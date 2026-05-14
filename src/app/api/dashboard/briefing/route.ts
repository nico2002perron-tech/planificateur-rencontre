import { NextResponse } from 'next/server';
import { getSectorPerformance } from '@/lib/fmp/client';

let cache: { data: unknown; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000;

const FETCH_TIMEOUT = 6000;
const NEWS_FEEDS = [
  // Francais (Quebec / Canada)
  { url: 'https://ici.radio-canada.ca/rss/4159', lang: 'fr' },            // Radio-Canada Economie
  { url: 'https://ici.radio-canada.ca/rss/4169', lang: 'fr' },            // Radio-Canada Science/Tech
  { url: 'https://ici.radio-canada.ca/rss/4175', lang: 'fr' },            // Radio-Canada Sante
  { url: 'https://www.lapresse.ca/affaires/rss', lang: 'fr' },
  { url: 'https://www.lapresse.ca/affaires/economie/rss', lang: 'fr' },
  { url: 'https://www.lesaffaires.com/rss', lang: 'fr' },
  { url: 'https://www.ledevoir.com/rss/section/economie.xml', lang: 'fr' },
  // Francais (France)
  { url: 'https://services.lesechos.fr/rss/les-echos-finance-marches.xml', lang: 'fr' },
  // Anglais generaliste
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', lang: 'en' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', lang: 'en' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', lang: 'en' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', lang: 'en' },
  { url: 'https://finance.yahoo.com/news/rssindex', lang: 'en' },
  // Anglais specialises
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', lang: 'en' },
  { url: 'https://techcrunch.com/feed/', lang: 'en' },
  { url: 'https://oilprice.com/rss/main', lang: 'en' },
];

interface RawArticle {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  lang: string;
  source: string;
}

async function fetchURL(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 GFSF-Radar/2.0' },
      signal: controller.signal,
    });
    return await res.text();
  } finally { clearTimeout(timer); }
}

function parseRSS(xml: string, lang: string): Omit<RawArticle, 'source'>[] {
  const articles: Omit<RawArticle, 'source'>[] = [];
  const items = xml.split('<item>').slice(1);
  for (const itemFull of items.slice(0, 12)) {
    const item = itemFull.split('</item>')[0];
    const title =
      (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>/) || [])[1] ||
      (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    const desc =
      (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/) || [])[1] ||
      (item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
    const cleanTitle = title.replace(/<[^>]+>/g, '').trim();
    if (cleanTitle && cleanTitle.length > 10) {
      articles.push({ title: cleanTitle, link: link.trim(), pubDate: pubDate.trim(), description: desc.replace(/<[^>]+>/g, '').substring(0, 300).trim(), lang });
    }
  }
  return articles;
}

function getSourceName(link: string): string {
  if (link.includes('radio-canada')) return 'Radio-Canada';
  if (link.includes('lapresse')) return 'La Presse';
  if (link.includes('lesaffaires')) return 'Les Affaires';
  if (link.includes('ledevoir')) return 'Le Devoir';
  if (link.includes('lesechos.fr')) return 'Les Echos';
  if (link.includes('cnbc.com')) return 'CNBC';
  if (link.includes('marketwatch.com')) return 'MarketWatch';
  if (link.includes('bbc.co') || link.includes('bbci.co')) return 'BBC';
  if (link.includes('yahoo.com')) return 'Yahoo Finance';
  if (link.includes('coindesk.com')) return 'CoinDesk';
  if (link.includes('techcrunch.com')) return 'TechCrunch';
  if (link.includes('oilprice.com')) return 'OilPrice';
  if (link.includes('bloomberg.com')) return 'Bloomberg';
  if (link.includes('reuters.com')) return 'Reuters';
  return 'Actualites';
}

function getTimeAgo(pubDate: string): string {
  if (!pubDate) return '';
  try {
    const diffMins = Math.floor((Date.now() - new Date(pubDate).getTime()) / 60000);
    if (diffMins < 0) return '1 min';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}j`;
  } catch { return ''; }
}

// -- Groq: market thesis --

interface MarketThesis {
  sentiment: 'haussier' | 'baissier' | 'mixte';
  thesis: string;
  drivers: { articleIndex: number; titleFr: string; impact: 'positif' | 'negatif' | 'neutre'; why: string; sector: string }[];
}

async function buildMarketThesis(articles: RawArticle[], sectorSummary: string): Promise<MarketThesis | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const headlineList = articles.slice(0, 25).map((a, i) =>
    `${i + 1}. [${a.source}] [${a.lang.toUpperCase()}] "${a.title}" — ${a.description.substring(0, 150)}`
  ).join('\n');

  const prompt = `Tu es le stratege en chef d'une firme de gestion de patrimoine au Quebec. Ton role: expliquer clairement a des conseillers financiers POURQUOI les marches bougent aujourd'hui.

MANCHETTES DU JOUR:
${headlineList}

PERFORMANCE SECTORIELLE: ${sectorSummary || 'Non disponible'}

Reponds en JSON strict:

{
  "sentiment": "haussier" ou "baissier" ou "mixte",
  "thesis": "3-4 phrases PERCUTANTES en francais qui expliquent la tendance des marches aujourd'hui. Sois DIRECT et CONCRET. Commence par le fait le plus important. Mentionne les chiffres et donnees cles. Exemple: 'La Fed a maintenu ses taux a 5.25%, rassurant les investisseurs. L'inflation americaine recule a 3.2%, son plus bas niveau en 2 ans. Les marches reagissent positivement, menes par la tech (+2.1%) et les financieres.' NE JAMAIS inventer de chiffres — utilise UNIQUEMENT ce qui est dans les manchettes.",
  "drivers": [
    {
      "articleIndex": 1,
      "titleFr": "Titre traduit en francais clair et percutant si anglais, sinon titre original",
      "impact": "positif" ou "negatif" ou "neutre",
      "why": "1-2 phrases: quel est l'impact concret sur les marches et les portefeuilles? Sois specifique.",
      "sector": "finance" ou "tech" ou "energy" ou "health" ou "industrial" ou "crypto" ou "defensive" ou "macro"
    }
  ]
}

REGLES CRITIQUES:
- "drivers": les 5-6 nouvelles les PLUS IMPORTANTES pour les marches. Priorise: banques centrales > donnees economiques > geopolitique > grandes tendances sectorielles.
- "articleIndex": DOIT correspondre au numero exact de la manchette (1, 2, 3...).
- "titleFr": si [EN], TRADUIS completement en francais. Si [FR], recopie tel quel. AUCUN mot anglais sauf noms propres.
- "thesis": base-toi UNIQUEMENT sur les manchettes fournies. Aucune invention.
- "why": explique l'impact reel sur les marches/portefeuilles, pas juste un resume de l'article.
- "sector": le secteur principal touche par cette nouvelle.
- Ordonne les drivers du PLUS important au MOINS important.

Reponds UNIQUEMENT avec le JSON.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.15, max_tokens: 3000 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.thesis || !Array.isArray(parsed.drivers)) return null;
    return {
      sentiment: ['haussier', 'baissier', 'mixte'].includes(parsed.sentiment) ? parsed.sentiment : 'mixte',
      thesis: parsed.thesis,
      drivers: parsed.drivers.slice(0, 6).map((d: { articleIndex?: number; titleFr?: string; impact?: string; why?: string; sector?: string }) => ({
        articleIndex: typeof d.articleIndex === 'number' ? d.articleIndex : 0,
        titleFr: d.titleFr || '',
        impact: ['positif', 'negatif', 'neutre'].includes(d.impact || '') ? d.impact : 'neutre',
        why: d.why || '',
        sector: d.sector || 'macro',
      })),
    };
  } catch { return null; }
}

// -- Main --

export async function GET() {
  try {
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // 1. Fetch real articles
    const feedResults = await Promise.all(
      NEWS_FEEDS.map((feed) =>
        fetchURL(feed.url)
          .then((xml) => ({ xml, lang: feed.lang, url: feed.url }))
          .catch(() => ({ xml: '', lang: feed.lang, url: feed.url }))
      )
    );

    let allArticles: RawArticle[] = [];
    for (const { xml, lang, url } of feedResults) {
      if (!xml) continue;
      const parsed = parseRSS(xml, lang);
      for (const a of parsed) {
        allArticles.push({ ...a, source: getSourceName(a.link || url) });
      }
    }

    const maxAge = 48 * 60 * 60 * 1000;
    allArticles = allArticles.filter((a) => {
      try { return Date.now() - new Date(a.pubDate).getTime() <= maxAge; } catch { return true; }
    });
    allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    const seen = new Set<string>();
    allArticles = allArticles.filter((a) => {
      const k = a.title.toLowerCase().substring(0, 50);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // 2. Fetch real sector data
    let sectorData: { sector?: string; changesPercentage?: number | string }[] = [];
    try {
      sectorData = await getSectorPerformance() as typeof sectorData;
    } catch { /* ok */ }

    const sectorSummary = (Array.isArray(sectorData) ? sectorData : [])
      .map((s) => `${s.sector}: ${s.changesPercentage}%`)
      .join(', ');

    // 3. Build all articles list with metadata
    const articlesWithMeta = allArticles.slice(0, 25).map((a, i) => ({
      index: i + 1,
      title: a.title,
      source: a.source,
      link: a.link,
      time: getTimeAgo(a.pubDate),
      lang: a.lang,
      description: a.description.substring(0, 200),
    }));

    // 4. AI market thesis
    const marketThesis = await buildMarketThesis(allArticles, sectorSummary);

    // 5. Enrich drivers with real article links
    const drivers = (marketThesis?.drivers ?? []).map(d => {
      const article = articlesWithMeta.find(a => a.index === d.articleIndex);
      return {
        titleFr: d.titleFr,
        impact: d.impact,
        why: d.why,
        source: article?.source || '',
        link: article?.link || '',
        time: article?.time || '',
        sector: d.sector || 'macro',
      };
    }).filter(d => d.link);

    const result = {
      sentiment: marketThesis?.sentiment || null,
      thesis: marketThesis?.thesis || null,
      drivers,
      topStories: articlesWithMeta.slice(0, 10),
      articleCount: allArticles.length,
      feedCount: NEWS_FEEDS.length,
      generatedAt: new Date().toISOString(),
    };

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Briefing API error:', error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({
      sentiment: null,
      thesis: null,
      drivers: [],
      topStories: [],
      articleCount: 0,
      feedCount: 0,
      generatedAt: new Date().toISOString(),
    });
  }
}

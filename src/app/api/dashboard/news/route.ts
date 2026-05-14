import { NextResponse } from 'next/server';

// ── Config ──
const ALL_FEEDS = [
  { url: 'https://ici.radio-canada.ca/rss/4159', lang: 'fr' },
  { url: 'https://www.lapresse.ca/affaires/rss', lang: 'fr' },
  { url: 'https://www.lapresse.ca/affaires/economie/rss', lang: 'fr' },
  { url: 'https://www.lesaffaires.com/rss', lang: 'fr' },
  { url: 'https://www.ledevoir.com/rss/section/economie.xml', lang: 'fr' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', lang: 'en' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', lang: 'en' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', lang: 'en' },
  { url: 'https://finance.yahoo.com/news/rssindex', lang: 'en' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', lang: 'en' },
  { url: 'https://techcrunch.com/feed/', lang: 'en' },
  { url: 'https://oilprice.com/rss/main', lang: 'en' },
];

const SECTORS = ['health', 'tech', 'crypto', 'industrial', 'energy', 'finance', 'defensive'] as const;
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_ARTICLES = 40;
const FETCH_TIMEOUT = 6000;

let cache: { data: unknown; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 60 min

// ── Fetch URL ──
async function fetchURL(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 GFSF-Radar/2.0' },
      signal: controller.signal,
    });
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Parse RSS ──
interface RawArticle {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  lang: string;
}

function parseRSS(xml: string, lang: string): RawArticle[] {
  const articles: RawArticle[] = [];
  const items = xml.split('<item>').slice(1);
  for (const itemFull of items.slice(0, 15)) {
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
      articles.push({ title: cleanTitle, link: link.trim(), pubDate: pubDate.trim(), description: desc.replace(/<[^>]+>/g, '').substring(0, 400).trim(), lang });
    }
  }
  return articles;
}

function getTimeAgo(pubDate: string): string {
  if (!pubDate) return '??';
  try {
    const diffMins = Math.floor((Date.now() - new Date(pubDate).getTime()) / 60000);
    if (diffMins < 0) return '1min';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}j`;
  } catch { return '??'; }
}

function getSourceName(link: string): string {
  if (!link) return 'Actualités';
  if (link.includes('radio-canada')) return 'Radio-Canada';
  if (link.includes('lapresse')) return 'La Presse';
  if (link.includes('lesaffaires')) return 'Les Affaires';
  if (link.includes('ledevoir')) return 'Le Devoir';
  if (link.includes('cnbc.com')) return 'CNBC';
  if (link.includes('marketwatch.com')) return 'MarketWatch';
  if (link.includes('bbc.co') || link.includes('bbci.co')) return 'BBC';
  if (link.includes('yahoo.com')) return 'Yahoo Finance';
  if (link.includes('coindesk.com')) return 'CoinDesk';
  if (link.includes('techcrunch.com')) return 'TechCrunch';
  if (link.includes('oilprice.com')) return 'OilPrice';
  return 'Actualités';
}

function looksEnglish(text: string): boolean {
  if (!text) return false;
  const lower = ' ' + text.toLowerCase().replace(/[^\p{L}\s']/gu, ' ') + ' ';
  const markers = [' the ', ' and ', ' for ', ' with ', ' from ', ' after ', ' amid ', ' over ', ' into ', ' about ', ' rises ', ' falls ', ' stocks ', ' market ', ' could ', ' would ', ' says ', ' said '];
  let hits = 0;
  for (const m of markers) { if (lower.includes(m)) hits++; if (hits >= 2) return true; }
  return false;
}

// ── Keyword fallback classification (when Groq is unavailable) ──
function classifyByKeywords(title: string, description: string): string[] {
  const text = (title + ' ' + description).toLowerCase();
  const sectors: string[] = [];
  if (/banqu|financ|taux|int[eé]r[eê]t|bourse|cr[eé]dit|bank|rate|fed |bce|inflation|devise|dollar|monétaire|obligat/.test(text)) sectors.push('finance');
  if (/tech|ia |ai |intel|apple|google|microsoft|robot|cyber|num[eé]rique|openai|startup|logiciel|software/.test(text)) sectors.push('tech');
  if (/bitcoin|crypto|blockchain|ethereum|btc|nft|token|defi|stablecoin/.test(text)) sectors.push('crypto');
  if (/p[eé]trol|oil|gaz |énergi|pipeline|opep|opec|renouvel|solaire|éolien|carbone/.test(text)) sectors.push('energy');
  if (/sant[eé]|pharma|m[eé]dic|vaccin|health|drug|hospital|biotech/.test(text)) sectors.push('health');
  if (/industri|manufactur|usine|construc|immobili|real estate|transport|logisti|a[eé]ro/.test(text)) sectors.push('industrial');
  if (/aliment|grocer|walmart|costco|consomm|retail|agricol|d[eé]fensif/.test(text)) sectors.push('defensive');
  return sectors.slice(0, 2);
}

// ── Groq classification ──
async function classifyArticles(articles: RawArticle[]) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const list = articles.map((a, i) => `${i + 1}. [${a.lang.toUpperCase()}] "${a.title}" — ${a.description.substring(0, 180)}`).join('\n');

  const prompt = `Tu es un éditeur de salle de nouvelles financières au Québec. Analyse ces articles et retourne les résultats en JSON.

POUR CHAQUE ARTICLE:
- "index": numéro de l'article
- "sectors": 0 à 2 secteurs parmi: health, tech, crypto, industrial, energy, finance, defensive. [] si hors sujet.
- "titleFr": OBLIGATOIRE. Titre traduit en français clair et naturel. Pour [EN] → traduis complètement. Pour [FR] → recopie tel quel. Le titre doit être accrocheur et informatif (style journal québécois).
- "summary": résumé de 1-2 phrases EN FRANÇAIS. Explique pourquoi c'est important.
- "impact": 1 à 5 (importance pour les marchés/investisseurs)

RÈGLES DE CLASSIFICATION:
- Impact 4-5: banques centrales, crises, données économiques majeures (PIB, emploi, inflation), guerres commerciales, régulations majeures
- Impact 2-3: mouvements sectoriels, fusions/acquisitions, politiques gouvernementales, tendances marché
- Impact 1: nouvelles individuelles d'entreprises, lancements de produits
- Attribue au moins 1 secteur à chaque article pertinent

Articles :
${list}

Réponds UNIQUEMENT avec un tableau JSON valide.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 6000 }),
      signal: AbortSignal.timeout(35000),
    });
    const data = await res.json();
    if (data.error) return null;
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch { return null; }
}

// ── Build ──
async function buildNews() {
  const feedResults = await Promise.all(
    ALL_FEEDS.map((feed) => fetchURL(feed.url).then((xml) => ({ xml, lang: feed.lang })).catch(() => ({ xml: '', lang: feed.lang })))
  );

  let allArticles: RawArticle[] = [];
  feedResults.forEach(({ xml, lang }) => { if (xml) allArticles = allArticles.concat(parseRSS(xml, lang)); });
  allArticles = allArticles.filter((a) => { try { return Date.now() - new Date(a.pubDate).getTime() <= MAX_AGE_MS; } catch { return true; } });
  allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // Dedup
  const seen = new Set<string>();
  allArticles = allArticles.filter((a) => { const k = a.title.toLowerCase().substring(0, 50); if (seen.has(k)) return false; seen.add(k); return true; });
  allArticles = allArticles.slice(0, MAX_ARTICLES);

  if (allArticles.length === 0) return { articles: [], ticker: [] };

  const aiResults = await classifyArticles(allArticles);
  const isValidAI = Array.isArray(aiResults);

  interface EnrichedArticle {
    title: string;
    summary: string;
    source: string;
    time: string;
    link: string;
    pubDate: string;
    sectors: string[];
    impact: number;
    isFrench: boolean;
    isNew: boolean;
  }

  const enriched: EnrichedArticle[] = allArticles.map((article, idx) => {
    const aiItem = isValidAI ? aiResults.find((r: { index?: number }) => (r.index ?? 0) - 1 === idx) : null;
    const timeAgo = getTimeAgo(article.pubDate);
    let sectors: string[] = [];
    let impact = 3;
    let finalTitle = article.title;
    let summary = article.description;

    if (aiItem) {
      sectors = (Array.isArray(aiItem.sectors) ? aiItem.sectors : []).filter((s: string) => (SECTORS as readonly string[]).includes(s)).slice(0, 2);
      impact = Math.min(5, Math.max(1, parseInt(aiItem.impact, 10) || 3));
      if (aiItem.titleFr) finalTitle = aiItem.titleFr;
      if (aiItem.summary) summary = aiItem.summary;
    }

    // Keyword fallback when AI didn't classify or is unavailable
    if (sectors.length === 0) {
      sectors = classifyByKeywords(article.title, article.description);
    }

    const isFrench = article.lang === 'fr' || (!!aiItem?.titleFr && !looksEnglish(finalTitle));

    // If still in English and no AI translation, tag it
    if (!isFrench && looksEnglish(finalTitle)) {
      finalTitle = `🇬🇧 ${finalTitle}`;
    }

    return {
      title: finalTitle,
      summary,
      source: getSourceName(article.link),
      time: timeAgo,
      link: article.link,
      pubDate: article.pubDate,
      sectors,
      impact,
      isFrench,
      isNew: timeAgo.includes('min') || (timeAgo.includes('h') && parseInt(timeAgo) < 3),
    };
  });

  // Build sector map
  const classified: Record<string, EnrichedArticle[]> = {};
  for (const sec of SECTORS) {
    classified[sec] = enriched.filter((a) => a.sectors.includes(sec)).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).slice(0, 6);
  }
  // "all" shows all articles sorted by recency, regardless of sector
  classified.all = enriched.slice(0, 12);

  // Ticker
  const tickerArticles = enriched.filter((a) => a.isFrench || a.sectors.length > 0);
  const ticker = tickerArticles
    .sort((a, b) => (b.impact - a.impact) || (new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()))
    .slice(0, 15)
    .map((a) => ({ title: a.title, link: a.link, source: a.source, sector: a.sectors[0] || 'all', time: a.time }));

  return { articles: classified, ticker, generatedAt: new Date().toISOString() };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const result = await buildNews();
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Dashboard news error:', error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ articles: {}, ticker: [] });
  }
}

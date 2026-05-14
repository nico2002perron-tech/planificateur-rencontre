import { NextResponse } from 'next/server';
import { getSectorPerformance } from '@/lib/fmp/client';

let cache: { data: unknown; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const FETCH_TIMEOUT = 6000;
const NEWS_FEEDS = [
  { url: 'https://ici.radio-canada.ca/rss/4159', lang: 'fr' },
  { url: 'https://www.lapresse.ca/affaires/rss', lang: 'fr' },
  { url: 'https://www.lapresse.ca/affaires/economie/rss', lang: 'fr' },
  { url: 'https://www.lesaffaires.com/rss', lang: 'fr' },
  { url: 'https://www.ledevoir.com/rss/section/economie.xml', lang: 'fr' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', lang: 'en' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', lang: 'en' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', lang: 'en' },
];

interface RawArticle {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  lang: string;
  source: string;
}

// ── Fetch + Parse (lightweight, shared with news route logic) ──

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
  for (const itemFull of items.slice(0, 10)) {
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
  if (link.includes('cnbc.com')) return 'CNBC';
  if (link.includes('marketwatch.com')) return 'MarketWatch';
  if (link.includes('bbc.co') || link.includes('bbci.co')) return 'BBC';
  return 'Actualités';
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

// ── Groq synthesis ──

async function synthesizeWithGroq(articles: RawArticle[], sectorSummary: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const headlineList = articles.slice(0, 15).map((a, i) =>
    `${i + 1}. [${a.source}] "${a.title}" — ${a.description.substring(0, 150)}`
  ).join('\n');

  const prompt = `Tu es un analyste financier senior au Québec. Voici les vraies manchettes du jour et les données de marché. Rédige une SYNTHÈSE de 3-4 paragraphes courts basée UNIQUEMENT sur ces informations réelles. Ne fabrique aucune donnée.

MANCHETTES DU JOUR:
${headlineList}

PERFORMANCE SECTORIELLE: ${sectorSummary || 'Non disponible'}

INSTRUCTIONS:
- Base-toi UNIQUEMENT sur les manchettes ci-dessus. Ne mentionne rien qui n'y figure pas.
- Identifie les 2-3 thèmes dominants de la journée
- Explique brièvement l'impact potentiel pour les investisseurs canadiens
- Ton: professionnel, concis, factuel
- 3-4 paragraphes courts, en français

Réponds avec le texte seulement, pas de JSON.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1500 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// ── Main ──

export async function GET() {
  try {
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // 1. Fetch real articles from RSS feeds
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
        const source = getSourceName(a.link || url);
        allArticles.push({ ...a, source });
      }
    }

    // Filter last 48h, dedup, sort by date
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

    // 3. Pick top stories (REAL articles)
    const topStories = allArticles.slice(0, 5).map((a) => ({
      title: a.title,
      source: a.source,
      link: a.link,
      time: getTimeAgo(a.pubDate),
      lang: a.lang,
      description: a.description.substring(0, 200),
    }));

    // 4. AI synthesis based on real headlines
    const synthesis = await synthesizeWithGroq(allArticles, sectorSummary);

    const result = {
      topStories,
      synthesis: synthesis || null,
      sectorSummary: (Array.isArray(sectorData) ? sectorData : []).slice(0, 6).map(s => ({
        sector: s.sector || '',
        change: s.changesPercentage || 0,
      })),
      articleCount: allArticles.length,
      generatedAt: new Date().toISOString(),
    };

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Briefing API error:', error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({
      topStories: [],
      synthesis: null,
      sectorSummary: [],
      articleCount: 0,
      generatedAt: new Date().toISOString(),
    });
  }
}

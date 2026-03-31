import { NextRequest, NextResponse } from 'next/server';
import { getYahooNews } from '@/lib/yahoo/client';
import type { SymbolNews, NewsResponse } from '@/lib/yahoo/types';

const EARNINGS_KEYWORDS = [
  'earnings', 'eps', 'quarterly results', 'revenue beat', 'revenue miss',
  'profit report', 'quarterly report', 'fiscal quarter', 'beat estimates',
  'missed estimates', 'earnings call', 'earnings release', 'reports q',
  'q1 results', 'q2 results', 'q3 results', 'q4 results',
  'annual results', 'financial results', 'income surges', 'income drops',
];

function isEarningsNews(title: string): boolean {
  const lower = title.toLowerCase();
  return EARNINGS_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) {
    return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30); // limit to 30 symbols max

  // Fetch news for all symbols in parallel (batched by 6)
  const BATCH = 6;
  const newsMap: Record<string, SymbolNews> = {};

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const articles = await getYahooNews(symbol, 8);

          // Only keep articles from the last 72 hours
          const cutoff = new Date();
          cutoff.setHours(cutoff.getHours() - 72);

          const recent = articles.filter((a) => {
            if (!a.publishedAt) return false;
            return new Date(a.publishedAt) > cutoff;
          });

          const hasEarnings = recent.some((a) => isEarningsNews(a.title));

          return {
            symbol,
            articles: recent,
            hasEarnings,
            hasNews: recent.length > 0,
          } satisfies SymbolNews;
        } catch {
          return { symbol, articles: [], hasEarnings: false, hasNews: false } satisfies SymbolNews;
        }
      })
    );

    for (const r of results) {
      newsMap[r.symbol] = r;
    }
  }

  return NextResponse.json({ news: newsMap } satisfies NewsResponse);
}

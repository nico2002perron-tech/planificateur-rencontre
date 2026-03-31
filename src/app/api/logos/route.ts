import { NextRequest, NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Convert portfolio symbol to TradingView search query */
function toSearchQuery(symbol: string): { query: string; exchange?: string } {
  if (symbol.endsWith('.TO')) return { query: symbol.replace('.TO', ''), exchange: 'TSX' };
  if (symbol.endsWith('.V')) return { query: symbol.replace('.V', ''), exchange: 'TSXV' };
  if (symbol.endsWith('.NE')) return { query: symbol.replace('.NE', ''), exchange: 'NEO' };
  return { query: symbol };
}

async function fetchLogo(symbol: string): Promise<string | null> {
  try {
    const { query, exchange } = toSearchQuery(symbol);
    const url = new URL('https://symbol-search.tradingview.com/symbol_search/v3/');
    url.searchParams.set('text', query);
    url.searchParams.set('hl', '0');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('domain', 'production');
    if (exchange) url.searchParams.set('exchange', exchange);

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': UA,
        Origin: 'https://www.tradingview.com',
        Referer: 'https://www.tradingview.com/',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const first = data?.symbols?.[0];
    if (!first) return null;

    const logoid = first.logoid || first.logo?.logoid || '';
    return logoid ? `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg` : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) {
    return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);

  // Fetch logos in parallel, batched by 6
  const BATCH = 6;
  const logos: Record<string, string | null> = {};

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((s) => fetchLogo(s)));
    batch.forEach((s, j) => {
      logos[s] = results[j];
    });
  }

  return NextResponse.json(
    { logos },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200' } }
  );
}

import { NextRequest, NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Exchanges we care about — prioritize CA then US
const RELEVANT_EXCHANGES = new Set([
  'TSX', 'TSXV', 'NEO',
  'NYSE', 'NASDAQ', 'AMEX', 'NYSE Arca',
]);

// Map TradingView exchange → ticker suffix
function buildTicker(symbol: string, exchange: string): string {
  if (exchange === 'TSX') return `${symbol}.TO`;
  if (exchange === 'TSXV') return `${symbol}.V`;
  if (exchange === 'NEO') return `${symbol}.NE`;
  return symbol; // NYSE, NASDAQ, AMEX — no suffix
}

interface TVSymbol {
  symbol: string;
  description: string;
  exchange: string;
  type: string;
  country: string;
  currency_code: string;
  logoid?: string;
  logo?: { logoid?: string };
  typespecs?: string[];
}

export async function GET(request: NextRequest) {
  let query = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (query.length < 1) {
    return NextResponse.json([]);
  }

  // Strip Canadian suffixes — TradingView doesn't understand ".TO" in search
  let forceExchange: string | null = null;
  if (/\.TO$/i.test(query)) { query = query.replace(/\.TO$/i, ''); forceExchange = 'TSX'; }
  else if (/\.V$/i.test(query)) { query = query.replace(/\.V$/i, ''); forceExchange = 'TSXV'; }
  else if (/\.NE$/i.test(query)) { query = query.replace(/\.NE$/i, ''); forceExchange = 'NEO'; }
  else if (/\.CN$/i.test(query)) { query = query.replace(/\.CN$/i, ''); forceExchange = 'NEO'; }

  try {
    const url = new URL('https://symbol-search.tradingview.com/symbol_search/v3/');
    url.searchParams.set('text', query);
    url.searchParams.set('hl', '0');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('domain', 'production');
    url.searchParams.set('sort_by_country', 'CA');
    // If user typed .TO / .V / .NE, filter to that exchange
    if (forceExchange) url.searchParams.set('exchange', forceExchange);

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': UA,
        'Origin': 'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/',
      },
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = await res.json();
    const symbols: TVSymbol[] = data?.symbols || [];

    // Filter to relevant exchanges & types (stocks + funds/ETFs)
    const validTypes = new Set(['stock', 'fund', 'dr']);
    const seen = new Set<string>();
    const results = [];

    for (const s of symbols) {
      if (!RELEVANT_EXCHANGES.has(s.exchange)) continue;
      if (!validTypes.has(s.type)) continue;

      const ticker = buildTicker(s.symbol, s.exchange);
      if (seen.has(ticker)) continue;
      seen.add(ticker);

      const logoId = s.logoid || s.logo?.logoid || '';

      // REITs / income trusts (.UN, .UN.TO) are classified as 'fund' by
      // TradingView but should be treated as stocks (real estate / equity)
      const isReit = /\.UN(\.TO|\.V)?$/i.test(ticker) || /\.UN$/i.test(s.symbol);
      let resolvedType: string;
      if (isReit) {
        resolvedType = 'Stock';
      } else if (s.type === 'fund') {
        resolvedType = 'ETF';
      } else if (s.type === 'dr') {
        resolvedType = 'ADR';
      } else {
        resolvedType = 'Stock';
      }

      results.push({
        symbol: ticker,
        name: s.description,
        exchange: s.exchange,
        type: resolvedType,
        country: s.country || '',
        currency: s.currency_code || '',
        logo: logoId ? `https://s3-symbol-logo.tradingview.com/${logoId}--big.svg` : null,
      });

      if (results.length >= 12) break;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('TradingView search error:', error);
    return NextResponse.json([]);
  }
}

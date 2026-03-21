import { NextRequest, NextResponse } from 'next/server';
import { yahooFetch } from '@/lib/yahoo/client';

/**
 * Try fetching price for a single Yahoo symbol.
 * Returns the price data or null if not found.
 */
async function tryFetchPrice(sym: string): Promise<{ price: number; currency: string; name: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=price`;
    const res = await yahooFetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const price = json?.quoteSummary?.result?.[0]?.price;
    if (!price) return null;

    const currentPrice = price.regularMarketPrice?.raw ?? 0;
    if (currentPrice <= 0) return null;

    return {
      price: Math.round(currentPrice * 100) / 100,
      currency: price.currency ?? '',
      name: price.shortName ?? price.longName ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/prices?symbols=AAPL,ENB,XBB.TO
 * Returns current prices from Yahoo Finance.
 * For symbols without exchange suffix, tries as-is first then with .TO.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('symbols')?.trim();
  if (!raw) return NextResponse.json([]);

  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
  if (symbols.length === 0) return NextResponse.json([]);

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const empty = { symbol, price: 0, currency: '', name: '' };

        // If symbol already has exchange suffix, try directly
        if (/\.(TO|V|CN|NE)$/.test(symbol)) {
          const data = await tryFetchPrice(symbol);
          return data ? { symbol, ...data } : empty;
        }

        // Try as-is first (US stocks: AAPL, MSFT)
        const asIs = await tryFetchPrice(symbol);
        if (asIs) return { symbol, ...asIs };

        // Try with .TO (Canadian stocks: ENB → ENB.TO)
        const withTO = await tryFetchPrice(`${symbol}.TO`);
        if (withTO) return { symbol, ...withTO };

        // Try with .NE (CDRs on NEO: META → META.NE)
        const withNE = await tryFetchPrice(`${symbol}.NE`);
        if (withNE) return { symbol, ...withNE };

        return empty;
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Prices fetch error:', error);
    return NextResponse.json([]);
  }
}

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
 * GET /api/prices?symbols=AAPL,ENB.TO,XBB.TO
 * Returns current prices from Yahoo Finance.
 * Symbols arrive pre-formatted from the parser (CAD already have .TO, USD have no suffix).
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
        const data = await tryFetchPrice(symbol);
        return data ? { symbol, ...data } : empty;
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Prices fetch error:', error);
    return NextResponse.json([]);
  }
}

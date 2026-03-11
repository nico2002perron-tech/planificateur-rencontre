import { NextRequest, NextResponse } from 'next/server';
import { yahooFetch } from '@/lib/yahoo/client';

/**
 * GET /api/prices?symbols=AAPL,RY.TO,XBB.TO
 * Returns current prices from Yahoo Finance for a list of symbols.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('symbols')?.trim();
  if (!raw) return NextResponse.json([]);

  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
  if (symbols.length === 0) return NextResponse.json([]);

  try {
    // Yahoo Finance quoteSummary for each symbol in parallel (batched)
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // Map .TO → .TO (Yahoo uses same format)
          const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price`;
          const res = await yahooFetch(url);
          if (!res.ok) return { symbol, price: 0, currency: '', name: '' };

          const json = await res.json();
          const price = json?.quoteSummary?.result?.[0]?.price;
          if (!price) return { symbol, price: 0, currency: '', name: '' };

          const currentPrice = price.regularMarketPrice?.raw ?? 0;
          const curr = price.currency ?? '';
          const shortName = price.shortName ?? price.longName ?? '';

          return {
            symbol,
            price: Math.round(currentPrice * 100) / 100,
            currency: curr,
            name: shortName,
          };
        } catch {
          return { symbol, price: 0, currency: '', name: '' };
        }
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Prices fetch error:', error);
    return NextResponse.json([]);
  }
}

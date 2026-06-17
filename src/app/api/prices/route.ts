import { NextRequest, NextResponse } from 'next/server';
import { yahooFetch, toYahooSymbol, getYahooDividend } from '@/lib/yahoo/client';

interface PriceData {
  price: number;
  currency: string;
  name: string;
  dividendRate?: number;   // Forward annual dividend per share (summaryDetail.dividendRate)
  dividendYield?: number;  // Forward dividend yield (decimal, e.g. 0.025 = 2.5%)
}

/**
 * Fetch price + summaryDetail (which contains forward dividend data).
 * Returns null if Yahoo has no price for this symbol.
 */
async function tryFetchPrice(sym: string): Promise<PriceData | null> {
  try {
    const ySym = toYahooSymbol(sym);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=price,summaryDetail`;
    const res = await yahooFetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const price = result.price ?? {};
    const sd = result.summaryDetail ?? {};

    const currentPrice = price.regularMarketPrice?.raw ?? 0;
    if (currentPrice <= 0) return null;

    const rawPos = (obj: unknown): number | undefined => {
      if (obj && typeof obj === 'object' && 'raw' in obj) {
        const v = Number((obj as { raw: number }).raw);
        return isFinite(v) && v > 0 ? v : undefined;
      }
      return undefined;
    };

    return {
      price: Math.round(currentPrice * 100) / 100,
      currency: price.currency ?? '',
      name: price.shortName ?? price.longName ?? '',
      dividendRate: rawPos(sd.dividendRate),
      dividendYield: rawPos(sd.dividendYield),
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/prices?symbols=AAPL,ENB.TO,XBB.TO
 * Returns current prices + forward dividend data from Yahoo Finance.
 *
 * Reliability: Yahoo's `summaryDetail` module omits dividend data intermittently
 * (frequent for .TO tickers like ENB.TO, T.TO, BNS.TO). When the forward rate is
 * missing, we fall back to the chart dividend-events API (getYahooDividend), which
 * returns the trailing-12-month dividend in the symbol's native currency — no
 * USD→CAD conversion and no fragile US-base-ticker guessing (T.TO ≠ AT&T).
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
        if (!data) return empty;

        // summaryDetail a omis le dividende → repli fiable via l'API chart.
        if (!data.dividendRate || data.dividendRate <= 0) {
          const div = await getYahooDividend(symbol);
          if (div) {
            return {
              symbol,
              ...data,
              dividendRate: div.rate,
              dividendYield: div.yieldPct / 100, // décimal (0.0494 = 4,94 %)
            };
          }
        }

        return { symbol, ...data };
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Prices fetch error:', error);
    return NextResponse.json([]);
  }
}

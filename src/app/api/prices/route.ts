import { NextRequest, NextResponse } from 'next/server';
import { yahooFetch, toYahooSymbol, getUsdCadRate } from '@/lib/yahoo/client';

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
 * Reliability: for .TO symbols without dividend data on Yahoo (e.g. interlisted
 * tickers like MSFT.TO), falls back to the US base ticker and converts the
 * forward dividend rate from USD to CAD using a cached USD/CAD rate.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('symbols')?.trim();
  if (!raw) return NextResponse.json([]);

  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
  if (symbols.length === 0) return NextResponse.json([]);

  try {
    // Fetch USD/CAD rate once (shared across all fallbacks). Only needed if a
    // .TO symbol has missing dividend data. Fetched lazily.
    let cachedRate: number | null = null;
    const getRate = async () => {
      if (cachedRate !== null) return cachedRate;
      cachedRate = await getUsdCadRate();
      return cachedRate;
    };

    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const empty = { symbol, price: 0, currency: '', name: '' };
        const data = await tryFetchPrice(symbol);

        // Reliability fallback: .TO symbols often lack dividend data on Yahoo
        // (interlisted tickers, CDRs). Try the US base ticker and convert.
        if (symbol.endsWith('.TO') && data && (!data.dividendRate || data.dividendRate <= 0)) {
          const usTicker = symbol.replace('.TO', '');
          const usData = await tryFetchPrice(usTicker);
          if (usData && usData.dividendRate && usData.dividendRate > 0) {
            const rate = await getRate();
            return {
              symbol,
              ...data,
              dividendRate: Math.round(usData.dividendRate * rate * 10000) / 10000,
              // Yield is a ratio, currency-agnostic
              dividendYield: usData.dividendYield,
            };
          }
        }

        return data ? { symbol, ...data } : empty;
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Prices fetch error:', error);
    return NextResponse.json([]);
  }
}

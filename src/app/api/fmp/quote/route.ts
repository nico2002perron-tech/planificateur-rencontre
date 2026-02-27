import { NextRequest, NextResponse } from 'next/server';
import { getQuote, getQuotes } from '@/lib/fmp/client';
import { getCachedPrices, setCachedPrice } from '@/lib/fmp/cache';

export async function GET(request: NextRequest) {
  const symbols = request.nextUrl.searchParams.get('symbols');
  if (!symbols) {
    return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  const symbolList = symbols.split(',').map((s) => s.trim());

  try {
    // Check cache first
    const cached = await getCachedPrices(symbolList);
    const cachedSymbols = new Set(cached.map((c) => c.symbol));
    const uncached = symbolList.filter((s) => !cachedSymbols.has(s));

    let freshData: Record<string, unknown>[] = [];

    if (uncached.length > 0) {
      const quotes = uncached.length === 1
        ? [await getQuote(uncached[0])].filter(Boolean)
        : await getQuotes(uncached);

      // Cache the fresh data
      for (const q of quotes) {
        if (!q) continue;
        await setCachedPrice(q.symbol, {
          price: q.price,
          change_percent: q.changesPercentage,
          market_cap: q.marketCap,
          pe_ratio: q.pe,
          company_name: q.name,
          exchange: q.exchange,
          fifty_two_week_high: q.yearHigh,
          fifty_two_week_low: q.yearLow,
        });
        freshData.push({
          symbol: q.symbol,
          price: q.price,
          change_percent: q.changesPercentage,
          company_name: q.name,
          market_cap: q.marketCap,
          pe_ratio: q.pe,
          exchange: q.exchange,
        });
      }
    }

    const result = [
      ...cached.map((c) => ({
        symbol: c.symbol,
        price: c.price,
        change_percent: c.change_percent,
        company_name: c.company_name,
        market_cap: c.market_cap,
        pe_ratio: c.pe_ratio,
        exchange: c.exchange,
        cached: true,
      })),
      ...freshData,
    ];

    return NextResponse.json(result);
  } catch (error) {
    console.error('FMP quote error:', error);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

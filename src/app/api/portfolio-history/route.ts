import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalPrices } from '@/lib/fmp/client';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/portfolio-history
 * Body: { holdings: { symbol: string, weight: number }[], benchmarks?: string[], months?: number }
 * Returns normalised portfolio + benchmark values (base 100) for charting.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const holdings: { symbol: string; weight: number }[] = body.holdings || [];
    const benchmarks: string[] = body.benchmarks || ['^GSPTSE', '^GSPC', '^IXIC'];
    const months: number = body.months || 12;

    if (holdings.length === 0) {
      return NextResponse.json({ error: 'holdings required' }, { status: 400 });
    }

    const from = new Date();
    from.setMonth(from.getMonth() - months);
    const fromStr = from.toISOString().split('T')[0];

    const supabase = createClient();
    const allSymbols = [...holdings.map(h => h.symbol), ...benchmarks];

    // Fetch historical for every symbol (DB-cached)
    const histMap = new Map<string, { date: string; close: number }[]>();

    await Promise.all(
      allSymbols.map(async (symbol) => {
        // Check DB cache first
        const { data: cached } = await supabase
          .from('historical_prices')
          .select('date, close')
          .eq('symbol', symbol)
          .gte('date', fromStr)
          .order('date', { ascending: true });

        if (cached && cached.length > 20) {
          histMap.set(symbol, cached);
          return;
        }

        // Fetch from FMP and cache
        try {
          const data = await getHistoricalPrices(symbol, fromStr);
          if (data.length > 0) {
            const rows = data.map(h => ({
              symbol, date: h.date, open: h.open, high: h.high,
              low: h.low, close: h.close, volume: h.volume,
            }));
            await supabase.from('historical_prices').upsert(rows, { onConflict: 'symbol,date' });
            histMap.set(symbol, data.map(h => ({ date: h.date, close: h.close })).sort((a, b) => a.date.localeCompare(b.date)));
          }
        } catch {
          // Skip symbols that fail (delisted, etc.)
        }
      })
    );

    // Collect all unique dates (ascending)
    const dateSet = new Set<string>();
    for (const prices of histMap.values()) {
      for (const p of prices) dateSet.add(p.date);
    }
    const allDates = Array.from(dateSet).sort();
    if (allDates.length === 0) {
      return NextResponse.json({ dates: [], portfolio: [], benchmarks: {} });
    }

    // Build lookup: symbol → Map<date, close>
    const lookup = new Map<string, Map<string, number>>();
    for (const [sym, prices] of histMap) {
      const m = new Map<string, number>();
      for (const p of prices) m.set(p.date, p.close);
      lookup.set(sym, m);
    }

    // Forward-fill missing dates
    function getPrice(sym: string, date: string, prevPrice: number): number {
      return lookup.get(sym)?.get(date) ?? prevPrice;
    }

    // Calculate portfolio values (weighted daily)
    // Normalize: total weight → 100, each holding's share
    const totalWeight = holdings.reduce((s, h) => s + h.weight, 0) || 1;

    // First date baseline prices
    const basePrices = new Map<string, number>();
    for (const h of holdings) {
      for (const d of allDates) {
        const p = lookup.get(h.symbol)?.get(d);
        if (p) { basePrices.set(h.symbol, p); break; }
      }
    }
    for (const b of benchmarks) {
      for (const d of allDates) {
        const p = lookup.get(b)?.get(d);
        if (p) { basePrices.set(b, p); break; }
      }
    }

    const portfolioValues: number[] = [];
    const benchmarkValues: Record<string, number[]> = {};
    for (const b of benchmarks) benchmarkValues[b] = [];

    const prevPrices = new Map<string, number>();
    for (const [sym, bp] of basePrices) prevPrices.set(sym, bp);

    for (const date of allDates) {
      // Portfolio: weighted return from base
      let portfolioVal = 0;
      for (const h of holdings) {
        const base = basePrices.get(h.symbol);
        if (!base) continue;
        const cur = getPrice(h.symbol, date, prevPrices.get(h.symbol) || base);
        prevPrices.set(h.symbol, cur);
        portfolioVal += (h.weight / totalWeight) * (cur / base) * 100;
      }
      portfolioValues.push(Math.round(portfolioVal * 100) / 100);

      // Benchmarks
      for (const b of benchmarks) {
        const base = basePrices.get(b);
        if (!base) { benchmarkValues[b].push(100); continue; }
        const cur = getPrice(b, date, prevPrices.get(b) || base);
        prevPrices.set(b, cur);
        benchmarkValues[b].push(Math.round((cur / base) * 10000) / 100);
      }
    }

    return NextResponse.json({
      dates: allDates,
      portfolio: portfolioValues,
      benchmarks: benchmarkValues,
    });
  } catch (error) {
    console.error('Portfolio history error:', error);
    return NextResponse.json({ error: 'Failed to compute portfolio history' }, { status: 500 });
  }
}

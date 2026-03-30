import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQuotes } from '@/lib/fmp/client';
import { setCachedPrice, setCachedExchangeRate } from '@/lib/fmp/cache';
import { getExchangeRate } from '@/lib/fmp/client';
import { getYahooQuotes } from '@/lib/yahoo/client';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient();

    // Get all unique symbols from holdings
    const { data: holdings } = await supabase
      .from('holdings')
      .select('symbol');

    const symbols = [...new Set((holdings || []).map((h) => h.symbol))];

    if (symbols.length === 0) {
      return NextResponse.json({ message: 'No symbols to refresh', count: 0 });
    }

    // Batch fetch quotes (FMP supports comma-separated)
    const batchSize = 50;
    let refreshed = 0;

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const quotes = await getQuotes(batch);

      for (const q of quotes) {
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
        refreshed++;
      }
    }

    // Refresh exchange rates
    const usdCad = await getExchangeRate('USD', 'CAD');
    if (usdCad) {
      await setCachedExchangeRate('USD/CAD', usdCad);
      await setCachedExchangeRate('CAD/USD', 1 / usdCad);
    }

    // ── Simulation Snapshots ─────────────────────────────────────
    let simulationsSnapped = 0;
    try {
      const { data: activeSims } = await supabase
        .from('model_simulations')
        .select('*')
        .eq('status', 'active');

      if (activeSims && activeSims.length > 0) {
        const today = new Date().toISOString().split('T')[0];

        for (const sim of activeSims) {
          try {
            const simHoldings = sim.holdings_snapshot as { symbol: string; quantity: number; purchase_price: number }[];
            const simSymbols = simHoldings.map((h) => h.symbol);
            const benchSymbols = sim.benchmarks || ['^GSPTSE', '^GSPC'];

            // Fetch current prices via Yahoo
            const [stockQuotes, benchQuotes] = await Promise.all([
              getYahooQuotes(simSymbols),
              getYahooQuotes(benchSymbols),
            ]);

            const priceMap = new Map(stockQuotes.map((q) => [q.symbol, q.price]));

            // Calculate total value and build holdings detail
            let totalValue = 0;
            const holdingsDetail = simHoldings.map((h) => {
              const price = priceMap.get(h.symbol) || h.purchase_price;
              const marketValue = h.quantity * price;
              totalValue += marketValue;
              return {
                symbol: h.symbol,
                price,
                market_value: Math.round(marketValue * 100) / 100,
                daily_change_pct: h.purchase_price > 0 ? Math.round(((price - h.purchase_price) / h.purchase_price) * 10000) / 100 : 0,
              };
            });

            // Benchmark values
            const benchmarkValues: Record<string, number> = {};
            for (const bq of benchQuotes) {
              benchmarkValues[bq.symbol] = bq.price;
            }

            // Get previous snapshot for daily return calculation
            const { data: prevSnap } = await supabase
              .from('simulation_snapshots')
              .select('total_value')
              .eq('simulation_id', sim.id)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle();

            const prevValue = prevSnap?.total_value || sim.initial_value;
            const dailyReturn = prevValue > 0 ? (totalValue - prevValue) / prevValue : 0;

            // Upsert snapshot (avoid duplicates for same day)
            await supabase
              .from('simulation_snapshots')
              .upsert({
                simulation_id: sim.id,
                date: today,
                total_value: Math.round(totalValue * 100) / 100,
                daily_return: Math.round(dailyReturn * 1000000) / 1000000,
                holdings_detail: holdingsDetail,
                benchmark_values: benchmarkValues,
              }, { onConflict: 'simulation_id,date' });

            simulationsSnapped++;
          } catch (simErr) {
            console.error(`Snapshot error for sim ${sim.id}:`, simErr);
          }
        }
      }
    } catch (snapErr) {
      console.error('Simulation snapshot error:', snapErr);
    }

    return NextResponse.json({
      message: 'Prices refreshed',
      symbols_refreshed: refreshed,
      simulations_snapped: simulationsSnapped,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron refresh error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQuotes } from '@/lib/fmp/client';
import { setCachedPrice, setCachedExchangeRate } from '@/lib/fmp/cache';
import { getExchangeRate } from '@/lib/fmp/client';

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

    return NextResponse.json({
      message: 'Prices refreshed',
      symbols_refreshed: refreshed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron refresh error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}

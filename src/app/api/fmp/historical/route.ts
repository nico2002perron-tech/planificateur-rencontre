import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalPrices } from '@/lib/fmp/client';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const from = request.nextUrl.searchParams.get('from') || undefined;
  const to = request.nextUrl.searchParams.get('to') || undefined;

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    const supabase = createClient();

    // Check DB cache first
    let query = supabase
      .from('historical_prices')
      .select('date, close, open, high, low, volume')
      .eq('symbol', symbol)
      .order('date', { ascending: true });

    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data: cached } = await query;

    if (cached && cached.length > 30) {
      return NextResponse.json(cached);
    }

    // Fetch from FMP
    const historical = await getHistoricalPrices(symbol, from, to);

    // Store in DB
    if (historical.length > 0) {
      const rows = historical.map((h) => ({
        symbol,
        date: h.date,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume,
      }));

      await supabase.from('historical_prices').upsert(rows, { onConflict: 'symbol,date' });
    }

    return NextResponse.json(
      historical.map((h) => ({
        date: h.date,
        close: h.close,
        open: h.open,
        high: h.high,
        low: h.low,
        volume: h.volume,
      }))
    );
  } catch (error) {
    console.error('FMP historical error:', error);
    return NextResponse.json({ error: 'Failed to fetch historical data' }, { status: 500 });
  }
}

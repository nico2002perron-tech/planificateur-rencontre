import { NextResponse } from 'next/server';
import { getYieldCurve, getHistoricalYields, type BocSeriesKey } from '@/lib/api/bank-of-canada';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/yields — Fetch current yield curve (from cache or live)
 * GET /api/yields?history=CA_10Y&recent=30 — Historical yields for a series
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const history = searchParams.get('history') as BocSeriesKey | null;
  const recent = parseInt(searchParams.get('recent') || '30', 10);

  try {
    // Historical mode
    if (history) {
      const data = await getHistoricalYields(history, recent);
      return NextResponse.json({ series: history, data });
    }

    // Try cached data first (from government_yields table)
    const supabase = createClient();
    const { data: cached } = await supabase
      .from('government_yields')
      .select('*')
      .order('term_years', { ascending: true });

    if (cached && cached.length > 0) {
      const age = Date.now() - new Date(cached[0].fetched_at).getTime();
      // If cache is less than 6 hours old, use it
      if (age < 6 * 3600 * 1000) {
        const overnight = cached.find((r) => r.term === 'OVERNIGHT');
        const points = cached
          .filter((r) => r.term !== 'OVERNIGHT')
          .map((r) => ({
            term: r.term,
            years: r.term_years,
            yield: r.yield_pct,
          }));

        return NextResponse.json({
          source: 'cache',
          date: cached[0].observation_date,
          overnight: overnight?.yield_pct ?? null,
          points,
        });
      }
    }

    // Live fetch
    const curve = await getYieldCurve();
    if (!curve) {
      return NextResponse.json({ error: 'Failed to fetch yield curve' }, { status: 502 });
    }

    return NextResponse.json({
      source: 'live',
      date: curve.date,
      overnight: curve.overnight,
      points: curve.points,
    });
  } catch (error) {
    console.error('Yields API error:', error);
    return NextResponse.json({ error: 'Failed to fetch yields' }, { status: 500 });
  }
}

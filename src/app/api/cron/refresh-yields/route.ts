import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getYieldCurve, BOC_SERIES } from '@/lib/api/bank-of-canada';

/**
 * CRON: Refresh Bank of Canada government bond yields.
 * Run daily at market close (5 PM ET).
 * Stores in government_yields table for use in spread calculations.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const curve = await getYieldCurve();
    if (!curve) {
      return NextResponse.json({ error: 'Failed to fetch yield curve' }, { status: 502 });
    }

    const supabase = createClient();

    // Upsert each yield point
    const rows = [
      ...(curve.overnight !== null ? [{
        series: BOC_SERIES.OVERNIGHT,
        term: 'OVERNIGHT',
        term_years: 0,
        yield_pct: curve.overnight,
        observation_date: curve.date,
        fetched_at: new Date().toISOString(),
      }] : []),
      ...curve.points.map((p) => ({
        series: (() => {
          switch (p.term) {
            case '2Y': return BOC_SERIES.CA_2Y;
            case '5Y': return BOC_SERIES.CA_5Y;
            case '10Y': return BOC_SERIES.CA_10Y;
            case '30Y': return BOC_SERIES.CA_30Y;
            default: return p.term;
          }
        })(),
        term: p.term,
        term_years: p.years,
        yield_pct: p.yield,
        observation_date: curve.date,
        fetched_at: new Date().toISOString(),
      })),
    ];

    for (const row of rows) {
      await supabase
        .from('government_yields')
        .upsert(row, { onConflict: 'series' });
    }

    return NextResponse.json({
      message: 'Yields refreshed',
      date: curve.date,
      overnight: curve.overnight,
      points: curve.points.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron refresh-yields error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}

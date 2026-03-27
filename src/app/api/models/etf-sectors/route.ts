import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { getYahooETFSectors } from '@/lib/yahoo/client';

/**
 * Yahoo sector names → internal SECTORS constant values.
 */
const YAHOO_TO_INTERNAL: Record<string, string> = {
  'Technology':              'TECHNOLOGY',
  'Healthcare':              'HEALTHCARE',
  'Financial Services':      'FINANCIALS',
  'Energy':                  'ENERGY',
  'Basic Materials':         'MATERIALS',
  'Industrials':             'INDUSTRIALS',
  'Consumer Cyclical':       'CONSUMER_DISC',
  'Consumer Defensive':      'CONSUMER_STAPLES',
  'Utilities':               'UTILITIES',
  'Real Estate':             'REAL_ESTATE',
  'Communication Services':  'TELECOM',
};

/**
 * GET /api/models/etf-sectors?symbol=XEQT.TO
 * Returns the sector breakdown of an ETF via Yahoo Finance.
 * Response: { sectors: [{ sector: "TECHNOLOGY", weight: 0.318, label: "Technologie" }, …] }
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const symbol = req.nextUrl.searchParams.get('symbol')?.trim();
  if (!symbol) {
    return NextResponse.json({ error: 'symbol requis' }, { status: 400 });
  }

  const yahooSectors = await getYahooETFSectors(symbol);
  if (!yahooSectors || yahooSectors.length === 0) {
    return NextResponse.json({ sectors: null });
  }

  // Map Yahoo sectors to internal sector values and aggregate
  const sectorMap = new Map<string, number>();
  let unmapped = 0;

  for (const { sector, weight } of yahooSectors) {
    const internal = YAHOO_TO_INTERNAL[sector];
    if (internal) {
      sectorMap.set(internal, (sectorMap.get(internal) || 0) + weight);
    } else {
      unmapped += weight;
    }
  }

  // If significant unmapped weight, distribute proportionally
  if (unmapped > 0.01 && sectorMap.size > 0) {
    const mappedTotal = [...sectorMap.values()].reduce((a, b) => a + b, 0);
    if (mappedTotal > 0) {
      for (const [key, val] of sectorMap) {
        sectorMap.set(key, val + unmapped * (val / mappedTotal));
      }
    }
  }

  const sectors = [...sectorMap.entries()]
    .map(([sector, weight]) => ({ sector, weight: Math.round(weight * 1000) / 1000 }))
    .filter(s => s.weight > 0.005) // ignore < 0.5%
    .sort((a, b) => b.weight - a.weight);

  return NextResponse.json({ sectors });
}

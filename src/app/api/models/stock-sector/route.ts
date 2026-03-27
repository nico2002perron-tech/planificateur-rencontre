import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { yahooFetch, toYahooSymbol } from '@/lib/yahoo/client';

/**
 * Yahoo sector name → internal SECTORS constant value.
 */
const YAHOO_SECTOR_MAP: Record<string, string> = {
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
 * GET /api/models/stock-sector?symbol=AAPL
 * Returns the sector of a stock via Yahoo Finance assetProfile.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const symbol = req.nextUrl.searchParams.get('symbol')?.trim();
  if (!symbol) {
    return NextResponse.json({ error: 'symbol requis' }, { status: 400 });
  }

  try {
    const ySym = toYahooSymbol(symbol);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=assetProfile`;
    const res = await yahooFetch(url);
    if (!res.ok) return NextResponse.json({ sector: null });

    const json = await res.json();
    const profile = json?.quoteSummary?.result?.[0]?.assetProfile;
    if (!profile?.sector) return NextResponse.json({ sector: null });

    const yahooSector = profile.sector as string;
    const internal = YAHOO_SECTOR_MAP[yahooSector] || null;

    return NextResponse.json({
      sector: internal,
      sectorRaw: yahooSector,
      industry: profile.industry || null,
    });
  } catch {
    return NextResponse.json({ sector: null });
  }
}

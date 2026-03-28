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
 * Try to fetch assetProfile for a given Yahoo symbol.
 * Returns the profile or null.
 */
async function fetchProfile(ySym: string) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=assetProfile`;
  const res = await yahooFetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.quoteSummary?.result?.[0]?.assetProfile ?? null;
}

/**
 * Strip Canadian exchange suffix to get the underlying US symbol.
 * e.g. MSFT.NE → MSFT, AAPL.TO → AAPL, GOOG.V → GOOG
 */
function toUnderlyingUS(symbol: string): string | null {
  const match = symbol.match(/^([A-Z]{1,5})(?:[.-][A-Z]{1,3})?\.(TO|V|NE)$/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * GET /api/models/stock-sector?symbol=AAPL
 * Returns the sector of a stock via Yahoo Finance assetProfile.
 * For hedged CAD listings (e.g. MSFT.NE), falls back to the underlying US symbol.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const symbol = req.nextUrl.searchParams.get('symbol')?.trim();
  if (!symbol) {
    return NextResponse.json({ error: 'symbol requis' }, { status: 400 });
  }

  try {
    // 1. Try the exact symbol first
    const ySym = toYahooSymbol(symbol);
    let profile = await fetchProfile(ySym);

    // 2. If no sector found and it's a Canadian-listed symbol, try the underlying US ticker
    if (!profile?.sector) {
      const usSym = toUnderlyingUS(symbol);
      if (usSym && usSym !== ySym) {
        profile = await fetchProfile(usSym);
      }
    }

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

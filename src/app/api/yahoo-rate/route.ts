import { NextResponse } from 'next/server';
import { getUsdCadRate } from '@/lib/yahoo/client';

/**
 * GET /api/yahoo-rate
 * Returns the live USD/CAD exchange rate from Yahoo Finance (USDCAD=X).
 * Cached server-side for 1 hour by getUsdCadRate().
 */
export async function GET() {
  try {
    const rate = await getUsdCadRate();
    return NextResponse.json({ rate });
  } catch {
    return NextResponse.json({ rate: null }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate } from '@/lib/fmp/client';
import { getCachedExchangeRate, setCachedExchangeRate } from '@/lib/fmp/cache';

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from') || 'USD';
  const to = request.nextUrl.searchParams.get('to') || 'CAD';
  const pair = `${from}/${to}`;

  try {
    const cached = await getCachedExchangeRate(pair);
    if (cached) return NextResponse.json({ pair, rate: cached, cached: true });

    const rate = await getExchangeRate(from, to);
    if (rate) await setCachedExchangeRate(pair, rate);

    return NextResponse.json({ pair, rate });
  } catch (error) {
    console.error('Exchange rate error:', error);
    return NextResponse.json({ error: 'Failed to fetch exchange rate' }, { status: 500 });
  }
}

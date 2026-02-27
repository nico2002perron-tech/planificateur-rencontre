import { NextRequest, NextResponse } from 'next/server';
import { getPriceTargets } from '@/lib/fmp/client';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    const targets = await getPriceTargets(symbol);
    return NextResponse.json(targets.slice(0, 10));
  } catch (error) {
    console.error('FMP price target error:', error);
    return NextResponse.json({ error: 'Failed to fetch price targets' }, { status: 500 });
  }
}

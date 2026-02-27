import { NextRequest, NextResponse } from 'next/server';
import { getTargetConsensus } from '@/lib/fmp/client';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    const consensus = await getTargetConsensus(symbol);
    return NextResponse.json(consensus ? [consensus] : []);
  } catch (error) {
    console.error('FMP price target error:', error);
    return NextResponse.json({ error: 'Failed to fetch price targets' }, { status: 500 });
  }
}

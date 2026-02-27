import { NextRequest, NextResponse } from 'next/server';
import { getProfile } from '@/lib/fmp/client';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    const profile = await getProfile(symbol);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('FMP profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

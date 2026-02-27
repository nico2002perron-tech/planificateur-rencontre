import { NextResponse } from 'next/server';
import { getSectorPerformance } from '@/lib/fmp/client';

export async function GET() {
  try {
    const data = await getSectorPerformance();
    return NextResponse.json(data);
  } catch (error) {
    console.error('FMP sector performance error:', error);
    return NextResponse.json({ error: 'Failed to fetch sector performance' }, { status: 500 });
  }
}

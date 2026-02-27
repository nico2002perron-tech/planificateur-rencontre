import { NextRequest, NextResponse } from 'next/server';
import { searchSymbol } from '@/lib/fmp/client';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchSymbol(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error('FMP search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

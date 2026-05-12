import { NextRequest, NextResponse } from 'next/server';
import { searchEODHD } from '@/lib/api/eodhd';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const raw = await searchEODHD(query);

    // Map to the shape expected by SymbolSearch component
    const results = raw.map((r) => {
      // Build symbol: "CODE.Exchange" for non-US, just "CODE" for US
      const symbol = r.Exchange === 'US' ? r.Code : `${r.Code}.${r.Exchange}`;
      return {
        symbol,
        name: r.Name,
        currency: r.Currency || '',
        stockExchange: r.Exchange || '',
        exchangeShortName: r.Exchange || '',
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('EODHD search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

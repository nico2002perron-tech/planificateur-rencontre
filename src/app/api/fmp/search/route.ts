import { NextRequest, NextResponse } from 'next/server';
import { searchYahooSymbols } from '@/lib/yahoo/client';

// Recherche de symboles pour l'autocomplétion (Rapport Prospect, PortfolioBuilder,
// SymbolSearch). Source : Yahoo Finance (gratuit, sans clé) — cohérent avec les prix
// live et cours cibles utilisés ailleurs dans l'app.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchYahooSymbols(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Symbol search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import {
  scoreUniverse,
  type StockInput,
  type CachedFundamentals,
  type SectorConfig,
} from '@/lib/models/stock-scorer';

/**
 * POST /api/models/score-universe
 *
 * Score all stock universe stocks for a given investment profile.
 * Body: { profile_id: string }
 * Returns: { scores: StockScore[] }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { profile_id } = body;

  if (!profile_id || typeof profile_id !== 'string') {
    return NextResponse.json({ error: 'profile_id requis' }, { status: 400 });
  }

  const supabase = createClient();

  // 1. Load sector configs for this profile
  const { data: sectorConfigs, error: scError } = await supabase
    .from('model_sector_config')
    .select('profile_id, sector, weight_pct, nb_titles')
    .eq('profile_id', profile_id);

  if (scError) {
    return NextResponse.json({ error: scError.message }, { status: 500 });
  }

  if (!sectorConfigs || sectorConfigs.length === 0) {
    return NextResponse.json(
      { error: 'Aucune configuration sectorielle pour ce profil' },
      { status: 404 },
    );
  }

  // 2. Load all stocks from universe
  const { data: stockRows, error: suError } = await supabase
    .from('model_stock_universe')
    .select('id, symbol, name, sector, stock_type, position')
    .order('position');

  if (suError) {
    return NextResponse.json({ error: suError.message }, { status: 500 });
  }

  const stocks: StockInput[] = (stockRows || []) as StockInput[];
  const symbols = stocks.map((s) => s.symbol);

  // 3. Batch-query price_cache for fundamentals
  const { data: cacheRows, error: pcError } = await supabase
    .from('price_cache')
    .select('symbol, pe_ratio, dividend_yield, market_cap')
    .in('symbol', symbols);

  if (pcError) {
    return NextResponse.json({ error: pcError.message }, { status: 500 });
  }

  // 4. Build cached fundamentals map
  const cachedMap = new Map<string, CachedFundamentals>();
  for (const row of cacheRows || []) {
    cachedMap.set(row.symbol, {
      pe_ratio: row.pe_ratio,
      dividend_yield: row.dividend_yield,
      market_cap: row.market_cap,
    });
  }

  // 5. Score the universe
  const scores = scoreUniverse(
    stocks,
    sectorConfigs as SectorConfig[],
    cachedMap,
  );

  return NextResponse.json({ scores });
}

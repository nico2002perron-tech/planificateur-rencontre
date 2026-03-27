import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { getYahooQuotes, getYahooProfile } from '@/lib/yahoo/client';
import { generatePortfolio, type ProfileInput, type StockUniverse, type BondUniverse } from '@/lib/models/portfolio-generator';
import { scoreOutOf10, type StockMetrics } from '@/lib/valuation/scoring';
import { getBenchmarkData } from '@/lib/valuation/benchmarks';

/**
 * POST /api/models/scoring
 *
 * Body: { profile_id: string, portfolio_value?: number }
 *
 * Genere un portefeuille, fetch les fondamentaux Yahoo pour chaque titre,
 * calcule les scores individuels et le score global du portefeuille.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { profile_id, portfolio_value = 100000 } = body;

  if (!profile_id) {
    return NextResponse.json({ error: 'profile_id requis' }, { status: 400 });
  }

  const supabase = createClient();

  // ── 1. Charger profil + univers ──
  const { data: profileRow } = await supabase
    .from('investment_profiles').select('*').eq('id', profile_id).single();
  if (!profileRow) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  const [{ data: sectorConfigs }, { data: bondConfigRow }] = await Promise.all([
    supabase.from('model_sector_config').select('*').eq('profile_id', profile_id),
    supabase.from('model_bond_config').select('*').eq('profile_id', profile_id).maybeSingle(),
  ]);

  const profile: ProfileInput = {
    id: profileRow.id, name: profileRow.name, profile_number: profileRow.profile_number,
    equity_pct: profileRow.equity_pct, bond_pct: profileRow.bond_pct, nb_bonds: profileRow.nb_bonds,
    sectors: (sectorConfigs || []).map((sc: { sector: string; weight_pct: number; nb_titles: number }) => ({
      sector: sc.sector, weight_pct: sc.weight_pct, nb_titles: sc.nb_titles,
    })),
    bond_config: bondConfigRow ? { price_min: bondConfigRow.price_min, price_max: bondConfigRow.price_max } : null,
  };

  const [{ data: stockRows }, { data: bondRows }] = await Promise.all([
    supabase.from('model_stock_universe').select('*').order('position'),
    supabase.from('bonds_universe').select('*'),
  ]);

  // ── 2. Generer le portefeuille ──
  const configuredSectors = new Set(profile.sectors.map(s => s.sector));
  const neededSymbols = [...new Set((stockRows || []).filter((s: StockUniverse) => configuredSectors.has(s.sector)).map((s: StockUniverse) => s.symbol))];

  const priceMap = new Map<string, number>();
  if (neededSymbols.length > 0) {
    const quotes = await getYahooQuotes(neededSymbols);
    for (const q of quotes) priceMap.set(q.symbol, q.price);
  }

  const portfolio = generatePortfolio({
    profile, portfolioValue: portfolio_value,
    stocks: (stockRows || []) as StockUniverse[],
    bonds: (bondRows || []) as BondUniverse[],
    prices: priceMap,
  });

  // ── 3. Fetch fondamentaux Yahoo pour chaque titre ──
  const allStocks = portfolio.sectors.flatMap(s => s.stocks);
  const symbols = allStocks.map(s => s.symbol);

  interface ScoredStock {
    symbol: string;
    name: string;
    sector: string;
    weight: number;
    price: number;
    pe: number;
    dividendYield: number;
    marketCap: number;
    scores: { overall: number; health: number; growth: number; valuation: number; sector: number };
  }

  const scoredStocks: ScoredStock[] = [];
  const BATCH = 4;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const profiles = await Promise.all(batch.map(s => getYahooProfile(s)));

    for (let j = 0; j < batch.length; j++) {
      const sym = batch[j];
      const stock = allStocks.find(s => s.symbol === sym);
      const yProfile = profiles[j];
      if (!stock) continue;

      const pe = 0; // Will be enriched from Yahoo
      const divYield = yProfile?.dividendYield ?? 0;
      const mktCap = yProfile?.mktCap ?? 0;
      const sector = yProfile?.sector || stock.sector;

      // Build metrics for scoring
      const metrics: StockMetrics = {
        ticker: sym,
        price: stock.price,
        pe: pe, // Yahoo doesn't always return P/E in profile, we use what we have
        ps: 0,
        sales_gr: 0,
        eps_gr: 0,
        net_cash: 0,
        fcf_yield: 0,
        rule_40: 0,
      };

      // Try to get P/E from price cache or calculate
      const cachedPrice = priceMap.get(sym);
      if (cachedPrice) {
        // Check Supabase cache for pe_ratio
        const { data: cached } = await supabase
          .from('price_cache')
          .select('pe_ratio, dividend_yield')
          .eq('symbol', sym)
          .maybeSingle();
        if (cached?.pe_ratio) metrics.pe = cached.pe_ratio;
      }

      const bench = getBenchmarkData(sym, sector);
      const scores = scoreOutOf10(metrics, bench);

      scoredStocks.push({
        symbol: sym,
        name: stock.name,
        sector: stock.sector,
        weight: stock.realWeight,
        price: stock.price,
        pe: metrics.pe,
        dividendYield: Math.round(divYield * 10000) / 100,
        marketCap: mktCap,
        scores,
      });
    }
  }

  // ── 4. Score global du portefeuille ──
  const totalWeight = scoredStocks.reduce((s, st) => s + st.weight, 0);

  function weightedAvg(field: keyof ScoredStock['scores']): number {
    if (totalWeight === 0) return 0;
    const sum = scoredStocks.reduce((s, st) => s + st.scores[field] * st.weight, 0);
    return Math.round((sum / totalWeight) * 10) / 10;
  }

  const portfolioScores = {
    overall: weightedAvg('overall'),
    health: weightedAvg('health'),
    growth: weightedAvg('growth'),
    valuation: weightedAvg('valuation'),
    sector: weightedAvg('sector'),
  };

  // Distribution des scores
  const distribution = {
    excellent: scoredStocks.filter(s => s.scores.overall >= 8).length,
    good: scoredStocks.filter(s => s.scores.overall >= 6 && s.scores.overall < 8).length,
    average: scoredStocks.filter(s => s.scores.overall >= 4 && s.scores.overall < 6).length,
    weak: scoredStocks.filter(s => s.scores.overall < 4).length,
  };

  return NextResponse.json({
    profileName: portfolio.profileName,
    profileNumber: portfolio.profileNumber,
    nbStocks: scoredStocks.length,
    portfolioScores,
    distribution,
    stocks: scoredStocks.sort((a, b) => b.scores.overall - a.scores.overall),
  });
}

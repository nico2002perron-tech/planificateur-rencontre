import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { getYahooQuotes, getYahooProfile, getYahooPriceTarget } from '@/lib/yahoo/client';
import { generatePortfolio, type ProfileInput, type StockUniverse, type BondUniverse } from '@/lib/models/portfolio-generator';
import { calculateDualScores, rankStocks, type CustomWeights } from '@/lib/valuation/safety-score';

/**
 * POST /api/models/scoring
 *
 * Body: { profile_id: string, portfolio_value?: number }
 *
 * Genere un portefeuille, fetch les fondamentaux Yahoo pour chaque titre,
 * calcule les scores de securite + potentiel et le classement.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { profile_id, portfolio_value = 100000, weights } = body;

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

  interface StockFundamentals {
    symbol: string;
    name: string;
    sector: string;
    weight: number;
    price: number;
    pe: number;
    eps: number;
    beta: number;
    dividendYield: number;
    week52High: number;
    week52Low: number;
    earningsGrowth: number;
    targetPrice: number;
    estimatedGainPercent: number;
    marketCap: number;
  }

  const stockData: StockFundamentals[] = [];
  const BATCH = 4;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const [profiles, targets] = await Promise.all([
      Promise.all(batch.map(s => getYahooProfile(s))),
      Promise.all(batch.map(s => getYahooPriceTarget(s))),
    ]);

    for (let j = 0; j < batch.length; j++) {
      const sym = batch[j];
      const stock = allStocks.find(s => s.symbol === sym);
      const yProfile = profiles[j];
      const yTarget = targets[j];
      if (!stock) continue;

      const currentPrice = stock.price;
      const targetPrice = yTarget.targetMean ?? 0;
      const gainPct = currentPrice > 0 && targetPrice > 0
        ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

      stockData.push({
        symbol: sym,
        name: stock.name,
        sector: yProfile?.sector || stock.sector,
        weight: stock.realWeight,
        price: currentPrice,
        pe: yProfile?.pe ?? 0,
        eps: yProfile?.eps ?? 0,
        beta: yProfile?.beta ?? 0,
        dividendYield: yProfile?.dividendYield ?? 0,
        week52High: yProfile?.week52High ?? 0,
        week52Low: yProfile?.week52Low ?? 0,
        earningsGrowth: yProfile?.earningsGrowth ?? 0,
        targetPrice,
        estimatedGainPercent: Math.round(gainPct * 100) / 100,
        marketCap: yProfile?.mktCap ?? 0,
      });
    }
  }

  // ── 4. Calculer dual scores ──
  const dualScoreInputs = stockData.map(s => ({
    symbol: s.symbol,
    companyName: s.name,
    currentPrice: s.price,
    weight: s.weight,
    beta: s.beta,
    pe: s.pe,
    eps: s.eps,
    week52High: s.week52High,
    week52Low: s.week52Low,
    dividendYield: s.dividendYield,
    earningsGrowth: s.earningsGrowth,
    targetPrice: s.targetPrice,
    estimatedGainPercent: s.estimatedGainPercent,
    sector: s.sector,
    assetClass: 'EQUITY',
  }));

  const rawScores = calculateDualScores(dualScoreInputs, [], undefined, weights as CustomWeights | undefined);
  const rankedScores = rankStocks(rawScores);

  // ── 5. Portfolio-level aggregates ──
  const totalWeight = rankedScores.reduce((s, sc) => s + sc.weight, 0);
  const avgSafety = totalWeight > 0
    ? Math.round(rankedScores.reduce((s, sc) => s + sc.safety.total * sc.weight, 0) / totalWeight * 10) / 10 : 0;
  const avgUpside = totalWeight > 0
    ? Math.round(rankedScores.reduce((s, sc) => s + sc.upside.total * sc.weight, 0) / totalWeight * 10) / 10 : 0;

  const quadrantDistribution = {
    star: rankedScores.filter(s => s.quadrant === 'star').length,
    safe: rankedScores.filter(s => s.quadrant === 'safe').length,
    growth: rankedScores.filter(s => s.quadrant === 'growth').length,
    watch: rankedScores.filter(s => s.quadrant === 'watch').length,
  };

  return NextResponse.json({
    profileName: portfolio.profileName,
    profileNumber: portfolio.profileNumber,
    nbStocks: rankedScores.length,
    portfolioScores: { safety: avgSafety, upside: avgUpside },
    quadrantDistribution,
    stocks: rankedScores.map(sc => {
      const sd = stockData.find(s => s.symbol === sc.symbol);
      return {
        ...sc,
        price: sd?.price ?? 0,
        pe: sd?.pe ?? 0,
        dividendYield: sd ? Math.round(sd.dividendYield * 10000) / 100 : 0,
        marketCap: sd?.marketCap ?? 0,
        targetPrice: sd?.targetPrice ?? 0,
        estimatedGainPercent: sd?.estimatedGainPercent ?? 0,
        sector: sd?.sector ?? '',
      };
    }),
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { getYahooHistoricalChart } from '@/lib/yahoo/client';
import { generatePortfolio, type ProfileInput, type StockUniverse, type BondUniverse } from '@/lib/models/portfolio-generator';
import { runBacktest, type PortfolioWeight, type MonthlyPoint } from '@/lib/models/backtester';
import { getYahooQuotes } from '@/lib/yahoo/client';

/**
 * POST /api/models/backtest
 *
 * Body: {
 *   profile_id: string,
 *   portfolio_value?: number,  // defaut: 100000
 *   years?: number,            // defaut: 5
 * }
 *
 * 1. Genere un portefeuille modele avec le profil
 * 2. Recupère l'historique Yahoo pour chaque symbole
 * 3. Calcule la performance pondérée historique
 * 4. Compare avec S&P/TSX et S&P 500
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { profile_id, portfolio_value = 100000, years = 5 } = body;

  if (!profile_id) {
    return NextResponse.json({ error: 'profile_id requis' }, { status: 400 });
  }

  const supabase = createClient();

  // ── 1. Charger profil ──
  const { data: profileRow } = await supabase
    .from('investment_profiles')
    .select('*')
    .eq('id', profile_id)
    .single();

  if (!profileRow) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  }

  const [{ data: sectorConfigs }, { data: bondConfigRow }] = await Promise.all([
    supabase.from('model_sector_config').select('*').eq('profile_id', profile_id),
    supabase.from('model_bond_config').select('*').eq('profile_id', profile_id).maybeSingle(),
  ]);

  const profile: ProfileInput = {
    id: profileRow.id,
    name: profileRow.name,
    profile_number: profileRow.profile_number,
    equity_pct: profileRow.equity_pct,
    bond_pct: profileRow.bond_pct,
    nb_bonds: profileRow.nb_bonds,
    sectors: (sectorConfigs || []).map((sc: { sector: string; weight_pct: number; nb_titles: number }) => ({
      sector: sc.sector, weight_pct: sc.weight_pct, nb_titles: sc.nb_titles,
    })),
    bond_config: bondConfigRow
      ? { price_min: bondConfigRow.price_min, price_max: bondConfigRow.price_max }
      : null,
  };

  // ── 2. Charger univers et generer le portefeuille ──
  const [{ data: stockRows }, { data: bondRows }] = await Promise.all([
    supabase.from('model_stock_universe').select('*').order('position'),
    supabase.from('bonds_universe').select('*'),
  ]);

  const stocks = (stockRows || []) as StockUniverse[];
  const bonds = (bondRows || []) as BondUniverse[];

  // Fetch prix courants pour la generation
  const configuredSectors = new Set(profile.sectors.map(s => s.sector));
  const neededSymbols = [...new Set(stocks.filter(s => configuredSectors.has(s.sector)).map(s => s.symbol))];

  const priceMap = new Map<string, number>();
  if (neededSymbols.length > 0) {
    const quotes = await getYahooQuotes(neededSymbols);
    for (const q of quotes) priceMap.set(q.symbol, q.price);
  }

  const portfolio = generatePortfolio({ profile, portfolioValue: portfolio_value, stocks, bonds, prices: priceMap });

  // ── 3. Extraire les poids des actions ──
  const totalValue = portfolio.totalStockValue + portfolio.totalBondValue + portfolio.cashRemaining;
  const weights: PortfolioWeight[] = [];

  for (const sec of portfolio.sectors) {
    for (const s of sec.stocks) {
      if (s.realValue > 0 && totalValue > 0) {
        weights.push({ symbol: s.symbol, weight: s.realValue / totalValue });
      }
    }
  }

  if (weights.length === 0) {
    return NextResponse.json({ error: 'Aucun titre avec donnees de prix' }, { status: 400 });
  }

  // ── 4. Fetch historique Yahoo ──
  const allSymbols = weights.map(w => w.symbol);
  const BATCH = 4; // concurrent fetches
  const historicalData = new Map<string, MonthlyPoint[]>();

  for (let i = 0; i < allSymbols.length; i += BATCH) {
    const batch = allSymbols.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(sym => getYahooHistoricalChart(sym, years))
    );
    batch.forEach((sym, j) => {
      if (results[j].length > 0) {
        historicalData.set(sym, results[j]);
      }
    });
  }

  // Benchmarks
  const [benchCA, benchUS] = await Promise.all([
    getYahooHistoricalChart('^GSPTSE', years),
    getYahooHistoricalChart('^GSPC', years),
  ]);

  // ── 5. Backtest ──
  const result = runBacktest(
    weights,
    historicalData,
    benchCA.length > 1 ? benchCA : undefined,
    benchUS.length > 1 ? benchUS : undefined,
  );

  return NextResponse.json({
    backtest: result,
    portfolio: {
      profileName: portfolio.profileName,
      profileNumber: portfolio.profileNumber,
      nbStocks: portfolio.stats.nbStocks,
      equityPct: portfolio.equityPct,
      bondPct: portfolio.bondPct,
    },
  });
}

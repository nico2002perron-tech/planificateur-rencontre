import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { getYahooQuotes } from '@/lib/yahoo/client';
import {
  generatePortfolio,
  type ProfileInput,
  type StockUniverse,
  type BondUniverse,
} from '@/lib/models/portfolio-generator';

/**
 * POST /api/models/generate
 *
 * Body: {
 *   profile_id: string,
 *   portfolio_value: number,
 *   save?: boolean,           // sauvegarder dans model_generated (défaut: false)
 *   client_id?: string,       // optionnel, pour lier à un client
 * }
 *
 * Retourne le portefeuille généré complet avec toutes les positions.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { profile_id, portfolio_value, save, client_id } = body;

  if (!profile_id || !portfolio_value || portfolio_value <= 0) {
    return NextResponse.json(
      { error: 'profile_id et portfolio_value (> 0) requis' },
      { status: 400 }
    );
  }

  const supabase = createClient();

  // ── 1. Charger le profil avec ses configs ──

  const { data: profileRow, error: pErr } = await supabase
    .from('investment_profiles')
    .select('*')
    .eq('id', profile_id)
    .single();

  if (pErr || !profileRow) {
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
      sector: sc.sector,
      weight_pct: sc.weight_pct,
      nb_titles: sc.nb_titles,
    })),
    bond_config: bondConfigRow
      ? { price_min: bondConfigRow.price_min, price_max: bondConfigRow.price_max }
      : null,
  };

  // ── 2. Charger l'univers ──

  const [{ data: stockRows }, { data: bondRows }] = await Promise.all([
    supabase.from('model_stock_universe').select('*').order('position'),
    supabase.from('bonds_universe').select('*'),
  ]);

  const stocks: StockUniverse[] = (stockRows || []) as StockUniverse[];
  const bonds: BondUniverse[] = (bondRows || []) as BondUniverse[];

  // ── 3. Récupérer les prix courants ──

  // Identifier les symboles nécessaires (uniquement les secteurs configurés)
  const configuredSectors = new Set(profile.sectors.map(s => s.sector));
  const neededSymbols = stocks
    .filter(s => configuredSectors.has(s.sector))
    .map(s => s.symbol);

  const uniqueSymbols = [...new Set(neededSymbols)];

  let priceMap = new Map<string, number>();

  if (uniqueSymbols.length > 0) {
    // D'abord vérifier le cache Supabase
    const { data: cachedPrices } = await supabase
      .from('price_cache')
      .select('symbol, price, fetched_at')
      .in('symbol', uniqueSymbols);

    const CACHE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();
    const fresh = new Set<string>();

    for (const cp of cachedPrices || []) {
      const age = now - new Date(cp.fetched_at).getTime();
      if (age < CACHE_MAX_AGE && cp.price > 0) {
        priceMap.set(cp.symbol, cp.price);
        fresh.add(cp.symbol);
      }
    }

    // Fetch les symboles manquants via Yahoo Finance
    const stale = uniqueSymbols.filter(s => !fresh.has(s));

    if (stale.length > 0) {
      const yahooQuotes = await getYahooQuotes(stale);
      for (const q of yahooQuotes) {
        priceMap.set(q.symbol, q.price);
        // Mettre en cache pour la prochaine fois
        await supabase.from('price_cache').upsert({
          symbol: q.symbol,
          price: q.price,
          company_name: q.name,
          change_percent: 0,
          fetched_at: new Date().toISOString(),
        });
      }
    }
  }

  // ── 4. Générer le portefeuille ──

  const result = generatePortfolio({
    profile,
    portfolioValue: portfolio_value,
    stocks,
    bonds,
    prices: priceMap,
  });

  // ── 5. Sauvegarder si demandé ──

  if (save) {
    await supabase.from('model_generated').insert({
      profile_id: profile.id,
      client_id: client_id || null,
      portfolio_value,
      holdings_snapshot: result.sectors,
      bonds_snapshot: result.bonds,
      stats: result.stats,
      generated_by: session.user.id,
    });
  }

  return NextResponse.json({ portfolio: result });
}

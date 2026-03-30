/**
 * Portfolio Generator — Port TypeScript de portfolio_generator.py
 *
 * Algorithme :
 * 1. Charger profil (allocations, config secteurs, config bonds)
 * 2. Charger univers actions + obligations depuis Supabase
 * 3. Récupérer les prix courants (Yahoo Finance)
 * 4. Sélectionner les actions par secteur (obligatoire d'abord, puis variable, par position)
 * 5. Sélectionner les obligations (obligatoires d'abord, puis remplir au nb_bonds)
 * 6. Calculer les quantités et valeurs réelles
 * 7. Retourner le portefeuille généré complet
 */

import 'server-only';

// ── Types ──

export interface StockUniverse {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  stock_type: 'obligatoire' | 'variable';
  position: number;
}

export interface BondUniverse {
  id: string;
  description: string;
  issuer: string | null;
  cusip: string | null;
  coupon: number | null;
  maturity: string | null;
  price: number | null;
  yield: number | null;
  spread: number | null;
  category: string | null;
  source: 'CAD' | 'US' | 'MANUAL';
  is_mandatory: boolean;
}

export interface SectorConfig {
  sector: string;
  weight_pct: number;
  nb_titles: number;
}

export interface BondConfig {
  price_min: number;
  price_max: number;
}

export interface ProfileInput {
  id: string;
  name: string;
  profile_number: number;
  equity_pct: number;
  bond_pct: number;
  nb_bonds: number;
  sectors: SectorConfig[];
  bond_config: BondConfig | null;
}

export interface GeneratorParams {
  profile: ProfileInput;
  portfolioValue: number;
  stocks: StockUniverse[];
  bonds: BondUniverse[];
  prices: Map<string, number>;           // symbol → current price
  dividendYields?: Map<string, number>;  // symbol → dividend yield (%)
  bypassLimits?: boolean;                // true = use all stocks passed (user-curated selection)
}

// ── Résultat ──

export interface GeneratedStock {
  symbol: string;
  name: string;
  sector: string;
  stock_type: 'obligatoire' | 'variable';
  price: number;
  quantity: number;
  realValue: number;
  targetWeight: number;  // poids cible (%)
  realWeight: number;    // poids réel (%) basé sur valeur réelle
  dividendYield?: number;
}

export interface GeneratedBond {
  description: string;
  issuer: string | null;
  cusip: string | null;
  coupon: number | null;
  maturity: string | null;
  price: number;
  yieldPct: number | null;
  quantity: number;       // multiples de 10
  realValue: number;      // quantity × 100 (face value)
  targetWeight: number;
  realWeight: number;
  is_mandatory: boolean;
  source: string;
}

export interface SectorSummary {
  sector: string;
  sectorLabel: string;
  targetWeight: number;
  realWeight: number;
  stocks: GeneratedStock[];
  totalValue: number;
}

export interface GeneratedPortfolio {
  profileName: string;
  profileNumber: number;
  portfolioValue: number;
  equityPct: number;
  bondPct: number;

  // Résumé
  totalStockValue: number;
  totalBondValue: number;
  cashRemaining: number;
  realEquityPct: number;
  realBondPct: number;
  realCashPct: number;

  // Détails
  sectors: SectorSummary[];
  bonds: GeneratedBond[];

  // Statistiques
  stats: {
    nbStocks: number;
    nbBonds: number;
    nbSectors: number;
    avgDividendYield: number;  // moyenne pondérée
    avgBondYield: number;      // rendement moyen obligations
    estimatedAnnualIncome: number;
  };

  generatedAt: string;
}

// ── Labels secteurs ──
const SECTOR_LABELS: Record<string, string> = {
  TECHNOLOGY: 'Technologie',
  HEALTHCARE: 'Santé',
  FINANCIALS: 'Finance',
  ENERGY: 'Énergie',
  MATERIALS: 'Matériaux',
  INDUSTRIALS: 'Industriels',
  CONSUMER_DISC: 'Cons. discrétionnaire',
  CONSUMER_STAPLES: 'Cons. de base',
  UTILITIES: 'Services publics',
  REAL_ESTATE: 'Immobilier',
  TELECOM: 'Télécommunications',
  MILITARY: 'Militaire',
};

// ── Algorithme principal ──

export function generatePortfolio(params: GeneratorParams): GeneratedPortfolio {
  const { profile, portfolioValue, stocks, bonds, prices, dividendYields, bypassLimits } = params;
  const { equity_pct, bond_pct, nb_bonds, sectors: sectorConfigs, bond_config } = profile;

  const equityBudget = portfolioValue * (equity_pct / 100);
  const bondBudget = portfolioValue * (bond_pct / 100);

  // ════════════════════════════════════════
  // PHASE 1 : Sélection des actions
  // ════════════════════════════════════════

  const generatedSectors: SectorSummary[] = [];
  const allGeneratedStocks: GeneratedStock[] = [];

  for (const config of sectorConfigs) {
    const { sector, weight_pct, nb_titles } = config;

    // Filtrer les actions de ce secteur
    const sectorStocks = stocks.filter(s => s.sector === sector);

    // Trier: obligatoire d'abord (par position), puis variable (par position)
    const obligatoire = sectorStocks
      .filter(s => s.stock_type === 'obligatoire')
      .sort((a, b) => a.position - b.position);
    const variable = sectorStocks
      .filter(s => s.stock_type === 'variable')
      .sort((a, b) => a.position - b.position);

    // Prendre les top nb_titles (obligatoire en priorité)
    // Si bypassLimits, utiliser tous les stocks passés (sélection manuelle de l'utilisateur)
    const selected = bypassLimits
      ? [...obligatoire, ...variable]
      : [...obligatoire, ...variable].slice(0, nb_titles);

    // Budget pour ce secteur
    const sectorBudget = equityBudget * (weight_pct / 100);
    const perStockBudget = selected.length > 0 ? sectorBudget / selected.length : 0;

    const sectorGeneratedStocks: GeneratedStock[] = [];
    let sectorTotalValue = 0;

    for (const stock of selected) {
      const price = prices.get(stock.symbol) ?? prices.get(stock.symbol.toUpperCase());
      if (!price || price <= 0) continue;

      const targetWeight = (equity_pct / 100) * (weight_pct / 100) * (1 / selected.length) * 100;
      const quantity = Math.floor(perStockBudget / price);
      const realValue = quantity * price;
      sectorTotalValue += realValue;

      const divYield = dividendYields?.get(stock.symbol);
      const gs: GeneratedStock = {
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        stock_type: stock.stock_type,
        price,
        quantity,
        realValue,
        targetWeight: Math.round(targetWeight * 100) / 100,
        realWeight: 0, // calculé après
        dividendYield: divYield && divYield > 0 ? divYield : undefined,
      };
      sectorGeneratedStocks.push(gs);
      allGeneratedStocks.push(gs);
    }

    generatedSectors.push({
      sector,
      sectorLabel: SECTOR_LABELS[sector] || sector,
      targetWeight: weight_pct,
      realWeight: 0, // calculé après
      stocks: sectorGeneratedStocks,
      totalValue: sectorTotalValue,
    });
  }

  const totalStockValue = allGeneratedStocks.reduce((sum, s) => sum + s.realValue, 0);

  // Calculer les poids réels des actions
  for (const s of allGeneratedStocks) {
    s.realWeight = portfolioValue > 0 ? Math.round((s.realValue / portfolioValue) * 10000) / 100 : 0;
  }
  for (const sec of generatedSectors) {
    sec.realWeight = portfolioValue > 0
      ? Math.round((sec.totalValue / portfolioValue) * 10000) / 100
      : 0;
  }

  // ════════════════════════════════════════
  // PHASE 2 : Sélection des obligations
  // ════════════════════════════════════════

  const priceMin = bond_config?.price_min ?? 0;
  const priceMax = bond_config?.price_max ?? 999;

  // Filtrer par prix si disponible
  const eligibleBonds = bonds.filter(b => {
    if (b.price == null) return true; // garder si pas de prix
    return b.price >= priceMin && b.price <= priceMax;
  });

  // Obligatoires d'abord
  const mandatoryBonds = eligibleBonds.filter(b => b.is_mandatory);
  const optionalBonds = eligibleBonds
    .filter(b => !b.is_mandatory)
    .sort((a, b) => {
      // Trier par yield décroissant (meilleur rendement en premier)
      const yA = a.yield ?? 0;
      const yB = b.yield ?? 0;
      return yB - yA;
    });

  // Éviter les doublons d'émetteur (par préfixe 3 chars)
  const selectedBonds: BondUniverse[] = [...mandatoryBonds];
  const usedPrefixes = new Set(
    mandatoryBonds.map(b => (b.issuer || b.description || '').slice(0, 3).toUpperCase())
  );

  for (const bond of optionalBonds) {
    if (selectedBonds.length >= nb_bonds) break;
    const prefix = (bond.issuer || bond.description || '').slice(0, 3).toUpperCase();
    if (usedPrefixes.has(prefix) && prefix.length >= 3) continue;
    selectedBonds.push(bond);
    usedPrefixes.add(prefix);
  }

  // Allocation en lots de 10 unités (face value = $100 par unité)
  const N = selectedBonds.length;
  const generatedBonds: GeneratedBond[] = [];
  let totalBondValue = 0;

  if (N > 0) {
    const qBase = Math.floor(bondBudget / N / 100 / 10) * 10; // quantité de base (multiples de 10)
    const budgetBase = N * qBase * 100;
    const budgetRemaining = bondBudget - budgetBase;
    const lotsExtra = Math.floor(budgetRemaining / 1000); // lots supplémentaires de $1000

    for (let i = 0; i < N; i++) {
      const bond = selectedBonds[i];
      const quantity = qBase + (i < lotsExtra ? 10 : 0);
      const realValue = quantity * 100; // face value
      totalBondValue += realValue;

      const targetWeight = portfolioValue > 0
        ? Math.round((realValue / portfolioValue) * 10000) / 100
        : 0;

      generatedBonds.push({
        description: bond.description,
        issuer: bond.issuer,
        cusip: bond.cusip,
        coupon: bond.coupon,
        maturity: bond.maturity,
        price: bond.price ?? 100,
        yieldPct: bond.yield,
        quantity,
        realValue,
        targetWeight,
        realWeight: portfolioValue > 0
          ? Math.round((realValue / portfolioValue) * 10000) / 100
          : 0,
        is_mandatory: bond.is_mandatory,
        source: bond.source,
      });
    }
  }

  // ════════════════════════════════════════
  // PHASE 3 : Statistiques
  // ════════════════════════════════════════

  const cashRemaining = portfolioValue - totalStockValue - totalBondValue;

  // Rendement moyen pondéré des dividendes (actions)
  let weightedDivSum = 0;
  let divWeightSum = 0;
  for (const s of allGeneratedStocks) {
    if (s.dividendYield && s.realValue > 0) {
      weightedDivSum += s.dividendYield * s.realValue;
      divWeightSum += s.realValue;
    }
  }
  const avgDividendYield = divWeightSum > 0
    ? Math.round((weightedDivSum / divWeightSum) * 100) / 100
    : 0;

  // Rendement moyen des obligations
  const bondsWithYield = generatedBonds.filter(b => b.yieldPct != null);
  const avgBondYield = bondsWithYield.length > 0
    ? Math.round(
        (bondsWithYield.reduce((sum, b) => sum + (b.yieldPct ?? 0), 0) / bondsWithYield.length) * 100
      ) / 100
    : 0;

  // Revenu annuel estimé
  const stockIncome = allGeneratedStocks.reduce((sum, s) => {
    return sum + (s.dividendYield ? s.realValue * (s.dividendYield / 100) : 0);
  }, 0);
  const bondIncome = generatedBonds.reduce((sum, b) => {
    if (b.coupon) {
      return sum + (b.coupon / 100) * b.quantity * 100;
    }
    return sum;
  }, 0);
  const estimatedAnnualIncome = Math.round(stockIncome + bondIncome);

  return {
    profileName: profile.name,
    profileNumber: profile.profile_number,
    portfolioValue,
    equityPct: equity_pct,
    bondPct: bond_pct,

    totalStockValue: Math.round(totalStockValue * 100) / 100,
    totalBondValue: Math.round(totalBondValue * 100) / 100,
    cashRemaining: Math.round(cashRemaining * 100) / 100,
    realEquityPct: portfolioValue > 0
      ? Math.round((totalStockValue / portfolioValue) * 10000) / 100
      : 0,
    realBondPct: portfolioValue > 0
      ? Math.round((totalBondValue / portfolioValue) * 10000) / 100
      : 0,
    realCashPct: portfolioValue > 0
      ? Math.round((cashRemaining / portfolioValue) * 10000) / 100
      : 0,

    sectors: generatedSectors,
    bonds: generatedBonds,

    stats: {
      nbStocks: allGeneratedStocks.length,
      nbBonds: generatedBonds.length,
      nbSectors: generatedSectors.filter(s => s.stocks.length > 0).length,
      avgDividendYield,
      avgBondYield,
      estimatedAnnualIncome,
    },

    generatedAt: new Date().toISOString(),
  };
}

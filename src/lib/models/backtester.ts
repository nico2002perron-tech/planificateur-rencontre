/**
 * Backtester — Simuler la performance historique d'un portefeuille modele
 *
 * Prend un ensemble de {symbol, weight} + données historiques mensuelles
 * et calcule la performance pondérée vs benchmarks.
 */

import 'server-only';

// ── Types ──

export interface PortfolioWeight {
  symbol: string;
  weight: number; // 0-1 (ex: 0.05 = 5%)
}

export interface MonthlyPoint {
  date: string;       // YYYY-MM-DD
  adjClose: number;
}

export interface StockContribution {
  symbol: string;
  weight: number;           // original portfolio weight (0-1)
  totalReturn: number;      // % total return for this stock
  contribution: number;     // weighted contribution to portfolio return (%)
}

export interface BacktestResult {
  // Séries temporelles
  series: {
    date: string;
    portfolio: number;       // valeur indexée (base 100)
    benchmark?: number;      // S&P/TSX indexé
    benchmarkUS?: number;    // S&P 500 indexé
  }[];

  // Drawdown
  drawdown: {
    date: string;
    portfolio: number;      // % drawdown (négatif)
    benchmark?: number;
  }[];

  // Statistiques
  stats: {
    totalReturn: number;          // % rendement total
    cagr: number;                 // % annualisé
    volatility: number;           // % écart-type annualisé
    maxDrawdown: number;          // % perte max
    sharpeRatio: number;          // (rendement - rf) / vol
    bestMonth: number;            // % meilleur mois
    worstMonth: number;           // % pire mois
    positiveMonths: number;       // % de mois positifs
    years: number;                // durée en années
    nbSymbolsWithData: number;    // symboles avec données historiques
  };

  // Per-stock contributions
  stockContributions: StockContribution[];

  benchmarkStats?: {
    totalReturn: number;
    cagr: number;
    volatility: number;
    maxDrawdown: number;
  };

  period: { start: string; end: string };
}

// ── Constantes ──

const RISK_FREE_RATE = 0.04; // 4% (taux sans risque approximatif)

// ── Fonctions utilitaires ──

function monthlyReturns(prices: MonthlyPoint[]): { date: string; ret: number }[] {
  const returns: { date: string; ret: number }[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push({
      date: prices[i].date,
      ret: (prices[i].adjClose - prices[i - 1].adjClose) / prices[i - 1].adjClose,
    });
  }
  return returns;
}

function calcStats(monthlyRets: number[], years: number) {
  if (monthlyRets.length === 0) {
    return { totalReturn: 0, cagr: 0, volatility: 0, maxDrawdown: 0, sharpeRatio: 0, bestMonth: 0, worstMonth: 0, positiveMonths: 0 };
  }

  // Rendement total
  let cumulative = 1;
  let peak = 1;
  let maxDD = 0;

  for (const r of monthlyRets) {
    cumulative *= (1 + r);
    if (cumulative > peak) peak = cumulative;
    const dd = (cumulative - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  const totalReturn = (cumulative - 1) * 100;
  const cagr = years > 0 ? (Math.pow(cumulative, 1 / years) - 1) * 100 : 0;

  // Volatilité annualisée
  const mean = monthlyRets.reduce((s, r) => s + r, 0) / monthlyRets.length;
  const variance = monthlyRets.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / monthlyRets.length;
  const monthlyVol = Math.sqrt(variance);
  const volatility = monthlyVol * Math.sqrt(12) * 100;

  // Sharpe ratio
  const excessReturn = cagr / 100 - RISK_FREE_RATE;
  const sharpeRatio = volatility > 0 ? excessReturn / (volatility / 100) : 0;

  const bestMonth = Math.max(...monthlyRets) * 100;
  const worstMonth = Math.min(...monthlyRets) * 100;
  const positiveMonths = (monthlyRets.filter(r => r > 0).length / monthlyRets.length) * 100;

  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    cagr: Math.round(cagr * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    maxDrawdown: Math.round(maxDD * 10000) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    bestMonth: Math.round(bestMonth * 100) / 100,
    worstMonth: Math.round(worstMonth * 100) / 100,
    positiveMonths: Math.round(positiveMonths),
  };
}

// ── Algorithme principal ──

export function runBacktest(
  weights: PortfolioWeight[],
  historicalData: Map<string, MonthlyPoint[]>,
  benchmarkData?: MonthlyPoint[],
  benchmarkUSData?: MonthlyPoint[],
): BacktestResult {
  // 1. Calculer les rendements mensuels par symbole
  const symbolReturns = new Map<string, Map<string, number>>();
  let allDates = new Set<string>();
  let nbWithData = 0;

  for (const w of weights) {
    const prices = historicalData.get(w.symbol);
    if (!prices || prices.length < 2) continue;
    nbWithData++;

    const rets = monthlyReturns(prices);
    const retMap = new Map<string, number>();
    for (const r of rets) {
      retMap.set(r.date, r.ret);
      allDates.add(r.date);
    }
    symbolReturns.set(w.symbol, retMap);
  }

  // Trier les dates
  const sortedDates = [...allDates].sort();
  if (sortedDates.length === 0) {
    return {
      series: [],
      drawdown: [],
      stats: { totalReturn: 0, cagr: 0, volatility: 0, maxDrawdown: 0, sharpeRatio: 0, bestMonth: 0, worstMonth: 0, positiveMonths: 0, years: 0, nbSymbolsWithData: 0 },
      stockContributions: [],
      period: { start: '', end: '' },
    };
  }

  // 2. Calculer le rendement pondéré du portefeuille par mois
  const portfolioMonthlyReturns: number[] = [];
  const portfolioSeries: { date: string; value: number }[] = [{ date: sortedDates[0], value: 100 }];
  let portfolioValue = 100;

  for (const date of sortedDates) {
    // Rendement pondéré : somme(weight_i * return_i) / somme(weights avec données)
    let weightedReturn = 0;
    let activeWeight = 0;

    for (const w of weights) {
      const retMap = symbolReturns.get(w.symbol);
      if (!retMap) continue;
      const ret = retMap.get(date);
      if (ret !== undefined) {
        weightedReturn += w.weight * ret;
        activeWeight += w.weight;
      }
    }

    // Normaliser si certains titres n'ont pas de données pour cette date
    const monthReturn = activeWeight > 0 ? weightedReturn / activeWeight : 0;
    portfolioMonthlyReturns.push(monthReturn);
    portfolioValue *= (1 + monthReturn);
    portfolioSeries.push({ date, value: Math.round(portfolioValue * 100) / 100 });
  }

  // 3. Benchmark
  let benchReturns: number[] = [];
  let benchSeries: { date: string; value: number }[] = [];
  let benchUSReturns: number[] = [];
  let benchUSSeries: { date: string; value: number }[] = [];

  if (benchmarkData && benchmarkData.length > 1) {
    const bRets = monthlyReturns(benchmarkData);
    const bRetMap = new Map(bRets.map(r => [r.date, r.ret]));
    let bValue = 100;
    benchSeries = [{ date: sortedDates[0], value: 100 }];

    for (const date of sortedDates) {
      const ret = bRetMap.get(date) ?? 0;
      benchReturns.push(ret);
      bValue *= (1 + ret);
      benchSeries.push({ date, value: Math.round(bValue * 100) / 100 });
    }
  }

  if (benchmarkUSData && benchmarkUSData.length > 1) {
    const bRets = monthlyReturns(benchmarkUSData);
    const bRetMap = new Map(bRets.map(r => [r.date, r.ret]));
    let bValue = 100;
    benchUSSeries = [{ date: sortedDates[0], value: 100 }];

    for (const date of sortedDates) {
      const ret = bRetMap.get(date) ?? 0;
      benchUSReturns.push(ret);
      bValue *= (1 + ret);
      benchUSSeries.push({ date, value: Math.round(bValue * 100) / 100 });
    }
  }

  // 4. Séries combinées
  const series = portfolioSeries.map(p => {
    const bench = benchSeries.find(b => b.date === p.date);
    const benchUS = benchUSSeries.find(b => b.date === p.date);
    return {
      date: p.date,
      portfolio: p.value,
      benchmark: bench?.value,
      benchmarkUS: benchUS?.value,
    };
  });

  // 5. Drawdown
  let pPeak = 100;
  let bPeak = 100;
  const drawdown = portfolioSeries.map(p => {
    if (p.value > pPeak) pPeak = p.value;
    const pDD = ((p.value - pPeak) / pPeak) * 100;
    const bench = benchSeries.find(b => b.date === p.date);
    let bDD: number | undefined;
    if (bench) {
      if (bench.value > bPeak) bPeak = bench.value;
      bDD = ((bench.value - bPeak) / bPeak) * 100;
    }
    return {
      date: p.date,
      portfolio: Math.round(pDD * 100) / 100,
      benchmark: bDD !== undefined ? Math.round(bDD * 100) / 100 : undefined,
    };
  });

  // 6. Stats
  const years = sortedDates.length / 12;
  const stats = {
    ...calcStats(portfolioMonthlyReturns, years),
    years: Math.round(years * 10) / 10,
    nbSymbolsWithData: nbWithData,
  };

  const benchmarkStats = benchReturns.length > 0
    ? {
        totalReturn: calcStats(benchReturns, years).totalReturn,
        cagr: calcStats(benchReturns, years).cagr,
        volatility: calcStats(benchReturns, years).volatility,
        maxDrawdown: calcStats(benchReturns, years).maxDrawdown,
      }
    : undefined;

  // 7. Per-stock contributions
  const stockContributions: StockContribution[] = [];
  for (const w of weights) {
    const retMap = symbolReturns.get(w.symbol);
    if (!retMap) continue;
    // Compute individual stock cumulative return
    let cumVal = 1;
    for (const date of sortedDates) {
      const ret = retMap.get(date);
      if (ret !== undefined) cumVal *= (1 + ret);
    }
    const stockReturn = (cumVal - 1) * 100;
    stockContributions.push({
      symbol: w.symbol,
      weight: Math.round(w.weight * 10000) / 100,
      totalReturn: Math.round(stockReturn * 100) / 100,
      contribution: Math.round(w.weight * stockReturn * 100) / 100,
    });
  }
  stockContributions.sort((a, b) => b.contribution - a.contribution);

  return {
    series,
    drawdown,
    stats,
    stockContributions,
    benchmarkStats,
    period: { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] },
  };
}

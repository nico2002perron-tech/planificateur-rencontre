/** Scoring — port de scoring/overall_score.py */

import type { BenchmarkData } from './benchmarks';

export interface StockMetrics {
  ticker: string;
  price: number;
  pe: number;
  ps: number;
  sales_gr: number;
  eps_gr: number;
  net_cash: number;
  fcf_yield: number;
  rule_40: number;
}

export interface Scores {
  overall: number;
  health: number;
  growth: number;
  valuation: number;
  sector: number;
}

export function scoreOutOf10(metrics: StockMetrics, bench: BenchmarkData): Scores {
  let overall = 5.0;

  if (metrics.pe > 0 && metrics.pe < (bench.pe ?? 20)) overall += 1;
  if (metrics.sales_gr > 0.1) overall += 1;
  if (metrics.net_cash > 0) overall += 1;

  const growth = Math.min(10, Math.max(0, 5 + metrics.sales_gr * 20));
  const valuation = metrics.pe > 0 ? Math.min(10, Math.max(0, 10 - metrics.pe / (bench.pe || 20) * 5)) : 5;
  const health = metrics.net_cash > 0 ? 7 : 4;

  return {
    overall: Math.min(9.5, overall),
    health,
    growth,
    valuation,
    sector: 5,
  };
}

export function relativeValuationLabel(
  current: number,
  benchmark: number
): { label: string; color: string; diff: number } {
  if (current <= 0 || benchmark <= 0) return { label: 'N/D', color: 'gray', diff: 0 };
  const diff = ((current - benchmark) / benchmark) * 100;
  if (diff < -10) return { label: `Sous-évalué (−${Math.abs(diff).toFixed(0)}%)`, color: 'green', diff };
  if (diff > 10)  return { label: `Sur-évalué (+${diff.toFixed(0)}%)`, color: 'red', diff };
  return { label: `Juste valeur (${diff > 0 ? '+' : ''}${diff.toFixed(0)}%)`, color: 'yellow', diff };
}

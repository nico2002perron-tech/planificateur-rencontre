// =============================================================================
// DERIVED METRICS — Pure transform functions (Stage 4 of pipeline)
// Moves all business logic out of PDF page components into a single, testable location.
// Every function is deterministic: same input → same output.
// =============================================================================

import { C } from '../pdf/styles';
import type {
  QualityBar,
  CorrelationDisplayMetrics,
  ProjectionScenarioRow,
  BenchmarkPeriodRow,
  PerformancePeriod,
  HoldingQualityScores,
  RawHolding,
} from './types';
import type { MonteCarloResult } from './monte-carlo';
import type { DiversificationAnalysis } from './correlation';

// ─── Quality Bars (previously in FundamentalsPage lines 72-76) ────

export function computeQualityBars(
  avgPE: number,
  avgROE: number,
  avgDebtEquity: number,
  avgMargin: number,
  avgBeta: number,
): QualityBar[] {
  return [
    { label: 'Rentabilite', value: Math.min(100, avgROE * 4), max: 100, color: C.cyan },
    { label: 'Solidite', value: Math.min(100, Math.max(0, 100 - avgDebtEquity * 30)), max: 100, color: C.up },
    { label: 'Valorisation', value: Math.min(100, Math.max(0, 100 - (avgPE - 10) * 3)), max: 100, color: C.gold },
    { label: 'Croissance', value: Math.min(100, avgMargin * 400), max: 100, color: C.blue },
    { label: 'Stabilite', value: Math.min(100, Math.max(0, (1.5 - avgBeta) * 80)), max: 100, color: '#8b5cf6' },
  ];
}

// ─── Per-Holding Quality Scores ───────────────────────────────

export function computeHoldingQualityScores(h: RawHolding): HoldingQualityScores {
  return {
    rentabilite: Math.min(100, (h.roe ?? 0) * 4),
    solidite: Math.min(100, Math.max(0, 100 - (h.debtToEquity ?? 0) * 30)),
    valorisation: Math.min(100, Math.max(0, 100 - ((h.pe ?? 20) - 10) * 3)),
    croissance: Math.min(100, (h.profitMargin ?? 0) * 400),
    stabilite: Math.min(100, Math.max(0, (1.5 - (h.beta ?? 1)) * 80)),
  };
}

// ─── Correlation Bar Values (previously in CorrelationPage lines 90-93) ────

export function computeCorrelationBarValues(
  analysis: DiversificationAnalysis,
): CorrelationDisplayMetrics {
  return {
    hhiBarValue: Math.max(0, 100 - analysis.hhi / 50),
    correlationBarValue: Math.max(0, 100 - analysis.correlationMatrix.avgCorrelation * 100),
    top5BarValue: Math.max(0, 100 - analysis.top5Concentration * 100),
    sectorBarValue: Math.max(0, 100 - analysis.sectorConcentration / 50),
  };
}

// ─── Projection Scenario Rows (previously in ProjectionPage lines 92-93) ────

export function computeProjectionScenarios(
  mc: MonteCarloResult,
  initialValue: number,
  horizonYears: number,
): ProjectionScenarioRow[] {
  const scenarios = [
    { label: 'Optimiste (90e)', percentile: 'p90', value: mc.finalValues.p90, color: '#10b981' },
    { label: 'Favorable (75e)', percentile: 'p75', value: mc.finalValues.p75, color: '#22c55e' },
    { label: 'Mediane (50e)', percentile: 'p50', value: mc.finalValues.p50, color: C.cyan },
    { label: 'Prudent (25e)', percentile: 'p25', value: mc.finalValues.p25, color: '#f59e0b' },
    { label: 'Pessimiste (10e)', percentile: 'p10', value: mc.finalValues.p10, color: '#ef4444' },
  ];

  return scenarios.map(s => {
    const gain = s.value - initialValue;
    const annualizedReturn = horizonYears > 0
      ? Math.pow(s.value / initialValue, 1 / horizonYears) - 1
      : 0;
    return {
      label: s.label,
      percentile: s.percentile,
      finalValue: s.value,
      gain,
      annualizedReturn,
      color: s.color,
    };
  });
}

// ─── Benchmark Period Rows (previously in ComparisonsPage lines 83-84) ────

export function computeBenchmarkPeriodRows(
  periods: PerformancePeriod[],
): BenchmarkPeriodRow[] {
  const maxAbs = Math.max(
    ...periods.map(p => Math.abs(p.portfolioReturn - p.benchmarkReturn)),
    0.01,
  );

  return periods.map(p => {
    const diff = p.portfolioReturn - p.benchmarkReturn;
    return {
      period: p.period,
      portfolioReturn: p.portfolioReturn,
      benchmarkReturn: p.benchmarkReturn,
      diff,
      diffBarPct: Math.abs(diff / maxAbs) * 45,
      diffColor: diff >= 0 ? C.up : C.down,
    };
  });
}

// ─── Holding Upside % (previously in AssetSheetsPage lines 63-65) ────

export function computeUpsidePct(
  targetPrice: number | undefined | null,
  currentPrice: number,
): number | null {
  if (!targetPrice || !currentPrice || currentPrice <= 0) return null;
  return ((targetPrice - currentPrice) / currentPrice) * 100;
}

// ─── Valuation Verdict ────────────────────────────────────────

export function computeValuationVerdict(
  upsidePct: number | null,
): 'undervalued' | 'fair' | 'overvalued' | null {
  if (upsidePct === null) return null;
  if (upsidePct > 10) return 'undervalued';
  if (upsidePct < -10) return 'overvalued';
  return 'fair';
}

// ─── Month Labels for Projection Chart ────────────────────────

export function buildMonthLabels(horizonYears: number): string[] {
  const horizonMonths = horizonYears * 12;
  const labels: string[] = [];
  for (let m = 0; m <= horizonMonths; m++) {
    if (m === 0) labels.push('Auj.');
    else if (m % 12 === 0) labels.push(`An ${m / 12}`);
    else labels.push('');
  }
  return labels;
}

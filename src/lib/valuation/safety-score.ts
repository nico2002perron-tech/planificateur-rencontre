/**
 * Dual Scoring: Safety Score + Upside Potential Score
 * Pure calculation module — no external API calls.
 * Weights are customizable per advisor.
 */

import type { BenchmarkData } from './benchmarks';
import { getBenchmarkData } from './benchmarks';

// ── Interfaces ────────────────────────────────────────────────────

export interface SafetyScoreBreakdown {
  week52Position: number;    // 0-10
  betaScore: number;         // 0-10
  dividendScore: number;     // 0-10
  peReasonableness: number;  // 0-10
  epsStability: number;      // 0-10
  total: number;             // 0-10 weighted
  label: string;
  color: string;
}

export interface UpsideScoreBreakdown {
  analystUpside: number;     // 0-10
  week52Room: number;        // 0-10
  valuationUpside: number;   // 0-10
  peSectorGap: number;       // 0-10
  epsGrowth: number;         // 0-10
  totalReturn: number;       // 0-10 (retired, always 0)
  total: number;             // 0-10 weighted
  label: string;
  color: string;
}

export interface StockDualScore {
  symbol: string;
  companyName: string;
  weight: number;
  safety: SafetyScoreBreakdown;
  upside: UpsideScoreBreakdown;
  rank: number;
  quadrant: 'star' | 'safe' | 'growth' | 'watch';
  confidence: 'high' | 'medium' | 'low';
}

export interface SafetyScoreInputs {
  currentPrice: number;
  week52High: number;
  week52Low: number;
  beta: number;
  dividendYield: number;  // decimal, e.g. 0.025
  pe: number;
  eps: number;
  sectorBenchmarkPE: number;
}

export interface UpsideScoreInputs {
  currentPrice: number;
  targetPrice: number;     // analyst consensus
  week52High: number;
  week52Low: number;
  avgIntrinsic: number;    // DCF valuation
  pe: number;
  sectorBenchmarkPE: number;
  earningsGrowth: number;  // decimal
  dividendYield: number;   // decimal
  estimatedGainPercent: number;
}

// ── Customizable Weights ─────────────────────────────────────────

export interface SafetyWeights {
  week52: number;
  beta: number;
  dividend: number;
  pe: number;
  eps: number;
}

export interface UpsideWeights {
  analyst: number;
  week52: number;
  dcf: number;
  peSector: number;
  epsGrowth: number;
}

export interface CustomWeights {
  safety?: Partial<SafetyWeights>;
  upside?: Partial<UpsideWeights>;
}

export const DEFAULT_SAFETY_WEIGHTS: SafetyWeights = {
  week52: 20,
  beta: 25,
  dividend: 20,
  pe: 20,
  eps: 15,
};

export const DEFAULT_UPSIDE_WEIGHTS: UpsideWeights = {
  analyst: 30,
  week52: 15,
  dcf: 20,
  peSector: 15,
  epsGrowth: 20,
};

// Normalize weights to fractions summing to 1.0
function normalizeWeights(w: Record<string, number>): Record<string, number> {
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (sum <= 0) return w;
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(w)) {
    result[k] = v / sum;
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 10): number {
  return Math.min(max, Math.max(min, v));
}

// ── Safety Score Calculation ──────────────────────────────────────

export function calculateSafetyScore(
  inputs: SafetyScoreInputs,
  customWeights?: Partial<SafetyWeights>,
): SafetyScoreBreakdown {
  const { currentPrice, week52High, week52Low, beta, dividendYield, pe, eps, sectorBenchmarkPE } = inputs;
  const w = normalizeWeights({ ...DEFAULT_SAFETY_WEIGHTS, ...customWeights });

  // 1. Position 52 semaines — plus pres du low = meilleure opportunite
  //    Courbe adoucie: low = 10, milieu = 6.5, high = 3
  let week52Position = 5;
  if (week52High > week52Low && week52High > 0) {
    const range = week52High - week52Low;
    const positionPct = (currentPrice - week52Low) / range;
    week52Position = clamp(10 - positionPct * 7);
  }

  // 2. Beta — lower beta = safer (courbe adoucie)
  //    beta 0 → 10, beta 1.0 → 6.5, beta 2.0 → 3, beta 2.9+ → 0
  let betaScore = 5;
  if (beta > 0) {
    betaScore = clamp(10 - beta * 3.5);
  }

  // 3. Rendement dividende — cushion, penalize traps > 8%
  //    Petit dividende < 1.5% → 6.5 (adouci, etait 5.5)
  //    Aucun dividende → 5 (neutre, titres growth)
  let dividendScore = 5;
  const yieldPct = dividendYield * 100;
  if (yieldPct > 0) {
    if (yieldPct >= 8) dividendScore = 3;
    else if (yieldPct >= 5) dividendScore = 8;
    else if (yieldPct >= 3) dividendScore = 9;
    else if (yieldPct >= 1.5) dividendScore = 7;
    else dividendScore = 6.5;
  }

  // 4. PE raisonnable — PE bas vs secteur = sous-evalue
  let peReasonableness = 5;
  if (pe > 0) {
    const benchPE = sectorBenchmarkPE > 0 ? sectorBenchmarkPE : 20;
    const ratio = pe / benchPE;
    if (ratio < 0.5) peReasonableness = 8;
    else if (ratio >= 0.5 && ratio <= 1.0) peReasonableness = 9;
    else if (ratio > 1.0 && ratio <= 1.3) peReasonableness = 7;
    else if (ratio > 1.3 && ratio <= 1.8) peReasonableness = 5;
    else peReasonableness = 2;
  }

  // 5. EPS positif — positif = solide, negatif = risque
  let epsStability = 5;
  if (eps > 0) {
    epsStability = 8;
  } else if (eps === 0) {
    epsStability = 4;
  } else {
    epsStability = 1;
  }

  // Weighted total (normalized)
  const total = clamp(
    week52Position * w.week52 +
    betaScore * w.beta +
    dividendScore * w.dividend +
    peReasonableness * w.pe +
    epsStability * w.eps
  );

  const rounded = Math.round(total * 10) / 10;

  let label: string;
  let color: string;
  if (rounded >= 8) { label = 'Tres sur'; color = '#10b981'; }
  else if (rounded >= 6) { label = 'Sur'; color = '#22d3ee'; }
  else if (rounded >= 4) { label = 'Modere'; color = '#f59e0b'; }
  else if (rounded >= 2) { label = 'Risque'; color = '#f97316'; }
  else { label = 'Tres risque'; color = '#ef4444'; }

  return {
    week52Position: Math.round(week52Position * 10) / 10,
    betaScore: Math.round(betaScore * 10) / 10,
    dividendScore: Math.round(dividendScore * 10) / 10,
    peReasonableness: Math.round(peReasonableness * 10) / 10,
    epsStability: Math.round(epsStability * 10) / 10,
    total: rounded,
    label,
    color,
  };
}

// ── Upside Score Calculation ─────────────────────────────────────

export function calculateUpsideScore(
  inputs: UpsideScoreInputs,
  customWeights?: Partial<UpsideWeights>,
): UpsideScoreBreakdown {
  const {
    currentPrice, targetPrice, week52High, week52Low,
    avgIntrinsic, pe, sectorBenchmarkPE, earningsGrowth,
  } = inputs;
  const w = normalizeWeights({ ...DEFAULT_UPSIDE_WEIGHTS, ...customWeights });

  // 1. Cible analystes vs prix — higher upside = higher score
  //    Adouci: 5-15% → 6.5 (etait 5.5)
  let analystUpside = 5;
  if (targetPrice > 0 && currentPrice > 0) {
    const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
    if (upside >= 40) analystUpside = 10;
    else if (upside >= 25) analystUpside = 8.5;
    else if (upside >= 15) analystUpside = 7;
    else if (upside >= 5) analystUpside = 6.5;
    else if (upside >= 0) analystUpside = 3;
    else if (upside >= -10) analystUpside = 2;
    else analystUpside = 1;
  }

  // 2. Position 52 semaines — room to grow (courbe adoucie)
  //    low = 10, milieu = 6.5, high = 3
  let week52Room = 5;
  if (week52High > week52Low && week52High > 0) {
    const range = week52High - week52Low;
    const positionPct = (currentPrice - week52Low) / range;
    week52Room = clamp(10 - positionPct * 7);
  }

  // 3. Upside valorisation DCF
  let valuationUpside = 5;
  if (avgIntrinsic > 0 && currentPrice > 0) {
    const dcfUpside = ((avgIntrinsic - currentPrice) / currentPrice) * 100;
    if (dcfUpside >= 50) valuationUpside = 10;
    else if (dcfUpside >= 30) valuationUpside = 8;
    else if (dcfUpside >= 15) valuationUpside = 7;
    else if (dcfUpside >= 5) valuationUpside = 5.5;
    else if (dcfUpside >= 0) valuationUpside = 4;
    else if (dcfUpside >= -15) valuationUpside = 2.5;
    else valuationUpside = 1;
  }

  // 4. PE vs secteur — PE below benchmark = expansion potential
  let peSectorGap = 5;
  if (pe > 0 && sectorBenchmarkPE > 0) {
    const ratio = pe / sectorBenchmarkPE;
    if (ratio < 0.5) peSectorGap = 9;
    else if (ratio < 0.75) peSectorGap = 8;
    else if (ratio < 1.0) peSectorGap = 6.5;
    else if (ratio < 1.2) peSectorGap = 4;
    else peSectorGap = 2;
  }

  // 5. Croissance EPS — adouci: 5-10% → 6 (etait 5.5)
  let epsGrowthScore = 5;
  if (earningsGrowth !== 0) {
    const gr = earningsGrowth * 100;
    if (gr >= 30) epsGrowthScore = 10;
    else if (gr >= 20) epsGrowthScore = 8;
    else if (gr >= 10) epsGrowthScore = 7;
    else if (gr >= 5) epsGrowthScore = 6;
    else if (gr >= 0) epsGrowthScore = 4;
    else epsGrowthScore = 2;
  }

  // Weighted total (normalized)
  const total = clamp(
    analystUpside * w.analyst +
    week52Room * w.week52 +
    valuationUpside * w.dcf +
    peSectorGap * w.peSector +
    epsGrowthScore * w.epsGrowth
  );

  const rounded = Math.round(total * 10) / 10;

  let label: string;
  let color: string;
  if (rounded >= 8) { label = 'Excellent'; color = '#10b981'; }
  else if (rounded >= 6) { label = 'Bon'; color = '#22d3ee'; }
  else if (rounded >= 4) { label = 'Modere'; color = '#f59e0b'; }
  else if (rounded >= 2) { label = 'Faible'; color = '#f97316'; }
  else { label = 'Tres faible'; color = '#ef4444'; }

  return {
    analystUpside: Math.round(analystUpside * 10) / 10,
    week52Room: Math.round(week52Room * 10) / 10,
    valuationUpside: Math.round(valuationUpside * 10) / 10,
    peSectorGap: Math.round(peSectorGap * 10) / 10,
    epsGrowth: Math.round(epsGrowthScore * 10) / 10,
    totalReturn: 0, // retire du calcul
    total: rounded,
    label,
    color,
  };
}

// ── Combined Dual Scoring ────────────────────────────────────────

interface DualScoreHolding {
  symbol: string;
  companyName: string;
  currentPrice: number;
  weight: number;
  beta: number;
  pe: number;
  eps: number;
  week52High: number;
  week52Low: number;
  dividendYield: number;
  earningsGrowth: number;
  targetPrice: number;
  estimatedGainPercent: number;
  sector: string;
  assetClass: string;
}

interface DualScoreValuation {
  symbol: string;
  avgIntrinsic: number;
}

export function calculateDualScores(
  holdings: DualScoreHolding[],
  valuations: DualScoreValuation[],
  benchmarkMap?: Map<string, BenchmarkData>,
  weights?: CustomWeights,
): StockDualScore[] {
  const valMap = new Map(valuations.map(v => [v.symbol, v]));
  const scores: StockDualScore[] = [];

  for (const h of holdings) {
    if (h.assetClass === 'CASH') continue;

    const bench = benchmarkMap?.get(h.symbol) ?? getBenchmarkData(h.symbol, h.sector);
    const val = valMap.get(h.symbol);

    let realDataPoints = 0;
    if (h.pe > 0) realDataPoints++;
    if (h.eps !== 0) realDataPoints++;
    if (h.beta > 0) realDataPoints++;
    if (h.week52High > 0) realDataPoints++;
    if (h.earningsGrowth !== 0) realDataPoints++;

    let confidence: 'high' | 'medium' | 'low';
    if (realDataPoints >= 4) confidence = 'high';
    else if (realDataPoints >= 2) confidence = 'medium';
    else confidence = 'low';

    const safety = calculateSafetyScore({
      currentPrice: h.currentPrice,
      week52High: h.week52High,
      week52Low: h.week52Low,
      beta: h.beta,
      dividendYield: h.dividendYield,
      pe: h.pe,
      eps: h.eps,
      sectorBenchmarkPE: bench.pe,
    }, weights?.safety);

    const upside = calculateUpsideScore({
      currentPrice: h.currentPrice,
      targetPrice: h.targetPrice,
      week52High: h.week52High,
      week52Low: h.week52Low,
      avgIntrinsic: val?.avgIntrinsic ?? 0,
      pe: h.pe,
      sectorBenchmarkPE: bench.pe,
      earningsGrowth: h.earningsGrowth,
      dividendYield: h.dividendYield,
      estimatedGainPercent: h.estimatedGainPercent,
    }, weights?.upside);

    let quadrant: 'star' | 'safe' | 'growth' | 'watch';
    if (safety.total >= 6 && upside.total >= 6) quadrant = 'star';
    else if (safety.total >= 6) quadrant = 'safe';
    else if (upside.total >= 6) quadrant = 'growth';
    else quadrant = 'watch';

    scores.push({
      symbol: h.symbol,
      companyName: h.companyName,
      weight: h.weight,
      safety,
      upside,
      rank: 0,
      quadrant,
      confidence,
    });
  }

  return scores;
}

// ── Ranking ──────────────────────────────────────────────────────

export function rankStocks(scores: StockDualScore[]): StockDualScore[] {
  const sorted = [...scores].sort((a, b) => {
    const compositeA = a.safety.total * 0.5 + a.upside.total * 0.5;
    const compositeB = b.safety.total * 0.5 + b.upside.total * 0.5;
    return compositeB - compositeA;
  });

  sorted.forEach((s, i) => { s.rank = i + 1; });
  return sorted;
}

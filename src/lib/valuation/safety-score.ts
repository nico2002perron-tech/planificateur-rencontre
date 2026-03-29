/**
 * Dual Scoring: Safety Score + Upside Potential Score
 * Pure calculation module — no external API calls.
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
  totalReturn: number;       // 0-10
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

// ── Safety Score Calculation ──────────────────────────────────────

function clamp(v: number, min = 0, max = 10): number {
  return Math.min(max, Math.max(min, v));
}

export function calculateSafetyScore(inputs: SafetyScoreInputs): SafetyScoreBreakdown {
  const { currentPrice, week52High, week52Low, beta, dividendYield, pe, eps, sectorBenchmarkPE } = inputs;

  // 1. Position 52 semaines (20%) — plus pres du low = meilleure opportunite
  let week52Position = 5;
  if (week52High > week52Low && week52High > 0) {
    const range = week52High - week52Low;
    const positionPct = (currentPrice - week52Low) / range; // 0 (au low) to 1 (au high)
    // Proche du low = score eleve, proche du high = score bas
    week52Position = clamp(10 - positionPct * 10);
  }

  // 2. Beta (25%) — lower beta = safer (smooth curve)
  let betaScore = 5;
  if (beta > 0) {
    // Continuous curve: beta 0 → 10, beta 1 → 6, beta 2+ → 0
    betaScore = clamp(10 - beta * 4.5);
  }

  // 3. Rendement dividende (20%) — cushion, but penalize traps > 8%
  let dividendScore = 5;
  const yieldPct = dividendYield * 100;
  if (yieldPct > 0) {
    if (yieldPct >= 8) dividendScore = 3;       // yield trap risk
    else if (yieldPct >= 5) dividendScore = 8;
    else if (yieldPct >= 3) dividendScore = 9;
    else if (yieldPct >= 1.5) dividendScore = 7;
    else dividendScore = 5.5;
  }
  // no dividend = neutre (titres growth comme NVDA, GOOG)

  // 4. PE raisonnable (20%) — PE bas vs secteur = sous-evalue
  let peReasonableness = 5;
  if (pe > 0) {
    const benchPE = sectorBenchmarkPE > 0 ? sectorBenchmarkPE : 20;
    const ratio = pe / benchPE;
    if (ratio < 0.5) peReasonableness = 8;          // tres sous-evalue
    else if (ratio >= 0.5 && ratio <= 1.0) peReasonableness = 9;  // sweet spot
    else if (ratio > 1.0 && ratio <= 1.3) peReasonableness = 7;
    else if (ratio > 1.3 && ratio <= 1.8) peReasonableness = 5;
    else peReasonableness = 2;                       // surevalu
  }

  // 5. EPS positif (15%) — positif = solide, negatif = risque
  let epsStability = 5;
  if (eps > 0) {
    epsStability = 8; // benefices positifs = bon signe
  } else if (eps === 0) {
    epsStability = 4; // breakeven
  } else {
    epsStability = 1; // pertes = risque
  }

  // Weighted total
  const total = clamp(
    week52Position * 0.20 +
    betaScore * 0.25 +
    dividendScore * 0.20 +
    peReasonableness * 0.20 +
    epsStability * 0.15
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

export function calculateUpsideScore(inputs: UpsideScoreInputs): UpsideScoreBreakdown {
  const {
    currentPrice, targetPrice, week52High, week52Low,
    avgIntrinsic, pe, sectorBenchmarkPE, earningsGrowth,
    dividendYield, estimatedGainPercent,
  } = inputs;

  // 1. Cible analystes vs prix (30%) — higher upside = higher score
  let analystUpside = 5;
  if (targetPrice > 0 && currentPrice > 0) {
    const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
    if (upside >= 40) analystUpside = 10;
    else if (upside >= 25) analystUpside = 8.5;
    else if (upside >= 15) analystUpside = 7;
    else if (upside >= 5) analystUpside = 5.5;
    else if (upside >= 0) analystUpside = 3;   // prix juste = peu de potentiel
    else if (upside >= -10) analystUpside = 2;
    else analystUpside = 1;
  }

  // 2. Position 52 semaines — room to grow (15%) — near low = more upside
  let week52Room = 5;
  if (week52High > week52Low && week52High > 0) {
    const range = week52High - week52Low;
    const positionPct = (currentPrice - week52Low) / range;
    // Near low = more room; near high = less room
    week52Room = clamp(10 - positionPct * 10);
  }

  // 3. Upside valorisation DCF (20%)
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

  // 4. PE vs secteur (15%) — PE below benchmark = expansion potential
  let peSectorGap = 5;
  if (pe > 0 && sectorBenchmarkPE > 0) {
    const ratio = pe / sectorBenchmarkPE;
    if (ratio < 0.5) peSectorGap = 9;
    else if (ratio < 0.75) peSectorGap = 8;
    else if (ratio < 1.0) peSectorGap = 6.5;
    else if (ratio < 1.2) peSectorGap = 4;
    else peSectorGap = 2;
  }

  // 5. Croissance EPS (20%) — poids augmente (ancien 15% + 5% redistribue)
  let epsGrowthScore = 5;
  if (earningsGrowth !== 0) {
    const gr = earningsGrowth * 100; // to percent
    if (gr >= 30) epsGrowthScore = 10;
    else if (gr >= 20) epsGrowthScore = 8;
    else if (gr >= 10) epsGrowthScore = 7;
    else if (gr >= 5) epsGrowthScore = 5.5;
    else if (gr >= 0) epsGrowthScore = 4;
    else epsGrowthScore = 2;
  }

  // Note: "rendement total" retire — double comptage avec cible analystes + dividende
  // Poids redistribues: analystes 25→30%, 52s 15→15%, DCF 20→20%, PE 15→15%, EPS 15→20%

  // Weighted total
  const total = clamp(
    analystUpside * 0.30 +
    week52Room * 0.15 +
    valuationUpside * 0.20 +
    peSectorGap * 0.15 +
    epsGrowthScore * 0.20
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
    totalReturn: 0, // retire du calcul (double comptage)
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
  benchmarkMap?: Map<string, BenchmarkData>
): StockDualScore[] {
  const valMap = new Map(valuations.map(v => [v.symbol, v]));

  const scores: StockDualScore[] = [];

  for (const h of holdings) {
    // Skip cash positions
    if (h.assetClass === 'CASH') continue;

    const bench = benchmarkMap?.get(h.symbol) ?? getBenchmarkData(h.symbol, h.sector);
    const val = valMap.get(h.symbol);

    // Count how many real data points we have
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
    });

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
    });

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
      rank: 0, // assigned by rankStocks
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

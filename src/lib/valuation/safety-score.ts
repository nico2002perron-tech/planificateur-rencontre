/**
 * Dual Scoring: Safety Score + Upside Potential Score
 * Pure calculation module — no external API calls.
 *
 * Safety score: modeled on institutional risk frameworks (Graham/Dodd, MSCI).
 * 6 fundamental factors + red-flag overrides.
 * Weights are customizable per advisor.
 */

import type { BenchmarkData } from './benchmarks';
import { getBenchmarkData } from './benchmarks';

// ── Interfaces ────────────────────────────────────────────────────

export interface SafetyScoreBreakdown {
  balanceSheetScore: number; // 0-10 (D/E + Current Ratio combined)
  betaScore: number;         // 0-10
  profitabilityScore: number;// 0-10 (margins + growth combined, EPS cap)
  valuationScore: number;    // 0-10 (PE absolute)
  sizeScore: number;         // 0-10 (market cap)
  dividendScore: number;     // 0-10
  total: number;             // 0-10 weighted, after red-flag caps
  label: string;
  color: string;
  redFlag: string | null;    // null if none, description if capped
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
  beta: number;
  dividendYield: number;   // decimal, e.g. 0.025
  pe: number;
  eps: number;             // for red-flag check only
  profitMargins: number;   // decimal, e.g. 0.25 = 25%
  debtToEquity: number;    // e.g. 150 = 150%
  currentRatio: number;    // e.g. 1.5
  earningsGrowth: number;  // decimal, e.g. 0.12 = 12%
  marketCap: number;       // dollars
  sector: string;          // for sector-adjusted D/E (financials)
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
  balanceSheet: number;
  beta: number;
  profitability: number;
  valuation: number;
  size: number;
  dividend: number;
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
  safetyAdj?: Partial<SafetyWeights>;   // per-factor adjustment -2 to +2
  upsideAdj?: Partial<UpsideWeights>;   // per-factor adjustment -2 to +2
}

export const DEFAULT_SAFETY_WEIGHTS: SafetyWeights = {
  balanceSheet: 25,
  beta: 20,
  profitability: 20,
  valuation: 15,
  size: 10,
  dividend: 10,
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

function rd(v: number): number {
  return Math.round(v * 10) / 10;
}

const FINANCIAL_SECTORS = new Set([
  'Financial Services', 'Financials', 'Banks', 'Insurance',
  'financial services', 'financials',
]);

// ── Safety Score Calculation ──────────────────────────────────────

export function calculateSafetyScore(
  inputs: SafetyScoreInputs,
  customWeights?: Partial<SafetyWeights>,
  adjustments?: Partial<SafetyWeights>,
): SafetyScoreBreakdown {
  const {
    beta, dividendYield, pe, eps, profitMargins, debtToEquity,
    currentRatio, earningsGrowth, marketCap, sector,
  } = inputs;
  const w = normalizeWeights({ ...DEFAULT_SAFETY_WEIGHTS, ...customWeights });
  const isFinancial = FINANCIAL_SECTORS.has(sector);

  // ── 1. Bilan financier (D/E + Current Ratio combinés) ──
  //    Score neutre (5) pour le secteur financier (business model leverage)
  let debtSub = 5;
  let liqSub = 5;

  if (isFinancial) {
    // Banques/assureurs : D/E et CR ne s'appliquent pas normalement
    debtSub = 5;
    liqSub = 5;
  } else {
    if (debtToEquity > 0) {
      if (debtToEquity <= 30) debtSub = 10;
      else if (debtToEquity <= 80) debtSub = 8;
      else if (debtToEquity <= 150) debtSub = 6;
      else if (debtToEquity <= 250) debtSub = 3;
      else debtSub = 1;
    }
    if (currentRatio > 0) {
      if (currentRatio >= 2.5) liqSub = 10;
      else if (currentRatio >= 2.0) liqSub = 9;
      else if (currentRatio >= 1.5) liqSub = 7;
      else if (currentRatio >= 1.0) liqSub = 5;
      else if (currentRatio >= 0.5) liqSub = 2;
      else liqSub = 0;
    }
  }
  let balanceSheetScore = debtSub * 0.6 + liqSub * 0.4;

  // ── 2. Beta / Risque marché ──
  let betaScore = 5;
  if (beta < 0) {
    betaScore = 7; // negatively correlated = defensive
  } else if (beta > 0) {
    if (beta <= 0.5) betaScore = 10;
    else if (beta <= 0.8) betaScore = 8;
    else if (beta <= 1.0) betaScore = 6;
    else if (beta <= 1.3) betaScore = 4;
    else if (beta <= 1.8) betaScore = 2;
    else betaScore = 0;
  }

  // ── 3. Rentabilité (marges + croissance, cap BPA négatif) ──
  let marginSub = 5;
  if (profitMargins !== 0) {
    const mPct = profitMargins * 100;
    if (mPct >= 25) marginSub = 10;
    else if (mPct >= 15) marginSub = 8;
    else if (mPct >= 8) marginSub = 6;
    else if (mPct >= 3) marginSub = 4;
    else if (mPct >= 0) marginSub = 2;
    else marginSub = 0;
  }

  let growthSub = 5;
  if (earningsGrowth !== 0) {
    const gr = earningsGrowth * 100;
    if (gr >= 15) growthSub = 10;
    else if (gr >= 5) growthSub = 8;
    else if (gr >= 0) growthSub = 6;
    else if (gr >= -10) growthSub = 3;
    else growthSub = 1;
  }

  let profitabilityScore = marginSub * 0.65 + growthSub * 0.35;
  // Hard cap: BPA négatif = rentabilité plafonnée à 2/10
  if (eps < 0) {
    profitabilityScore = Math.min(profitabilityScore, 2);
  }

  // ── 4. Valorisation (PE absolu — pas relatif au secteur) ──
  //    PE très bas (<5) = signal ambigu (value trap possible)
  let valuationScore = 4; // neutre-bas si pas de PE (pas de bénéfices)
  if (pe > 0) {
    if (pe >= 8 && pe <= 16) valuationScore = 10;
    else if (pe > 5 && pe < 8) valuationScore = 8;
    else if (pe > 16 && pe <= 22) valuationScore = 8;
    else if (pe > 22 && pe <= 30) valuationScore = 6;
    else if (pe > 30 && pe <= 45) valuationScore = 4;
    else if (pe > 45 && pe <= 80) valuationScore = 2;
    else if (pe > 80) valuationScore = 1;
    else valuationScore = 6; // PE 0-5: très bas, signal ambigu
  } else if (pe < 0) {
    valuationScore = 1; // bénéfices négatifs
  }

  // ── 5. Taille (capitalisation boursière) ──
  let sizeScore = 5;
  if (marketCap > 0) {
    const capB = marketCap / 1e9; // en milliards
    if (capB >= 200) sizeScore = 10;
    else if (capB >= 50) sizeScore = 9;
    else if (capB >= 10) sizeScore = 7;
    else if (capB >= 2) sizeScore = 5;
    else if (capB >= 0.5) sizeScore = 3;
    else sizeScore = 1;
  }

  // ── 6. Dividende ──
  let dividendScore = 3; // pas de dividende = peu de coussin
  const yieldPct = dividendYield * 100;
  if (yieldPct > 0) {
    if (yieldPct >= 2 && yieldPct <= 4) dividendScore = 10;
    else if (yieldPct > 4 && yieldPct <= 5) dividendScore = 8;
    else if (yieldPct >= 1 && yieldPct < 2) dividendScore = 7;
    else if (yieldPct > 5 && yieldPct <= 7) dividendScore = 5;
    else if (yieldPct > 0.5 && yieldPct < 1) dividendScore = 5;
    else if (yieldPct > 7) dividendScore = 3; // rendement piège
    else dividendScore = 4; // très petit dividende
  }

  // Apply per-factor adjustments (Strict -1 / Normal 0 / Souple +1)
  if (adjustments) {
    balanceSheetScore = clamp(balanceSheetScore + (adjustments.balanceSheet ?? 0));
    betaScore = clamp(betaScore + (adjustments.beta ?? 0));
    profitabilityScore = clamp(profitabilityScore + (adjustments.profitability ?? 0));
    valuationScore = clamp(valuationScore + (adjustments.valuation ?? 0));
    sizeScore = clamp(sizeScore + (adjustments.size ?? 0));
    dividendScore = clamp(dividendScore + (adjustments.dividend ?? 0));
  }

  // Weighted total (normalized)
  let total = clamp(
    balanceSheetScore * w.balanceSheet +
    betaScore * w.beta +
    profitabilityScore * w.profitability +
    valuationScore * w.valuation +
    sizeScore * w.size +
    dividendScore * w.dividend
  );

  // ── Red-flag overrides — plafonnent le score final ──
  let redFlag: string | null = null;

  if (eps < 0 && debtToEquity > 150) {
    total = Math.min(total, 2.0);
    redFlag = 'BPA negatif + endettement eleve';
  }
  if (profitMargins < 0 && currentRatio > 0 && currentRatio < 1.0) {
    total = Math.min(total, 2.5);
    redFlag = redFlag ?? 'Marges negatives + liquidite insuffisante';
  }
  if (beta > 2.0 && pe > 60) {
    total = Math.min(total, 3.0);
    redFlag = redFlag ?? 'Beta eleve + valorisation speculative';
  }
  if (marketCap > 0 && marketCap < 300_000_000 && eps <= 0) {
    total = Math.min(total, 2.0);
    redFlag = redFlag ?? 'Micro cap sans benefices';
  }

  const rounded = rd(total);

  let label: string;
  let color: string;
  if (rounded >= 8) { label = 'Tres sur'; color = '#10b981'; }
  else if (rounded >= 6) { label = 'Sur'; color = '#22d3ee'; }
  else if (rounded >= 4) { label = 'Modere'; color = '#f59e0b'; }
  else if (rounded >= 2) { label = 'Risque'; color = '#f97316'; }
  else { label = 'Tres risque'; color = '#ef4444'; }

  return {
    balanceSheetScore: rd(balanceSheetScore),
    betaScore: rd(betaScore),
    profitabilityScore: rd(profitabilityScore),
    valuationScore: rd(valuationScore),
    sizeScore: rd(sizeScore),
    dividendScore: rd(dividendScore),
    total: rounded,
    label,
    color,
    redFlag,
  };
}

// ── Upside Score Calculation ─────────────────────────────────────

export function calculateUpsideScore(
  inputs: UpsideScoreInputs,
  customWeights?: Partial<UpsideWeights>,
  adjustments?: Partial<UpsideWeights>,
): UpsideScoreBreakdown {
  const {
    currentPrice, targetPrice, week52High, week52Low,
    avgIntrinsic, pe, sectorBenchmarkPE, earningsGrowth,
  } = inputs;
  const w = normalizeWeights({ ...DEFAULT_UPSIDE_WEIGHTS, ...customWeights });

  // 1. Cible analystes vs prix
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

  // 2. Position 52 semaines — room to grow
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

  // 5. Croissance EPS
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

  // Apply per-factor adjustments
  if (adjustments) {
    analystUpside = clamp(analystUpside + (adjustments.analyst ?? 0));
    week52Room = clamp(week52Room + (adjustments.week52 ?? 0));
    valuationUpside = clamp(valuationUpside + (adjustments.dcf ?? 0));
    peSectorGap = clamp(peSectorGap + (adjustments.peSector ?? 0));
    epsGrowthScore = clamp(epsGrowthScore + (adjustments.epsGrowth ?? 0));
  }

  // Weighted total (normalized)
  const total = clamp(
    analystUpside * w.analyst +
    week52Room * w.week52 +
    valuationUpside * w.dcf +
    peSectorGap * w.peSector +
    epsGrowthScore * w.epsGrowth
  );

  const rounded = rd(total);

  let label: string;
  let color: string;
  if (rounded >= 8) { label = 'Excellent'; color = '#10b981'; }
  else if (rounded >= 6) { label = 'Bon'; color = '#22d3ee'; }
  else if (rounded >= 4) { label = 'Modere'; color = '#f59e0b'; }
  else if (rounded >= 2) { label = 'Faible'; color = '#f97316'; }
  else { label = 'Tres faible'; color = '#ef4444'; }

  return {
    analystUpside: rd(analystUpside),
    week52Room: rd(week52Room),
    valuationUpside: rd(valuationUpside),
    peSectorGap: rd(peSectorGap),
    epsGrowth: rd(epsGrowthScore),
    totalReturn: 0,
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
  profitMargins: number;
  debtToEquity: number;
  currentRatio: number;
  marketCap: number;
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

    // Confidence based on available data points
    let realDataPoints = 0;
    if (h.pe > 0) realDataPoints++;
    if (h.beta > 0) realDataPoints++;
    if (h.profitMargins !== 0) realDataPoints++;
    if (h.debtToEquity > 0) realDataPoints++;
    if (h.currentRatio > 0) realDataPoints++;
    if (h.marketCap > 0) realDataPoints++;
    if (h.earningsGrowth !== 0) realDataPoints++;
    if (h.dividendYield > 0) realDataPoints++;

    let confidence: 'high' | 'medium' | 'low';
    if (realDataPoints >= 6) confidence = 'high';
    else if (realDataPoints >= 3) confidence = 'medium';
    else confidence = 'low';

    const safety = calculateSafetyScore({
      beta: h.beta,
      dividendYield: h.dividendYield,
      pe: h.pe,
      eps: h.eps,
      profitMargins: h.profitMargins,
      debtToEquity: h.debtToEquity,
      currentRatio: h.currentRatio,
      earningsGrowth: h.earningsGrowth,
      marketCap: h.marketCap,
      sector: h.sector,
    }, weights?.safety, weights?.safetyAdj);

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
    }, weights?.upside, weights?.upsideAdj);

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

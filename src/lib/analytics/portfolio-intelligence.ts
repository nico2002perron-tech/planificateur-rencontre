// =============================================================================
// PORTFOLIO INTELLIGENCE SCORE
// Composite score /100 built from 7 sub-scores — the portfolio's overall grade.
// Each sub-score is 0-100 and weighted to produce the final composite.
// =============================================================================

export interface PortfolioIntelligenceScore {
  overall: number;           // 0-100
  grade: string;             // A+, A, B+, B, C+, C, D
  label: string;             // "Excellent", "Tres bon", etc.
  color: string;
  subScores: SubScore[];
}

export interface SubScore {
  name: string;
  score: number;             // 0-100
  weight: number;            // Decimal weight (e.g. 0.20)
  icon: string;              // For display
  description: string;       // One-line factual description
}

export interface ScoreInputs {
  // Diversification inputs
  hhi: number;                          // Position HHI
  avgCorrelation: number;               // Average pairwise correlation
  top5Concentration: number;            // % in top 5 positions
  numPositions: number;
  numSectors: number;

  // Growth inputs
  weightedRevenueGrowth: number;        // Portfolio-weighted
  weightedEarningsGrowth: number;
  weightedROE: number;

  // Income inputs
  portfolioYield: number;               // Blended dividend/coupon yield
  dividendCoverage: number;             // Avg payout ratio (lower = better covered)
  incomeGrowth: number;                 // Historical dividend growth

  // Resilience inputs
  beta: number;
  maxDrawdown: number;                  // Negative number
  var95: number;                        // Negative number
  avgDownsideCapture: number;           // Lower = more resilient

  // Valuation inputs
  avgUpsideToFairValue: number;         // % upside to DCF fair value
  weightedPE: number;
  weightedPEG: number;

  // Stability inputs
  annualizedVolatility: number;
  sortinoRatio: number;
  positiveMonthPct: number;             // % of months positive

  // Quality inputs
  weightedProfitMargin: number;
  weightedDebtToEquity: number;
  weightedCurrentRatio: number;
}

/**
 * MAIN: Calculate the Portfolio Intelligence Score
 */
export function calculatePortfolioIntelligence(inputs: ScoreInputs): PortfolioIntelligenceScore {
  const subScores: SubScore[] = [
    {
      name: 'Diversification',
      score: scoreDiversification(inputs),
      weight: 0.20,
      icon: 'grid',
      description: buildDiversificationDesc(inputs),
    },
    {
      name: 'Croissance',
      score: scoreGrowth(inputs),
      weight: 0.15,
      icon: 'trending-up',
      description: buildGrowthDesc(inputs),
    },
    {
      name: 'Revenu',
      score: scoreIncome(inputs),
      weight: 0.15,
      icon: 'dollar-sign',
      description: buildIncomeDesc(inputs),
    },
    {
      name: 'Resilience',
      score: scoreResilience(inputs),
      weight: 0.15,
      icon: 'shield',
      description: buildResilienceDesc(inputs),
    },
    {
      name: 'Valorisation',
      score: scoreValuation(inputs),
      weight: 0.15,
      icon: 'target',
      description: buildValuationDesc(inputs),
    },
    {
      name: 'Stabilite',
      score: scoreStability(inputs),
      weight: 0.10,
      icon: 'activity',
      description: buildStabilityDesc(inputs),
    },
    {
      name: 'Qualite',
      score: scoreQuality(inputs),
      weight: 0.10,
      icon: 'award',
      description: buildQualityDesc(inputs),
    },
  ];

  const overall = Math.round(
    subScores.reduce((sum, s) => sum + s.score * s.weight, 0)
  );

  return {
    overall,
    grade: getGrade(overall),
    label: getLabel(overall),
    color: getColor(overall),
    subScores,
  };
}

// -----------------------------------------------------------------------
// Sub-score calculators (each returns 0-100)
// -----------------------------------------------------------------------

function scoreDiversification(i: ScoreInputs): number {
  // HHI: 200 (50 equal) = 100, 10000 (1 position) = 0
  const hhiScore = lerp(i.hhi, 5000, 200, 0, 100);
  // Correlation: 0 = 100, 1 = 0
  const corrScore = lerp(i.avgCorrelation, 0.8, 0.1, 0, 100);
  // Top 5: <30% = great, >70% = bad
  const concScore = lerp(i.top5Concentration, 0.70, 0.25, 0, 100);
  // Positions: 20+ = 100
  const numScore = Math.min(100, (i.numPositions / 20) * 100);
  // Sectors: 8+ = 100
  const sectorScore = Math.min(100, (i.numSectors / 8) * 100);

  return Math.round(hhiScore * 0.25 + corrScore * 0.25 + concScore * 0.20 + numScore * 0.15 + sectorScore * 0.15);
}

function scoreGrowth(i: ScoreInputs): number {
  // Revenue growth: 15%+ = excellent
  const revScore = lerp(i.weightedRevenueGrowth, -0.05, 0.15, 0, 100);
  // Earnings growth: 15%+ = excellent
  const epsScore = lerp(i.weightedEarningsGrowth, -0.05, 0.20, 0, 100);
  // ROE: 20%+ = excellent
  const roeScore = lerp(i.weightedROE, 0, 25, 0, 100);

  return Math.round(revScore * 0.35 + epsScore * 0.40 + roeScore * 0.25);
}

function scoreIncome(i: ScoreInputs): number {
  // Yield: 0% = 0, 4%+ = 100
  const yieldScore = lerp(i.portfolioYield, 0, 0.04, 0, 100);
  // Coverage: low payout = good (< 50% ideal)
  const coverageScore = i.dividendCoverage > 0
    ? lerp(i.dividendCoverage, 0.90, 0.30, 0, 100)
    : 50; // No data = neutral
  // Growth: 5%+ annual dividend growth = excellent
  const growthScore = lerp(i.incomeGrowth, -0.02, 0.08, 0, 100);

  return Math.round(yieldScore * 0.45 + coverageScore * 0.25 + growthScore * 0.30);
}

function scoreResilience(i: ScoreInputs): number {
  // Beta: <0.7 = excellent, >1.3 = poor
  const betaScore = lerp(i.beta, 1.5, 0.6, 0, 100);
  // Max drawdown: <10% = great, >40% = terrible
  const ddScore = lerp(Math.abs(i.maxDrawdown), 0.45, 0.08, 0, 100);
  // VaR 95: closer to 0 = better
  const varScore = lerp(Math.abs(i.var95), 0.40, 0.05, 0, 100);
  // Downside capture: <80 = good, >120 = bad
  const captureScore = lerp(i.avgDownsideCapture, 130, 60, 0, 100);

  return Math.round(betaScore * 0.30 + ddScore * 0.30 + varScore * 0.20 + captureScore * 0.20);
}

function scoreValuation(i: ScoreInputs): number {
  // Upside to fair value: positive = good
  const upsideScore = lerp(i.avgUpsideToFairValue, -0.20, 0.25, 0, 100);
  // P/E: lower relative to growth
  const peScore = i.weightedPE > 0
    ? lerp(i.weightedPE, 35, 12, 0, 100)
    : 50;
  // PEG: <1 = excellent, >2 = expensive
  const pegScore = i.weightedPEG > 0
    ? lerp(i.weightedPEG, 3.0, 0.8, 0, 100)
    : 50;

  return Math.round(upsideScore * 0.40 + peScore * 0.30 + pegScore * 0.30);
}

function scoreStability(i: ScoreInputs): number {
  // Volatility: <10% = excellent, >25% = high
  const volScore = lerp(i.annualizedVolatility, 0.30, 0.08, 0, 100);
  // Sortino: >2 = excellent, <0.5 = poor
  const sortinoScore = lerp(i.sortinoRatio, 0, 2.5, 0, 100);
  // Positive months: >65% = good
  const posScore = lerp(i.positiveMonthPct, 0.40, 0.70, 0, 100);

  return Math.round(volScore * 0.40 + sortinoScore * 0.35 + posScore * 0.25);
}

function scoreQuality(i: ScoreInputs): number {
  // Profit margin: >15% = quality
  const marginScore = lerp(i.weightedProfitMargin, 0, 0.20, 0, 100);
  // Debt/equity: <1.0 = healthy
  const debtScore = lerp(i.weightedDebtToEquity, 3.0, 0.3, 0, 100);
  // Current ratio: >1.5 = healthy
  const liquidityScore = lerp(i.weightedCurrentRatio, 0.5, 2.0, 0, 100);

  return Math.round(marginScore * 0.40 + debtScore * 0.35 + liquidityScore * 0.25);
}

// -----------------------------------------------------------------------
// Description builders (factual, no opinions)
// -----------------------------------------------------------------------

function buildDiversificationDesc(i: ScoreInputs): string {
  return `${i.numPositions} positions dans ${i.numSectors} secteurs, top 5 = ${(i.top5Concentration * 100).toFixed(0)}%`;
}

function buildGrowthDesc(i: ScoreInputs): string {
  return `Croissance revenus ${(i.weightedRevenueGrowth * 100).toFixed(0)}%, BPA ${(i.weightedEarningsGrowth * 100).toFixed(0)}%, ROE ${i.weightedROE.toFixed(0)}%`;
}

function buildIncomeDesc(i: ScoreInputs): string {
  return `Rendement de ${(i.portfolioYield * 100).toFixed(1)}%`;
}

function buildResilienceDesc(i: ScoreInputs): string {
  return `Beta ${i.beta.toFixed(2)}, drawdown max ${(i.maxDrawdown * 100).toFixed(0)}%`;
}

function buildValuationDesc(i: ScoreInputs): string {
  const direction = i.avgUpsideToFairValue >= 0 ? 'sous-evalue' : 'surevalue';
  return `Portefeuille ${direction} de ${(Math.abs(i.avgUpsideToFairValue) * 100).toFixed(0)}% vs juste valeur`;
}

function buildStabilityDesc(i: ScoreInputs): string {
  return `Volatilite ${(i.annualizedVolatility * 100).toFixed(0)}%, Sortino ${i.sortinoRatio.toFixed(2)}`;
}

function buildQualityDesc(i: ScoreInputs): string {
  return `Marge nette ${(i.weightedProfitMargin * 100).toFixed(0)}%, dette/equity ${i.weightedDebtToEquity.toFixed(1)}x`;
}

// -----------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------

/** Linear interpolation: maps value from [fromLow, fromHigh] to [toLow, toHigh], clamped */
function lerp(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
  if (fromLow === fromHigh) return (toLow + toHigh) / 2;
  const t = (value - fromLow) / (fromHigh - fromLow);
  const clamped = Math.max(0, Math.min(1, t));
  return toLow + clamped * (toHigh - toLow);
}

function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  return 'D';
}

function getLabel(score: number): string {
  if (score >= 90) return 'Exceptionnel';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Tres bon';
  if (score >= 60) return 'Bon';
  if (score >= 50) return 'Correct';
  if (score >= 40) return 'A ameliorer';
  return 'Faible';
}

function getColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#00b4d8';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

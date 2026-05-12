// =============================================================================
// BOND ANALYTICS ENGINE
// Duration, convexity, credit quality, maturity ladder, stress tests
// =============================================================================

export interface BondAnalytics {
  // Portfolio-level metrics
  weightedAvgCoupon: number;
  weightedAvgYield: number;
  weightedAvgMaturityYears: number;
  modifiedDuration: number;
  macaulayDuration: number;
  convexity: number;
  totalAnnualIncome: number;
  avgCreditQuality: string;

  // Credit quality distribution
  creditDistribution: Array<{
    rating: string;
    weight: number;
    color: string;
  }>;

  // Maturity ladder
  maturityLadder: Array<{
    bucket: string;
    weight: number;
    count: number;
  }>;

  // Stress tests
  stressTests: Array<{
    scenario: string;
    rateChange: number;        // e.g. +0.01 for +1%
    estimatedPriceImpact: number; // e.g. -0.03 for -3%
    estimatedDollarImpact: number;
    color: string;
  }>;

  // Real return
  realYield: number;           // Yield minus inflation
  inflationAssumption: number;
}

export interface BondHolding {
  symbol: string;
  name: string;
  weight: number;              // Weight in total portfolio (not just bond sleeve)
  weightInBonds: number;       // Weight within bond allocation
  coupon: number;              // Annual coupon rate (%)
  yieldToMaturity: number;     // YTM (%)
  maturityDate: string;        // YYYY-MM-DD
  parValue: number;
  marketPrice: number;
  rating: string;              // S&P style: AAA, AA, A, BBB, BB, B, etc.
  quantity: number;
}

const RATING_ORDER: Record<string, number> = {
  'AAA': 1, 'AA+': 2, 'AA': 3, 'AA-': 4,
  'A+': 5, 'A': 6, 'A-': 7,
  'BBB+': 8, 'BBB': 9, 'BBB-': 10,
  'BB+': 11, 'BB': 12, 'BB-': 13,
  'B+': 14, 'B': 15, 'B-': 16,
  'CCC': 17, 'CC': 18, 'C': 19, 'D': 20,
  'NR': 21, 'N/A': 21, '': 21,
};

const RATING_COLORS: Record<string, string> = {
  'AAA': '#22c55e',
  'AA': '#4ade80',
  'A': '#86efac',
  'BBB': '#fbbf24',
  'BB': '#f97316',
  'B': '#ef4444',
  'CCC': '#dc2626',
  'NR': '#94a3b8',
};

/**
 * Calculate years to maturity from a date string
 */
function yearsToMaturity(maturityDate: string): number {
  const now = new Date();
  const maturity = new Date(maturityDate);
  const diffMs = maturity.getTime() - now.getTime();
  return Math.max(0, diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Modified Duration approximation
 * D_mod = D_mac / (1 + y/m) where m = payment frequency
 */
function calcModifiedDuration(couponRate: number, ytm: number, yearsToMat: number): number {
  if (yearsToMat <= 0 || ytm <= -1) return 0;

  const c = couponRate / 100;
  const y = ytm / 100;
  const n = Math.ceil(yearsToMat * 2); // Semi-annual periods
  const yPer = y / 2; // Semi-annual yield
  const cPer = c / 2; // Semi-annual coupon

  if (n === 0 || yPer <= -1) return 0;

  // Macaulay duration
  let numerator = 0;
  let denominator = 0;
  for (let t = 1; t <= n; t++) {
    const pv = cPer / Math.pow(1 + yPer, t);
    numerator += t * pv;
    denominator += pv;
  }
  // Add principal
  const pvPrincipal = 1 / Math.pow(1 + yPer, n);
  numerator += n * pvPrincipal;
  denominator += pvPrincipal;

  const macDuration = denominator === 0 ? 0 : (numerator / denominator) / 2; // Convert to years
  const modDuration = macDuration / (1 + yPer);

  return modDuration;
}

/**
 * Convexity approximation
 */
function calcConvexity(couponRate: number, ytm: number, yearsToMat: number): number {
  if (yearsToMat <= 0 || ytm <= -1) return 0;

  const c = couponRate / 100;
  const y = ytm / 100;
  const n = Math.ceil(yearsToMat * 2);
  const yPer = y / 2;
  const cPer = c / 2;

  if (n === 0 || yPer <= -1) return 0;

  let numerator = 0;
  let denominator = 0;
  for (let t = 1; t <= n; t++) {
    const pv = cPer / Math.pow(1 + yPer, t);
    numerator += t * (t + 1) * pv;
    denominator += pv;
  }
  const pvPrincipal = 1 / Math.pow(1 + yPer, n);
  numerator += n * (n + 1) * pvPrincipal;
  denominator += pvPrincipal;

  if (denominator === 0) return 0;
  return (numerator / (denominator * 4 * Math.pow(1 + yPer, 2)));
}

/**
 * Get rating bucket for grouping (e.g. AA+, AA, AA- → "AA")
 */
function ratingBucket(rating: string): string {
  if (!rating || rating === 'NR' || rating === 'N/A') return 'NR';
  const clean = rating.replace(/[+-]/g, '');
  return clean;
}

/**
 * Get average credit quality as a rating string
 */
function avgCreditRating(bonds: BondHolding[]): string {
  if (bonds.length === 0) return 'N/A';
  let weightedScore = 0;
  let totalWeight = 0;

  for (const b of bonds) {
    const score = RATING_ORDER[b.rating] || RATING_ORDER['NR'];
    weightedScore += score * b.weightInBonds;
    totalWeight += b.weightInBonds;
  }

  if (totalWeight === 0) return 'N/A';
  const avgScore = weightedScore / totalWeight;

  // Find closest rating
  const entries = Object.entries(RATING_ORDER);
  let closest = 'BBB';
  let closestDiff = Infinity;
  for (const [r, s] of entries) {
    const diff = Math.abs(s - avgScore);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = r;
    }
  }
  return closest;
}

/**
 * MAIN: Calculate comprehensive bond analytics
 */
export function calculateBondAnalytics(
  bonds: BondHolding[],
  totalPortfolioValue: number,
  inflationRate: number = 0.025
): BondAnalytics {
  if (bonds.length === 0) {
    return emptyBondAnalytics(inflationRate);
  }

  const totalBondWeight = bonds.reduce((sum, b) => sum + b.weightInBonds, 0) || 1;

  // Weighted averages
  let waCoupon = 0, waYield = 0, waMaturity = 0;
  let waDuration = 0, waConvexity = 0;
  let totalIncome = 0;

  for (const b of bonds) {
    const w = b.weightInBonds / totalBondWeight;
    const ytm = yearsToMaturity(b.maturityDate);

    waCoupon += w * b.coupon;
    waYield += w * b.yieldToMaturity;
    waMaturity += w * ytm;

    const dur = calcModifiedDuration(b.coupon, b.yieldToMaturity, ytm);
    const conv = calcConvexity(b.coupon, b.yieldToMaturity, ytm);
    waDuration += w * dur;
    waConvexity += w * conv;

    totalIncome += (b.coupon / 100) * b.parValue * b.quantity;
  }

  // Credit distribution
  const creditMap: Record<string, number> = {};
  for (const b of bonds) {
    const bucket = ratingBucket(b.rating);
    creditMap[bucket] = (creditMap[bucket] || 0) + b.weightInBonds / totalBondWeight;
  }

  const creditDistribution = Object.entries(creditMap)
    .map(([rating, weight]) => ({
      rating,
      weight,
      color: RATING_COLORS[rating] || '#94a3b8',
    }))
    .sort((a, b) => (RATING_ORDER[a.rating] || 99) - (RATING_ORDER[b.rating] || 99));

  // Maturity ladder
  const maturityBuckets: Record<string, { weight: number; count: number }> = {
    '0-1 an': { weight: 0, count: 0 },
    '1-3 ans': { weight: 0, count: 0 },
    '3-5 ans': { weight: 0, count: 0 },
    '5-7 ans': { weight: 0, count: 0 },
    '7-10 ans': { weight: 0, count: 0 },
    '10+ ans': { weight: 0, count: 0 },
  };

  for (const b of bonds) {
    const ytm = yearsToMaturity(b.maturityDate);
    const w = b.weightInBonds / totalBondWeight;
    let bucket: string;
    if (ytm <= 1) bucket = '0-1 an';
    else if (ytm <= 3) bucket = '1-3 ans';
    else if (ytm <= 5) bucket = '3-5 ans';
    else if (ytm <= 7) bucket = '5-7 ans';
    else if (ytm <= 10) bucket = '7-10 ans';
    else bucket = '10+ ans';

    maturityBuckets[bucket].weight += w;
    maturityBuckets[bucket].count++;
  }

  const maturityLadder = Object.entries(maturityBuckets)
    .map(([bucket, { weight, count }]) => ({ bucket, weight, count }));

  // Stress tests: price impact ≈ -Duration × ΔRate + 0.5 × Convexity × (ΔRate)²
  const bondPortfolioValue = totalPortfolioValue * bonds.reduce((sum, b) => sum + b.weight, 0);
  const stressScenarios = [
    { scenario: 'Hausse taux +0.5%', rateChange: 0.005 },
    { scenario: 'Hausse taux +1.0%', rateChange: 0.01 },
    { scenario: 'Hausse taux +2.0%', rateChange: 0.02 },
    { scenario: 'Baisse taux -0.5%', rateChange: -0.005 },
    { scenario: 'Baisse taux -1.0%', rateChange: -0.01 },
  ];

  const stressTests = stressScenarios.map(s => {
    const priceImpact = -waDuration * s.rateChange + 0.5 * waConvexity * Math.pow(s.rateChange, 2);
    const dollarImpact = bondPortfolioValue * priceImpact;
    return {
      scenario: s.scenario,
      rateChange: s.rateChange,
      estimatedPriceImpact: priceImpact,
      estimatedDollarImpact: dollarImpact,
      color: priceImpact >= 0 ? '#22c55e' : '#ef4444',
    };
  });

  return {
    weightedAvgCoupon: waCoupon,
    weightedAvgYield: waYield,
    weightedAvgMaturityYears: waMaturity,
    modifiedDuration: waDuration,
    macaulayDuration: waDuration * (1 + waYield / 200), // Approximate
    convexity: waConvexity,
    totalAnnualIncome: totalIncome,
    avgCreditQuality: avgCreditRating(bonds),
    creditDistribution,
    maturityLadder,
    stressTests,
    realYield: waYield - inflationRate * 100,
    inflationAssumption: inflationRate,
  };
}

function emptyBondAnalytics(inflationRate: number): BondAnalytics {
  return {
    weightedAvgCoupon: 0,
    weightedAvgYield: 0,
    weightedAvgMaturityYears: 0,
    modifiedDuration: 0,
    macaulayDuration: 0,
    convexity: 0,
    totalAnnualIncome: 0,
    avgCreditQuality: 'N/A',
    creditDistribution: [],
    maturityLadder: [],
    stressTests: [],
    realYield: 0,
    inflationAssumption: inflationRate,
  };
}

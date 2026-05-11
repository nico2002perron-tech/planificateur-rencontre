/**
 * Portfolio Statistics Calculator
 * Calculates risk/return metrics from historical price data.
 * All return inputs should be monthly decimal returns (e.g., 0.05 = 5%).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PortfolioReturns {
  monthly: number[];       // Monthly returns as decimals
  dates: string[];         // YYYY-MM dates corresponding to returns
}

export interface RiskStats {
  // Returns
  returnYTD: number | null;
  return1Y: number | null;
  return3Y: number | null;       // Annualized
  return5Y: number | null;       // Annualized
  return10Y: number | null;      // Annualized
  returnSinceInception: number | null; // Annualized

  // Risk
  stdDev1Y: number | null;      // Annualized
  stdDev3Y: number | null;      // Annualized
  stdDev5Y: number | null;      // Annualized

  // Risk-adjusted
  sharpe1Y: number | null;
  sharpe3Y: number | null;
  sharpe5Y: number | null;
  sortino3Y: number | null;

  // Relative (vs benchmark)
  alpha3Y: number | null;
  beta3Y: number | null;
  rSquared3Y: number | null;
  trackingError3Y: number | null;
  informationRatio3Y: number | null;
  captureUpside3Y: number | null;
  captureDownside3Y: number | null;

  // Drawdown
  maxDrawdown: number;
  maxDrawdownDate: string;

  // Best/worst
  bestMonth: number;
  bestMonthDate: string;
  worstMonth: number;
  worstMonthDate: string;
}

export interface GrowthPoint {
  date: string;
  portfolio: number;
  benchmark: number;
}

export interface AnnualReturn {
  year: number;
  portfolio: number;
  benchmark: number;
}

// ── Core calculations ────────────────────────────────────────────────────────

/** Calculate monthly returns from price series */
export function calculateMonthlyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/** Annualize a monthly return series */
function annualizeReturn(monthlyReturns: number[]): number {
  if (monthlyReturns.length === 0) return 0;
  const cumulative = monthlyReturns.reduce((acc, r) => acc * (1 + r), 1);
  if (cumulative <= 0) return -1; // Total loss guard
  const years = monthlyReturns.length / 12;
  if (years <= 0) return cumulative - 1;
  return Math.pow(cumulative, 1 / years) - 1;
}

/** Annualize monthly standard deviation */
function annualizeStdDev(monthlyReturns: number[]): number {
  return stdDev(monthlyReturns) * Math.sqrt(12);
}

/** Standard deviation */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Covariance between two arrays */
function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (a[i] - meanA) * (b[i] - meanB);
  }
  return sum / (n - 1);
}

/** Correlation coefficient */
function correlation(a: number[], b: number[]): number {
  const stdA = stdDev(a);
  const stdB = stdDev(b);
  if (stdA === 0 || stdB === 0) return 0;
  return covariance(a, b) / (stdA * stdB);
}

/** Cumulative return over N most recent months */
function cumulativeReturn(returns: number[], months: number): number | null {
  if (returns.length < months) return null;
  const slice = returns.slice(-months);
  return slice.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

/** Annualized return over N most recent months */
function annualizedReturnN(returns: number[], months: number): number | null {
  if (returns.length < months) return null;
  const slice = returns.slice(-months);
  return annualizeReturn(slice);
}

// ── Sharpe Ratio ──────────────────────────────────────────────────────────

function sharpeRatio(returns: number[], months: number, riskFreeAnnual = 0.04): number | null {
  if (returns.length < months) return null;
  const slice = returns.slice(-months);
  const annReturn = annualizeReturn(slice);
  const annStd = annualizeStdDev(slice);
  if (annStd === 0) return null;
  return (annReturn - riskFreeAnnual) / annStd;
}

// ── Sortino Ratio ─────────────────────────────────────────────────────────

function sortinoRatio(returns: number[], months: number, riskFreeAnnual = 0.04): number | null {
  if (returns.length < months) return null;
  const slice = returns.slice(-months);
  const annReturn = annualizeReturn(slice);
  const monthlyRfr = Math.pow(1 + riskFreeAnnual, 1 / 12) - 1;
  const downside = slice.filter(r => r < monthlyRfr).map(r => Math.pow(r - monthlyRfr, 2));
  if (downside.length === 0) return null;
  const downsideDev = Math.sqrt(downside.reduce((a, b) => a + b, 0) / slice.length) * Math.sqrt(12);
  if (downsideDev === 0) return null;
  return (annReturn - riskFreeAnnual) / downsideDev;
}

// ── Beta, Alpha, R² ──────────────────────────────────────────────────────

function betaCalc(portfolioReturns: number[], benchmarkReturns: number[], months: number): number | null {
  if (portfolioReturns.length < months || benchmarkReturns.length < months) return null;
  const pSlice = portfolioReturns.slice(-months);
  const bSlice = benchmarkReturns.slice(-months);
  const varBench = stdDev(bSlice) ** 2;
  if (varBench === 0) return null;
  return covariance(pSlice, bSlice) / varBench;
}

function alphaCalc(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  months: number,
  riskFreeAnnual = 0.04
): number | null {
  const beta = betaCalc(portfolioReturns, benchmarkReturns, months);
  if (beta === null) return null;
  const pReturn = annualizedReturnN(portfolioReturns, months);
  const bReturn = annualizedReturnN(benchmarkReturns, months);
  if (pReturn === null || bReturn === null) return null;
  return pReturn - (riskFreeAnnual + beta * (bReturn - riskFreeAnnual));
}

function rSquaredCalc(portfolioReturns: number[], benchmarkReturns: number[], months: number): number | null {
  if (portfolioReturns.length < months || benchmarkReturns.length < months) return null;
  const r = correlation(portfolioReturns.slice(-months), benchmarkReturns.slice(-months));
  return r * r;
}

// ── Tracking Error & Information Ratio ──────────────────────────────────

function trackingErrorCalc(portfolioReturns: number[], benchmarkReturns: number[], months: number): number | null {
  if (portfolioReturns.length < months || benchmarkReturns.length < months) return null;
  const pSlice = portfolioReturns.slice(-months);
  const bSlice = benchmarkReturns.slice(-months);
  const diff = pSlice.map((p, i) => p - bSlice[i]);
  return stdDev(diff) * Math.sqrt(12);
}

function informationRatioCalc(portfolioReturns: number[], benchmarkReturns: number[], months: number): number | null {
  const te = trackingErrorCalc(portfolioReturns, benchmarkReturns, months);
  if (!te || te === 0) return null;
  const pReturn = annualizedReturnN(portfolioReturns, months);
  const bReturn = annualizedReturnN(benchmarkReturns, months);
  if (pReturn === null || bReturn === null) return null;
  return (pReturn - bReturn) / te;
}

// ── Capture Ratios ──────────────────────────────────────────────────────

function captureRatio(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  months: number,
  type: 'up' | 'down'
): number | null {
  if (portfolioReturns.length < months || benchmarkReturns.length < months) return null;
  const pSlice = portfolioReturns.slice(-months);
  const bSlice = benchmarkReturns.slice(-months);

  const pFiltered: number[] = [];
  const bFiltered: number[] = [];

  for (let i = 0; i < bSlice.length; i++) {
    if (type === 'up' && bSlice[i] > 0) {
      pFiltered.push(pSlice[i]);
      bFiltered.push(bSlice[i]);
    } else if (type === 'down' && bSlice[i] < 0) {
      pFiltered.push(pSlice[i]);
      bFiltered.push(bSlice[i]);
    }
  }

  if (pFiltered.length < 6) return null; // Need enough months for reliable annualization
  const pAnn = annualizeReturn(pFiltered);
  const bAnn = annualizeReturn(bFiltered);
  if (bAnn === 0) return null;
  const ratio = (pAnn / bAnn) * 100;
  // Clamp to reasonable range to avoid extreme values
  return Math.max(-500, Math.min(500, ratio));
}

// ── Max Drawdown ────────────────────────────────────────────────────────

function maxDrawdownCalc(returns: number[], dates: string[]): { drawdown: number; date: string } {
  let peak = 1;
  let cumulative = 1;
  let maxDD = 0;
  let maxDDDate = dates[0] ?? '';

  for (let i = 0; i < returns.length; i++) {
    cumulative *= (1 + returns[i]);
    if (cumulative > peak) peak = cumulative;
    const dd = (peak - cumulative) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDDate = dates[i] ?? '';
    }
  }

  return { drawdown: -maxDD, date: maxDDDate };
}

// ── YTD Return ──────────────────────────────────────────────────────────

function ytdReturn(returns: number[], dates: string[]): number | null {
  const currentYear = new Date().getFullYear().toString();
  const ytdReturns: number[] = [];
  for (let i = 0; i < dates.length; i++) {
    if (dates[i].startsWith(currentYear)) {
      ytdReturns.push(returns[i]);
    }
  }
  if (ytdReturns.length === 0) return null;
  return ytdReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

// ── Best/Worst Month ────────────────────────────────────────────────────

function bestWorstMonth(returns: number[], dates: string[]): {
  best: number; bestDate: string;
  worst: number; worstDate: string;
} {
  if (returns.length === 0) return { best: 0, bestDate: '', worst: 0, worstDate: '' };
  let best = returns[0], worst = returns[0];
  let bestDate = dates[0] ?? '', worstDate = dates[0] ?? '';
  for (let i = 1; i < returns.length; i++) {
    if (returns[i] > best) { best = returns[i]; bestDate = dates[i]; }
    if (returns[i] < worst) { worst = returns[i]; worstDate = dates[i]; }
  }
  return { best, bestDate, worst, worstDate };
}

// ── Growth of $10,000 ───────────────────────────────────────────────────

export function calculateGrowthSeries(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  dates: string[],
  initialValue = 10000
): GrowthPoint[] {
  const points: GrowthPoint[] = [{ date: dates[0] ?? '', portfolio: initialValue, benchmark: initialValue }];
  let pValue = initialValue;
  let bValue = initialValue;

  const n = Math.min(portfolioReturns.length, benchmarkReturns.length, dates.length);
  for (let i = 0; i < n; i++) {
    pValue *= (1 + portfolioReturns[i]);
    bValue *= (1 + benchmarkReturns[i]);
    points.push({
      date: dates[i],
      portfolio: Math.round(pValue * 100) / 100,
      benchmark: Math.round(bValue * 100) / 100,
    });
  }

  return points;
}

// ── Annual Returns ──────────────────────────────────────────────────────

export function calculateAnnualReturns(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  dates: string[]
): AnnualReturn[] {
  const yearMap = new Map<number, { portfolio: number[]; benchmark: number[] }>();
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length, dates.length);

  for (let i = 0; i < n; i++) {
    const year = parseInt(dates[i].slice(0, 4));
    if (!yearMap.has(year)) yearMap.set(year, { portfolio: [], benchmark: [] });
    const entry = yearMap.get(year)!;
    entry.portfolio.push(portfolioReturns[i]);
    entry.benchmark.push(benchmarkReturns[i]);
  }

  const results: AnnualReturn[] = [];
  for (const [year, data] of yearMap) {
    // Only include full years (at least 11 months) or current year
    const currentYear = new Date().getFullYear();
    if (data.portfolio.length >= 11 || year === currentYear) {
      results.push({
        year,
        portfolio: data.portfolio.reduce((acc, r) => acc * (1 + r), 1) - 1,
        benchmark: data.benchmark.reduce((acc, r) => acc * (1 + r), 1) - 1,
      });
    }
  }

  return results.sort((a, b) => a.year - b.year);
}

// ── Main Calculator ─────────────────────────────────────────────────────

export function calculateRiskStats(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  dates: string[],
  riskFreeRate = 0.04
): RiskStats {
  const dd = maxDrawdownCalc(portfolioReturns, dates);
  const bw = bestWorstMonth(portfolioReturns, dates);

  return {
    returnYTD: ytdReturn(portfolioReturns, dates),
    return1Y: cumulativeReturn(portfolioReturns, 12),
    return3Y: annualizedReturnN(portfolioReturns, 36),
    return5Y: annualizedReturnN(portfolioReturns, 60),
    return10Y: annualizedReturnN(portfolioReturns, 120),
    returnSinceInception: annualizeReturn(portfolioReturns),

    stdDev1Y: portfolioReturns.length >= 12 ? annualizeStdDev(portfolioReturns.slice(-12)) : null,
    stdDev3Y: portfolioReturns.length >= 36 ? annualizeStdDev(portfolioReturns.slice(-36)) : null,
    stdDev5Y: portfolioReturns.length >= 60 ? annualizeStdDev(portfolioReturns.slice(-60)) : null,

    sharpe1Y: sharpeRatio(portfolioReturns, 12, riskFreeRate),
    sharpe3Y: sharpeRatio(portfolioReturns, 36, riskFreeRate),
    sharpe5Y: sharpeRatio(portfolioReturns, 60, riskFreeRate),
    sortino3Y: sortinoRatio(portfolioReturns, 36, riskFreeRate),

    alpha3Y: alphaCalc(portfolioReturns, benchmarkReturns, 36, riskFreeRate),
    beta3Y: betaCalc(portfolioReturns, benchmarkReturns, 36),
    rSquared3Y: rSquaredCalc(portfolioReturns, benchmarkReturns, 36),
    trackingError3Y: trackingErrorCalc(portfolioReturns, benchmarkReturns, 36),
    informationRatio3Y: informationRatioCalc(portfolioReturns, benchmarkReturns, 36),
    captureUpside3Y: captureRatio(portfolioReturns, benchmarkReturns, 36, 'up'),
    captureDownside3Y: captureRatio(portfolioReturns, benchmarkReturns, 36, 'down'),

    maxDrawdown: dd.drawdown,
    maxDrawdownDate: dd.date,

    bestMonth: bw.best,
    bestMonthDate: bw.bestDate,
    worstMonth: bw.worst,
    worstMonthDate: bw.worstDate,
  };
}

// ── Style Matrix Classification ─────────────────────────────────────────

export type StyleSize = 'large' | 'mid' | 'small';
export type StyleValue = 'value' | 'blend' | 'growth';
export type StyleBox = `${StyleSize}-${StyleValue}`;

export interface StyleClassification {
  size: StyleSize;
  style: StyleValue;
  box: StyleBox;
}

/**
 * Classify a stock into the 3x3 Morningstar-style box.
 * @param marketCap Market cap in dollars
 * @param pe P/E ratio
 * @param pb P/B ratio
 */
export function classifyStyle(
  marketCap: number,
  pe: number | null,
  pb: number | null
): StyleClassification {
  // Size classification (in USD)
  let size: StyleSize;
  if (marketCap >= 10_000_000_000) size = 'large';
  else if (marketCap >= 2_000_000_000) size = 'mid';
  else size = 'small';

  // Style classification based on P/B and P/E
  let styleScore = 0; // -2 to +2, negative = value, positive = growth

  if (pb !== null && pb > 0) {
    if (pb < 1.5) styleScore -= 1;
    else if (pb > 3) styleScore += 1;
  }

  if (pe !== null && pe > 0) {
    if (pe < 15) styleScore -= 1;
    else if (pe > 25) styleScore += 1;
  }

  let style: StyleValue;
  if (styleScore <= -1) style = 'value';
  else if (styleScore >= 1) style = 'growth';
  else style = 'blend';

  return { size, style, box: `${size}-${style}` };
}

/**
 * Calculate style matrix weights from a portfolio of holdings.
 * Returns a 3x3 matrix with weights summing to 1.
 */
export function calculateStyleMatrix(
  holdings: Array<{
    weight: number;
    marketCap: number;
    pe: number | null;
    pb: number | null;
  }>
): Record<StyleBox, number> {
  const matrix: Record<StyleBox, number> = {
    'large-value': 0, 'large-blend': 0, 'large-growth': 0,
    'mid-value': 0, 'mid-blend': 0, 'mid-growth': 0,
    'small-value': 0, 'small-blend': 0, 'small-growth': 0,
  };

  let totalWeight = 0;
  for (const h of holdings) {
    if (h.marketCap <= 0) continue;
    const classification = classifyStyle(h.marketCap, h.pe, h.pb);
    matrix[classification.box] += h.weight;
    totalWeight += h.weight;
  }

  // Normalize
  if (totalWeight > 0) {
    for (const key of Object.keys(matrix) as StyleBox[]) {
      matrix[key] = matrix[key] / totalWeight;
    }
  }

  return matrix;
}

// ── Weighted Portfolio Fundamentals ─────────────────────────────────────

export interface WeightedFundamentals {
  weightedPE: number | null;
  weightedPB: number | null;
  weightedROE: number | null;
  weightedDividendYield: number | null;
  weightedEarningsGrowth: number | null;
  weightedProfitMargin: number | null;
  avgMarketCapB: number;
}

export function calculateWeightedFundamentals(
  holdings: Array<{
    weight: number;
    pe: number | null;
    pb: number | null;
    roe: number | null;
    dividendYield: number | null;
    earningsGrowth: number | null;
    profitMargin: number | null;
    marketCap: number;
  }>
): WeightedFundamentals {
  let totalWeight = 0;
  let peSum = 0, peWeight = 0;
  let pbSum = 0, pbWeight = 0;
  let roeSum = 0, roeWeight = 0;
  let dySum = 0, dyWeight = 0;
  let egSum = 0, egWeight = 0;
  let pmSum = 0, pmWeight = 0;
  let mcSum = 0;

  for (const h of holdings) {
    totalWeight += h.weight;

    if (h.pe !== null && h.pe > 0 && h.pe < 200) { peSum += h.pe * h.weight; peWeight += h.weight; }
    if (h.pb !== null && h.pb > 0) { pbSum += h.pb * h.weight; pbWeight += h.weight; }
    if (h.roe !== null) { roeSum += h.roe * h.weight; roeWeight += h.weight; }
    if (h.dividendYield !== null && h.dividendYield >= 0) { dySum += h.dividendYield * h.weight; dyWeight += h.weight; }
    if (h.earningsGrowth !== null) { egSum += h.earningsGrowth * h.weight; egWeight += h.weight; }
    if (h.profitMargin !== null) { pmSum += h.profitMargin * h.weight; pmWeight += h.weight; }
    mcSum += h.marketCap * h.weight;
  }

  return {
    weightedPE: peWeight > 0 ? peSum / peWeight : null,
    weightedPB: pbWeight > 0 ? pbSum / pbWeight : null,
    weightedROE: roeWeight > 0 ? roeSum / roeWeight : null,
    weightedDividendYield: dyWeight > 0 ? dySum / dyWeight : null,
    weightedEarningsGrowth: egWeight > 0 ? egSum / egWeight : null,
    weightedProfitMargin: pmWeight > 0 ? pmSum / pmWeight : null,
    avgMarketCapB: totalWeight > 0 ? mcSum / totalWeight / 1_000_000_000 : 0,
  };
}

// ── Monte Carlo Simulation ──────────────────────────────────────────

export interface MonteCarloResult {
  percentile5: number[];   // Growth path at 5th percentile
  percentile25: number[];  // 25th
  percentile50: number[];  // Median
  percentile75: number[];  // 75th
  percentile95: number[];  // 95th
  months: number;
  probPositive: number;    // Probability of positive return
  probDoubling: number;    // Probability of doubling
  medianFinal: number;     // Median final value
  worstCase: number;       // 5th percentile final
  bestCase: number;        // 95th percentile final
}

export function calculateMonteCarlo(
  monthlyReturns: number[],
  horizonYears = 5,
  numSimulations = 1000,
  initialValue = 10000,
): MonteCarloResult {
  const months = horizonYears * 12;
  const mean = monthlyReturns.reduce((s, r) => s + r, 0) / monthlyReturns.length;
  const sd = stdDev(monthlyReturns);

  // Run simulations
  const finalValues: number[] = [];
  const allPaths: number[][] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const path = [initialValue];
    let value = initialValue;
    for (let m = 0; m < months; m++) {
      // Box-Muller transform for normal random (clamp u1 away from 0)
      const u1 = Math.max(1e-10, Math.random());
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const ret = mean + sd * z;
      value = Math.max(0, value * (1 + ret)); // Portfolio value can't go negative
      path.push(value);
    }
    finalValues.push(value);
    allPaths.push(path);
  }

  // Extract percentile paths
  const getPercentilePath = (pct: number): number[] => {
    const result: number[] = [];
    for (let m = 0; m <= months; m++) {
      const values = allPaths.map(p => p[m]).sort((a, b) => a - b);
      const idx = Math.floor(values.length * pct / 100);
      result.push(Math.round(values[Math.min(idx, values.length - 1)]));
    }
    return result;
  };

  finalValues.sort((a, b) => a - b);
  const probPositive = finalValues.filter(v => v > initialValue).length / numSimulations;
  const probDoubling = finalValues.filter(v => v > initialValue * 2).length / numSimulations;

  return {
    percentile5: getPercentilePath(5),
    percentile25: getPercentilePath(25),
    percentile50: getPercentilePath(50),
    percentile75: getPercentilePath(75),
    percentile95: getPercentilePath(95),
    months,
    probPositive,
    probDoubling,
    medianFinal: Math.round(finalValues[Math.floor(numSimulations / 2)]),
    worstCase: Math.round(finalValues[Math.floor(numSimulations * 0.05)]),
    bestCase: Math.round(finalValues[Math.floor(numSimulations * 0.95)]),
  };
}

// ── Stress Tests ────────────────────────────────────────────────────

export interface StressTestResult {
  name: string;
  period: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  maxDrawdown: number;
}

export function calculateStressTests(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  dates: string[],
): StressTestResult[] {
  const stressEvents = [
    { name: 'COVID-19 (Mars 2020)', start: '2020-02', end: '2020-04' },
    { name: 'Marché baissier 2022', start: '2022-01', end: '2022-10' },
    { name: 'Hausse des taux 2022-2023', start: '2022-01', end: '2023-06' },
    { name: 'Correction 2018 (Q4)', start: '2018-10', end: '2018-12' },
  ];

  const results: StressTestResult[] = [];

  for (const event of stressEvents) {
    const indices: number[] = [];
    for (let i = 0; i < dates.length; i++) {
      const ym = dates[i].slice(0, 7); // YYYY-MM
      if (ym >= event.start && ym <= event.end) {
        indices.push(i);
      }
    }

    if (indices.length < 1) continue;

    const pReturns = indices.map(i => portfolioReturns[i]);
    const bReturns = indices.map(i => benchmarkReturns[i]);

    const pCum = pReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
    const bCum = bReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;

    // Max drawdown during stress period
    let peak = 1, cumVal = 1, maxDD = 0;
    for (const r of pReturns) {
      cumVal *= (1 + r);
      if (cumVal > peak) peak = cumVal;
      const dd = (peak - cumVal) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    results.push({
      name: event.name,
      period: `${event.start} → ${event.end}`,
      portfolioReturn: pCum,
      benchmarkReturn: bCum,
      maxDrawdown: -maxDD,
    });
  }

  return results;
}

// ── Correlation Matrix ──────────────────────────────────────────────

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
}

export function calculateCorrelationMatrix(
  holdingReturns: Map<string, number[]>,
  symbols: string[],
): CorrelationMatrix {
  const n = symbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const ri = holdingReturns.get(symbols[i]) ?? [];
      const rj = holdingReturns.get(symbols[j]) ?? [];
      if (ri.length > 0 && rj.length > 0) {
        const minLen = Math.min(ri.length, rj.length);
        const corr = correlation(ri.slice(-minLen), rj.slice(-minLen));
        matrix[i][j] = Math.round(corr * 100) / 100;
        matrix[j][i] = matrix[i][j];
      }
    }
  }

  return { symbols, matrix };
}

// ── Risk Contribution ───────────────────────────────────────────────

export interface RiskContribution {
  symbol: string;
  weight: number;
  volatility: number;      // Individual annualized vol
  riskContribution: number; // % of total portfolio risk
  returnContribution: number; // Weighted return contribution
}

export function calculateRiskContributions(
  holdingReturns: Map<string, number[]>,
  symbols: string[],
  weights: number[], // normalized 0-1
  portfolioReturns: number[],
): RiskContribution[] {
  const portVol = annualizeStdDev(portfolioReturns);
  if (portVol === 0) return [];

  const contributions: RiskContribution[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const returns = holdingReturns.get(symbols[i]) ?? [];
    if (returns.length < 2) {
      contributions.push({
        symbol: symbols[i],
        weight: weights[i],
        volatility: 0,
        riskContribution: 0,
        returnContribution: 0,
      });
      continue;
    }

    const holdingVol = annualizeStdDev(returns);

    // Marginal contribution = w_i * cov(r_i, r_p) / sigma_p
    const minLen = Math.min(returns.length, portfolioReturns.length);
    const cov = covariance(
      returns.slice(-minLen),
      portfolioReturns.slice(-minLen),
    );
    const marginal = (weights[i] * cov * 12) / portVol; // Annualized
    const riskPct = portVol > 0 ? (marginal / portVol) * 100 : 0;

    // Return contribution
    const holdingAnnReturn = annualizeReturn(returns);
    const returnContrib = weights[i] * holdingAnnReturn;

    contributions.push({
      symbol: symbols[i],
      weight: weights[i],
      volatility: holdingVol,
      riskContribution: riskPct,
      returnContribution: returnContrib,
    });
  }

  return contributions;
}

// ── Concentration (Herfindahl Index) ────────────────────────────────

export interface ConcentrationStats {
  herfindahl: number;       // 0-10000 (sum of squared weights)
  effectivePositions: number; // 1/HHI * 100
  top5Weight: number;       // Weight of top 5 holdings
  top10Weight: number;      // Weight of top 10 holdings
  level: 'Faible' | 'Modéré' | 'Élevé' | 'Très élevé';
}

export function calculateConcentration(weights: number[]): ConcentrationStats {
  const sorted = [...weights].sort((a, b) => b - a);
  const hhi = sorted.reduce((sum, w) => sum + (w * 100) ** 2, 0);
  const effective = hhi > 0 ? 10000 / hhi : weights.length;
  const top5 = sorted.slice(0, 5).reduce((s, w) => s + w, 0);
  const top10 = sorted.slice(0, 10).reduce((s, w) => s + w, 0);

  let level: ConcentrationStats['level'];
  if (hhi < 1000) level = 'Faible';
  else if (hhi < 1800) level = 'Modéré';
  else if (hhi < 2500) level = 'Élevé';
  else level = 'Très élevé';

  return {
    herfindahl: Math.round(hhi),
    effectivePositions: Math.round(effective * 10) / 10,
    top5Weight: top5,
    top10Weight: top10,
    level,
  };
}

// ── Currency Exposure ───────────────────────────────────────────────

export interface CurrencyExposure {
  currency: string;
  weight: number; // 0-1
  label: string;
}

export function calculateCurrencyExposure(
  holdings: Array<{ weight: number; currency: string }>,
): CurrencyExposure[] {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const cur = h.currency || 'CAD';
    map.set(cur, (map.get(cur) ?? 0) + h.weight);
  }

  const labels: Record<string, string> = {
    CAD: 'Dollar canadien',
    USD: 'Dollar américain',
    EUR: 'Euro',
    GBP: 'Livre sterling',
    JPY: 'Yen japonais',
  };

  return [...map.entries()]
    .map(([currency, weight]) => ({
      currency,
      weight,
      label: labels[currency] ?? currency,
    }))
    .sort((a, b) => b.weight - a.weight);
}

// ── Dividend Projection (5 years) ──────────────────────────────────

export interface DividendProjection {
  year: number;
  income: number;
  yieldOnCost: number;
}

export function calculateDividendProjection(
  totalDivYield: number,
  portfolioValue: number,
  growthRate = 0.05, // 5% dividend growth assumption
  years = 5,
): DividendProjection[] {
  const projections: DividendProjection[] = [];
  let currentYield = totalDivYield;

  for (let y = 0; y < years; y++) {
    const income = portfolioValue * currentYield;
    projections.push({
      year: new Date().getFullYear() + y,
      income: Math.round(income),
      yieldOnCost: currentYield,
    });
    currentYield *= (1 + growthRate);
  }

  return projections;
}

// ── Risk Profile Classification ────────────────────────────────────

export interface RiskProfile {
  level: 'Conservateur' | 'Modéré' | 'Croissance' | 'Audacieux';
  score: number; // 0-100
  description: string;
}

export function classifyRiskProfile(
  stdDev3Y: number | null,
  beta3Y: number | null,
  maxDrawdown: number,
  equityWeight: number, // 0-1
): RiskProfile {
  let score = 50;

  // Volatility component (0-30 pts)
  if (stdDev3Y !== null) {
    if (stdDev3Y < 0.08) score -= 15;
    else if (stdDev3Y < 0.12) score -= 5;
    else if (stdDev3Y > 0.18) score += 15;
    else if (stdDev3Y > 0.14) score += 5;
  }

  // Beta component (0-20 pts)
  if (beta3Y !== null) {
    if (beta3Y < 0.7) score -= 10;
    else if (beta3Y > 1.2) score += 10;
    else if (beta3Y > 1.0) score += 5;
  }

  // Max drawdown component (0-20 pts)
  const absMD = Math.abs(maxDrawdown);
  if (absMD < 0.1) score -= 10;
  else if (absMD < 0.2) score -= 5;
  else if (absMD > 0.35) score += 10;
  else if (absMD > 0.25) score += 5;

  // Equity weight component
  if (equityWeight < 0.4) score -= 10;
  else if (equityWeight > 0.8) score += 10;

  score = Math.max(0, Math.min(100, score));

  let level: RiskProfile['level'];
  let description: string;

  if (score < 30) {
    level = 'Conservateur';
    description = 'Ce portefeuille présente un profil de risque faible, adapté aux investisseurs prudents qui privilégient la préservation du capital.';
  } else if (score < 55) {
    level = 'Modéré';
    description = 'Ce portefeuille offre un équilibre entre croissance et protection du capital, adapté aux investisseurs ayant une tolérance au risque moyenne.';
  } else if (score < 75) {
    level = 'Croissance';
    description = 'Ce portefeuille est orienté vers la croissance avec une volatilité plus élevée, adapté aux investisseurs ayant un horizon de placement long terme.';
  } else {
    level = 'Audacieux';
    description = 'Ce portefeuille présente un profil de risque élevé avec un potentiel de rendement supérieur, adapté aux investisseurs agressifs.';
  }

  return { level, score, description };
}

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

  if (pFiltered.length < 2) return null;
  const pAnn = annualizeReturn(pFiltered);
  const bAnn = annualizeReturn(bFiltered);
  if (bAnn === 0) return null;
  return (pAnn / bAnn) * 100;
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
  let best = -Infinity, worst = Infinity;
  let bestDate = '', worstDate = '';
  for (let i = 0; i < returns.length; i++) {
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

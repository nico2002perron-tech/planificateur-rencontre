// =============================================================================
// RISK METRICS ENGINE
// Calculates portfolio-level and per-holding risk statistics from historical prices
// =============================================================================

export interface RiskMetrics {
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  alpha: number;
  beta: number;
  maxDrawdown: number;
  maxDrawdownStart: string;
  maxDrawdownEnd: string;
  recoveryDays: number | null;
  var95: number;          // Value-at-Risk 95%
  var99: number;          // Value-at-Risk 99%
  cvar95: number;         // Conditional VaR (Expected Shortfall)
  trackingError: number;
  informationRatio: number;
  calmarRatio: number;
  upsideCapture: number;
  downsideCapture: number;
  positiveMonths: number;
  negativeMonths: number;
  bestMonth: number;
  worstMonth: number;
  avgPositiveMonth: number;
  avgNegativeMonth: number;
}

export interface DrawdownPeriod {
  start: string;
  end: string;
  trough: string;
  depth: number;
  recoveryDate: string | null;
  durationDays: number;
}

/**
 * Calculate monthly log returns from an array of monthly prices
 */
export function calcMonthlyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    } else {
      returns.push(0);
    }
  }
  return returns;
}

/**
 * Calculate simple (arithmetic) monthly returns
 */
export function calcSimpleReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    } else {
      returns.push(0);
    }
  }
  return returns;
}

/**
 * Annualized return from monthly returns
 */
function annualizedReturn(monthlyReturns: number[]): number {
  if (monthlyReturns.length === 0) return 0;
  const total = monthlyReturns.reduce((acc, r) => acc * (1 + r), 1);
  const years = monthlyReturns.length / 12;
  if (years <= 0 || total <= 0) return 0;
  return Math.pow(total, 1 / years) - 1;
}

/**
 * Annualized volatility from monthly returns
 */
function annualizedVolatility(monthlyReturns: number[]): number {
  if (monthlyReturns.length < 2) return 0;
  const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const variance = monthlyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (monthlyReturns.length - 1);
  return Math.sqrt(variance * 12);
}

/**
 * Sharpe Ratio = (Rp - Rf) / sigma_p
 */
function sharpeRatio(annReturn: number, annVol: number, riskFreeRate: number): number {
  if (annVol === 0) return 0;
  return (annReturn - riskFreeRate) / annVol;
}

/**
 * Sortino Ratio = (Rp - Rf) / downside_deviation
 */
function sortinoRatio(monthlyReturns: number[], riskFreeRate: number): number {
  if (monthlyReturns.length < 2) return 0;
  const monthlyRf = riskFreeRate / 12;
  const downsideReturns = monthlyReturns.filter(r => r < monthlyRf);
  if (downsideReturns.length === 0) return 10; // No downside = excellent
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - monthlyRf, 2), 0) / downsideReturns.length;
  const downsideDev = Math.sqrt(downsideVariance * 12);
  if (downsideDev === 0) return 10;
  const annRet = annualizedReturn(monthlyReturns);
  return (annRet - riskFreeRate) / downsideDev;
}

/**
 * Beta and Alpha vs benchmark
 */
function betaAlpha(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate: number
): { beta: number; alpha: number } {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < 3) return { beta: 1, alpha: 0 };

  const pSlice = portfolioReturns.slice(-n);
  const bSlice = benchmarkReturns.slice(-n);

  const pMean = pSlice.reduce((a, b) => a + b, 0) / n;
  const bMean = bSlice.reduce((a, b) => a + b, 0) / n;

  let covariance = 0;
  let benchVariance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (pSlice[i] - pMean) * (bSlice[i] - bMean);
    benchVariance += Math.pow(bSlice[i] - bMean, 2);
  }
  covariance /= n - 1;
  benchVariance /= n - 1;

  const beta = benchVariance === 0 ? 1 : covariance / benchVariance;
  const annPortReturn = annualizedReturn(pSlice);
  const annBenchReturn = annualizedReturn(bSlice);
  const alpha = annPortReturn - (riskFreeRate + beta * (annBenchReturn - riskFreeRate));

  return { beta, alpha };
}

/**
 * Maximum Drawdown analysis from monthly prices (with dates)
 */
export function analyzeDrawdowns(
  prices: number[],
  dates: string[]
): { maxDrawdown: number; start: string; end: string; periods: DrawdownPeriod[] } {
  if (prices.length < 2) {
    return { maxDrawdown: 0, start: '', end: '', periods: [] };
  }

  let peak = prices[0];
  let peakIdx = 0;
  let maxDd = 0;
  let maxDdStart = 0;
  let maxDdEnd = 0;

  const periods: DrawdownPeriod[] = [];
  let currentDdStart = 0;
  let inDrawdown = false;

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      if (inDrawdown) {
        // Recovered
        const ddDepth = (prices[maxDdEnd] - prices[peakIdx]) / prices[peakIdx];
        if (Math.abs(ddDepth) > 0.03) {
          periods.push({
            start: dates[currentDdStart] || '',
            end: dates[maxDdEnd] || '',
            trough: dates[maxDdEnd] || '',
            depth: ddDepth,
            recoveryDate: dates[i] || null,
            durationDays: (i - currentDdStart) * 30,
          });
        }
        inDrawdown = false;
      }
      peak = prices[i];
      peakIdx = i;
    } else {
      const dd = (prices[i] - peak) / peak;
      if (!inDrawdown) {
        currentDdStart = peakIdx;
        inDrawdown = true;
      }
      if (dd < maxDd) {
        maxDd = dd;
        maxDdStart = peakIdx;
        maxDdEnd = i;
      }
    }
  }

  // If still in drawdown at end
  if (inDrawdown) {
    const ddDepth = (prices[prices.length - 1] - prices[peakIdx]) / prices[peakIdx];
    if (Math.abs(ddDepth) > 0.03) {
      periods.push({
        start: dates[currentDdStart] || '',
        end: dates[prices.length - 1] || '',
        trough: dates[maxDdEnd] || '',
        depth: ddDepth,
        recoveryDate: null,
        durationDays: (prices.length - 1 - currentDdStart) * 30,
      });
    }
  }

  // Sort by depth (worst first)
  periods.sort((a, b) => a.depth - b.depth);

  return {
    maxDrawdown: maxDd,
    start: dates[maxDdStart] || '',
    end: dates[maxDdEnd] || '',
    periods: periods.slice(0, 5),
  };
}

/**
 * Value at Risk (Historical simulation)
 */
function valueAtRisk(monthlyReturns: number[], confidence: number): number {
  if (monthlyReturns.length < 10) return 0;
  const sorted = [...monthlyReturns].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * (1 - confidence));
  return sorted[idx] || 0;
}

/**
 * Conditional VaR (Expected Shortfall) — average of returns below VaR
 */
function conditionalVaR(monthlyReturns: number[], confidence: number): number {
  if (monthlyReturns.length < 10) return 0;
  const sorted = [...monthlyReturns].sort((a, b) => a - b);
  const cutoff = Math.floor(sorted.length * (1 - confidence));
  if (cutoff === 0) return sorted[0] || 0;
  const tail = sorted.slice(0, cutoff);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

/**
 * Tracking Error vs benchmark
 */
function trackingError(portfolioReturns: number[], benchmarkReturns: number[]): number {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < 3) return 0;
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) {
    diffs.push(portfolioReturns[portfolioReturns.length - n + i] - benchmarkReturns[benchmarkReturns.length - n + i]);
  }
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const variance = diffs.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / (n - 1);
  return Math.sqrt(variance * 12);
}

/**
 * Upside/Downside capture ratios
 */
function captureRatios(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): { upside: number; downside: number } {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < 3) return { upside: 100, downside: 100 };

  let upPortSum = 0, upBenchSum = 0, upCount = 0;
  let dnPortSum = 0, dnBenchSum = 0, dnCount = 0;

  for (let i = 0; i < n; i++) {
    const pIdx = portfolioReturns.length - n + i;
    const bIdx = benchmarkReturns.length - n + i;
    if (benchmarkReturns[bIdx] >= 0) {
      upPortSum += portfolioReturns[pIdx];
      upBenchSum += benchmarkReturns[bIdx];
      upCount++;
    } else {
      dnPortSum += portfolioReturns[pIdx];
      dnBenchSum += benchmarkReturns[bIdx];
      dnCount++;
    }
  }

  const upside = upBenchSum !== 0 ? (upPortSum / upCount) / (upBenchSum / upCount) * 100 : 100;
  const downside = dnBenchSum !== 0 ? (dnPortSum / dnCount) / (dnBenchSum / dnCount) * 100 : 100;

  return { upside, downside };
}

/**
 * MAIN: Calculate comprehensive risk metrics for a portfolio
 */
export function calculateRiskMetrics(
  portfolioPrices: number[],
  portfolioDates: string[],
  benchmarkPrices: number[],
  riskFreeRate: number = 0.04
): RiskMetrics {
  const pReturns = calcSimpleReturns(portfolioPrices);
  const bReturns = calcSimpleReturns(benchmarkPrices);

  const annRet = annualizedReturn(pReturns);
  const annVol = annualizedVolatility(pReturns);
  const { beta: b, alpha: a } = betaAlpha(pReturns, bReturns, riskFreeRate);
  const dd = analyzeDrawdowns(portfolioPrices, portfolioDates);
  const te = trackingError(pReturns, bReturns);
  const captures = captureRatios(pReturns, bReturns);

  const positiveMonths = pReturns.filter(r => r >= 0);
  const negativeMonths = pReturns.filter(r => r < 0);

  return {
    annualizedReturn: annRet,
    annualizedVolatility: annVol,
    sharpeRatio: sharpeRatio(annRet, annVol, riskFreeRate),
    sortinoRatio: sortinoRatio(pReturns, riskFreeRate),
    alpha: a,
    beta: b,
    maxDrawdown: dd.maxDrawdown,
    maxDrawdownStart: dd.start,
    maxDrawdownEnd: dd.end,
    recoveryDays: dd.periods[0]?.durationDays ?? null,
    var95: valueAtRisk(pReturns, 0.95) * Math.sqrt(12),  // annualized
    var99: valueAtRisk(pReturns, 0.99) * Math.sqrt(12),
    cvar95: conditionalVaR(pReturns, 0.95) * Math.sqrt(12),
    trackingError: te,
    informationRatio: te === 0 ? 0 : (annRet - annualizedReturn(bReturns)) / te,
    calmarRatio: dd.maxDrawdown === 0 ? 0 : annRet / Math.abs(dd.maxDrawdown),
    upsideCapture: captures.upside,
    downsideCapture: captures.downside,
    positiveMonths: positiveMonths.length,
    negativeMonths: negativeMonths.length,
    bestMonth: pReturns.length > 0 ? Math.max(...pReturns) : 0,
    worstMonth: pReturns.length > 0 ? Math.min(...pReturns) : 0,
    avgPositiveMonth: positiveMonths.length > 0 ? positiveMonths.reduce((a, b) => a + b, 0) / positiveMonths.length : 0,
    avgNegativeMonth: negativeMonths.length > 0 ? negativeMonths.reduce((a, b) => a + b, 0) / negativeMonths.length : 0,
  };
}

/**
 * Calculate weighted portfolio monthly prices from individual holding prices
 */
export function buildPortfolioTimeSeries(
  holdingPrices: Record<string, number[]>,
  weights: Record<string, number>,
  dates: string[]
): number[] {
  const n = dates.length;
  const portfolioPrices: number[] = new Array(n).fill(0);

  // Normalize weights
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return portfolioPrices;

  // Calculate weighted portfolio value (rebased to 100)
  const symbols = Object.keys(weights);
  for (const sym of symbols) {
    const prices = holdingPrices[sym];
    if (!prices || prices.length === 0) continue;
    const w = weights[sym] / totalWeight;
    const basePrice = prices[0];
    if (basePrice <= 0) continue;
    for (let i = 0; i < Math.min(n, prices.length); i++) {
      portfolioPrices[i] += (prices[i] / basePrice) * w * 100;
    }
  }

  return portfolioPrices;
}

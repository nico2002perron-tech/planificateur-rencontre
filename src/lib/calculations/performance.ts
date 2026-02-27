interface PricePoint {
  date: string;
  close: number;
}

export function calculateReturn(prices: PricePoint[]): number {
  if (prices.length < 2) return 0;
  const first = prices[0].close;
  const last = prices[prices.length - 1].close;
  return ((last - first) / first) * 100;
}

export function calculateAnnualizedReturn(totalReturn: number, years: number): number {
  if (years <= 0) return 0;
  return (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
}

export function calculateVolatility(prices: PricePoint[]): number {
  if (prices.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i].close / prices[i - 1].close));
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const dailyVol = Math.sqrt(variance);

  return dailyVol * Math.sqrt(252) * 100; // annualized
}

export function calculateSharpeRatio(
  portfolioReturn: number,
  riskFreeRate: number,
  volatility: number
): number {
  if (volatility === 0) return 0;
  return (portfolioReturn - riskFreeRate) / volatility;
}

export function calculateMaxDrawdown(prices: PricePoint[]): number {
  if (prices.length < 2) return 0;

  let maxPrice = prices[0].close;
  let maxDrawdown = 0;

  for (const point of prices) {
    if (point.close > maxPrice) maxPrice = point.close;
    const drawdown = (maxPrice - point.close) / maxPrice;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown * 100;
}

export function calculateBeta(
  portfolioPrices: PricePoint[],
  benchmarkPrices: PricePoint[]
): number {
  const minLen = Math.min(portfolioPrices.length, benchmarkPrices.length);
  if (minLen < 10) return 1;

  const pReturns: number[] = [];
  const bReturns: number[] = [];

  for (let i = 1; i < minLen; i++) {
    pReturns.push(
      (portfolioPrices[i].close - portfolioPrices[i - 1].close) / portfolioPrices[i - 1].close
    );
    bReturns.push(
      (benchmarkPrices[i].close - benchmarkPrices[i - 1].close) / benchmarkPrices[i - 1].close
    );
  }

  const pMean = pReturns.reduce((a, b) => a + b, 0) / pReturns.length;
  const bMean = bReturns.reduce((a, b) => a + b, 0) / bReturns.length;

  let covariance = 0;
  let bVariance = 0;

  for (let i = 0; i < pReturns.length; i++) {
    covariance += (pReturns[i] - pMean) * (bReturns[i] - bMean);
    bVariance += Math.pow(bReturns[i] - bMean, 2);
  }

  if (bVariance === 0) return 1;
  return covariance / bVariance;
}

export function getPerformancePeriods(prices: PricePoint[]): Record<string, number> {
  if (prices.length === 0) return {};

  const latest = prices[prices.length - 1];
  const latestDate = new Date(latest.date);

  function getReturnSince(daysAgo: number): number | null {
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() - daysAgo);
    const closest = prices.find((p) => new Date(p.date) >= targetDate);
    if (!closest) return null;
    return ((latest.close - closest.close) / closest.close) * 100;
  }

  // YTD
  const yearStart = new Date(latestDate.getFullYear(), 0, 1);
  const ytdPoint = prices.find((p) => new Date(p.date) >= yearStart);
  const ytd = ytdPoint ? ((latest.close - ytdPoint.close) / ytdPoint.close) * 100 : null;

  return {
    '1M': getReturnSince(30) ?? 0,
    '3M': getReturnSince(90) ?? 0,
    'YTD': ytd ?? 0,
    '1A': getReturnSince(365) ?? 0,
    '3A': getReturnSince(365 * 3) ?? 0,
    '5A': getReturnSince(365 * 5) ?? 0,
  };
}

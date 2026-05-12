// =============================================================================
// MONTE CARLO SIMULATION ENGINE
// Generates probabilistic portfolio projections using historical return distributions
// =============================================================================

export interface MonteCarloConfig {
  numSimulations: number;      // Default 1000
  horizonMonths: number;       // Projection horizon
  initialValue: number;        // Starting portfolio value
  monthlyContribution: number; // Additional monthly investment (0 if none)
  riskFreeRate: number;        // Annual risk-free rate
  inflationRate: number;       // Annual inflation rate for real returns
}

export interface MonteCarloResult {
  percentiles: {
    p5: number[];   // 5th percentile path
    p10: number[];  // 10th percentile path
    p25: number[];  // 25th percentile path
    p50: number[];  // Median path
    p75: number[];  // 75th percentile path
    p90: number[];  // 90th percentile path
    p95: number[];  // 95th percentile path
  };
  finalValues: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    mean: number;
  };
  probabilityOfTarget: number;  // P(final > target)
  probabilityOfLoss: number;    // P(final < initial)
  expectedReturn: number;       // Mean annualized return
  medianReturn: number;         // Median annualized return
  worstCase: number;            // Worst simulation final value
  bestCase: number;             // Best simulation final value
}

/**
 * Box-Muller transform: generate standard normal random number
 */
function randomNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generate correlated random returns for multiple assets using Cholesky decomposition
 */
function choleskyDecomposition(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = matrix[i][i] - sum;
        if (val < 0) return null; // Not positive definite
        L[i][j] = Math.sqrt(val);
      } else {
        L[i][j] = L[j][j] === 0 ? 0 : (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

/**
 * Run Monte Carlo simulation for a portfolio
 *
 * @param monthlyReturns - Historical monthly returns of the portfolio
 * @param config - Simulation parameters
 * @param targetValue - Optional target value for probability calculation
 */
export function runMonteCarlo(
  monthlyReturns: number[],
  config: MonteCarloConfig,
  targetValue?: number
): MonteCarloResult {
  const { numSimulations, horizonMonths, initialValue, monthlyContribution, inflationRate } = config;

  if (monthlyReturns.length < 12) {
    // Not enough data — return deterministic estimate
    return createDeterministicResult(initialValue, horizonMonths, monthlyContribution, 0.07, targetValue);
  }

  // Calculate historical distribution parameters
  const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const variance = monthlyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (monthlyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12) - 1;

  // Run simulations
  const allPaths: number[][] = [];
  const finalValues: number[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = [initialValue];
    let value = initialValue;

    for (let m = 1; m <= horizonMonths; m++) {
      // Generate random monthly return from calibrated normal distribution
      const randomReturn = mean + stdDev * randomNormal();
      // Apply return and contribution, subtract inflation
      value = value * (1 + randomReturn) + monthlyContribution;
      value = value / (1 + monthlyInflation); // Real return
      path.push(Math.max(0, value));
    }

    allPaths.push(path);
    finalValues.push(path[horizonMonths]);
  }

  // Sort final values for percentile calculation
  finalValues.sort((a, b) => a - b);

  // Extract percentile paths
  const percentilePaths = extractPercentilePaths(allPaths, horizonMonths);

  // Calculate statistics
  const years = horizonMonths / 12;
  const meanFinal = finalValues.reduce((a, b) => a + b, 0) / finalValues.length;
  const medianFinal = finalValues[Math.floor(finalValues.length * 0.5)];

  const totalContributions = initialValue + monthlyContribution * horizonMonths;
  const probTarget = targetValue
    ? finalValues.filter(v => v >= targetValue).length / finalValues.length
    : 0;
  const probLoss = finalValues.filter(v => v < totalContributions).length / finalValues.length;

  return {
    percentiles: percentilePaths,
    finalValues: {
      p5: finalValues[Math.floor(finalValues.length * 0.05)],
      p10: finalValues[Math.floor(finalValues.length * 0.10)],
      p25: finalValues[Math.floor(finalValues.length * 0.25)],
      p50: medianFinal,
      p75: finalValues[Math.floor(finalValues.length * 0.75)],
      p90: finalValues[Math.floor(finalValues.length * 0.90)],
      p95: finalValues[Math.floor(finalValues.length * 0.95)],
      mean: meanFinal,
    },
    probabilityOfTarget: probTarget,
    probabilityOfLoss: probLoss,
    expectedReturn: years > 0 ? Math.pow(meanFinal / initialValue, 1 / years) - 1 : 0,
    medianReturn: years > 0 ? Math.pow(medianFinal / initialValue, 1 / years) - 1 : 0,
    worstCase: finalValues[0],
    bestCase: finalValues[finalValues.length - 1],
  };
}

/**
 * Multi-asset Monte Carlo with correlation matrix
 */
export function runMultiAssetMonteCarlo(
  assetReturns: Record<string, number[]>,
  weights: Record<string, number>,
  correlationMatrix: number[][],
  symbols: string[],
  config: MonteCarloConfig,
  targetValue?: number
): MonteCarloResult {
  // Build portfolio-level monthly returns from individual asset returns
  const nAssets = symbols.length;
  const minLength = Math.min(...symbols.map(s => assetReturns[s]?.length ?? 0));

  if (minLength < 12 || nAssets === 0) {
    // Fallback to simple Monte Carlo with portfolio-level returns
    const portfolioReturns = buildPortfolioReturns(assetReturns, weights, symbols, minLength);
    return runMonteCarlo(portfolioReturns, config, targetValue);
  }

  // Calculate means and stddevs per asset
  const means: number[] = [];
  const stdDevs: number[] = [];
  for (const sym of symbols) {
    const rets = assetReturns[sym].slice(-minLength);
    const m = rets.reduce((a, b) => a + b, 0) / rets.length;
    const v = rets.reduce((sum, r) => sum + Math.pow(r - m, 2), 0) / (rets.length - 1);
    means.push(m);
    stdDevs.push(Math.sqrt(v));
  }

  // Cholesky decomposition of correlation matrix
  const L = choleskyDecomposition(correlationMatrix);
  if (!L) {
    // Fallback if matrix not positive definite
    const portfolioReturns = buildPortfolioReturns(assetReturns, weights, symbols, minLength);
    return runMonteCarlo(portfolioReturns, config, targetValue);
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const normWeights = symbols.map(s => (weights[s] || 0) / totalWeight);
  const monthlyInflation = Math.pow(1 + config.inflationRate, 1 / 12) - 1;

  const allPaths: number[][] = [];
  const finalValues: number[] = [];

  for (let sim = 0; sim < config.numSimulations; sim++) {
    const path: number[] = [config.initialValue];
    let value = config.initialValue;

    for (let m = 1; m <= config.horizonMonths; m++) {
      // Generate correlated random normals
      const z: number[] = Array.from({ length: nAssets }, () => randomNormal());
      const correlated: number[] = new Array(nAssets).fill(0);
      for (let i = 0; i < nAssets; i++) {
        for (let j = 0; j <= i; j++) {
          correlated[i] += L[i][j] * z[j];
        }
      }

      // Portfolio return = weighted sum of individual asset returns
      let portfolioReturn = 0;
      for (let i = 0; i < nAssets; i++) {
        const assetReturn = means[i] + stdDevs[i] * correlated[i];
        portfolioReturn += normWeights[i] * assetReturn;
      }

      value = value * (1 + portfolioReturn) + config.monthlyContribution;
      value = value / (1 + monthlyInflation);
      path.push(Math.max(0, value));
    }

    allPaths.push(path);
    finalValues.push(path[config.horizonMonths]);
  }

  finalValues.sort((a, b) => a - b);
  const percentilePaths = extractPercentilePaths(allPaths, config.horizonMonths);
  const years = config.horizonMonths / 12;
  const meanFinal = finalValues.reduce((a, b) => a + b, 0) / finalValues.length;
  const medianFinal = finalValues[Math.floor(finalValues.length * 0.5)];
  const totalContributions = config.initialValue + config.monthlyContribution * config.horizonMonths;

  return {
    percentiles: percentilePaths,
    finalValues: {
      p5: finalValues[Math.floor(finalValues.length * 0.05)],
      p10: finalValues[Math.floor(finalValues.length * 0.10)],
      p25: finalValues[Math.floor(finalValues.length * 0.25)],
      p50: medianFinal,
      p75: finalValues[Math.floor(finalValues.length * 0.75)],
      p90: finalValues[Math.floor(finalValues.length * 0.90)],
      p95: finalValues[Math.floor(finalValues.length * 0.95)],
      mean: meanFinal,
    },
    probabilityOfTarget: targetValue
      ? finalValues.filter(v => v >= targetValue).length / finalValues.length
      : 0,
    probabilityOfLoss: finalValues.filter(v => v < totalContributions).length / finalValues.length,
    expectedReturn: years > 0 ? Math.pow(meanFinal / config.initialValue, 1 / years) - 1 : 0,
    medianReturn: years > 0 ? Math.pow(medianFinal / config.initialValue, 1 / years) - 1 : 0,
    worstCase: finalValues[0],
    bestCase: finalValues[finalValues.length - 1],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractPercentilePaths(
  allPaths: number[][],
  horizonMonths: number
): MonteCarloResult['percentiles'] {
  const percentileIndices = [0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95];
  const result: Record<string, number[]> = {};

  for (const p of percentileIndices) {
    result[`p${Math.round(p * 100)}`] = [];
  }

  for (let m = 0; m <= horizonMonths; m++) {
    const valuesAtMonth = allPaths.map(path => path[m]).sort((a, b) => a - b);
    for (const p of percentileIndices) {
      const idx = Math.floor(valuesAtMonth.length * p);
      result[`p${Math.round(p * 100)}`].push(valuesAtMonth[idx]);
    }
  }

  return result as MonteCarloResult['percentiles'];
}

function buildPortfolioReturns(
  assetReturns: Record<string, number[]>,
  weights: Record<string, number>,
  symbols: string[],
  length: number
): number[] {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const portfolioReturns: number[] = new Array(length).fill(0);

  for (const sym of symbols) {
    const w = (weights[sym] || 0) / totalWeight;
    const rets = assetReturns[sym] || [];
    for (let i = 0; i < Math.min(length, rets.length); i++) {
      portfolioReturns[i] += w * rets[rets.length - length + i];
    }
  }

  return portfolioReturns;
}

function createDeterministicResult(
  initialValue: number,
  horizonMonths: number,
  monthlyContribution: number,
  assumedReturn: number,
  targetValue?: number
): MonteCarloResult {
  const monthlyReturn = Math.pow(1 + assumedReturn, 1 / 12) - 1;
  const path: number[] = [initialValue];
  let value = initialValue;

  for (let m = 1; m <= horizonMonths; m++) {
    value = value * (1 + monthlyReturn) + monthlyContribution;
    path.push(value);
  }

  const finalVal = path[horizonMonths];
  return {
    percentiles: { p5: path, p10: path, p25: path, p50: path, p75: path, p90: path, p95: path },
    finalValues: { p5: finalVal, p10: finalVal, p25: finalVal, p50: finalVal, p75: finalVal, p90: finalVal, p95: finalVal, mean: finalVal },
    probabilityOfTarget: targetValue ? (finalVal >= targetValue ? 1 : 0) : 0,
    probabilityOfLoss: 0,
    expectedReturn: assumedReturn,
    medianReturn: assumedReturn,
    worstCase: finalVal,
    bestCase: finalVal,
  };
}

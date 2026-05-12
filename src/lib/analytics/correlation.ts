// =============================================================================
// CORRELATION & DIVERSIFICATION ENGINE
// Computes correlation matrices, concentration metrics, diversification scores
// =============================================================================

import { calcSimpleReturns } from './risk-metrics';

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];       // NxN correlation coefficients
  avgCorrelation: number;   // Average pairwise correlation
}

export interface DiversificationAnalysis {
  correlationMatrix: CorrelationMatrix;
  hhi: number;                          // Herfindahl-Hirschman Index (0-10000)
  effectivePositions: number;           // 1/HHI normalized
  top5Concentration: number;            // % of portfolio in top 5
  sectorConcentration: number;          // HHI by sector
  regionConcentration: number;          // HHI by region
  currencyConcentration: number;        // HHI by currency
  diversificationScore: number;         // 0-100 composite score
  diversificationLabel: string;
  warnings: string[];
}

export interface ConcentrationBreakdown {
  label: string;
  weight: number;
  count: number;
}

/**
 * Compute Pearson correlation coefficient between two return series
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const xSlice = x.slice(-n);
  const ySlice = y.slice(-n);

  const xMean = xSlice.reduce((a, b) => a + b, 0) / n;
  const yMean = ySlice.reduce((a, b) => a + b, 0) / n;

  let cov = 0, xVar = 0, yVar = 0;
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - xMean;
    const dy = ySlice[i] - yMean;
    cov += dx * dy;
    xVar += dx * dx;
    yVar += dy * dy;
  }

  const denom = Math.sqrt(xVar * yVar);
  return denom === 0 ? 0 : cov / denom;
}

/**
 * Build NxN correlation matrix from price histories
 */
export function buildCorrelationMatrix(
  holdingPrices: Record<string, number[]>,
  symbols: string[]
): CorrelationMatrix {
  const n = symbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // Calculate returns for each symbol
  const returnsMap: Record<string, number[]> = {};
  for (const sym of symbols) {
    const prices = holdingPrices[sym];
    if (prices && prices.length >= 3) {
      returnsMap[sym] = calcSimpleReturns(prices);
    } else {
      returnsMap[sym] = [];
    }
  }

  let totalCorr = 0;
  let corrCount = 0;

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0;
    for (let j = i + 1; j < n; j++) {
      const rI = returnsMap[symbols[i]];
      const rJ = returnsMap[symbols[j]];
      if (rI.length >= 3 && rJ.length >= 3) {
        const corr = pearsonCorrelation(rI, rJ);
        matrix[i][j] = corr;
        matrix[j][i] = corr;
        totalCorr += corr;
        corrCount++;
      }
    }
  }

  return {
    symbols,
    matrix,
    avgCorrelation: corrCount > 0 ? totalCorr / corrCount : 0,
  };
}

/**
 * Herfindahl-Hirschman Index
 * HHI = sum of squared weights (0-10000 scale)
 * Lower = more diversified
 */
export function calculateHHI(weights: number[]): number {
  return weights.reduce((sum, w) => sum + Math.pow(w * 100, 2), 0);
}

/**
 * Effective number of positions = 1 / sum(w_i^2)
 */
export function effectivePositions(weights: number[]): number {
  const sumSquared = weights.reduce((sum, w) => sum + w * w, 0);
  return sumSquared === 0 ? 0 : 1 / sumSquared;
}

/**
 * Calculate concentration by group (sector, region, currency)
 */
export function groupConcentration(
  holdings: Array<{ weight: number; group: string }>
): { hhi: number; breakdown: ConcentrationBreakdown[] } {
  const groups: Record<string, { weight: number; count: number }> = {};

  for (const h of holdings) {
    const g = h.group || 'Autre';
    if (!groups[g]) groups[g] = { weight: 0, count: 0 };
    groups[g].weight += h.weight;
    groups[g].count++;
  }

  const breakdown = Object.entries(groups)
    .map(([label, { weight, count }]) => ({ label, weight, count }))
    .sort((a, b) => b.weight - a.weight);

  const hhi = breakdown.reduce((sum, g) => sum + Math.pow(g.weight * 100, 2), 0);

  return { hhi, breakdown };
}

/**
 * MAIN: Full diversification analysis
 */
export function analyzeDiversification(
  holdingPrices: Record<string, number[]>,
  holdings: Array<{
    symbol: string;
    weight: number;
    sector: string;
    region: string;
    currency: string;
  }>
): DiversificationAnalysis {
  const symbols = holdings.map(h => h.symbol);
  const weights = holdings.map(h => h.weight);

  // Correlation matrix
  const corrMatrix = buildCorrelationMatrix(holdingPrices, symbols);

  // Position concentration
  const hhi = calculateHHI(weights);
  const effPos = effectivePositions(weights);

  // Top 5 concentration
  const sortedWeights = [...weights].sort((a, b) => b - a);
  const top5 = sortedWeights.slice(0, 5).reduce((a, b) => a + b, 0);

  // Group concentrations
  const sectorConc = groupConcentration(holdings.map(h => ({ weight: h.weight, group: h.sector })));
  const regionConc = groupConcentration(holdings.map(h => ({ weight: h.weight, group: h.region })));
  const currencyConc = groupConcentration(holdings.map(h => ({ weight: h.weight, group: h.currency })));

  // Diversification score (0-100)
  const score = calculateDiversificationScore(
    hhi,
    corrMatrix.avgCorrelation,
    top5,
    sectorConc.hhi,
    holdings.length
  );

  // Warnings
  const warnings: string[] = [];
  if (top5 > 0.6) warnings.push('Plus de 60% du portefeuille est concentre dans 5 positions');
  if (corrMatrix.avgCorrelation > 0.6) warnings.push('Correlation moyenne elevee entre les actifs (> 0.6)');
  if (sectorConc.breakdown[0]?.weight > 0.4) warnings.push(`Surconcentration sectorielle : ${sectorConc.breakdown[0].label} (${(sectorConc.breakdown[0].weight * 100).toFixed(0)}%)`);
  if (holdings.length < 8) warnings.push('Moins de 8 positions — diversification limitee');
  if (regionConc.breakdown.length === 1) warnings.push('Aucune diversification geographique');

  return {
    correlationMatrix: corrMatrix,
    hhi,
    effectivePositions: effPos,
    top5Concentration: top5,
    sectorConcentration: sectorConc.hhi,
    regionConcentration: regionConc.hhi,
    currencyConcentration: currencyConc.hhi,
    diversificationScore: score,
    diversificationLabel: getDiversificationLabel(score),
    warnings,
  };
}

function calculateDiversificationScore(
  positionHHI: number,
  avgCorrelation: number,
  top5Conc: number,
  sectorHHI: number,
  numPositions: number
): number {
  // Position diversification (30%)
  // HHI of 200 (50 equal positions) = 100, HHI of 10000 (1 position) = 0
  const positionScore = Math.max(0, Math.min(100, (1 - positionHHI / 5000) * 100));

  // Correlation diversification (25%)
  // avg corr of 0 = 100, avg corr of 1 = 0
  const corrScore = Math.max(0, Math.min(100, (1 - avgCorrelation) * 100));

  // Concentration (20%)
  const concScore = Math.max(0, Math.min(100, (1 - top5Conc) * 100));

  // Sector diversification (15%)
  const sectorScore = Math.max(0, Math.min(100, (1 - sectorHHI / 5000) * 100));

  // Number of positions (10%)
  // 20+ positions = 100, <5 = low
  const numScore = Math.min(100, (numPositions / 20) * 100);

  return Math.round(
    positionScore * 0.30 +
    corrScore * 0.25 +
    concScore * 0.20 +
    sectorScore * 0.15 +
    numScore * 0.10
  );
}

function getDiversificationLabel(score: number): string {
  if (score >= 80) return 'Excellente';
  if (score >= 65) return 'Bonne';
  if (score >= 50) return 'Adequate';
  if (score >= 35) return 'Faible';
  return 'Tres concentre';
}

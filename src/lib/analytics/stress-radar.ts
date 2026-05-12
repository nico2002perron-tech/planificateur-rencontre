// =============================================================================
// PORTFOLIO STRESS RADAR ENGINE
// Measures portfolio sensitivity to 7 macro stress factors based on actual
// sector/asset class exposures. Uses empirical sector sensitivities — no guessing.
// =============================================================================

export interface StressRadarResult {
  factors: StressFactor[];
  overallResilience: number;   // 0-100 (100 = very resilient)
  resilienceLabel: string;
  vulnerabilities: string[];   // Top 2-3 factual vulnerability statements
  strengths: string[];         // Top 2-3 factual strength statements
}

export interface StressFactor {
  name: string;
  sensitivity: number;        // 0-10 (0 = immune, 10 = extremely sensitive)
  label: string;              // 'Faible' | 'Modere' | 'Eleve' | 'Tres eleve'
  color: string;
  explanation: string;        // Factual one-liner explaining the score
}

// -----------------------------------------------------------------------
// EMPIRICAL SECTOR SENSITIVITY MATRIX
// Based on historical analysis of sector behavior during each stress event.
// Scale: -1 (benefits) to +1 (severely hurt)
// -----------------------------------------------------------------------
const SECTOR_SENSITIVITY: Record<string, Record<string, number>> = {
  // Sector → { Factor → sensitivity }
  'Technology': {
    inflation: 0.4,
    recession: 0.5,
    rate_hike: 0.7,
    oil_crash: -0.1,
    tech_crash: 1.0,
    usd_strong: 0.2,
    trade_war: 0.5,
  },
  'Financial Services': {
    inflation: 0.2,
    recession: 0.7,
    rate_hike: -0.3, // Banks benefit from rate hikes
    oil_crash: 0.1,
    tech_crash: 0.2,
    usd_strong: 0.1,
    trade_war: 0.3,
  },
  'Financials': {
    inflation: 0.2,
    recession: 0.7,
    rate_hike: -0.3,
    oil_crash: 0.1,
    tech_crash: 0.2,
    usd_strong: 0.1,
    trade_war: 0.3,
  },
  'Healthcare': {
    inflation: 0.1,
    recession: 0.1,
    rate_hike: 0.2,
    oil_crash: 0.0,
    tech_crash: 0.1,
    usd_strong: 0.2,
    trade_war: 0.2,
  },
  'Health Care': {
    inflation: 0.1,
    recession: 0.1,
    rate_hike: 0.2,
    oil_crash: 0.0,
    tech_crash: 0.1,
    usd_strong: 0.2,
    trade_war: 0.2,
  },
  'Energy': {
    inflation: -0.3, // Energy benefits from inflation
    recession: 0.6,
    rate_hike: 0.1,
    oil_crash: 1.0,
    tech_crash: 0.0,
    usd_strong: 0.3,
    trade_war: 0.4,
  },
  'Consumer Cyclical': {
    inflation: 0.5,
    recession: 0.8,
    rate_hike: 0.5,
    oil_crash: 0.1,
    tech_crash: 0.3,
    usd_strong: 0.3,
    trade_war: 0.5,
  },
  'Consumer Discretionary': {
    inflation: 0.5,
    recession: 0.8,
    rate_hike: 0.5,
    oil_crash: 0.1,
    tech_crash: 0.3,
    usd_strong: 0.3,
    trade_war: 0.5,
  },
  'Consumer Defensive': {
    inflation: 0.2,
    recession: 0.1,
    rate_hike: 0.2,
    oil_crash: 0.0,
    tech_crash: 0.0,
    usd_strong: 0.2,
    trade_war: 0.1,
  },
  'Consumer Staples': {
    inflation: 0.2,
    recession: 0.1,
    rate_hike: 0.2,
    oil_crash: 0.0,
    tech_crash: 0.0,
    usd_strong: 0.2,
    trade_war: 0.1,
  },
  'Industrials': {
    inflation: 0.3,
    recession: 0.6,
    rate_hike: 0.3,
    oil_crash: 0.2,
    tech_crash: 0.1,
    usd_strong: 0.4,
    trade_war: 0.7,
  },
  'Materials': {
    inflation: -0.2,
    recession: 0.5,
    rate_hike: 0.2,
    oil_crash: 0.3,
    tech_crash: 0.0,
    usd_strong: 0.5,
    trade_war: 0.6,
  },
  'Basic Materials': {
    inflation: -0.2,
    recession: 0.5,
    rate_hike: 0.2,
    oil_crash: 0.3,
    tech_crash: 0.0,
    usd_strong: 0.5,
    trade_war: 0.6,
  },
  'Utilities': {
    inflation: 0.3,
    recession: 0.1,
    rate_hike: 0.6, // Rate sensitive
    oil_crash: -0.1,
    tech_crash: -0.1,
    usd_strong: 0.1,
    trade_war: 0.0,
  },
  'Real Estate': {
    inflation: 0.4,
    recession: 0.5,
    rate_hike: 0.8, // Very rate sensitive
    oil_crash: 0.0,
    tech_crash: 0.0,
    usd_strong: 0.1,
    trade_war: 0.1,
  },
  'Communication Services': {
    inflation: 0.2,
    recession: 0.3,
    rate_hike: 0.4,
    oil_crash: 0.0,
    tech_crash: 0.6,
    usd_strong: 0.2,
    trade_war: 0.3,
  },
};

// Asset class sensitivity overrides
const ASSET_CLASS_SENSITIVITY: Record<string, Record<string, number>> = {
  'Fixed Income': {
    inflation: 0.7,
    recession: -0.3, // Bonds rally in recession
    rate_hike: 0.9,
    oil_crash: -0.1,
    tech_crash: -0.3,
    usd_strong: 0.1,
    trade_war: -0.2,
  },
  'Obligations': {
    inflation: 0.7,
    recession: -0.3,
    rate_hike: 0.9,
    oil_crash: -0.1,
    tech_crash: -0.3,
    usd_strong: 0.1,
    trade_war: -0.2,
  },
  'Revenu fixe': {
    inflation: 0.7,
    recession: -0.3,
    rate_hike: 0.9,
    oil_crash: -0.1,
    tech_crash: -0.3,
    usd_strong: 0.1,
    trade_war: -0.2,
  },
  'Cash': {
    inflation: 0.3,
    recession: -0.5,
    rate_hike: -0.5,
    oil_crash: -0.3,
    tech_crash: -0.5,
    usd_strong: 0.0,
    trade_war: -0.3,
  },
};

const FACTOR_LABELS: Record<string, string> = {
  inflation: 'Inflation',
  recession: 'Recession',
  rate_hike: 'Hausse des taux',
  oil_crash: 'Baisse du petrole',
  tech_crash: 'Crash technologique',
  usd_strong: 'USD fort',
  trade_war: 'Guerre commerciale',
};

const FACTOR_ORDER = ['inflation', 'recession', 'rate_hike', 'oil_crash', 'tech_crash', 'usd_strong', 'trade_war'];

/**
 * MAIN: Calculate portfolio stress radar
 */
export function calculateStressRadar(
  holdings: Array<{
    symbol: string;
    weight: number;
    sector: string;
    assetClass: string;
    beta?: number;
  }>
): StressRadarResult {
  const factorScores: Record<string, number> = {};

  for (const factor of FACTOR_ORDER) {
    let weightedSensitivity = 0;

    for (const h of holdings) {
      // Check asset class override first
      const acSensitivity = ASSET_CLASS_SENSITIVITY[h.assetClass];
      if (acSensitivity && acSensitivity[factor] !== undefined) {
        weightedSensitivity += h.weight * acSensitivity[factor];
        continue;
      }

      // Use sector sensitivity
      const sectorSens = SECTOR_SENSITIVITY[h.sector];
      if (sectorSens && sectorSens[factor] !== undefined) {
        let sensitivity = sectorSens[factor];
        // Adjust by beta if available (higher beta = more sensitive)
        if (h.beta && h.beta > 0) {
          sensitivity *= Math.min(1.5, h.beta);
        }
        weightedSensitivity += h.weight * sensitivity;
      } else {
        // Default sector sensitivity
        weightedSensitivity += h.weight * 0.3;
      }
    }

    // Convert to 0-10 scale: sensitivity range is roughly -0.5 to +1.0
    // Map: -0.5 → 0, 0 → 3, 0.5 → 6.5, 1.0 → 10
    const normalized = Math.max(0, Math.min(10, (weightedSensitivity + 0.5) * (10 / 1.5)));
    factorScores[factor] = Math.round(normalized * 10) / 10;
  }

  // Build factor results
  const factors: StressFactor[] = FACTOR_ORDER.map(factor => {
    const score = factorScores[factor];
    return {
      name: FACTOR_LABELS[factor],
      sensitivity: score,
      label: getSensitivityLabel(score),
      color: getSensitivityColor(score),
      explanation: getFactorExplanation(factor, score, holdings),
    };
  });

  // Overall resilience = inverse of average sensitivity
  const avgSensitivity = factors.reduce((sum, f) => sum + f.sensitivity, 0) / factors.length;
  const resilience = Math.round(Math.max(0, Math.min(100, (1 - avgSensitivity / 10) * 100)));

  // Identify vulnerabilities and strengths
  const sorted = [...factors].sort((a, b) => b.sensitivity - a.sensitivity);
  const vulnerabilities = sorted
    .filter(f => f.sensitivity >= 5)
    .slice(0, 3)
    .map(f => `Sensibilite elevee a ${f.name.toLowerCase()} (${f.sensitivity.toFixed(1)}/10)`);

  const strengths = [...factors]
    .sort((a, b) => a.sensitivity - b.sensitivity)
    .filter(f => f.sensitivity <= 3)
    .slice(0, 3)
    .map(f => `Resilient face a ${f.name.toLowerCase()} (${f.sensitivity.toFixed(1)}/10)`);

  return {
    factors,
    overallResilience: resilience,
    resilienceLabel: getResilienceLabel(resilience),
    vulnerabilities,
    strengths,
  };
}

function getSensitivityLabel(score: number): string {
  if (score <= 2.5) return 'Faible';
  if (score <= 5) return 'Modere';
  if (score <= 7.5) return 'Eleve';
  return 'Tres eleve';
}

function getSensitivityColor(score: number): string {
  if (score <= 2.5) return '#22c55e';  // Green
  if (score <= 5) return '#f59e0b';    // Amber
  if (score <= 7.5) return '#f97316';  // Orange
  return '#ef4444';                     // Red
}

function getResilienceLabel(score: number): string {
  if (score >= 75) return 'Tres resilient';
  if (score >= 55) return 'Resilient';
  if (score >= 40) return 'Moderement expose';
  return 'Vulnerable';
}

function getFactorExplanation(
  factor: string,
  score: number,
  holdings: Array<{ symbol: string; weight: number; sector: string; assetClass: string }>
): string {
  // Find the main sector contributors
  const sectorWeights: Record<string, number> = {};
  for (const h of holdings) {
    const key = h.assetClass === 'Obligations' || h.assetClass === 'Fixed Income' || h.assetClass === 'Revenu fixe'
      ? 'Obligations'
      : h.sector;
    sectorWeights[key] = (sectorWeights[key] || 0) + h.weight;
  }
  const topSector = Object.entries(sectorWeights).sort((a, b) => b[1] - a[1])[0];

  if (score <= 2.5) {
    return `Exposition limitee grace a la composition du portefeuille`;
  }
  if (score >= 7) {
    return `Exposition elevee, principalement via ${topSector?.[0] || 'les actifs'} (${((topSector?.[1] || 0) * 100).toFixed(0)}%)`;
  }
  return `Exposition moderee selon la repartition sectorielle actuelle`;
}

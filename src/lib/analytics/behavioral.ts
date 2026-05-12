// =============================================================================
// BEHAVIORAL / HISTORICAL STRESS TEST ENGINE
// Estimates how the portfolio WOULD have performed during past crises
// Based on empirical sector drawdowns — no speculation, only historical data.
// =============================================================================

export interface CrisisScenario {
  name: string;
  period: string;
  description: string;
  marketDrawdown: number;       // e.g. -0.34 for -34%
  estimatedPortfolioDrawdown: number;
  estimatedLossDollar: number;
  estimatedRecoveryMonths: number;
  impactLevel: 'Faible' | 'Modere' | 'Important' | 'Severe';
  color: string;
}

export interface BehavioralAnalysis {
  scenarios: CrisisScenario[];
  worstEstimatedDrawdown: number;
  avgEstimatedDrawdown: number;
  emotionalContext: string;     // Factual statement about expected behavior
}

// -----------------------------------------------------------------------
// HISTORICAL SECTOR DRAWDOWNS PER CRISIS
// Source: Actual historical sector-level max drawdowns (peak-to-trough)
// -----------------------------------------------------------------------
interface CrisisDefinition {
  name: string;
  period: string;
  description: string;
  marketDrawdown: number;
  marketRecoveryMonths: number;
  sectorDrawdowns: Record<string, number>;
  bondDrawdown: number;
  cashDrawdown: number;
}

const HISTORICAL_CRISES: CrisisDefinition[] = [
  {
    name: 'Crise financiere 2008',
    period: 'Oct 2007 - Mar 2009',
    description: 'Effondrement du marche immobilier et crise bancaire mondiale',
    marketDrawdown: -0.50,
    marketRecoveryMonths: 48,
    sectorDrawdowns: {
      'Technology': -0.52,
      'Financial Services': -0.75,
      'Financials': -0.75,
      'Healthcare': -0.32,
      'Health Care': -0.32,
      'Energy': -0.55,
      'Consumer Cyclical': -0.58,
      'Consumer Discretionary': -0.58,
      'Consumer Defensive': -0.22,
      'Consumer Staples': -0.22,
      'Industrials': -0.55,
      'Materials': -0.52,
      'Basic Materials': -0.52,
      'Utilities': -0.35,
      'Real Estate': -0.68,
      'Communication Services': -0.45,
    },
    bondDrawdown: 0.05, // Bonds rallied
    cashDrawdown: 0.0,
  },
  {
    name: 'COVID-19 Mars 2020',
    period: 'Fev - Mar 2020',
    description: 'Pandemie mondiale et arret economique soudain',
    marketDrawdown: -0.34,
    marketRecoveryMonths: 5,
    sectorDrawdowns: {
      'Technology': -0.28,
      'Financial Services': -0.40,
      'Financials': -0.40,
      'Healthcare': -0.25,
      'Health Care': -0.25,
      'Energy': -0.55,
      'Consumer Cyclical': -0.40,
      'Consumer Discretionary': -0.40,
      'Consumer Defensive': -0.18,
      'Consumer Staples': -0.18,
      'Industrials': -0.38,
      'Materials': -0.32,
      'Basic Materials': -0.32,
      'Utilities': -0.28,
      'Real Estate': -0.35,
      'Communication Services': -0.30,
    },
    bondDrawdown: 0.02,
    cashDrawdown: 0.0,
  },
  {
    name: 'Inflation et hausse des taux 2022',
    period: 'Jan - Oct 2022',
    description: 'Inflation post-pandemie, hausse agressive des taux directeurs',
    marketDrawdown: -0.25,
    marketRecoveryMonths: 14,
    sectorDrawdowns: {
      'Technology': -0.35,
      'Financial Services': -0.18,
      'Financials': -0.18,
      'Healthcare': -0.12,
      'Health Care': -0.12,
      'Energy': 0.15, // Energy was positive in 2022
      'Consumer Cyclical': -0.30,
      'Consumer Discretionary': -0.30,
      'Consumer Defensive': -0.08,
      'Consumer Staples': -0.08,
      'Industrials': -0.22,
      'Materials': -0.15,
      'Basic Materials': -0.15,
      'Utilities': -0.05,
      'Real Estate': -0.30,
      'Communication Services': -0.40,
    },
    bondDrawdown: -0.13,
    cashDrawdown: 0.0,
  },
  {
    name: 'Bulle technologique 2000-2002',
    period: 'Mar 2000 - Oct 2002',
    description: 'Eclatement de la bulle Internet et crash des valeurs technologiques',
    marketDrawdown: -0.49,
    marketRecoveryMonths: 56,
    sectorDrawdowns: {
      'Technology': -0.78,
      'Financial Services': -0.30,
      'Financials': -0.30,
      'Healthcare': -0.20,
      'Health Care': -0.20,
      'Energy': -0.15,
      'Consumer Cyclical': -0.40,
      'Consumer Discretionary': -0.40,
      'Consumer Defensive': -0.10,
      'Consumer Staples': -0.10,
      'Industrials': -0.35,
      'Materials': -0.25,
      'Basic Materials': -0.25,
      'Utilities': -0.40,
      'Real Estate': -0.15,
      'Communication Services': -0.70,
    },
    bondDrawdown: 0.15, // Bonds performed well
    cashDrawdown: 0.0,
  },
];

const FIXED_INCOME_CLASSES = new Set([
  'Obligations', 'Fixed Income', 'Revenu fixe', 'Bond', 'Bonds',
]);
const CASH_CLASSES = new Set([
  'Cash', 'Liquidites', 'Marche monetaire', 'Money Market',
]);

/**
 * MAIN: Estimate portfolio behavior during historical crises
 */
export function analyzeBehavioral(
  holdings: Array<{
    symbol: string;
    name: string;
    weight: number;
    sector: string;
    assetClass: string;
    beta?: number;
  }>,
  portfolioValue: number
): BehavioralAnalysis {
  const scenarios: CrisisScenario[] = HISTORICAL_CRISES.map(crisis => {
    let estimatedDrawdown = 0;

    for (const h of holdings) {
      // Fixed income
      if (FIXED_INCOME_CLASSES.has(h.assetClass)) {
        estimatedDrawdown += h.weight * crisis.bondDrawdown;
        continue;
      }
      // Cash
      if (CASH_CLASSES.has(h.assetClass)) {
        estimatedDrawdown += h.weight * crisis.cashDrawdown;
        continue;
      }

      // Equities — use sector drawdown
      const sectorDd = crisis.sectorDrawdowns[h.sector];
      if (sectorDd !== undefined) {
        let dd = sectorDd;
        // Adjust by beta if available
        if (h.beta && h.beta > 0) {
          dd *= Math.min(1.5, h.beta);
        }
        estimatedDrawdown += h.weight * dd;
      } else {
        // Default: use market drawdown
        const betaMul = h.beta && h.beta > 0 ? Math.min(1.5, h.beta) : 1;
        estimatedDrawdown += h.weight * crisis.marketDrawdown * betaMul;
      }
    }

    // Cap the drawdown at reasonable bounds
    estimatedDrawdown = Math.max(-0.95, Math.min(0.30, estimatedDrawdown));

    const lossDollar = portfolioValue * Math.abs(estimatedDrawdown);

    // Estimate recovery (proportional to crisis recovery, adjusted by portfolio vs market severity)
    const severityRatio = crisis.marketDrawdown !== 0
      ? Math.abs(estimatedDrawdown) / Math.abs(crisis.marketDrawdown)
      : 1;
    const recoveryMonths = Math.round(crisis.marketRecoveryMonths * severityRatio);

    const impactLevel = getImpactLevel(estimatedDrawdown);

    return {
      name: crisis.name,
      period: crisis.period,
      description: crisis.description,
      marketDrawdown: crisis.marketDrawdown,
      estimatedPortfolioDrawdown: estimatedDrawdown,
      estimatedLossDollar: lossDollar,
      estimatedRecoveryMonths: recoveryMonths,
      impactLevel: impactLevel.label,
      color: impactLevel.color,
    };
  });

  const drawdowns = scenarios.map(s => s.estimatedPortfolioDrawdown);
  const worstDd = Math.min(...drawdowns);
  const avgDd = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;

  // Build factual emotional context
  const worstScenario = scenarios.find(s => s.estimatedPortfolioDrawdown === worstDd)!;
  const worstLoss = Math.abs(worstDd * portfolioValue);
  const emotionalContext = `Dans le pire scenario historique (${worstScenario.name}), le portefeuille aurait temporairement perdu environ ${formatDollar(worstLoss)}. La recuperation estimee aurait pris environ ${worstScenario.estimatedRecoveryMonths} mois.`;

  return {
    scenarios,
    worstEstimatedDrawdown: worstDd,
    avgEstimatedDrawdown: avgDd,
    emotionalContext,
  };
}

function getImpactLevel(drawdown: number): { label: 'Faible' | 'Modere' | 'Important' | 'Severe'; color: string } {
  const abs = Math.abs(drawdown);
  if (abs < 0.10) return { label: 'Faible', color: '#22c55e' };
  if (abs < 0.20) return { label: 'Modere', color: '#f59e0b' };
  if (abs < 0.35) return { label: 'Important', color: '#f97316' };
  return { label: 'Severe', color: '#ef4444' };
}

function formatDollar(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M$`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)} 000$`;
  return `${value.toFixed(0)}$`;
}

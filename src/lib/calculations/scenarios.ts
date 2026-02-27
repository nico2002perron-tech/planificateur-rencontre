export interface ScenarioAssumptions {
  equityReturn: number;
  fixedIncomeReturn: number;
  inflation: number;
  years: number;
}

export interface ScenarioResult {
  name: string;
  type: 'bull' | 'base' | 'bear';
  projectedValue: number;
  totalReturn: number;
  annualizedReturn: number;
}

export const DEFAULT_SCENARIOS: Record<string, ScenarioAssumptions> = {
  bull: {
    equityReturn: 12,
    fixedIncomeReturn: 5,
    inflation: 2,
    years: 5,
  },
  base: {
    equityReturn: 7,
    fixedIncomeReturn: 3.5,
    inflation: 2.5,
    years: 5,
  },
  bear: {
    equityReturn: 2,
    fixedIncomeReturn: 2,
    inflation: 3,
    years: 5,
  },
};

export const STRESS_TEST_SCENARIOS = {
  '2008': {
    name: 'Crise financière 2008',
    equityImpact: -38,
    fixedIncomeImpact: 5,
    duration: '18 mois',
  },
  '2020': {
    name: 'COVID-19 (2020)',
    equityImpact: -34,
    fixedIncomeImpact: 2,
    duration: '1 mois',
  },
  '2022': {
    name: 'Hausse des taux 2022',
    equityImpact: -19,
    fixedIncomeImpact: -13,
    duration: '10 mois',
  },
};

export function projectPortfolioValue(
  currentValue: number,
  equityWeight: number,
  assumptions: ScenarioAssumptions
): ScenarioResult[] {
  const fixedWeight = 1 - equityWeight;

  return (['bull', 'base', 'bear'] as const).map((type) => {
    const a = DEFAULT_SCENARIOS[type];
    const blendedReturn = equityWeight * a.equityReturn + fixedWeight * a.fixedIncomeReturn;
    const realReturn = blendedReturn - a.inflation;
    const projectedValue = currentValue * Math.pow(1 + realReturn / 100, a.years);

    return {
      name: type === 'bull' ? 'Optimiste' : type === 'base' ? 'Base' : 'Pessimiste',
      type,
      projectedValue,
      totalReturn: ((projectedValue - currentValue) / currentValue) * 100,
      annualizedReturn: realReturn,
    };
  });
}

export function applyStressTest(
  currentValue: number,
  equityWeight: number,
  scenario: keyof typeof STRESS_TEST_SCENARIOS
): { name: string; impactedValue: number; loss: number; lossPercent: number } {
  const s = STRESS_TEST_SCENARIOS[scenario];
  const fixedWeight = 1 - equityWeight;
  const totalImpact = equityWeight * s.equityImpact + fixedWeight * s.fixedIncomeImpact;
  const impactedValue = currentValue * (1 + totalImpact / 100);
  const loss = currentValue - impactedValue;

  return {
    name: s.name,
    impactedValue,
    loss,
    lossPercent: totalImpact,
  };
}

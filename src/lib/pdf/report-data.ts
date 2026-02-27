import {
  calculateAllocationBy,
  calculateTopPositions,
  type AllocationSlice,
} from '@/lib/calculations/allocation';
import {
  projectPortfolioValue,
  applyStressTest,
  STRESS_TEST_SCENARIOS,
  type ScenarioResult,
} from '@/lib/calculations/scenarios';

// ─── Types ───────────────────────────────────────────────────────

interface DBHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  asset_class: string;
  sector: string;
  region: string;
}

interface DBPortfolio {
  id: string;
  name: string;
  account_type: string;
  currency: string;
}

interface DBClient {
  first_name: string;
  last_name: string;
  type: string;
  risk_profile: string;
  objectives: string;
  investment_horizon: string;
}

interface PriceInfo {
  price: number;
  company_name?: string;
  sector?: string;
}

export interface ReportHolding {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  weight: number;
  gainLoss: number;
  gainLossPercent: number;
  assetClass: string;
  sector: string;
  region: string;
}

export interface StressTestResult {
  name: string;
  impactedValue: number;
  loss: number;
  lossPercent: number;
}

export interface ProjectionYear {
  year: number;
  bull: number;
  base: number;
  bear: number;
}

export interface FullReportData {
  client: {
    name: string;
    type: string;
    riskProfile: string;
    objectives: string;
    horizon: string;
  };
  advisor: {
    name: string;
    title: string;
  };
  portfolio: {
    name: string;
    accountType: string;
    currency: string;
    totalValue: number;
    totalCost: number;
    totalGainLoss: number;
    totalGainLossPercent: number;
    holdings: ReportHolding[];
    modelSource?: string;
  };
  allocations: {
    byAssetClass: AllocationSlice[];
    bySector: AllocationSlice[];
    byRegion: AllocationSlice[];
  };
  topPositions: { symbol: string; name: string; market_value: number; weight: number }[];
  riskMetrics: {
    volatility: number;
    sharpe: number;
    maxDrawdown: number;
    beta: number;
    estimated: boolean;
  };
  scenarios: ScenarioResult[];
  projectionYears: ProjectionYear[];
  stressTests: StressTestResult[];
  generatedAt: string;
  config: {
    sections: string[];
    projectionYears: number;
  };
}

// ─── Risk Estimates by Asset Class ──────────────────────────────

const ASSET_CLASS_VOLATILITY: Record<string, number> = {
  EQUITY: 16,
  FIXED_INCOME: 5,
  CASH: 0.5,
  ALTERNATIVE: 12,
  REAL_ESTATE: 10,
  COMMODITY: 20,
};

const ASSET_CLASS_BETA: Record<string, number> = {
  EQUITY: 1.0,
  FIXED_INCOME: 0.1,
  CASH: 0.0,
  ALTERNATIVE: 0.6,
  REAL_ESTATE: 0.5,
  COMMODITY: 0.3,
};

const ASSET_CLASS_RETURN: Record<string, number> = {
  EQUITY: 8,
  FIXED_INCOME: 3.5,
  CASH: 2,
  ALTERNATIVE: 6,
  REAL_ESTATE: 7,
  COMMODITY: 4,
};

// ─── Builder ────────────────────────────────────────────────────

export function buildFullReportData(
  portfolio: DBPortfolio,
  dbHoldings: DBHolding[],
  client: DBClient,
  advisor: { name: string; title: string },
  priceMap: Record<string, PriceInfo>,
  config: { sections?: string[]; projectionYears?: number; modelSource?: string } = {}
): FullReportData {
  const projYears = config.projectionYears || 5;
  const sections = config.sections || [
    'summary', 'composition', 'allocation', 'risk', 'scenarios', 'stress', 'disclaimers',
  ];

  // ── Build Holdings with market values ──
  const holdings: ReportHolding[] = dbHoldings.map((h) => {
    const priceInfo = priceMap[h.symbol];
    const currentPrice = priceInfo?.price || h.average_cost;
    const marketValue = h.quantity * currentPrice;
    const costBasis = h.quantity * h.average_cost;
    const gainLoss = marketValue - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

    return {
      symbol: h.symbol,
      name: h.name || priceInfo?.company_name || h.symbol,
      quantity: h.quantity,
      avgCost: h.average_cost,
      currentPrice,
      marketValue,
      costBasis,
      weight: 0, // calculated below
      gainLoss,
      gainLossPercent,
      assetClass: h.asset_class || 'EQUITY',
      sector: priceInfo?.sector || h.sector || '',
      region: h.region || 'CA',
    };
  });

  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);

  // Assign weights
  if (totalValue > 0) {
    holdings.forEach((h) => {
      h.weight = (h.marketValue / totalValue) * 100;
    });
  }

  // ── Allocations ──
  const holdingsForAlloc = holdings.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    market_value: h.marketValue,
    asset_class: h.assetClass,
    sector: h.sector,
    region: h.region,
  }));

  const byAssetClass = calculateAllocationBy(holdingsForAlloc, 'asset_class');
  const bySector = calculateAllocationBy(holdingsForAlloc, 'sector');
  const byRegion = calculateAllocationBy(holdingsForAlloc, 'region');

  // ── Top Positions ──
  const top5 = calculateTopPositions(holdingsForAlloc, 5).map((t) => ({
    symbol: t.symbol,
    name: t.name,
    market_value: t.market_value,
    weight: totalValue > 0 ? (t.market_value / totalValue) * 100 : 0,
  }));

  // ── Risk Metrics (estimated from asset class weights) ──
  let weightedVol = 0;
  let weightedBeta = 0;
  let weightedReturn = 0;
  let equityWeight = 0;

  for (const h of holdings) {
    const w = h.weight / 100;
    const vol = ASSET_CLASS_VOLATILITY[h.assetClass] || 16;
    const beta = ASSET_CLASS_BETA[h.assetClass] || 1;
    const ret = ASSET_CLASS_RETURN[h.assetClass] || 7;
    weightedVol += w * vol;
    weightedBeta += w * beta;
    weightedReturn += w * ret;
    if (h.assetClass === 'EQUITY') equityWeight += w;
  }

  const riskFreeRate = 4; // approximate risk-free rate
  const sharpe = weightedVol > 0 ? (weightedReturn - riskFreeRate) / weightedVol : 0;
  const maxDrawdown = weightedVol * 2.5; // rough approximation

  // ── Scenarios ──
  const scenarios = projectPortfolioValue(totalValue, equityWeight, {
    equityReturn: 7,
    fixedIncomeReturn: 3.5,
    inflation: 2.5,
    years: projYears,
  });

  // ── Year-by-year projection ──
  const projectionYears: ProjectionYear[] = [];
  const bullReturn = equityWeight * 12 + (1 - equityWeight) * 5 - 2;
  const baseReturn = equityWeight * 7 + (1 - equityWeight) * 3.5 - 2.5;
  const bearReturn = equityWeight * 2 + (1 - equityWeight) * 2 - 3;

  for (let y = 1; y <= projYears; y++) {
    projectionYears.push({
      year: y,
      bull: totalValue * Math.pow(1 + bullReturn / 100, y),
      base: totalValue * Math.pow(1 + baseReturn / 100, y),
      bear: totalValue * Math.pow(1 + bearReturn / 100, y),
    });
  }

  // ── Stress Tests ──
  const stressTests: StressTestResult[] = (
    Object.keys(STRESS_TEST_SCENARIOS) as Array<keyof typeof STRESS_TEST_SCENARIOS>
  ).map((key) => applyStressTest(totalValue, equityWeight, key));

  // ── Final Data ──
  return {
    client: {
      name: `${client.first_name} ${client.last_name}`,
      type: client.type,
      riskProfile: client.risk_profile || 'EQUILIBRE',
      objectives: client.objectives || '',
      horizon: client.investment_horizon || '',
    },
    advisor: {
      name: advisor.name,
      title: advisor.title || '',
    },
    portfolio: {
      name: portfolio.name,
      accountType: portfolio.account_type,
      currency: portfolio.currency,
      totalValue,
      totalCost,
      totalGainLoss: totalValue - totalCost,
      totalGainLossPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      holdings,
      modelSource: config.modelSource,
    },
    allocations: { byAssetClass, bySector, byRegion },
    topPositions: top5,
    riskMetrics: {
      volatility: weightedVol,
      sharpe,
      maxDrawdown,
      beta: weightedBeta,
      estimated: true,
    },
    scenarios,
    projectionYears,
    stressTests,
    generatedAt: new Intl.DateTimeFormat('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date()),
    config: {
      sections,
      projectionYears: projYears,
    },
  };
}

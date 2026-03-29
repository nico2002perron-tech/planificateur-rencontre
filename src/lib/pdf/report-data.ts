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
import type { AIReportContent, ValuationDataItem } from '@/lib/ai/types';
import type { BenchmarkComparisonData } from './benchmark-data';
import type { StockDualScore } from '@/lib/valuation/safety-score';
export type { AIReportContent, ValuationDataItem, BenchmarkComparisonData, StockDualScore };

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
  sectorDisplay: string;
  dividendAnnual: number;
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

// ─── New Enriched Types ──────────────────────────────────────────

export interface HoldingProfile {
  symbol: string;
  companyName: string;
  description: string;
  sector: string;
  industry: string;
  country: string;
  beta: number;
  lastDiv: number;
  marketCap: number;
  exchange: string;
  targetPrice: number;
  targetHigh: number;
  targetLow: number;
  numberOfAnalysts: number;
  currentPrice: number;
  quantity: number;
  costBasis: number;
  estimatedGainPercent: number;
  estimatedGainDollar: number;
  targetSource: 'consensus' | 'estimated' | 'manual' | 'none';
  pe: number;
  eps: number;
  week52High: number;
  week52Low: number;
  dividendYield: number;
  earningsGrowth: number;
  profitMargins: number;
  debtToEquity: number;
  currentRatio: number;
  revenueGrowth: number;
  freeCashflow: number;
  returnOnEquity: number;
  forwardPE: number;
}

export interface HistoricalPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number;
}

export interface AnnualReturn {
  year: number;
  portfolioReturn: number;
  benchmarkReturn: number;
  difference: number;
}

export interface PriceTargetSummary {
  totalCurrentValue: number;
  totalTargetValue: number;
  totalEstimatedGainDollar: number;
  totalEstimatedGainPercent: number;
}

export interface SectorBreakdownItem {
  sector: string;
  sectorLabel: string;
  holdings: string[];
  totalValue: number;
  weight: number;
}

// ─── FMP Data Inputs ─────────────────────────────────────────────

export interface FMPProfileData {
  symbol: string;
  companyName: string;
  description: string;
  sector: string;
  industry: string;
  country: string;
  beta: number;
  lastDiv: number;
  mktCap: number;
  exchange: string;
  pe?: number;
  eps?: number;
  week52High?: number;
  week52Low?: number;
  dividendYield?: number;
  earningsGrowth?: number;
  profitMargins?: number;
  debtToEquity?: number;
  currentRatio?: number;
  revenueGrowth?: number;
  freeCashflow?: number;
  returnOnEquity?: number;
  forwardPE?: number;
}

export interface FMPTargetData {
  targetConsensus: number;
  targetHigh: number;
  targetLow: number;
  numberOfAnalysts: number;
}

export interface FMPHistoricalData {
  date: string;
  close: number;
}

export interface EnrichedFMPData {
  profiles: Record<string, FMPProfileData>;
  targets: Record<string, FMPTargetData>;
  holdingHistory: Record<string, FMPHistoricalData[]>;
  benchmarkHistory: FMPHistoricalData[];
}

// ─── Full Report Data ────────────────────────────────────────────

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
  // New enriched data
  holdingProfiles: HoldingProfile[];
  annualReturns: AnnualReturn[];
  priceTargetSummary: PriceTargetSummary;
  sectorBreakdown: SectorBreakdownItem[];
  generatedAt: string;
  config: {
    sections: string[];
    projectionYears: number;
    aiEnabled?: boolean;
    includeValuation?: boolean;
  };
  aiContent?: AIReportContent | null;
  valuationData?: ValuationDataItem[] | null;
  benchmarkComparison?: BenchmarkComparisonData | null;
  stockScores?: StockDualScore[] | null;
}

// ─── Sector Labels (FR) ─────────────────────────────────────────

const SECTOR_LABELS_FR: Record<string, string> = {
  'Technology': 'Technologie',
  'Healthcare': 'Santé',
  'Financial Services': 'Services financiers',
  'Financials': 'Services financiers',
  'Consumer Cyclical': 'Consommation cyclique',
  'Consumer Defensive': 'Consommation défensive',
  'Industrials': 'Industriels',
  'Energy': 'Énergie',
  'Utilities': 'Services publics',
  'Real Estate': 'Immobilier',
  'Basic Materials': 'Matériaux de base',
  'Communication Services': 'Communications',
  'Consumer Staples': 'Biens de consommation',
  'Military': 'Militaire',
  'Defense': 'Défense',
  'Aerospace & Defense': 'Aérospatiale & Défense',
  'Militaire': 'Militaire',
};

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

// ─── Helper: Truncate description ────────────────────────────────

function truncateWords(text: string, maxWords: number): string {
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

// ─── Helper: Compute annual returns from monthly history ─────────

function computeAnnualReturns(
  holdingHistory: Record<string, FMPHistoricalData[]>,
  benchmarkHistory: FMPHistoricalData[],
  holdings: ReportHolding[]
): AnnualReturn[] {
  if (benchmarkHistory.length < 12) return [];

  // Group benchmark by year
  const benchmarkByYear = new Map<number, { first: number; last: number }>();
  const sortedBenchmark = [...benchmarkHistory].sort((a, b) => a.date.localeCompare(b.date));

  for (const pt of sortedBenchmark) {
    const year = new Date(pt.date).getFullYear();
    const existing = benchmarkByYear.get(year);
    if (!existing) {
      benchmarkByYear.set(year, { first: pt.close, last: pt.close });
    } else {
      existing.last = pt.close;
    }
  }

  // Build portfolio value at year boundaries
  const allYears = Array.from(benchmarkByYear.keys()).sort();
  const results: AnnualReturn[] = [];

  for (const year of allYears) {
    const benchData = benchmarkByYear.get(year);
    if (!benchData || benchData.first === 0) continue;

    const benchReturn = ((benchData.last - benchData.first) / benchData.first) * 100;

    // Calculate portfolio return for this year
    let portfolioStartValue = 0;
    let portfolioEndValue = 0;
    let hasData = false;

    for (const h of holdings) {
      const history = holdingHistory[h.symbol];
      if (!history || history.length === 0) continue;

      const yearData = history
        .filter((p) => new Date(p.date).getFullYear() === year)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (yearData.length >= 2) {
        portfolioStartValue += h.quantity * yearData[0].close;
        portfolioEndValue += h.quantity * yearData[yearData.length - 1].close;
        hasData = true;
      }
    }

    if (hasData && portfolioStartValue > 0) {
      const portReturn = ((portfolioEndValue - portfolioStartValue) / portfolioStartValue) * 100;
      results.push({
        year,
        portfolioReturn: Math.round(portReturn * 100) / 100,
        benchmarkReturn: Math.round(benchReturn * 100) / 100,
        difference: Math.round((portReturn - benchReturn) * 100) / 100,
      });
    }
  }

  // Return last 5 years maximum
  return results.slice(-5);
}

// ─── Builder ────────────────────────────────────────────────────

export function buildFullReportData(
  portfolio: DBPortfolio,
  dbHoldings: DBHolding[],
  client: DBClient,
  advisor: { name: string; title: string },
  priceMap: Record<string, PriceInfo>,
  config: { sections?: string[]; projectionYears?: number; modelSource?: string; customTargets?: Record<string, number>; aiEnabled?: boolean; includeValuation?: boolean } = {},
  fmpData?: EnrichedFMPData,
  etfSectorData?: Record<string, { sector: string; weight: number }[]>
): FullReportData {
  const projYears = config.projectionYears || 5;
  const sections = config.sections || [
    'summary', 'composition', 'allocation', 'risk', 'scenarios', 'stress', 'disclaimers',
  ];

  // ── Build Holdings with market values ──
  const holdings: ReportHolding[] = dbHoldings.map((h) => {
    const priceInfo = priceMap[h.symbol];
    const profile = fmpData?.profiles[h.symbol];
    const currentPrice = priceInfo?.price || h.average_cost;
    const marketValue = h.quantity * currentPrice;
    const costBasis = h.quantity * h.average_cost;
    const gainLoss = marketValue - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

    return {
      symbol: h.symbol,
      name: profile?.companyName || h.name || priceInfo?.company_name || h.symbol,
      quantity: h.quantity,
      avgCost: h.average_cost,
      currentPrice,
      marketValue,
      costBasis,
      weight: 0, // calculated below
      gainLoss,
      gainLossPercent,
      assetClass: h.asset_class || 'EQUITY',
      sector: profile?.sector || priceInfo?.sector || h.sector || '',
      sectorDisplay: (() => {
        const etfSectors = etfSectorData?.[h.symbol];
        if (etfSectors && etfSectors.length > 0) {
          return [...etfSectors]
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 3)
            .map(es => SECTOR_LABELS_FR[es.sector] || es.sector)
            .join(', ');
        }
        const rawSector = profile?.sector || priceInfo?.sector || h.sector || '';
        return SECTOR_LABELS_FR[rawSector] || rawSector || '';
      })(),
      dividendAnnual: (profile?.lastDiv || 0) * h.quantity,
      region: h.region || (profile?.country === 'CA' || profile?.country === 'Canada' ? 'CA' : profile?.country === 'US' || profile?.country === 'United States' ? 'US' : h.region || 'CA'),
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

  const riskFreeRate = 4;
  const sharpe = weightedVol > 0 ? (weightedReturn - riskFreeRate) / weightedVol : 0;
  const maxDrawdown = weightedVol * 2.5;

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

  // ── Holding Profiles (enriched from FMP) ──
  const holdingProfiles: HoldingProfile[] = holdings.map((h) => {
    const profile = fmpData?.profiles[h.symbol];
    const target = fmpData?.targets[h.symbol];
    const customTarget = config.customTargets?.[h.symbol];
    const targetPrice = customTarget ?? target?.targetConsensus ?? 0;
    const gainDollar = targetPrice > 0 ? h.quantity * (targetPrice - h.currentPrice) : 0;
    const gainPercent = h.currentPrice > 0 && targetPrice > 0
      ? ((targetPrice - h.currentPrice) / h.currentPrice) * 100
      : 0;

    // Determine target source
    let targetSource: 'consensus' | 'estimated' | 'manual' | 'none' = 'none';
    if (customTarget != null && customTarget > 0) targetSource = 'manual';
    else if (target?.targetConsensus && target.targetConsensus > 0) targetSource = 'consensus';

    return {
      symbol: h.symbol,
      companyName: profile?.companyName || h.name,
      description: truncateWords(profile?.description || '', 100),
      sector: profile?.sector || h.sector || '',
      industry: profile?.industry || '',
      country: profile?.country || '',
      beta: profile?.beta || 0,
      lastDiv: profile?.lastDiv || 0,
      marketCap: profile?.mktCap || 0,
      exchange: profile?.exchange || '',
      targetPrice,
      targetHigh: target?.targetHigh || 0,
      targetLow: target?.targetLow || 0,
      numberOfAnalysts: target?.numberOfAnalysts || 0,
      currentPrice: h.currentPrice,
      quantity: h.quantity,
      costBasis: h.costBasis,
      estimatedGainPercent: Math.round(gainPercent * 100) / 100,
      estimatedGainDollar: Math.round(gainDollar * 100) / 100,
      targetSource,
      pe: profile?.pe || 0,
      eps: profile?.eps || 0,
      week52High: profile?.week52High || 0,
      week52Low: profile?.week52Low || 0,
      dividendYield: profile?.dividendYield || 0,
      earningsGrowth: profile?.earningsGrowth || 0,
      profitMargins: profile?.profitMargins || 0,
      debtToEquity: profile?.debtToEquity || 0,
      currentRatio: profile?.currentRatio || 0,
      revenueGrowth: profile?.revenueGrowth || 0,
      freeCashflow: profile?.freeCashflow || 0,
      returnOnEquity: profile?.returnOnEquity || 0,
      forwardPE: profile?.forwardPE || 0,
    };
  });

  // ── Price Target Summary ──
  let totalTargetValue = 0;
  for (const hp of holdingProfiles) {
    if (hp.targetPrice > 0) {
      totalTargetValue += hp.quantity * hp.targetPrice;
    } else {
      totalTargetValue += hp.quantity * hp.currentPrice;
    }
  }
  const totalEstimatedGainDollar = totalTargetValue - totalValue;
  const totalEstimatedGainPercent = totalValue > 0
    ? (totalEstimatedGainDollar / totalValue) * 100
    : 0;

  const priceTargetSummary: PriceTargetSummary = {
    totalCurrentValue: totalValue,
    totalTargetValue,
    totalEstimatedGainDollar: Math.round(totalEstimatedGainDollar * 100) / 100,
    totalEstimatedGainPercent: Math.round(totalEstimatedGainPercent * 100) / 100,
  };

  // ── Sector Breakdown (with ETF decomposition) ──
  const sectorMap = new Map<string, { holdings: string[]; totalValue: number }>();
  for (const h of holdings) {
    const etfSectors = etfSectorData?.[h.symbol];
    if (etfSectors && etfSectors.length > 0) {
      // ETF: distribute value across its underlying sectors
      for (const es of etfSectors) {
        const sectorValue = h.marketValue * es.weight;
        const sector = es.sector || 'Autre';
        const existing = sectorMap.get(sector);
        if (existing) {
          if (!existing.holdings.includes(h.symbol)) existing.holdings.push(h.symbol);
          existing.totalValue += sectorValue;
        } else {
          sectorMap.set(sector, { holdings: [h.symbol], totalValue: sectorValue });
        }
      }
    } else {
      // Stock: single sector
      const sector = h.sector || 'Autre';
      const existing = sectorMap.get(sector);
      if (existing) {
        existing.holdings.push(h.symbol);
        existing.totalValue += h.marketValue;
      } else {
        sectorMap.set(sector, { holdings: [h.symbol], totalValue: h.marketValue });
      }
    }
  }
  const sectorBreakdown: SectorBreakdownItem[] = Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      sectorLabel: SECTOR_LABELS_FR[sector] || sector,
      holdings: data.holdings,
      totalValue: data.totalValue,
      weight: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  // ── Annual Returns (from FMP historical data) ──
  const annualReturns = fmpData
    ? computeAnnualReturns(fmpData.holdingHistory, fmpData.benchmarkHistory, holdings)
    : [];

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
    holdingProfiles,
    annualReturns,
    priceTargetSummary,
    sectorBreakdown,
    generatedAt: new Intl.DateTimeFormat('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date()),
    config: {
      sections,
      projectionYears: projYears,
      aiEnabled: config.aiEnabled,
      includeValuation: config.includeValuation,
    },
  };
}

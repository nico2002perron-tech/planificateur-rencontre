// =============================================================================
// PORTFOLIO ANALYSIS RESULT — Single Source of Truth
// All types for the unified analytics pipeline. Consumed read-only by PDF pages,
// AI prompts, and future dashboards.
// =============================================================================

import type { RiskMetrics, DrawdownPeriod } from './risk-metrics';
import type { MonteCarloResult } from './monte-carlo';
import type { DiversificationAnalysis } from './correlation';
import type { PortfolioDNA } from './portfolio-dna';
import type { StressRadarResult } from './stress-radar';
import type { BehavioralAnalysis } from './behavioral';
import type { BondAnalytics } from './bond-analytics';
import type { PortfolioIntelligenceScore } from './portfolio-intelligence';
import type { AIReportContentV2 } from '../ai/types-v2';

// Re-export engine types for convenience
export type {
  RiskMetrics, DrawdownPeriod,
  MonteCarloResult,
  DiversificationAnalysis,
  PortfolioDNA,
  StressRadarResult,
  BehavioralAnalysis,
  BondAnalytics,
  PortfolioIntelligenceScore,
  AIReportContentV2,
};

// ─── TOP-LEVEL ────────────────────────────────────────────────
export interface PortfolioAnalysisResult {
  meta: AnalysisMeta;
  client: ClientInfo;
  portfolio: PortfolioSummary;
  holdings: AnalyzedHolding[];

  // Analytics modules (direct engine outputs)
  risk: RiskAnalysis;
  projection: ProjectionAnalysis;
  diversification: DiversificationAnalysis;
  dna: PortfolioDNA;
  stress: StressRadarResult;
  behavioral: BehavioralAnalysis;
  bonds: BondAnalysisBlock | null;
  intelligence: PortfolioIntelligenceScore;

  // Pre-computed display blocks
  allocation: AllocationBlock;
  fundamentals: FundamentalsBlock;
  valuation: ValuationBlock;
  income: IncomeBlock;
  benchmark: BenchmarkBlock;
  marketIntel: MarketIntelBlock;
  recommendations: RecommendationsBlock;

  // AI narratives (optional)
  ai: AIReportContentV2 | null;
}

// ─── META ─────────────────────────────────────────────────────
export interface AnalysisMeta {
  generatedAt: string;
  dataAsOf: string;
  engineVersion: string;
  horizonYears: number;
  monthlyContribution: number;
  targetValue: number | null;
  benchmarkSymbol: string;
  benchmarkName: string;
  currency: string;
}

// ─── CLIENT ───────────────────────────────────────────────────
export interface ClientInfo {
  name: string;
  portfolioName: string;
  riskProfile: string;
  horizon: string;
  advisorName: string;
  advisorTitle: string;
}

// ─── PORTFOLIO SUMMARY ───────────────────────────────────────
export interface PortfolioSummary {
  totalValue: number;
  currency: string;
  expectedReturn: number;
  annualIncome: number;
  holdingCount: number;
  sectorCount: number;
  equityWeight: number;
  fixedIncomeWeight: number;
  alternativeWeight: number;
  cashWeight: number;
  top3Holdings: Array<{ name: string; weight: number }>;
}

// ─── ANALYZED HOLDING ─────────────────────────────────────────
export interface AnalyzedHolding {
  symbol: string;
  name: string;
  weight: number;
  currentPrice: number;
  sector: string;
  region: string;
  currency: string;
  assetClass: string;

  // DNA
  dnaStyle: string;
  dnaReason: string;
  dnaConfidence: number;

  // Fundamentals
  pe: number | null;
  pb: number | null;
  roe: number | null;
  debtToEquity: number | null;
  profitMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  beta: number | null;

  // Pre-computed quality scores
  qualityScores: HoldingQualityScores;

  // Valuation
  fairValue: number | null;
  upsidePct: number | null;
  valuationVerdict: 'undervalued' | 'fair' | 'overvalued' | null;
  dcfValue: number | null;
  peValue: number | null;
  psValue: number | null;

  // Income
  annualDividend: number | null;
  payoutRatio: number | null;
  dividendGrowth5Y: number | null;
  exDividendDate: string | null;
  paymentFrequency: string | null;

  // Asset sheet
  targetPrice: number | null;
  safetyScore: number | null;
  upsideScore: number | null;
  whyItExists: string;

  // Fund-specific
  isFund: boolean;
  morningstarRating: number | null;
  mer: number | null;
  topHoldings: Array<{ name: string; weight: number }> | null;

  // Scatter coordinates
  scatterX: number | null;
  scatterY: number | null;
  scatterSize: number;
}

export interface HoldingQualityScores {
  rentabilite: number;
  solidite: number;
  valorisation: number;
  croissance: number;
  stabilite: number;
}

// ─── RISK ANALYSIS ────────────────────────────────────────────
export interface RiskAnalysis {
  metrics: RiskMetrics;
  drawdownChart: {
    values: number[];
    dates: string[];
  };
  drawdownPeriods: DrawdownPeriod[];
  monthlyReturns: number[];
}

// ─── PROJECTION ANALYSIS ──────────────────────────────────────
export interface ProjectionAnalysis {
  monteCarlo: MonteCarloResult;
  monthLabels: string[];
  scenarioRows: ProjectionScenarioRow[];
}

export interface ProjectionScenarioRow {
  label: string;
  percentile: string;
  finalValue: number;
  gain: number;
  annualizedReturn: number;
  color: string;
}

// ─── ALLOCATION BLOCK ─────────────────────────────────────────
export interface AllocationBlock {
  assetClassSlices: AllocationSlice[];
  sectorSlices: AllocationSlice[];
  regionSlices: AllocationSlice[];
  currencySlices: AllocationSlice[];
  top10Holdings: Array<{ symbol: string; name: string; weight: number; sector: string }>;
}

export interface AllocationSlice {
  label: string;
  weight: number;  // 0-1
  color: string;
}

// ─── FUNDAMENTALS BLOCK ──────────────────────────────────────
export interface FundamentalsBlock {
  rows: FundamentalRow[];
  portfolioAvgPE: number;
  portfolioAvgROE: number;
  portfolioAvgDebtEquity: number;
  portfolioAvgMargin: number;
  portfolioAvgBeta: number;
  qualityBars: QualityBar[];
  scatterPoints: ScatterPoint[];
}

export interface FundamentalRow {
  symbol: string;
  name: string;
  weight: number;
  pe?: number;
  pb?: number;
  roe?: number;
  debtToEquity?: number;
  profitMargin?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  dividendYield?: number;
  marketCap?: number;
  beta?: number;
}

export interface QualityBar {
  label: string;
  value: number;
  max: number;
  color: string;
}

export interface ScatterPoint {
  label: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
}

// ─── VALUATION BLOCK ─────────────────────────────────────────
export interface ValuationBlock {
  rows: ValuationRow[];
  portfolioUpside: number;
  undervaluedCount: number;
  overvaluedCount: number;
  fairValueCount: number;
  sensitivityMatrix: SensitivityMatrix | null;
}

export interface ValuationRow {
  symbol: string;
  name: string;
  weight: number;
  currentPrice: number;
  fairValueDCF?: number;
  fairValuePS?: number;
  fairValuePE?: number;
  consensusFairValue?: number;
  upsidePct: number;
  verdict: 'Sous-evalue' | 'Juste valeur' | 'Surevalue' | 'N/A';
  verdictColor: string;
}

export interface SensitivityMatrix {
  symbol: string;
  growthRates: string[];
  discountRates: string[];
  values: number[][];
  currentPrice: number;
}

// ─── INCOME BLOCK ────────────────────────────────────────────
export interface IncomeBlock {
  holdings: IncomeHolding[];
  totalAnnualIncome: number;
  portfolioYield: number;
  monthlyIncome: number;
  yieldOnCost: number | null;
  incomeByMonth: StackedBarItem[] | null;
}

export interface IncomeHolding {
  symbol: string;
  name: string;
  weight: number;
  dividendYield: number;
  annualDividend: number;
  payoutRatio?: number;
  exDivDate?: string;
  frequency: string;
  growthRate5Y?: number;
}

export interface StackedBarItem {
  label: string;
  segments: Array<{
    value: number;
    color: string;
    name: string;
  }>;
}

// ─── BOND ANALYSIS BLOCK ─────────────────────────────────────
export interface BondAnalysisBlock {
  analytics: BondAnalytics;
  allocationPct: number;
}

// ─── BENCHMARK BLOCK ─────────────────────────────────────────
export interface BenchmarkBlock {
  name: string;
  comparisons: BenchmarkComparison[];
  periodRows: BenchmarkPeriodRow[];
  portfolioGrowth: number[];
  benchmarkGrowth: number[];
  growthMonths: string[];
  captureUp: number;
  captureDown: number;
}

export interface BenchmarkComparison {
  label: string;
  portfolioValue: number;
  benchmarkValue: number;
  unit: string;
  betterIsHigher: boolean;
}

export interface BenchmarkPeriodRow {
  period: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  diff: number;
  diffBarPct: number;
  diffColor: string;
}

export interface PerformancePeriod {
  period: string;
  portfolioReturn: number;
  benchmarkReturn: number;
}

// ─── CORRELATION DISPLAY ──────────────────────────────────────
export interface CorrelationDisplayMetrics {
  hhiBarValue: number;
  correlationBarValue: number;
  top5BarValue: number;
  sectorBarValue: number;
}

// ─── MARKET INTEL BLOCK ──────────────────────────────────────
export interface MarketIntelBlock {
  factors: MarketFactor[];
  sectorOutlooks: SectorOutlook[];
  summary: string;
}

export interface MarketFactor {
  name: string;
  status: 'Favorable' | 'Neutre' | 'Defavorable';
  description: string;
  impact: string;
  color: string;
}

export interface SectorOutlook {
  sector: string;
  signal: 'Surponderer' | 'Neutre' | 'Sous-ponderer';
  weight: number;
  color: string;
}

// ─── RECOMMENDATIONS BLOCK ───────────────────────────────────
export interface RecommendationsBlock {
  recommendations: Recommendation[];
  strengthSummary: string[];
  weaknessSummary: string[];
}

export interface Recommendation {
  priority: 'Haute' | 'Moyenne' | 'Basse';
  category: string;
  title: string;
  description: string;
  impact: string;
  color: string;
}

// ─── ASSET SHEET DATA ─────────────────────────────────────────
export interface AssetSheetData {
  symbol: string;
  name: string;
  weight: number;
  currentPrice: number;
  targetPrice?: number;
  sector: string;
  assetClass: string;
  safetyScore?: number;
  upsideScore?: number;
  quadrant?: string;
  pe?: number;
  roe?: number;
  debtToEquity?: number;
  dividendYield?: number;
  marketCap?: number;
  beta?: number;
  dnaStyle: string;
  dnaReason: string;
  whyItExists: string;
  isFund?: boolean;
  morningstarRating?: number;
  mer?: number;
  topHoldings?: Array<{ name: string; weight: number }>;
}

// ─── RAW INPUT TYPES ──────────────────────────────────────────
export interface RawPortfolioInput {
  client: ClientInfo;
  holdings: RawHolding[];
  historicalPrices: Record<string, { dates: string[]; prices: number[] }>;
  benchmarkPrices: { dates: string[]; prices: number[] };

  config: {
    horizonYears: number;
    monthlyContribution: number;
    targetValue: number | null;
    riskFreeRate: number;
    inflationRate: number;
    benchmarkSymbol: string;
    benchmarkName: string;
    currency: string;
  };

  marketContext?: {
    factors: MarketFactor[];
    sectorOutlooks: SectorOutlook[];
    summary: string;
  };
}

export interface RawHolding {
  symbol: string;
  name: string;
  weight: number;
  currentPrice: number;
  shares: number;
  costBasis?: number;
  assetClass: string;
  sector: string;
  region: string;
  currency: string;
  pe?: number;
  pb?: number;
  roe?: number;
  debtToEquity?: number;
  profitMargin?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  dividendYield?: number;
  annualDividend?: number;
  payoutRatio?: number;
  dividendGrowth5Y?: number;
  exDividendDate?: string;
  paymentFrequency?: string;
  marketCap?: number;
  beta?: number;
  dcfValue?: number;
  peValue?: number;
  psValue?: number;
  fairValue?: number;
  targetPrice?: number;
  coupon?: number;
  maturity?: string;
  ytm?: number;
  duration?: number;
  creditRating?: string;
  faceValue?: number;
  isFund?: boolean;
  morningstarRating?: number;
  mer?: number;
  topHoldings?: Array<{ name: string; weight: number }>;
}

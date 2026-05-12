// =============================================================================
// ANALYTICS MODULE — Central exports
// =============================================================================

// ─── Pipeline (Single Source of Truth) ────────────────────────
export { computePortfolioAnalysis } from './pipeline';
export type {
  PortfolioAnalysisResult, AnalysisMeta, ClientInfo, PortfolioSummary,
  AnalyzedHolding, HoldingQualityScores,
  RiskAnalysis, ProjectionAnalysis, ProjectionScenarioRow,
  AllocationBlock, AllocationSlice,
  FundamentalsBlock, FundamentalRow, QualityBar, ScatterPoint,
  ValuationBlock, ValuationRow, SensitivityMatrix,
  IncomeBlock, IncomeHolding, StackedBarItem,
  BondAnalysisBlock,
  BenchmarkBlock, BenchmarkComparison, BenchmarkPeriodRow, PerformancePeriod,
  CorrelationDisplayMetrics,
  MarketIntelBlock, MarketFactor, SectorOutlook,
  RecommendationsBlock, Recommendation,
  AssetSheetData,
  RawPortfolioInput, RawHolding,
} from './types';

// ─── Derived Metrics ──────────────────────────────────────────
export {
  computeQualityBars, computeHoldingQualityScores,
  computeCorrelationBarValues, computeProjectionScenarios,
  computeBenchmarkPeriodRows, computeUpsidePct,
  computeValuationVerdict, buildMonthLabels,
} from './derived-metrics';

// ─── Schemas (boundary validation) ────────────────────────────
export { RawPortfolioInputSchema, RawHoldingSchema, AIReportContentV2Schema } from './schemas';

// ─── Individual Engines (for direct use if needed) ────────────
export { calculateRiskMetrics, analyzeDrawdowns, buildPortfolioTimeSeries, calcSimpleReturns, calcMonthlyReturns } from './risk-metrics';
export type { RiskMetrics, DrawdownPeriod } from './risk-metrics';

export { runMonteCarlo, runMultiAssetMonteCarlo } from './monte-carlo';
export type { MonteCarloConfig, MonteCarloResult } from './monte-carlo';

export { buildCorrelationMatrix, analyzeDiversification, calculateHHI, effectivePositions, groupConcentration } from './correlation';
export type { CorrelationMatrix, DiversificationAnalysis, ConcentrationBreakdown } from './correlation';

export { analyzePortfolioDNA } from './portfolio-dna';
export type { PortfolioDNA, HoldingDNA, DNAStyle, HoldingData } from './portfolio-dna';

export { calculateStressRadar } from './stress-radar';
export type { StressRadarResult, StressFactor } from './stress-radar';

export { analyzeBehavioral } from './behavioral';
export type { BehavioralAnalysis, CrisisScenario } from './behavioral';

export { calculateBondAnalytics } from './bond-analytics';
export type { BondAnalytics, BondHolding } from './bond-analytics';

export { calculatePortfolioIntelligence } from './portfolio-intelligence';
export type { PortfolioIntelligenceScore, SubScore, ScoreInputs } from './portfolio-intelligence';

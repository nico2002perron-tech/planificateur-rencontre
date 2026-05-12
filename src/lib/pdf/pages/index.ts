// =============================================================================
// PDF PAGES — Central exports
// =============================================================================

export { CoverPage } from './cover';
export { TableOfContentsPage, buildTOCEntries } from './table-of-contents';
export { ExecutiveSummaryPage } from './executive-summary';
export { PortfolioDNAPage } from './portfolio-dna';
export { AllocationPage } from './allocation';
export { ProjectionPage } from './projection';
export { FundamentalsPage } from './fundamentals';
export { ValuationPage } from './valuation';
export { IncomePage } from './income';
export { BondsPage } from './bonds';
export { RiskPage } from './risk';
export { CorrelationPage } from './correlation';
export { StressRadarPage } from './stress-radar';
export { BehavioralPage } from './behavioral';
export { MarketIntelPage } from './market-intel';
export { RecommendationsPage } from './recommendations';
export { ComparisonsPage } from './comparisons';
export { AssetSheetsPage } from './asset-sheets';

// Shared utilities
export { ReportPage, SectionTitle, AIBlock, KPICard, StatCard, ScoreBadge, ScoreBar, DonutChart, Legend, SectorBars } from './shared';
export { fmt, fmtFull, fmtPct, fmtPctShort, fmtNum, fmtCap, fmtDollarShort, truncate } from './shared';

// Types
export type { AllocationSlice } from './allocation';
export type { FundamentalRow } from './fundamentals';
export type { ValuationRow } from './valuation';
export type { IncomeHolding } from './income';
export type { AssetSheetData } from './asset-sheets';
export type { MarketFactor, SectorOutlook } from './market-intel';
export type { Recommendation } from './recommendations';
export type { BenchmarkComparison, PerformancePeriod } from './comparisons';

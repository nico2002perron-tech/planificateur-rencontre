// =============================================================================
// REPORT V2 ORCHESTRATOR
// Assembles the full 18+ page PDF Document from modular page components.
// =============================================================================
import React from 'react';
import { Document, Font } from '@react-pdf/renderer';
import path from 'path';

// Pages
import { CoverPage } from './pages/cover';
import { TableOfContentsPage, buildTOCEntries } from './pages/table-of-contents';
import { ExecutiveSummaryPage } from './pages/executive-summary';
import { PortfolioDNAPage } from './pages/portfolio-dna';
import { AllocationPage } from './pages/allocation';
import { ProjectionPage } from './pages/projection';
import { FundamentalsPage } from './pages/fundamentals';
import { ValuationPage } from './pages/valuation';
import { IncomePage } from './pages/income';
import { BondsPage } from './pages/bonds';
import { RiskPage } from './pages/risk';
import { CorrelationPage } from './pages/correlation';
import { StressRadarPage } from './pages/stress-radar';
import { BehavioralPage } from './pages/behavioral';
import { MarketIntelPage } from './pages/market-intel';
import { RecommendationsPage } from './pages/recommendations';
import { ComparisonsPage } from './pages/comparisons';
import { AssetSheetsPage } from './pages/asset-sheets';

// Types (legacy)
import type { PortfolioDNA } from '../analytics/portfolio-dna';
import type { MonteCarloResult } from '../analytics/monte-carlo';
import type { RiskMetrics, DrawdownPeriod } from '../analytics/risk-metrics';
import type { DiversificationAnalysis } from '../analytics/correlation';
import type { StressRadarResult } from '../analytics/stress-radar';
import type { BehavioralAnalysis } from '../analytics/behavioral';
import type { BondAnalytics } from '../analytics/bond-analytics';
import type { PortfolioIntelligenceScore } from '../analytics/portfolio-intelligence';
import type { AllocationSlice } from './pages/allocation';
import type { FundamentalRow } from './pages/fundamentals';
import type { ValuationRow } from './pages/valuation';
import type { IncomeHolding } from './pages/income';
import type { AssetSheetData } from './pages/asset-sheets';
import type { MarketFactor, SectorOutlook } from './pages/market-intel';
import type { Recommendation } from './pages/recommendations';
import type { BenchmarkComparison, PerformancePeriod } from './pages/comparisons';
import type { ScatterPoint } from './charts/scatter-plot';
import type { StackedBarItem } from './charts/stacked-bar';
import type { AIReportContentV2 } from '../ai/types-v2';

// New pipeline types
import type { PortfolioAnalysisResult } from '../analytics/types';
import { computeCorrelationBarValues } from '../analytics/derived-metrics';

// ─── Font Registration ──────────────────────────────────────────
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: path.join(FONT_DIR, 'Montserrat-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'Montserrat-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'Montserrat-Bold.ttf'), fontWeight: 700 },
    { src: path.join(FONT_DIR, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 },
  ],
});

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: path.join(FONT_DIR, 'OpenSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'OpenSans-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'OpenSans-Bold.ttf'), fontWeight: 700 },
  ],
});

// Disable hyphenation for cleaner text
Font.registerHyphenationCallback((word) => [word]);

// ─── Master Data Interface ──────────────────────────────────────

export interface ReportV2Data {
  // Client info
  client: {
    name: string;
    portfolioName: string;
    riskProfile: string;
    horizon: string;
    advisorName: string;
    advisorTitle: string;
  };

  // Portfolio-level
  portfolio: {
    totalValue: number;
    currency: string;
    expectedReturn: number;
    annualIncome: number;
    holdingCount: number;
    sectorCount: number;
    equityWeight: number;
    fixedIncomeWeight: number;
    top3Holdings: Array<{ name: string; weight: number }>;
  };

  // Analytics results
  intelligenceScore: PortfolioIntelligenceScore;
  dna: PortfolioDNA;
  monteCarlo: MonteCarloResult;
  riskMetrics: RiskMetrics;
  diversification: DiversificationAnalysis;
  stressRadar: StressRadarResult;
  behavioral: BehavioralAnalysis;
  bondAnalytics?: BondAnalytics;

  // Allocation slices
  assetClassSlices: AllocationSlice[];
  sectorSlices: AllocationSlice[];
  regionSlices: AllocationSlice[];
  currencySlices: AllocationSlice[];

  // Holdings tables
  top10Holdings: Array<{ symbol: string; name: string; weight: number; sector: string }>;
  fundamentalRows: FundamentalRow[];
  valuationRows: ValuationRow[];
  incomeHoldings: IncomeHolding[];
  assetSheets: AssetSheetData[];

  // Aggregated fundamentals
  portfolioAvgPE: number;
  portfolioAvgROE: number;
  portfolioAvgDebtEquity: number;
  portfolioAvgMargin: number;
  portfolioAvgBeta: number;

  // Valuation summary
  portfolioUpside: number;
  undervaluedCount: number;
  overvaluedCount: number;
  fairValueCount: number;
  sensitivityMatrix?: {
    symbol: string;
    growthRates: string[];
    discountRates: string[];
    values: number[][];
    currentPrice: number;
  };

  // Income
  totalAnnualIncome: number;
  portfolioYield: number;
  monthlyIncome: number;
  incomeByMonth?: StackedBarItem[];
  yieldOnCost?: number;

  // Bonds
  bondAllocationPct: number;

  // Risk
  drawdownValues?: number[];
  drawdownDates?: string[];
  drawdownPeriods: DrawdownPeriod[];

  // Correlation
  holdingLabels: string[];

  // Scatter plot
  scatterPoints: ScatterPoint[];

  // Monte Carlo config
  horizonYears: number;
  monthlyContribution: number;
  targetValue?: number;

  // Market intel
  marketFactors: MarketFactor[];
  sectorOutlooks: SectorOutlook[];
  marketSummary: string;

  // Recommendations
  recommendations: Recommendation[];
  strengthSummary: string[];
  weaknessSummary: string[];

  // Benchmark comparison
  benchmarkName: string;
  benchmarkComparisons: BenchmarkComparison[];
  performancePeriods: PerformancePeriod[];
  portfolioGrowth: number[];
  benchmarkGrowth: number[];
  growthMonths: string[];
  captureUp: number;
  captureDown: number;

  // AI content (optional — report works without it)
  ai?: AIReportContentV2 | null;

  // Generation metadata
  generatedAt: string;
}

// ─── Main Report Component ──────────────────────────────────────

export function ReportV2({ data }: { data: ReportV2Data }) {
  const hasBonds = data.bondAllocationPct > 0 && data.bondAnalytics !== undefined;
  const holdingCount = data.assetSheets.length;

  // Calculate total pages
  const assetSheetPages = Math.ceil(holdingCount / 3);
  const baseSections = 14; // exec + dna + alloc + proj + fund + val + income + risk + stress + corr + behav + market + reco + bench
  const bondPages = hasBonds ? 1 : 0;
  const totalPages = 2 + baseSections + bondPages + assetSheetPages; // cover + toc + sections + asset sheets

  // Build TOC entries
  const tocEntries = buildTOCEntries({ hasBonds, holdingCount });

  // Page counter
  let pageNum = 3; // After cover (1) + TOC (2)

  // Chunk asset sheets into groups of 3
  const assetChunks: AssetSheetData[][] = [];
  for (let i = 0; i < data.assetSheets.length; i += 3) {
    assetChunks.push(data.assetSheets.slice(i, i + 3));
  }

  return (
    <Document
      title={`Rapport de portefeuille — ${data.client.name}`}
      author="Groupe Financier Ste-Foy"
      subject="Analyse de portefeuille"
      creator="Planificateur de Rencontre"
    >
      {/* Page 1: Cover */}
      <CoverPage
        clientName={data.client.name}
        portfolioName={data.client.portfolioName}
        riskProfile={data.client.riskProfile}
        targetReturn={`${(data.portfolio.expectedReturn * 100).toFixed(1)}%`}
        estimatedIncome={formatCurrency(data.portfolio.annualIncome, data.portfolio.currency)}
        portfolioValue={formatCurrency(data.portfolio.totalValue, data.portfolio.currency)}
        intelligenceScore={data.intelligenceScore}
        advisorName={data.client.advisorName}
        advisorTitle={data.client.advisorTitle}
        generatedAt={data.generatedAt}
        horizon={data.client.horizon}
      />

      {/* Page 2: Table of Contents */}
      <TableOfContentsPage entries={tocEntries} totalPages={totalPages} />

      {/* Page 3: Executive Summary */}
      <ExecutiveSummaryPage
        pageNum={pageNum++}
        totalPages={totalPages}
        portfolioValue={data.portfolio.totalValue}
        expectedReturn={data.portfolio.expectedReturn * 100}
        annualIncome={data.portfolio.annualIncome}
        intelligenceScore={data.intelligenceScore.overall}
        holdingCount={data.portfolio.holdingCount}
        sectorCount={data.portfolio.sectorCount}
        top3Holdings={data.portfolio.top3Holdings}
        equityWeight={data.portfolio.equityWeight}
        fixedIncomeWeight={data.portfolio.fixedIncomeWeight}
        aiSummary={data.ai?.executiveSummary || ''}
        currency={data.portfolio.currency}
      />

      {/* Page 4: Portfolio DNA */}
      <PortfolioDNAPage
        pageNum={pageNum++}
        totalPages={totalPages}
        dna={data.dna}
        aiComment={data.ai?.dnaComment}
      />

      {/* Page 5: Allocation */}
      <AllocationPage
        pageNum={pageNum++}
        totalPages={totalPages}
        assetClassSlices={data.assetClassSlices}
        sectorSlices={data.sectorSlices}
        regionSlices={data.regionSlices}
        currencySlices={data.currencySlices}
        top10Holdings={data.top10Holdings}
        aiComment={data.ai?.allocationComment}
      />

      {/* Page 6: Projections */}
      <ProjectionPage
        pageNum={pageNum++}
        totalPages={totalPages}
        monteCarlo={data.monteCarlo}
        initialValue={data.portfolio.totalValue}
        horizonYears={data.horizonYears}
        monthlyContribution={data.monthlyContribution}
        targetValue={data.targetValue}
        currency={data.portfolio.currency}
        aiComment={data.ai?.projectionComment}
      />

      {/* Page 7: Fundamentals */}
      <FundamentalsPage
        pageNum={pageNum++}
        totalPages={totalPages}
        holdings={data.fundamentalRows}
        portfolioAvgPE={data.portfolioAvgPE}
        portfolioAvgROE={data.portfolioAvgROE}
        portfolioAvgDebtEquity={data.portfolioAvgDebtEquity}
        portfolioAvgMargin={data.portfolioAvgMargin}
        portfolioAvgBeta={data.portfolioAvgBeta}
        scatterPoints={data.scatterPoints}
        aiComment={data.ai?.fundamentalsComment}
      />

      {/* Page 8: Valuation */}
      <ValuationPage
        pageNum={pageNum++}
        totalPages={totalPages}
        holdings={data.valuationRows}
        portfolioUpside={data.portfolioUpside}
        undervaluedCount={data.undervaluedCount}
        overvaluedCount={data.overvaluedCount}
        fairValueCount={data.fairValueCount}
        sensitivityMatrix={data.sensitivityMatrix}
        currency={data.portfolio.currency}
        aiComment={data.ai?.valuationComment}
      />

      {/* Page 9: Income */}
      <IncomePage
        pageNum={pageNum++}
        totalPages={totalPages}
        holdings={data.incomeHoldings}
        totalAnnualIncome={data.totalAnnualIncome}
        portfolioYield={data.portfolioYield}
        monthlyIncome={data.monthlyIncome}
        incomeByMonth={data.incomeByMonth}
        yieldOnCost={data.yieldOnCost}
        currency={data.portfolio.currency}
        aiComment={data.ai?.incomeComment}
      />

      {/* Page 10 (optional): Bonds */}
      {hasBonds && data.bondAnalytics && (
        <BondsPage
          pageNum={pageNum++}
          totalPages={totalPages}
          analytics={data.bondAnalytics}
          bondAllocationPct={data.bondAllocationPct}
          portfolioValue={data.portfolio.totalValue}
          currency={data.portfolio.currency}
          aiComment={data.ai?.bondsComment}
        />
      )}

      {/* Risk */}
      <RiskPage
        pageNum={pageNum++}
        totalPages={totalPages}
        metrics={data.riskMetrics}
        drawdownValues={data.drawdownValues}
        drawdownDates={data.drawdownDates}
        drawdownPeriods={data.drawdownPeriods}
        aiComment={data.ai?.riskComment}
      />

      {/* Stress Radar */}
      <StressRadarPage
        pageNum={pageNum++}
        totalPages={totalPages}
        radar={data.stressRadar}
        aiComment={data.ai?.stressRadarComment}
      />

      {/* Correlation & Diversification */}
      <CorrelationPage
        pageNum={pageNum++}
        totalPages={totalPages}
        analysis={data.diversification}
        holdingLabels={data.holdingLabels}
        aiComment={data.ai?.correlationComment}
      />

      {/* Behavioral */}
      <BehavioralPage
        pageNum={pageNum++}
        totalPages={totalPages}
        analysis={data.behavioral}
        portfolioValue={data.portfolio.totalValue}
        aiComment={data.ai?.behavioralComment}
      />

      {/* Market Intelligence */}
      <MarketIntelPage
        pageNum={pageNum++}
        totalPages={totalPages}
        factors={data.marketFactors}
        sectorOutlooks={data.sectorOutlooks}
        marketSummary={data.marketSummary}
        date={data.generatedAt}
        aiComment={data.ai?.marketComment}
      />

      {/* Recommendations */}
      <RecommendationsPage
        pageNum={pageNum++}
        totalPages={totalPages}
        intelligenceScore={data.intelligenceScore}
        recommendations={data.recommendations}
        strengthSummary={data.strengthSummary}
        weaknessSummary={data.weaknessSummary}
        aiComment={data.ai?.recommendationsComment}
      />

      {/* Benchmark Comparisons */}
      <ComparisonsPage
        pageNum={pageNum++}
        totalPages={totalPages}
        benchmarkName={data.benchmarkName}
        comparisons={data.benchmarkComparisons}
        performancePeriods={data.performancePeriods}
        portfolioGrowth={data.portfolioGrowth}
        benchmarkGrowth={data.benchmarkGrowth}
        months={data.growthMonths}
        captureUp={data.captureUp}
        captureDown={data.captureDown}
        aiComment={data.ai?.benchmarkComment}
      />

      {/* Asset Sheets (3 per page) */}
      {assetChunks.map((chunk, i) => (
        <AssetSheetsPage
          key={`assets-${i}`}
          pageNum={pageNum++}
          totalPages={totalPages}
          assets={chunk}
          currency={data.portfolio.currency}
        />
      ))}
    </Document>
  );
}

// ─── New: Report from PortfolioAnalysisResult ───────────────────

export function ReportV2FromAnalysis({ data }: { data: PortfolioAnalysisResult }) {
  const hasBonds = data.bonds !== null && data.bonds.allocationPct > 0;

  // Build asset sheets from analyzed holdings
  const assetSheets: AssetSheetData[] = data.holdings.map(h => ({
    symbol: h.symbol, name: h.name, weight: h.weight,
    currentPrice: h.currentPrice, targetPrice: h.targetPrice ?? undefined,
    sector: h.sector, assetClass: h.assetClass,
    safetyScore: h.safetyScore ?? undefined, upsideScore: h.upsideScore ?? undefined,
    pe: h.pe ?? undefined, roe: h.roe ?? undefined,
    debtToEquity: h.debtToEquity ?? undefined,
    dividendYield: h.dividendYield ?? undefined,
    marketCap: h.marketCap ?? undefined, beta: h.beta ?? undefined,
    dnaStyle: h.dnaStyle, dnaReason: h.dnaReason,
    whyItExists: h.whyItExists,
    isFund: h.isFund || undefined,
    morningstarRating: h.morningstarRating ?? undefined,
    mer: h.mer ?? undefined,
    topHoldings: h.topHoldings ?? undefined,
    upsidePct: h.upsidePct,
  }));

  const holdingCount = assetSheets.length;
  const assetSheetPages = Math.ceil(holdingCount / 3);
  const baseSections = 14;
  const bondPages = hasBonds ? 1 : 0;
  const totalPages = 2 + baseSections + bondPages + assetSheetPages;
  const tocEntries = buildTOCEntries({ hasBonds, holdingCount });
  let pageNum = 3;

  const assetChunks: AssetSheetData[][] = [];
  for (let i = 0; i < assetSheets.length; i += 3) {
    assetChunks.push(assetSheets.slice(i, i + 3));
  }

  const holdingLabels = data.holdings.map(h => h.symbol);
  const corrBarValues = computeCorrelationBarValues(data.diversification);

  return (
    <Document
      title={`Rapport de portefeuille — ${data.client.name}`}
      author="Groupe Financier Ste-Foy"
      subject="Analyse de portefeuille"
      creator="Planificateur de Rencontre"
    >
      <CoverPage
        clientName={data.client.name}
        portfolioName={data.client.portfolioName}
        riskProfile={data.client.riskProfile}
        targetReturn={`${(data.portfolio.expectedReturn * 100).toFixed(1)}%`}
        estimatedIncome={formatCurrency(data.portfolio.annualIncome, data.portfolio.currency)}
        portfolioValue={formatCurrency(data.portfolio.totalValue, data.portfolio.currency)}
        intelligenceScore={data.intelligence}
        advisorName={data.client.advisorName}
        advisorTitle={data.client.advisorTitle}
        generatedAt={data.meta.generatedAt}
        horizon={data.client.horizon}
      />

      <TableOfContentsPage entries={tocEntries} totalPages={totalPages} />

      <ExecutiveSummaryPage
        pageNum={pageNum++}
        totalPages={totalPages}
        portfolioValue={data.portfolio.totalValue}
        expectedReturn={data.portfolio.expectedReturn * 100}
        annualIncome={data.portfolio.annualIncome}
        intelligenceScore={data.intelligence.overall}
        holdingCount={data.portfolio.holdingCount}
        sectorCount={data.portfolio.sectorCount}
        top3Holdings={data.portfolio.top3Holdings}
        equityWeight={data.portfolio.equityWeight}
        fixedIncomeWeight={data.portfolio.fixedIncomeWeight}
        aiSummary={data.ai?.executiveSummary || ''}
        currency={data.portfolio.currency}
      />

      <PortfolioDNAPage
        pageNum={pageNum++}
        totalPages={totalPages}
        dna={data.dna}
        aiComment={data.ai?.dnaComment}
      />

      <AllocationPage
        pageNum={pageNum++}
        totalPages={totalPages}
        assetClassSlices={data.allocation.assetClassSlices}
        sectorSlices={data.allocation.sectorSlices}
        regionSlices={data.allocation.regionSlices}
        currencySlices={data.allocation.currencySlices}
        top10Holdings={data.allocation.top10Holdings}
        aiComment={data.ai?.allocationComment}
      />

      <ProjectionPage
        pageNum={pageNum++}
        totalPages={totalPages}
        monteCarlo={data.projection.monteCarlo}
        initialValue={data.portfolio.totalValue}
        horizonYears={data.meta.horizonYears}
        monthlyContribution={data.meta.monthlyContribution}
        targetValue={data.meta.targetValue ?? undefined}
        currency={data.portfolio.currency}
        aiComment={data.ai?.projectionComment}
        scenarioRows={data.projection.scenarioRows}
      />

      <FundamentalsPage
        pageNum={pageNum++}
        totalPages={totalPages}
        holdings={data.fundamentals.rows}
        portfolioAvgPE={data.fundamentals.portfolioAvgPE}
        portfolioAvgROE={data.fundamentals.portfolioAvgROE}
        portfolioAvgDebtEquity={data.fundamentals.portfolioAvgDebtEquity}
        portfolioAvgMargin={data.fundamentals.portfolioAvgMargin}
        portfolioAvgBeta={data.fundamentals.portfolioAvgBeta}
        scatterPoints={data.fundamentals.scatterPoints}
        aiComment={data.ai?.fundamentalsComment}
        qualityBars={data.fundamentals.qualityBars}
      />

      <ValuationPage
        pageNum={pageNum++}
        totalPages={totalPages}
        holdings={data.valuation.rows}
        portfolioUpside={data.valuation.portfolioUpside}
        undervaluedCount={data.valuation.undervaluedCount}
        overvaluedCount={data.valuation.overvaluedCount}
        fairValueCount={data.valuation.fairValueCount}
        sensitivityMatrix={data.valuation.sensitivityMatrix ?? undefined}
        currency={data.portfolio.currency}
        aiComment={data.ai?.valuationComment}
      />

      <IncomePage
        pageNum={pageNum++}
        totalPages={totalPages}
        holdings={data.income.holdings}
        totalAnnualIncome={data.income.totalAnnualIncome}
        portfolioYield={data.income.portfolioYield}
        monthlyIncome={data.income.monthlyIncome}
        incomeByMonth={data.income.incomeByMonth ?? undefined}
        yieldOnCost={data.income.yieldOnCost ?? undefined}
        currency={data.portfolio.currency}
        aiComment={data.ai?.incomeComment}
      />

      {hasBonds && data.bonds && (
        <BondsPage
          pageNum={pageNum++}
          totalPages={totalPages}
          analytics={data.bonds.analytics}
          bondAllocationPct={data.bonds.allocationPct}
          portfolioValue={data.portfolio.totalValue}
          currency={data.portfolio.currency}
          aiComment={data.ai?.bondsComment}
        />
      )}

      <RiskPage
        pageNum={pageNum++}
        totalPages={totalPages}
        metrics={data.risk.metrics}
        drawdownValues={data.risk.drawdownChart.values}
        drawdownDates={data.risk.drawdownChart.dates}
        drawdownPeriods={data.risk.drawdownPeriods}
        aiComment={data.ai?.riskComment}
      />

      <StressRadarPage
        pageNum={pageNum++}
        totalPages={totalPages}
        radar={data.stress}
        aiComment={data.ai?.stressRadarComment}
      />

      <CorrelationPage
        pageNum={pageNum++}
        totalPages={totalPages}
        analysis={data.diversification}
        holdingLabels={holdingLabels}
        aiComment={data.ai?.correlationComment}
        barValues={corrBarValues}
      />

      <BehavioralPage
        pageNum={pageNum++}
        totalPages={totalPages}
        analysis={data.behavioral}
        portfolioValue={data.portfolio.totalValue}
        aiComment={data.ai?.behavioralComment}
      />

      <MarketIntelPage
        pageNum={pageNum++}
        totalPages={totalPages}
        factors={data.marketIntel.factors}
        sectorOutlooks={data.marketIntel.sectorOutlooks}
        marketSummary={data.marketIntel.summary}
        date={data.meta.generatedAt}
        aiComment={data.ai?.marketComment}
      />

      <RecommendationsPage
        pageNum={pageNum++}
        totalPages={totalPages}
        intelligenceScore={data.intelligence}
        recommendations={data.recommendations.recommendations}
        strengthSummary={data.recommendations.strengthSummary}
        weaknessSummary={data.recommendations.weaknessSummary}
        aiComment={data.ai?.recommendationsComment}
      />

      <ComparisonsPage
        pageNum={pageNum++}
        totalPages={totalPages}
        benchmarkName={data.benchmark.name}
        comparisons={data.benchmark.comparisons}
        performancePeriods={data.benchmark.periodRows.map(r => ({
          period: r.period,
          portfolioReturn: r.portfolioReturn,
          benchmarkReturn: r.benchmarkReturn,
        }))}
        portfolioGrowth={data.benchmark.portfolioGrowth}
        benchmarkGrowth={data.benchmark.benchmarkGrowth}
        months={data.benchmark.growthMonths}
        captureUp={data.benchmark.captureUp}
        captureDown={data.benchmark.captureDown}
        aiComment={data.ai?.benchmarkComment}
        periodRows={data.benchmark.periodRows}
      />

      {assetChunks.map((chunk, i) => (
        <AssetSheetsPage
          key={`assets-${i}`}
          pageNum={pageNum++}
          totalPages={totalPages}
          assets={chunk}
          currency={data.portfolio.currency}
        />
      ))}
    </Document>
  );
}

// ─── Helper ─────────────────────────────────────────────────────

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

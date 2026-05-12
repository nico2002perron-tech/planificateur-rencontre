// =============================================================================
// ANALYTICS PIPELINE — Single entry point
// Orchestrates all analytics engines and derived-metric computations.
// Input: RawPortfolioInput → Output: PortfolioAnalysisResult (read-only)
// =============================================================================

import type {
  RawPortfolioInput,
  PortfolioAnalysisResult,
  AnalyzedHolding,
  AllocationBlock,
  FundamentalsBlock,
  ValuationBlock,
  IncomeBlock,
  BenchmarkBlock,
  MarketIntelBlock,
  RecommendationsBlock,
  PerformancePeriod,
  RiskAnalysis,
  ProjectionAnalysis,
  BondAnalysisBlock,
  AllocationSlice,
  FundamentalRow,
  ValuationRow,
  IncomeHolding,
  AssetSheetData,
  ScatterPoint,
  RawHolding,
} from './types';

// Analytics engines
import { calculateRiskMetrics, analyzeDrawdowns, buildPortfolioTimeSeries, calcSimpleReturns } from './risk-metrics';
import { runMultiAssetMonteCarlo } from './monte-carlo';
import type { MonteCarloConfig } from './monte-carlo';
import { buildCorrelationMatrix, analyzeDiversification } from './correlation';
import { analyzePortfolioDNA } from './portfolio-dna';
import type { HoldingData } from './portfolio-dna';
import { calculateStressRadar } from './stress-radar';
import { analyzeBehavioral } from './behavioral';
import { calculateBondAnalytics } from './bond-analytics';
import type { BondHolding } from './bond-analytics';
import { calculatePortfolioIntelligence } from './portfolio-intelligence';
import type { ScoreInputs } from './portfolio-intelligence';

// Derived metrics
import {
  computeQualityBars,
  computeHoldingQualityScores,
  computeCorrelationBarValues,
  computeProjectionScenarios,
  computeBenchmarkPeriodRows,
  computeUpsidePct,
  computeValuationVerdict,
  buildMonthLabels,
} from './derived-metrics';

const ENGINE_VERSION = '2.0.0';

const FIXED_INCOME_CLASSES = new Set(['Obligations', 'Fixed Income', 'Revenu fixe']);
const CASH_CLASSES = new Set(['Cash', 'Liquidites', 'Marche monetaire', 'Money Market']);

// ─── MAIN PIPELINE ────────────────────────────────────────────

export async function computePortfolioAnalysis(
  input: RawPortfolioInput,
): Promise<PortfolioAnalysisResult> {
  const { client, holdings: rawHoldings, historicalPrices, benchmarkPrices, config } = input;

  // ─── Stage 1: Data Preparation ────────────────────────────
  const symbols = rawHoldings.map(h => h.symbol);
  const weightsMap: Record<string, number> = {};
  for (const h of rawHoldings) weightsMap[h.symbol] = h.weight;

  const holdingPricesMap: Record<string, number[]> = {};
  for (const sym of symbols) {
    holdingPricesMap[sym] = historicalPrices[sym]?.prices ?? [];
  }

  // Find common dates array from the longest available series
  const allDates = benchmarkPrices.dates.length > 0
    ? benchmarkPrices.dates
    : Object.values(historicalPrices).reduce((best, cur) =>
        cur.dates.length > best.length ? cur.dates : best, [] as string[]);

  const portfolioPrices = buildPortfolioTimeSeries(holdingPricesMap, weightsMap, allDates);
  const portfolioReturns = calcSimpleReturns(portfolioPrices);
  const benchmarkReturns = calcSimpleReturns(benchmarkPrices.prices);

  // Asset returns for multi-asset MC
  const assetReturns: Record<string, number[]> = {};
  for (const sym of symbols) {
    const prices = holdingPricesMap[sym];
    if (prices.length >= 3) {
      assetReturns[sym] = calcSimpleReturns(prices);
    }
  }

  // ─── Stage 2: Independent Analytics (parallel) ────────────
  const correlationMatrix = buildCorrelationMatrix(holdingPricesMap, symbols);

  const holdingDataForDNA: HoldingData[] = rawHoldings.map(h => ({
    symbol: h.symbol,
    name: h.name,
    weight: h.weight,
    assetClass: h.assetClass,
    sector: h.sector,
    dividendYield: h.dividendYield,
    beta: h.beta,
    revenueGrowth: h.revenueGrowth,
    earningsGrowth: h.earningsGrowth,
    pe: h.pe,
    roe: h.roe,
    profitMargins: h.profitMargin,
    debtToEquity: h.debtToEquity,
    marketCap: h.marketCap,
    currentPrice: h.currentPrice,
    targetPrice: h.targetPrice,
    coupon: h.coupon,
    maturity: h.maturity,
  }));

  const riskMetrics = calculateRiskMetrics(
    portfolioPrices, allDates, benchmarkPrices.prices, config.riskFreeRate,
  );
  const drawdownResult = analyzeDrawdowns(portfolioPrices, allDates);
  const dna = analyzePortfolioDNA(holdingDataForDNA);
  const stressRadar = calculateStressRadar(
    rawHoldings.map(h => ({
      symbol: h.symbol, weight: h.weight, sector: h.sector,
      assetClass: h.assetClass, beta: h.beta,
    })),
  );

  const totalValue = rawHoldings.reduce((sum, h) => sum + h.currentPrice * h.shares, 0)
    || rawHoldings.reduce((sum, h) => sum + h.weight * 100000, 0); // Fallback

  const behavioral = analyzeBehavioral(
    rawHoldings.map(h => ({
      symbol: h.symbol, name: h.name, weight: h.weight,
      sector: h.sector, assetClass: h.assetClass, beta: h.beta,
    })),
    totalValue,
  );

  // Bond analytics
  const bondHoldings = rawHoldings.filter(h =>
    FIXED_INCOME_CLASSES.has(h.assetClass) && h.coupon !== undefined,
  );
  const bondWeight = rawHoldings
    .filter(h => FIXED_INCOME_CLASSES.has(h.assetClass))
    .reduce((sum, h) => sum + h.weight, 0);

  let bonds: BondAnalysisBlock | null = null;
  if (bondHoldings.length > 0) {
    const bondHoldingsForEngine: BondHolding[] = bondHoldings.map(h => ({
      symbol: h.symbol,
      name: h.name,
      weight: h.weight,
      weightInBonds: bondWeight > 0 ? h.weight / bondWeight : 0,
      coupon: h.coupon ?? 0,
      yieldToMaturity: h.ytm ?? h.coupon ?? 0,
      maturityDate: h.maturity ?? new Date(Date.now() + 5 * 365.25 * 86400000).toISOString().slice(0, 10),
      parValue: h.faceValue ?? 1000,
      marketPrice: h.currentPrice,
      rating: h.creditRating ?? 'NR',
      quantity: h.shares,
    }));
    const bondAnalytics = calculateBondAnalytics(bondHoldingsForEngine, totalValue, config.inflationRate);
    bonds = { analytics: bondAnalytics, allocationPct: bondWeight };
  }

  // ─── Stage 3: Dependent Analytics ─────────────────────────
  const diversification = analyzeDiversification(
    holdingPricesMap,
    rawHoldings.map(h => ({
      symbol: h.symbol, weight: h.weight, sector: h.sector,
      region: h.region, currency: h.currency,
    })),
  );

  const mcConfig: MonteCarloConfig = {
    numSimulations: 1000,
    horizonMonths: config.horizonYears * 12,
    initialValue: totalValue,
    monthlyContribution: config.monthlyContribution,
    riskFreeRate: config.riskFreeRate,
    inflationRate: config.inflationRate,
  };
  const monteCarlo = runMultiAssetMonteCarlo(
    assetReturns, weightsMap, correlationMatrix.matrix, symbols,
    mcConfig, config.targetValue ?? undefined,
  );

  // Build intelligence score inputs
  const equityHoldings = rawHoldings.filter(h =>
    !FIXED_INCOME_CLASSES.has(h.assetClass) && !CASH_CLASSES.has(h.assetClass),
  );
  const wAvg = (field: (h: RawHolding) => number | undefined) => {
    let sum = 0, wSum = 0;
    for (const h of equityHoldings) {
      const v = field(h);
      if (v !== undefined && v !== null) {
        sum += h.weight * v;
        wSum += h.weight;
      }
    }
    return wSum > 0 ? sum / wSum : 0;
  };

  const sectors = new Set(rawHoldings.map(h => h.sector));
  const totalMonths = riskMetrics.positiveMonths + riskMetrics.negativeMonths;

  const scoreInputs: ScoreInputs = {
    hhi: diversification.hhi,
    avgCorrelation: diversification.correlationMatrix.avgCorrelation,
    top5Concentration: diversification.top5Concentration,
    numPositions: rawHoldings.length,
    numSectors: sectors.size,
    weightedRevenueGrowth: wAvg(h => h.revenueGrowth),
    weightedEarningsGrowth: wAvg(h => h.earningsGrowth),
    weightedROE: wAvg(h => h.roe),
    portfolioYield: wAvg(h => h.dividendYield),
    dividendCoverage: wAvg(h => h.payoutRatio),
    incomeGrowth: wAvg(h => h.dividendGrowth5Y),
    beta: riskMetrics.beta,
    maxDrawdown: riskMetrics.maxDrawdown,
    var95: riskMetrics.var95,
    avgDownsideCapture: riskMetrics.downsideCapture,
    avgUpsideToFairValue: wAvg(h => {
      if (!h.fairValue || !h.currentPrice || h.currentPrice <= 0) return undefined;
      return (h.fairValue - h.currentPrice) / h.currentPrice;
    }),
    weightedPE: wAvg(h => h.pe),
    weightedPEG: wAvg(h => {
      if (!h.pe || !h.earningsGrowth || h.earningsGrowth <= 0) return undefined;
      return h.pe / (h.earningsGrowth * 100);
    }),
    annualizedVolatility: riskMetrics.annualizedVolatility,
    sortinoRatio: riskMetrics.sortinoRatio,
    positiveMonthPct: totalMonths > 0 ? riskMetrics.positiveMonths / totalMonths : 0.5,
    weightedProfitMargin: wAvg(h => h.profitMargin),
    weightedDebtToEquity: wAvg(h => h.debtToEquity),
    weightedCurrentRatio: 1.5, // Default — not available from basic FMP
  };

  const intelligence = calculatePortfolioIntelligence(scoreInputs);

  // ─── Stage 4: Derived Metrics ─────────────────────────────

  // Fundamentals aggregates
  const portfolioAvgPE = wAvg(h => h.pe);
  const portfolioAvgROE = wAvg(h => h.roe);
  const portfolioAvgDebtEquity = wAvg(h => h.debtToEquity);
  const portfolioAvgMargin = wAvg(h => h.profitMargin);
  const portfolioAvgBeta = wAvg(h => h.beta);

  // Build AnalyzedHoldings
  const dnaMap = new Map(dna.holdings.map(d => [d.symbol, d]));

  const analyzedHoldings: AnalyzedHolding[] = rawHoldings.map(h => {
    const holdingDNA = dnaMap.get(h.symbol);
    const upsidePct = computeUpsidePct(h.fairValue, h.currentPrice);

    return {
      symbol: h.symbol,
      name: h.name,
      weight: h.weight,
      currentPrice: h.currentPrice,
      sector: h.sector,
      region: h.region,
      currency: h.currency,
      assetClass: h.assetClass,
      dnaStyle: holdingDNA?.style ?? 'Quality Growth',
      dnaReason: holdingDNA?.reason ?? '',
      dnaConfidence: holdingDNA?.styleConfidence ?? 0,
      pe: h.pe ?? null,
      pb: h.pb ?? null,
      roe: h.roe ?? null,
      debtToEquity: h.debtToEquity ?? null,
      profitMargin: h.profitMargin ?? null,
      revenueGrowth: h.revenueGrowth ?? null,
      earningsGrowth: h.earningsGrowth ?? null,
      dividendYield: h.dividendYield ?? null,
      marketCap: h.marketCap ?? null,
      beta: h.beta ?? null,
      qualityScores: computeHoldingQualityScores(h),
      fairValue: h.fairValue ?? null,
      upsidePct,
      valuationVerdict: computeValuationVerdict(upsidePct),
      dcfValue: h.dcfValue ?? null,
      peValue: h.peValue ?? null,
      psValue: h.psValue ?? null,
      annualDividend: h.annualDividend ?? null,
      payoutRatio: h.payoutRatio ?? null,
      dividendGrowth5Y: h.dividendGrowth5Y ?? null,
      exDividendDate: h.exDividendDate ?? null,
      paymentFrequency: h.paymentFrequency ?? null,
      targetPrice: h.targetPrice ?? null,
      safetyScore: null, // Computed by safety-score module if available
      upsideScore: null,
      whyItExists: '',   // Filled by AI holdingDescriptions
      isFund: h.isFund ?? false,
      morningstarRating: h.morningstarRating ?? null,
      mer: h.mer ?? null,
      topHoldings: h.topHoldings ?? null,
      scatterX: null, // Populated below if price data available
      scatterY: null,
      scatterSize: Math.max(4, h.weight * 80),
    };
  });

  // Scatter coordinates
  for (const ah of analyzedHoldings) {
    const prices = holdingPricesMap[ah.symbol];
    if (prices && prices.length >= 13) {
      const rets = calcSimpleReturns(prices);
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance = rets.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (rets.length - 1);
      ah.scatterX = Math.sqrt(variance * 12); // annualized vol
      ah.scatterY = Math.pow(1 + mean, 12) - 1; // annualized return
    }
  }

  // Build display blocks
  const allocation = buildAllocationBlock(rawHoldings);
  const fundamentals = buildFundamentalsBlock(rawHoldings, analyzedHoldings, portfolioAvgPE, portfolioAvgROE, portfolioAvgDebtEquity, portfolioAvgMargin, portfolioAvgBeta);
  const valuation = buildValuationBlock(rawHoldings);
  const incomeBlock = buildIncomeBlock(rawHoldings, totalValue);

  // Benchmark block
  const performancePeriods = buildPerformancePeriods(portfolioReturns, benchmarkReturns);
  const benchmark = buildBenchmarkBlock(
    config.benchmarkName, performancePeriods, portfolioPrices, benchmarkPrices.prices,
    allDates, riskMetrics.upsideCapture, riskMetrics.downsideCapture, riskMetrics,
    diversification, rawHoldings,
  );

  // Risk analysis
  const riskAnalysis: RiskAnalysis = {
    metrics: riskMetrics,
    drawdownChart: {
      values: computeDrawdownValues(portfolioPrices),
      dates: allDates,
    },
    drawdownPeriods: drawdownResult.periods,
    monthlyReturns: portfolioReturns,
  };

  // Projection analysis
  const projection: ProjectionAnalysis = {
    monteCarlo,
    monthLabels: buildMonthLabels(config.horizonYears),
    scenarioRows: computeProjectionScenarios(monteCarlo, totalValue, config.horizonYears),
  };

  // Market intel
  const marketIntel: MarketIntelBlock = {
    factors: input.marketContext?.factors ?? [],
    sectorOutlooks: input.marketContext?.sectorOutlooks ?? [],
    summary: input.marketContext?.summary ?? '',
  };

  // Recommendations
  const recommendations = buildRecommendationsBlock(intelligence, diversification, riskMetrics);

  // Portfolio summary
  const equityWeight = rawHoldings.filter(h => !FIXED_INCOME_CLASSES.has(h.assetClass) && !CASH_CLASSES.has(h.assetClass) && h.assetClass !== 'Alternatif' && h.assetClass !== 'Alternative').reduce((s, h) => s + h.weight, 0);
  const fixedIncomeWeight = rawHoldings.filter(h => FIXED_INCOME_CLASSES.has(h.assetClass)).reduce((s, h) => s + h.weight, 0);
  const cashWeight = rawHoldings.filter(h => CASH_CLASSES.has(h.assetClass)).reduce((s, h) => s + h.weight, 0);
  const alternativeWeight = rawHoldings.filter(h => h.assetClass === 'Alternatif' || h.assetClass === 'Alternative').reduce((s, h) => s + h.weight, 0);
  const totalAnnualIncome = rawHoldings.reduce((s, h) => s + (h.annualDividend ?? 0) * h.shares, 0);
  const top3 = [...rawHoldings].sort((a, b) => b.weight - a.weight).slice(0, 3).map(h => ({ name: h.name, weight: h.weight }));

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: allDates[allDates.length - 1] ?? new Date().toISOString().slice(0, 10),
      engineVersion: ENGINE_VERSION,
      horizonYears: config.horizonYears,
      monthlyContribution: config.monthlyContribution,
      targetValue: config.targetValue,
      benchmarkSymbol: config.benchmarkSymbol,
      benchmarkName: config.benchmarkName,
      currency: config.currency,
    },
    client,
    portfolio: {
      totalValue,
      currency: config.currency,
      expectedReturn: monteCarlo.expectedReturn,
      annualIncome: totalAnnualIncome,
      holdingCount: rawHoldings.length,
      sectorCount: sectors.size,
      equityWeight,
      fixedIncomeWeight,
      alternativeWeight,
      cashWeight,
      top3Holdings: top3,
    },
    holdings: analyzedHoldings,
    risk: riskAnalysis,
    projection,
    diversification,
    dna,
    stress: stressRadar,
    behavioral,
    bonds,
    intelligence,
    allocation,
    fundamentals,
    valuation,
    income: incomeBlock,
    benchmark,
    marketIntel,
    recommendations,
    ai: null, // Set externally after AI generation
  };
}

// ─── Block Builders ───────────────────────────────────────────

function buildAllocationBlock(holdings: RawHolding[]): AllocationBlock {
  const assetClassSlices = groupToSlices(holdings, h => h.assetClass, ASSET_CLASS_COLORS);
  const sectorSlices = groupToSlices(holdings, h => h.sector, SECTOR_COLORS);
  const regionSlices = groupToSlices(holdings, h => h.region, REGION_COLORS);
  const currencySlices = groupToSlices(holdings, h => h.currency, CURRENCY_COLORS);
  const top10 = [...holdings]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map(h => ({ symbol: h.symbol, name: h.name, weight: h.weight, sector: h.sector }));

  return { assetClassSlices, sectorSlices, regionSlices, currencySlices, top10Holdings: top10 };
}

function buildFundamentalsBlock(
  rawHoldings: RawHolding[],
  analyzed: AnalyzedHolding[],
  avgPE: number, avgROE: number, avgDebtEquity: number, avgMargin: number, avgBeta: number,
): FundamentalsBlock {
  const rows: FundamentalRow[] = rawHoldings.map(h => ({
    symbol: h.symbol, name: h.name, weight: h.weight,
    pe: h.pe, pb: h.pb, roe: h.roe, debtToEquity: h.debtToEquity,
    profitMargin: h.profitMargin, revenueGrowth: h.revenueGrowth,
    earningsGrowth: h.earningsGrowth, dividendYield: h.dividendYield,
    marketCap: h.marketCap, beta: h.beta,
  }));

  const scatterPoints: ScatterPoint[] = analyzed
    .filter(a => a.scatterX !== null && a.scatterY !== null)
    .map(a => ({
      label: a.symbol,
      x: a.scatterX!,
      y: a.scatterY!,
      size: a.scatterSize,
    }));

  return {
    rows,
    portfolioAvgPE: avgPE,
    portfolioAvgROE: avgROE,
    portfolioAvgDebtEquity: avgDebtEquity,
    portfolioAvgMargin: avgMargin,
    portfolioAvgBeta: avgBeta,
    qualityBars: computeQualityBars(avgPE, avgROE, avgDebtEquity, avgMargin, avgBeta),
    scatterPoints,
  };
}

function buildValuationBlock(holdings: RawHolding[]): ValuationBlock {
  const rows: ValuationRow[] = holdings
    .filter(h => !FIXED_INCOME_CLASSES.has(h.assetClass))
    .map(h => {
      const upside = h.fairValue && h.currentPrice > 0
        ? ((h.fairValue - h.currentPrice) / h.currentPrice) * 100
        : 0;
      const verdict: ValuationRow['verdict'] = !h.fairValue ? 'N/A'
        : upside > 10 ? 'Sous-evalue'
        : upside < -10 ? 'Surevalue'
        : 'Juste valeur';
      const verdictColor = verdict === 'Sous-evalue' ? '#22c55e'
        : verdict === 'Surevalue' ? '#ef4444'
        : verdict === 'Juste valeur' ? '#f59e0b'
        : '#94a3b8';

      return {
        symbol: h.symbol, name: h.name, weight: h.weight, currentPrice: h.currentPrice,
        fairValueDCF: h.dcfValue, fairValuePS: h.psValue, fairValuePE: h.peValue,
        consensusFairValue: h.fairValue, upsidePct: upside, verdict, verdictColor,
      };
    });

  const undervalued = rows.filter(r => r.verdict === 'Sous-evalue').length;
  const overvalued = rows.filter(r => r.verdict === 'Surevalue').length;
  const fair = rows.filter(r => r.verdict === 'Juste valeur').length;
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0) || 1;
  const portfolioUpside = rows.reduce((s, r) => s + r.upsidePct * r.weight, 0) / totalWeight;

  return {
    rows,
    portfolioUpside,
    undervaluedCount: undervalued,
    overvaluedCount: overvalued,
    fairValueCount: fair,
    sensitivityMatrix: null, // Set externally if computed
  };
}

function buildIncomeBlock(holdings: RawHolding[], totalValue: number): IncomeBlock {
  const incomeHoldings: IncomeHolding[] = holdings
    .filter(h => (h.dividendYield ?? 0) > 0 || (h.annualDividend ?? 0) > 0)
    .map(h => ({
      symbol: h.symbol, name: h.name, weight: h.weight,
      dividendYield: h.dividendYield ?? 0,
      annualDividend: (h.annualDividend ?? 0) * h.shares,
      payoutRatio: h.payoutRatio,
      exDivDate: h.exDividendDate,
      frequency: resolveFrequency(h.paymentFrequency),
      growthRate5Y: h.dividendGrowth5Y,
    }))
    .sort((a, b) => b.annualDividend - a.annualDividend);

  const totalAnnualIncome = incomeHoldings.reduce((s, h) => s + h.annualDividend, 0);
  const portfolioYield = totalValue > 0 ? totalAnnualIncome / totalValue : 0;

  return {
    holdings: incomeHoldings,
    totalAnnualIncome,
    portfolioYield,
    monthlyIncome: totalAnnualIncome / 12,
    yieldOnCost: null,
    incomeByMonth: null,
  };
}

function buildBenchmarkBlock(
  name: string,
  periods: PerformancePeriod[],
  portfolioPrices: number[],
  benchmarkPrices: number[],
  dates: string[],
  captureUp: number,
  captureDown: number,
  riskMetrics: import('./risk-metrics').RiskMetrics,
  diversification: import('./correlation').DiversificationAnalysis,
  holdings: RawHolding[],
): BenchmarkBlock {
  // Rebase to 100
  const rebase = (prices: number[]) => {
    if (prices.length === 0 || prices[0] === 0) return prices;
    return prices.map(p => (p / prices[0]) * 100);
  };

  const comparisons = buildBenchmarkComparisons(riskMetrics, diversification, holdings);

  return {
    name,
    comparisons,
    periodRows: computeBenchmarkPeriodRows(periods),
    portfolioGrowth: rebase(portfolioPrices),
    benchmarkGrowth: rebase(benchmarkPrices),
    growthMonths: dates,
    captureUp,
    captureDown,
  };
}

function buildRecommendationsBlock(
  intelligence: import('./portfolio-intelligence').PortfolioIntelligenceScore,
  diversification: import('./correlation').DiversificationAnalysis,
  risk: import('./risk-metrics').RiskMetrics,
): RecommendationsBlock {
  const recs: import('./types').Recommendation[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Diversification recommendations
  if (diversification.top5Concentration > 0.5) {
    recs.push({
      priority: 'Haute', category: 'Diversification',
      title: 'Reduire la concentration dans le top 5',
      description: `Les 5 premieres positions representent ${(diversification.top5Concentration * 100).toFixed(0)}% du portefeuille.`,
      impact: 'Reduction du risque specifique', color: '#ef4444',
    });
    weaknesses.push(`Concentration elevee (top 5 = ${(diversification.top5Concentration * 100).toFixed(0)}%)`);
  } else {
    strengths.push('Bonne repartition entre les positions');
  }

  // Risk recommendations
  if (Math.abs(risk.maxDrawdown) > 0.25) {
    recs.push({
      priority: 'Moyenne', category: 'Risque',
      title: 'Consideration de protection baissiere',
      description: `Le drawdown maximal historique est de ${(risk.maxDrawdown * 100).toFixed(0)}%.`,
      impact: 'Amelioration de la resilience', color: '#f59e0b',
    });
    weaknesses.push(`Drawdown maximal de ${(risk.maxDrawdown * 100).toFixed(0)}%`);
  } else {
    strengths.push(`Drawdown maximal contenu a ${(risk.maxDrawdown * 100).toFixed(0)}%`);
  }

  // Correlation
  if (diversification.correlationMatrix.avgCorrelation > 0.5) {
    recs.push({
      priority: 'Moyenne', category: 'Correlation',
      title: 'Ajouter des actifs decorrelés',
      description: `La correlation moyenne est de ${diversification.correlationMatrix.avgCorrelation.toFixed(2)}.`,
      impact: 'Meilleure diversification reelle', color: '#f59e0b',
    });
    weaknesses.push('Correlation elevee entre les actifs');
  } else {
    strengths.push('Faible correlation entre les actifs');
  }

  // Intelligence sub-scores
  for (const sub of intelligence.subScores) {
    if (sub.score >= 70) {
      strengths.push(`${sub.name} : ${sub.description}`);
    } else if (sub.score < 40) {
      recs.push({
        priority: 'Basse', category: sub.name,
        title: `Ameliorer le score de ${sub.name.toLowerCase()}`,
        description: sub.description,
        impact: `Score actuel: ${sub.score}/100`, color: '#94a3b8',
      });
      weaknesses.push(`${sub.name} : score de ${sub.score}/100`);
    }
  }

  return {
    recommendations: recs.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority)),
    strengthSummary: strengths.slice(0, 5),
    weaknessSummary: weaknesses.slice(0, 5),
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function groupToSlices(
  holdings: RawHolding[],
  groupFn: (h: RawHolding) => string,
  colorMap: Record<string, string>,
): AllocationSlice[] {
  const groups: Record<string, number> = {};
  for (const h of holdings) {
    const key = groupFn(h) || 'Autre';
    groups[key] = (groups[key] || 0) + h.weight;
  }
  const fallbackColors = ['#00b4d8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#0ea5e9', '#64748b', '#ec4899', '#14b8a6'];
  let ci = 0;
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([label, weight]) => ({
      label,
      weight,
      color: colorMap[label] || fallbackColors[ci++ % fallbackColors.length] || '#94a3b8',
    }));
}

function buildPerformancePeriods(
  portfolioReturns: number[],
  benchmarkReturns: number[],
): PerformancePeriod[] {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < 1) return [];

  const compound = (rets: number[], months: number) => {
    const slice = rets.slice(-Math.min(months, rets.length));
    return slice.reduce((acc, r) => acc * (1 + r), 1) - 1;
  };

  const periods: PerformancePeriod[] = [];
  if (n >= 1) periods.push({ period: '1 mois', portfolioReturn: compound(portfolioReturns, 1), benchmarkReturn: compound(benchmarkReturns, 1) });
  if (n >= 3) periods.push({ period: '3 mois', portfolioReturn: compound(portfolioReturns, 3), benchmarkReturn: compound(benchmarkReturns, 3) });
  if (n >= 6) periods.push({ period: '6 mois', portfolioReturn: compound(portfolioReturns, 6), benchmarkReturn: compound(benchmarkReturns, 6) });
  if (n >= 12) periods.push({ period: '1 an', portfolioReturn: compound(portfolioReturns, 12), benchmarkReturn: compound(benchmarkReturns, 12) });
  if (n >= 36) periods.push({ period: '3 ans', portfolioReturn: compound(portfolioReturns, 36), benchmarkReturn: compound(benchmarkReturns, 36) });
  if (n >= 60) periods.push({ period: '5 ans', portfolioReturn: compound(portfolioReturns, 60), benchmarkReturn: compound(benchmarkReturns, 60) });

  return periods;
}

function buildBenchmarkComparisons(
  risk: import('./risk-metrics').RiskMetrics,
  div: import('./correlation').DiversificationAnalysis,
  holdings: RawHolding[],
): import('./types').BenchmarkComparison[] {
  return [
    { label: 'Rendement annualise', portfolioValue: risk.annualizedReturn, benchmarkValue: 0, unit: '%', betterIsHigher: true },
    { label: 'Volatilite', portfolioValue: risk.annualizedVolatility, benchmarkValue: 0, unit: '%', betterIsHigher: false },
    { label: 'Ratio de Sharpe', portfolioValue: risk.sharpeRatio, benchmarkValue: 0, unit: 'ratio', betterIsHigher: true },
    { label: 'Ratio de Sortino', portfolioValue: risk.sortinoRatio, benchmarkValue: 0, unit: 'ratio', betterIsHigher: true },
    { label: 'Beta', portfolioValue: risk.beta, benchmarkValue: 1, unit: 'x', betterIsHigher: false },
    { label: 'Drawdown max', portfolioValue: risk.maxDrawdown, benchmarkValue: 0, unit: '%', betterIsHigher: false },
  ];
}

function computeDrawdownValues(prices: number[]): number[] {
  if (prices.length === 0) return [];
  let peak = prices[0];
  return prices.map(p => {
    if (p > peak) peak = p;
    return peak > 0 ? (p - peak) / peak : 0;
  });
}

function resolveFrequency(freq?: string): string {
  if (!freq) return 'N/A';
  const f = freq.toLowerCase();
  if (f.includes('month') || f.includes('mensuel')) return 'Mensuel';
  if (f.includes('quarter') || f.includes('trimest')) return 'Trimestriel';
  if (f.includes('semi') || f.includes('semestr')) return 'Semestriel';
  if (f.includes('annual') || f.includes('annuel')) return 'Annuel';
  return freq;
}

function priorityOrder(p: string): number {
  if (p === 'Haute') return 0;
  if (p === 'Moyenne') return 1;
  return 2;
}

// ─── Color Maps ───────────────────────────────────────────────

const ASSET_CLASS_COLORS: Record<string, string> = {
  'Actions': '#00b4d8', 'Equities': '#00b4d8', 'Actions canadiennes': '#00b4d8',
  'Obligations': '#6366f1', 'Fixed Income': '#6366f1', 'Revenu fixe': '#6366f1',
  'FNB': '#22c55e', 'ETF': '#22c55e',
  'Fonds commun': '#f59e0b',
  'Alternatif': '#8b5cf6', 'Alternative': '#8b5cf6',
  'Cash': '#94a3b8', 'Liquidites': '#94a3b8',
};

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#00b4d8', 'Financial Services': '#6366f1', 'Financials': '#6366f1',
  'Healthcare': '#22c55e', 'Health Care': '#22c55e',
  'Energy': '#f59e0b', 'Consumer Cyclical': '#ef4444', 'Consumer Discretionary': '#ef4444',
  'Consumer Defensive': '#10b981', 'Consumer Staples': '#10b981',
  'Industrials': '#8b5cf6', 'Materials': '#64748b', 'Basic Materials': '#64748b',
  'Utilities': '#0ea5e9', 'Real Estate': '#ec4899',
  'Communication Services': '#f97316',
};

const REGION_COLORS: Record<string, string> = {
  'Canada': '#ef4444', 'United States': '#3b82f6', 'USA': '#3b82f6',
  'Europe': '#22c55e', 'Asie': '#f59e0b', 'Asia': '#f59e0b',
  'Monde': '#8b5cf6', 'Global': '#8b5cf6',
};

const CURRENCY_COLORS: Record<string, string> = {
  'CAD': '#ef4444', 'USD': '#3b82f6', 'EUR': '#22c55e', 'GBP': '#8b5cf6',
};

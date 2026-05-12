// =============================================================================
// ZOD SCHEMAS — System boundary validation only
// Used to validate external inputs (API routes, cache reads, provider responses)
// Internal pipeline data flows use plain TypeScript interfaces from types.ts.
// =============================================================================

import { z } from 'zod';

// ─── Raw Holding Schema (validated at API boundary) ───────────
export const RawHoldingSchema = z.object({
  symbol: z.string().min(1),
  name: z.string(),
  weight: z.number().min(0).max(1),
  currentPrice: z.number().positive(),
  shares: z.number().min(0),
  costBasis: z.number().optional(),
  assetClass: z.string(),
  sector: z.string(),
  region: z.string(),
  currency: z.string(),
  pe: z.number().optional(),
  pb: z.number().optional(),
  roe: z.number().optional(),
  debtToEquity: z.number().optional(),
  profitMargin: z.number().optional(),
  revenueGrowth: z.number().optional(),
  earningsGrowth: z.number().optional(),
  dividendYield: z.number().optional(),
  annualDividend: z.number().optional(),
  payoutRatio: z.number().optional(),
  dividendGrowth5Y: z.number().optional(),
  exDividendDate: z.string().optional(),
  paymentFrequency: z.string().optional(),
  marketCap: z.number().optional(),
  beta: z.number().optional(),
  dcfValue: z.number().optional(),
  peValue: z.number().optional(),
  psValue: z.number().optional(),
  fairValue: z.number().optional(),
  targetPrice: z.number().optional(),
  coupon: z.number().optional(),
  maturity: z.string().optional(),
  ytm: z.number().optional(),
  duration: z.number().optional(),
  creditRating: z.string().optional(),
  faceValue: z.number().optional(),
  isFund: z.boolean().optional(),
  morningstarRating: z.number().min(1).max(5).optional(),
  mer: z.number().optional(),
  topHoldings: z.array(z.object({
    name: z.string(),
    weight: z.number(),
  })).optional(),
});

// ─── Client Info Schema ───────────────────────────────────────
export const ClientInfoSchema = z.object({
  name: z.string().min(1),
  portfolioName: z.string(),
  riskProfile: z.string(),
  horizon: z.string(),
  advisorName: z.string(),
  advisorTitle: z.string(),
});

// ─── Config Schema ────────────────────────────────────────────
export const PipelineConfigSchema = z.object({
  horizonYears: z.number().int().min(1).max(50),
  monthlyContribution: z.number().min(0),
  targetValue: z.number().positive().nullable(),
  riskFreeRate: z.number().min(0).max(0.20),
  inflationRate: z.number().min(0).max(0.20),
  benchmarkSymbol: z.string().min(1),
  benchmarkName: z.string().min(1),
  currency: z.string().length(3),
});

// ─── Historical Prices Schema ─────────────────────────────────
const PriceSeriesSchema = z.object({
  dates: z.array(z.string()),
  prices: z.array(z.number()),
});

// ─── Full Input Schema ────────────────────────────────────────
export const RawPortfolioInputSchema = z.object({
  client: ClientInfoSchema,
  holdings: z.array(RawHoldingSchema).min(1),
  historicalPrices: z.record(z.string(), PriceSeriesSchema),
  benchmarkPrices: PriceSeriesSchema,
  config: PipelineConfigSchema,
  marketContext: z.object({
    factors: z.array(z.object({
      name: z.string(),
      status: z.enum(['Favorable', 'Neutre', 'Defavorable']),
      description: z.string(),
      impact: z.string(),
      color: z.string(),
    })),
    sectorOutlooks: z.array(z.object({
      sector: z.string(),
      signal: z.enum(['Surponderer', 'Neutre', 'Sous-ponderer']),
      weight: z.number(),
      color: z.string(),
    })),
    summary: z.string(),
  }).optional(),
});

// ─── AI Response Schema ───────────────────────────────────────
export const AIReportContentV2Schema = z.object({
  executiveSummary: z.string(),
  allocationComment: z.string(),
  dnaComment: z.string(),
  projectionComment: z.string(),
  fundamentalsComment: z.string(),
  valuationComment: z.string(),
  incomeComment: z.string(),
  bondsComment: z.string().optional(),
  riskComment: z.string(),
  stressRadarComment: z.string(),
  correlationComment: z.string(),
  behavioralComment: z.string(),
  marketComment: z.string(),
  benchmarkComment: z.string(),
  recommendationsComment: z.string(),
  holdingDescriptions: z.record(z.string(), z.string()),
});

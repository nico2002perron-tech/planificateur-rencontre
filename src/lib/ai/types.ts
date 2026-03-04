/** AI Report Content Types */

export interface AIReportContent {
  executiveSummary: string;
  allocationComment: string;
  targetAnalysis: string;
  riskInterpretation: string;
  holdingDescriptions: Record<string, string>;
  valuationComment?: string;
}

export interface ValuationDataItem {
  symbol: string;
  name: string;
  currentPrice: number;
  priceDcf: number;
  priceSales: number;
  priceEarnings: number;
  avgIntrinsic: number;
  upsidePercent: number;
  reverseDcfGrowth: number;
  scores: {
    overall: number;
    health: number;
    growth: number;
    valuation: number;
  };
  sensitivityMatrix?: {
    rows: string[];
    cols: string[];
    data: number[][];
  };
}

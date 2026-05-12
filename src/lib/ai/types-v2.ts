/** Extended AI Report Content Types — V2 (18-page report) */

export interface AIReportContentV2 {
  // Executive summary (1 per report)
  executiveSummary: string;

  // Section-specific narratives
  allocationComment: string;
  dnaComment: string;
  projectionComment: string;
  fundamentalsComment: string;
  valuationComment: string;
  incomeComment: string;
  bondsComment?: string;
  riskComment: string;
  stressRadarComment: string;
  correlationComment: string;
  behavioralComment: string;
  marketComment: string;
  benchmarkComment: string;
  recommendationsComment: string;

  // Per-holding factual descriptions (symbol → short factual sentence)
  holdingDescriptions: Record<string, string>;
}

/** Keys for each AI narrative block */
export type AIBlockKey = keyof Omit<AIReportContentV2, 'holdingDescriptions'>;

// =============================================================================
// PORTFOLIO DNA ENGINE
// Classifies each holding into investment style categories and builds the
// portfolio's "DNA fingerprint" — the client sees instantly what they own.
// =============================================================================

export type DNAStyle =
  | 'Quality Growth'
  | 'Dividend Income'
  | 'Defensive'
  | 'Cyclical'
  | 'Speculative Growth'
  | 'Value'
  | 'Fixed Income'
  | 'Alternative';

export interface HoldingDNA {
  symbol: string;
  name: string;
  weight: number;
  style: DNAStyle;
  styleConfidence: number; // 0-1, how strongly it matches
  reason: string;          // Factual one-line reason
}

export interface PortfolioDNA {
  holdings: HoldingDNA[];
  styleBreakdown: Array<{
    style: DNAStyle;
    weight: number;       // Sum of weights for this style
    count: number;        // Number of holdings
    color: string;        // Display color
  }>;
  dominantStyle: DNAStyle;
  secondaryStyle: DNAStyle | null;
  summary: string;        // Factual one-line summary
}

// Style colors for consistent display
const STYLE_COLORS: Record<DNAStyle, string> = {
  'Quality Growth': '#00b4d8',
  'Dividend Income': '#22c55e',
  'Defensive': '#6366f1',
  'Cyclical': '#f59e0b',
  'Speculative Growth': '#ef4444',
  'Value': '#8b5cf6',
  'Fixed Income': '#0ea5e9',
  'Alternative': '#64748b',
};

// Sector classifications for cyclical/defensive determination
const CYCLICAL_SECTORS = new Set([
  'Energy', 'Materials', 'Basic Materials', 'Industrials',
  'Consumer Discretionary', 'Consumer Cyclical', 'Financial Services',
  'Financials', 'Real Estate',
]);

const DEFENSIVE_SECTORS = new Set([
  'Consumer Staples', 'Consumer Defensive', 'Healthcare', 'Health Care',
  'Utilities', 'Communication Services',
]);

export interface HoldingData {
  symbol: string;
  name: string;
  weight: number;
  assetClass: string;
  sector: string;
  dividendYield?: number;
  beta?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  pe?: number;
  roe?: number;
  profitMargins?: number;
  debtToEquity?: number;
  marketCap?: number;
  currentPrice?: number;
  targetPrice?: number;
  coupon?: number;
  maturity?: string;
}

/**
 * Classify a single holding into a DNA style based on its fundamentals
 * Uses only factual data — no speculation
 */
function classifyHolding(h: HoldingData): { style: DNAStyle; confidence: number; reason: string } {
  // Fixed income is straightforward
  if (h.assetClass === 'Obligations' || h.assetClass === 'Fixed Income' || h.assetClass === 'Revenu fixe' || h.coupon) {
    return {
      style: 'Fixed Income',
      confidence: 1.0,
      reason: `Obligation${h.coupon ? ` avec coupon de ${h.coupon.toFixed(2)}%` : ''}`,
    };
  }

  // ETF/Fund classification
  if (h.assetClass === 'FNB' || h.assetClass === 'ETF' || h.assetClass === 'Fonds commun') {
    return classifyFund(h);
  }

  // Alternative assets
  if (h.assetClass === 'Alternatif' || h.assetClass === 'Alternative') {
    return { style: 'Alternative', confidence: 0.8, reason: 'Actif alternatif' };
  }

  // Score each style for equities
  const scores: Record<DNAStyle, number> = {
    'Quality Growth': 0,
    'Dividend Income': 0,
    'Defensive': 0,
    'Cyclical': 0,
    'Speculative Growth': 0,
    'Value': 0,
    'Fixed Income': 0,
    'Alternative': 0,
  };

  // Quality Growth: high ROE, good margins, growing, moderate-high valuation
  if (h.roe && h.roe > 15) scores['Quality Growth'] += 2;
  if (h.profitMargins && h.profitMargins > 0.15) scores['Quality Growth'] += 2;
  if (h.revenueGrowth && h.revenueGrowth > 0.08) scores['Quality Growth'] += 2;
  if (h.earningsGrowth && h.earningsGrowth > 0.10) scores['Quality Growth'] += 1;
  if (h.marketCap && h.marketCap > 10e9) scores['Quality Growth'] += 1;

  // Dividend Income: significant yield, stable
  if (h.dividendYield && h.dividendYield > 0.025) scores['Dividend Income'] += 3;
  if (h.dividendYield && h.dividendYield > 0.04) scores['Dividend Income'] += 2;
  if (h.beta && h.beta < 1.0) scores['Dividend Income'] += 1;
  if (h.profitMargins && h.profitMargins > 0.10) scores['Dividend Income'] += 1;

  // Defensive: low beta, defensive sector, stable
  if (h.beta && h.beta < 0.8) scores['Defensive'] += 3;
  if (DEFENSIVE_SECTORS.has(h.sector)) scores['Defensive'] += 2;
  if (h.profitMargins && h.profitMargins > 0.10) scores['Defensive'] += 1;
  if (h.debtToEquity && h.debtToEquity < 1.0) scores['Defensive'] += 1;

  // Cyclical: cyclical sector, higher beta
  if (CYCLICAL_SECTORS.has(h.sector)) scores['Cyclical'] += 3;
  if (h.beta && h.beta > 1.0) scores['Cyclical'] += 1;
  if (h.revenueGrowth && h.revenueGrowth > 0.05) scores['Cyclical'] += 1;

  // Speculative Growth: very high growth, high valuation, no dividends, high beta
  if (h.revenueGrowth && h.revenueGrowth > 0.20) scores['Speculative Growth'] += 2;
  if (h.earningsGrowth && h.earningsGrowth > 0.25) scores['Speculative Growth'] += 2;
  if (h.pe && h.pe > 40) scores['Speculative Growth'] += 2;
  if (h.beta && h.beta > 1.3) scores['Speculative Growth'] += 1;
  if (!h.dividendYield || h.dividendYield === 0) scores['Speculative Growth'] += 1;
  if (h.marketCap && h.marketCap < 10e9) scores['Speculative Growth'] += 1;

  // Value: low PE, moderate growth, potentially high dividend
  if (h.pe && h.pe > 0 && h.pe < 15) scores['Value'] += 3;
  if (h.pe && h.pe > 0 && h.pe < 20) scores['Value'] += 1;
  if (h.dividendYield && h.dividendYield > 0.02) scores['Value'] += 1;
  if (h.targetPrice && h.currentPrice && h.targetPrice > h.currentPrice * 1.15) scores['Value'] += 1;

  // Find top style
  const sortedStyles = (Object.entries(scores) as [DNAStyle, number][])
    .filter(([s]) => s !== 'Fixed Income' && s !== 'Alternative')
    .sort((a, b) => b[1] - a[1]);

  const topStyle = sortedStyles[0];
  const maxPossible = 10;
  const confidence = Math.min(1, topStyle[1] / maxPossible);

  // Generate factual reason
  const reason = generateReason(h, topStyle[0]);

  return { style: topStyle[0], confidence, reason };
}

function classifyFund(h: HoldingData): { style: DNAStyle; confidence: number; reason: string } {
  const name = (h.name || '').toLowerCase();

  if (name.includes('bond') || name.includes('obligat') || name.includes('income') || name.includes('revenu')) {
    return { style: 'Fixed Income', confidence: 0.9, reason: 'Fonds de revenu fixe' };
  }
  if (name.includes('dividend') || name.includes('distribut')) {
    return { style: 'Dividend Income', confidence: 0.9, reason: 'Fonds axe sur les dividendes' };
  }
  if (name.includes('growth') || name.includes('croissance')) {
    if (h.dividendYield && h.dividendYield > 0.02) {
      return { style: 'Quality Growth', confidence: 0.8, reason: 'Fonds de croissance avec revenu' };
    }
    return { style: 'Quality Growth', confidence: 0.85, reason: 'Fonds de croissance' };
  }
  if (name.includes('value') || name.includes('valeur')) {
    return { style: 'Value', confidence: 0.85, reason: 'Fonds de type valeur' };
  }
  if (name.includes('balanced') || name.includes('equilibr')) {
    return { style: 'Defensive', confidence: 0.8, reason: 'Fonds equilibre' };
  }
  if (name.includes('tech') || name.includes('innov')) {
    return { style: 'Speculative Growth', confidence: 0.8, reason: 'Fonds sectoriel technologie/innovation' };
  }
  if (name.includes('resource') || name.includes('energy') || name.includes('material')) {
    return { style: 'Cyclical', confidence: 0.8, reason: 'Fonds sectoriel cyclique' };
  }

  // Default based on beta/dividend
  if (h.dividendYield && h.dividendYield > 0.03) {
    return { style: 'Dividend Income', confidence: 0.6, reason: 'Fonds avec rendement de distribution' };
  }

  return { style: 'Quality Growth', confidence: 0.5, reason: 'Fonds diversifie' };
}

function generateReason(h: HoldingData, style: DNAStyle): string {
  const parts: string[] = [];

  switch (style) {
    case 'Quality Growth':
      if (h.roe && h.roe > 15) parts.push(`ROE de ${h.roe.toFixed(0)}%`);
      if (h.revenueGrowth && h.revenueGrowth > 0.08) parts.push(`croissance des revenus de ${(h.revenueGrowth * 100).toFixed(0)}%`);
      if (h.profitMargins && h.profitMargins > 0.15) parts.push(`marge nette de ${(h.profitMargins * 100).toFixed(0)}%`);
      return parts.length > 0 ? `Croissance de qualite : ${parts.join(', ')}` : 'Profil de croissance de qualite';

    case 'Dividend Income':
      if (h.dividendYield) parts.push(`rendement de ${(h.dividendYield * 100).toFixed(1)}%`);
      if (h.beta && h.beta < 1) parts.push(`beta de ${h.beta.toFixed(2)}`);
      return parts.length > 0 ? `Revenu de dividende : ${parts.join(', ')}` : 'Source de revenu de dividende';

    case 'Defensive':
      if (h.beta && h.beta < 0.8) parts.push(`beta faible de ${h.beta.toFixed(2)}`);
      if (DEFENSIVE_SECTORS.has(h.sector)) parts.push(`secteur defensif (${h.sector})`);
      return parts.length > 0 ? `Position defensive : ${parts.join(', ')}` : 'Profil defensif';

    case 'Cyclical':
      if (CYCLICAL_SECTORS.has(h.sector)) parts.push(`secteur cyclique (${h.sector})`);
      if (h.beta && h.beta > 1) parts.push(`beta de ${h.beta.toFixed(2)}`);
      return parts.length > 0 ? `Exposition cyclique : ${parts.join(', ')}` : 'Position cyclique';

    case 'Speculative Growth':
      if (h.revenueGrowth && h.revenueGrowth > 0.20) parts.push(`croissance des revenus de ${(h.revenueGrowth * 100).toFixed(0)}%`);
      if (h.pe && h.pe > 40) parts.push(`P/E de ${h.pe.toFixed(0)}x`);
      return parts.length > 0 ? `Croissance speculative : ${parts.join(', ')}` : 'Profil de forte croissance';

    case 'Value':
      if (h.pe && h.pe > 0 && h.pe < 15) parts.push(`P/E de ${h.pe.toFixed(1)}x`);
      if (h.dividendYield) parts.push(`rendement de ${(h.dividendYield * 100).toFixed(1)}%`);
      return parts.length > 0 ? `Valeur : ${parts.join(', ')}` : 'Profil de type valeur';

    default:
      return '';
  }
}

/**
 * MAIN: Analyze the DNA of a portfolio
 */
export function analyzePortfolioDNA(holdings: HoldingData[]): PortfolioDNA {
  const classified: HoldingDNA[] = holdings.map(h => {
    const { style, confidence, reason } = classifyHolding(h);
    return {
      symbol: h.symbol,
      name: h.name,
      weight: h.weight,
      style,
      styleConfidence: confidence,
      reason,
    };
  });

  // Aggregate by style
  const styleMap: Record<DNAStyle, { weight: number; count: number }> = {
    'Quality Growth': { weight: 0, count: 0 },
    'Dividend Income': { weight: 0, count: 0 },
    'Defensive': { weight: 0, count: 0 },
    'Cyclical': { weight: 0, count: 0 },
    'Speculative Growth': { weight: 0, count: 0 },
    'Value': { weight: 0, count: 0 },
    'Fixed Income': { weight: 0, count: 0 },
    'Alternative': { weight: 0, count: 0 },
  };

  for (const h of classified) {
    styleMap[h.style].weight += h.weight;
    styleMap[h.style].count++;
  }

  const styleBreakdown = (Object.entries(styleMap) as [DNAStyle, { weight: number; count: number }][])
    .filter(([, v]) => v.weight > 0)
    .map(([style, { weight, count }]) => ({
      style,
      weight,
      count,
      color: STYLE_COLORS[style],
    }))
    .sort((a, b) => b.weight - a.weight);

  const dominant = styleBreakdown[0]?.style || 'Quality Growth';
  const secondary = styleBreakdown.length > 1 ? styleBreakdown[1].style : null;

  // Build factual summary
  const domPct = (styleBreakdown[0]?.weight * 100 || 0).toFixed(0);
  const secPct = styleBreakdown[1] ? (styleBreakdown[1].weight * 100).toFixed(0) : null;
  let summary = `Portefeuille a dominante ${dominant} (${domPct}%)`;
  if (secondary && secPct) {
    summary += ` avec composante ${secondary} (${secPct}%)`;
  }

  return {
    holdings: classified,
    styleBreakdown,
    dominantStyle: dominant,
    secondaryStyle: secondary,
    summary,
  };
}

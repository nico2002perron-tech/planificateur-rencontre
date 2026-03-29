/**
 * Dual Scoring: Safety Score + Upside Potential Score
 * Pure calculation module — no external API calls.
 *
 * Safety score: institutional risk framework (Graham/Dodd, MSCI, Piotroski-inspired).
 * 6 fundamental factors with continuous interpolation + PEG-adjusted valuation
 * + realized volatility blend + red-flag overrides.
 * Calibrated so a median S&P 500 / TSX 60 large-cap scores 6-7 ("Sûr").
 */

import type { BenchmarkData } from './benchmarks';
import { getBenchmarkData } from './benchmarks';

// ── Interfaces ────────────────────────────────────────────────────

export interface SafetyScoreBreakdown {
  balanceSheetScore: number; // 0-10 (D/E + Current Ratio combined)
  betaScore: number;         // 0-10 (beta + 52w realized vol blended)
  profitabilityScore: number;// 0-10 (margins + growth, EPS cap)
  valuationScore: number;    // 0-10 (PE, PEG-adjusted when growth data available)
  sizeScore: number;         // 0-10 (market cap)
  dividendScore: number;     // 0-10
  total: number;             // 0-10 weighted, after red-flag caps
  label: string;
  color: string;
  redFlag: string | null;    // null if none, description if capped
}

export interface UpsideScoreBreakdown {
  analystUpside: number;     // 0-10
  week52Room: number;        // 0-10
  valuationUpside: number;   // 0-10
  peSectorGap: number;       // 0-10
  epsGrowth: number;         // 0-10
  totalReturn: number;       // 0-10 (retired, always 0)
  total: number;             // 0-10 weighted
  label: string;
  color: string;
}

export interface StockDualScore {
  symbol: string;
  companyName: string;
  weight: number;
  safety: SafetyScoreBreakdown;
  upside: UpsideScoreBreakdown;
  rank: number;
  quadrant: 'star' | 'safe' | 'growth' | 'watch';
  confidence: 'high' | 'medium' | 'low';
}

export interface SafetyScoreInputs {
  beta: number;
  dividendYield: number;   // decimal, e.g. 0.025
  pe: number;
  eps: number;             // for red-flag check + profitability cap
  profitMargins: number;   // decimal, e.g. 0.25 = 25%
  debtToEquity: number;    // e.g. 150 = 150%
  currentRatio: number;    // e.g. 1.5
  earningsGrowth: number;  // decimal, e.g. 0.12 = 12%
  marketCap: number;       // dollars
  sector: string;          // for sector-adjusted D/E (financials)
  week52High: number;      // for realized volatility calculation
  week52Low: number;
  currentPrice: number;
}

export interface UpsideScoreInputs {
  currentPrice: number;
  targetPrice: number;     // analyst consensus
  week52High: number;
  week52Low: number;
  avgIntrinsic: number;    // DCF valuation
  pe: number;
  sectorBenchmarkPE: number;
  earningsGrowth: number;  // decimal
  dividendYield: number;   // decimal
  estimatedGainPercent: number;
}

// ── Customizable Weights ─────────────────────────────────────────

export interface SafetyWeights {
  balanceSheet: number;
  beta: number;
  profitability: number;
  valuation: number;
  size: number;
  dividend: number;
}

export interface UpsideWeights {
  analyst: number;
  week52: number;
  dcf: number;
  peSector: number;
  epsGrowth: number;
}

export interface CustomWeights {
  safety?: Partial<SafetyWeights>;
  upside?: Partial<UpsideWeights>;
  safetyAdj?: Partial<SafetyWeights>;   // per-factor adjustment -2 to +2
  upsideAdj?: Partial<UpsideWeights>;   // per-factor adjustment -2 to +2
}

export const DEFAULT_SAFETY_WEIGHTS: SafetyWeights = {
  balanceSheet: 25,
  beta: 20,
  profitability: 20,
  valuation: 15,
  size: 10,
  dividend: 10,
};

export const DEFAULT_UPSIDE_WEIGHTS: UpsideWeights = {
  analyst: 30,
  week52: 15,
  dcf: 20,
  peSector: 15,
  epsGrowth: 20,
};

// Normalize weights to fractions summing to 1.0
function normalizeWeights(w: Record<string, number>): Record<string, number> {
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (sum <= 0) return w;
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(w)) {
    result[k] = v / sum;
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 10): number {
  return Math.min(max, Math.max(min, v));
}

function rd(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Linear interpolation between anchor points.
 * anchors: sorted array of [inputValue, outputScore].
 * Values below first anchor → first score; above last → last score.
 * Eliminates cliff effects between tiers for smoother, more precise scoring.
 */
function lerp(value: number, anchors: [number, number][]): number {
  if (anchors.length === 0) return 5;
  if (value <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    if (value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

const FINANCIAL_SECTORS = new Set([
  'Financial Services', 'Financials', 'Banks', 'Insurance',
  'financial services', 'financials',
]);

// ── Safety Score Calculation ──────────────────────────────────────

export function calculateSafetyScore(
  inputs: SafetyScoreInputs,
  customWeights?: Partial<SafetyWeights>,
  adjustments?: Partial<SafetyWeights>,
): SafetyScoreBreakdown {
  const {
    beta, dividendYield, pe, eps, profitMargins, debtToEquity,
    currentRatio, earningsGrowth, marketCap, sector,
    week52High, week52Low, currentPrice,
  } = inputs;
  const w = normalizeWeights({ ...DEFAULT_SAFETY_WEIGHTS, ...customWeights });
  const isFinancial = FINANCIAL_SECTORS.has(sector);

  // ══════════════════════════════════════════════════════════════════
  // Continuous interpolation (lerp) replaces step functions to
  // eliminate arbitrary cliff effects. Each factor uses anchor points
  // calibrated to real market distributions (S&P 500, TSX 60).
  // A median large-cap naturally scores 6-7 ("Sûr").
  // ══════════════════════════════════════════════════════════════════

  // ── 1. Balance Sheet (D/E × 0.6 + Current Ratio × 0.4) ──
  //    Banks/insurance: neutral (capital structure is regulated, D/E is meaningless).
  //    D/E = 0 from Yahoo: likely missing data → conservative neutral.
  //    D/E > 0: continuous curve, S&P 500 median ~ 120-180%.
  let debtSub: number;
  let liqSub: number;

  if (isFinancial) {
    debtSub = 6.5;
    liqSub = 6.5;
  } else {
    if (debtToEquity <= 0) {
      // D/E = 0: almost always means Yahoo didn't return the data.
      // Genuinely zero-debt public companies are extremely rare.
      // If other data exists (CR > 0), give slight benefit of the doubt.
      debtSub = currentRatio > 0 ? 7 : 5.5;
    } else {
      debtSub = lerp(debtToEquity, [
        [1, 10],      // near-zero debt (e.g., some tech companies)
        [30, 9],      // very low
        [80, 8],      // low
        [130, 7],     // below median
        [180, 6],     // around S&P median
        [250, 4.5],   // elevated
        [400, 2.5],   // high
        [600, 1],     // dangerous
      ]);
    }

    if (currentRatio <= 0) {
      // CR = 0: data missing (common for financials, some industries)
      liqSub = 5;
    } else {
      liqSub = lerp(currentRatio, [
        [0.3, 1],     // critically low
        [0.6, 3],     // very low
        [0.8, 4],     // low
        [1.0, 5.5],   // break-even
        [1.3, 6.5],   // adequate
        [1.5, 7.5],   // good
        [2.0, 8.5],   // very good
        [3.0, 10],    // excellent
      ]);
    }
  }
  let balanceSheetScore = debtSub * 0.6 + liqSub * 0.4;

  // ── 2. Market Risk (Beta × 0.6 + Realized Volatility × 0.4) ──
  //    Beta alone is insufficient: measures only systematic risk, can be stale,
  //    and equals 0 when data is missing.
  //    52-week price range / price ≈ annualized realized volatility,
  //    capturing both systematic + idiosyncratic risk.
  //    Blending both gives a more reliable risk picture.
  let betaComponent = 6.5;
  if (beta > 0) {
    // Courbe permissive : beta 1.0 (marché) = 6.5 ("Solide").
    // Seuls les titres nettement plus volatils que le marché sont pénalisés.
    betaComponent = lerp(beta, [
      [0.2, 10],    // ultra-stable (services publics, REITs)
      [0.5, 9.5],   // très défensif
      [0.7, 8.5],   // défensif
      [0.9, 7.5],   // légèrement sous le marché
      [1.0, 6.5],   // moyenne du marché — "Solide"
      [1.2, 5.5],   // légèrement au-dessus — normal pour croissance
      [1.4, 4.5],   // modérément volatile
      [1.7, 3],     // volatile
      [2.0, 1.5],   // très volatile
      [2.5, 0],     // extrême
    ]);
  } else if (beta < 0) {
    betaComponent = 8.5; // corrélation inverse = couverture défensive
  }

  let volComponent = 6.5; // neutre si pas de données 52 semaines
  if (week52High > week52Low && currentPrice > 0 && week52Low > 0) {
    const rangeRatio = ((week52High - week52Low) / currentPrice) * 100;
    // Courbe permissive : 30% de range (typique S&P 500) = 7 ("Solide").
    volComponent = lerp(rangeRatio, [
      [5, 10],      // 5% = ultra-stable (rare)
      [12, 9.5],    // 12% = très stable
      [20, 8.5],    // 20% = large-cap stable
      [30, 7],      // 30% = typique S&P 500 — "Solide"
      [45, 5],      // 45% = volatile
      [65, 3],      // 65% = très volatile
      [100, 0.5],   // 100% = spéculatif
    ]);
  }

  // Blend: if both available → 60/40 beta/vol. If only one → use that one.
  let betaScore: number;
  if (beta > 0 && week52High > week52Low && currentPrice > 0) {
    betaScore = betaComponent * 0.6 + volComponent * 0.4;
  } else if (beta > 0) {
    betaScore = betaComponent;
  } else if (week52High > week52Low && currentPrice > 0) {
    betaScore = volComponent;
  } else {
    betaScore = 5; // no data at all → neutral
  }

  // ── 3. Profitability (Margins × 0.65 + Growth × 0.35, EPS cap) ──
  //    Profit margins: S&P 500 median ~ 12-15%. Continuous curve.
  //    Growth: earningsGrowth from Yahoo financialData.
  //    EPS < 0 → hard cap at 3 (unprofitable = unreliable safety).
  let marginSub = 5;
  if (profitMargins !== 0) {
    const mPct = profitMargins * 100;
    marginSub = lerp(mPct, [
      [-20, 0.5],   // deep losses
      [-5, 2],      // moderate losses
      [0, 3],       // breakeven
      [3, 4.5],     // thin margins (retail, airlines)
      [8, 6],       // moderate
      [15, 8],      // good (S&P median ~ 12-15%)
      [25, 9.5],    // excellent
      [40, 10],     // exceptional (software, pharma)
    ]);
  }

  let growthSub = 5;
  if (earningsGrowth !== 0) {
    const gr = earningsGrowth * 100;
    growthSub = lerp(gr, [
      [-30, 1],     // severe decline
      [-10, 3],     // moderate decline
      [0, 5],       // flat
      [5, 6.5],     // modest growth
      [10, 7.5],    // good
      [20, 9],      // strong
      [35, 10],     // exceptional
    ]);
  }

  let profitabilityScore = marginSub * 0.65 + growthSub * 0.35;
  if (eps < 0) {
    profitabilityScore = Math.min(profitabilityScore, 3);
  }

  // ── 4. Valuation (PE with PEG adjustment) ──
  //    Base PE score via continuous curve, then PEG adjusts for growth context.
  //    A PE of 30 with 25% growth (PEG 1.2) is much safer than PE 30 with 0% growth.
  //    Very low PE (0-5) is suspicious: often one-time gains or dying businesses.
  let valuationScore = 4; // default when PE = 0 (no data)
  if (pe > 0) {
    if (pe <= 5) {
      // Very low PE: suspicious — often one-time gains, asset sales,
      // or businesses in terminal decline. Not automatically "cheap."
      valuationScore = 4;
    } else {
      valuationScore = lerp(pe, [
        [5, 5],       // transition from suspicious zone
        [8, 8.5],     // deep value
        [12, 9.5],    // classic value sweet spot
        [16, 9],      // reasonable value
        [20, 8],      // fair value
        [25, 6.5],    // growth premium
        [30, 5.5],    // rich but common for quality growth
        [40, 4],      // expensive
        [55, 2.5],    // very expensive
        [80, 1],      // speculative
      ]);
    }

    // PEG adjustment: integrates growth rate into PE assessment.
    // Only applies when meaningful growth data exists (> 2%) and PE is elevated (> 15).
    // PEG < 1 = growth is cheap (safer); PEG > 2.5 = growth is overpriced (riskier).
    if (earningsGrowth > 0.02 && pe > 15) {
      const peg = pe / (earningsGrowth * 100);
      let pegAdj = 0;
      if (peg < 0.8) pegAdj = 1.5;        // very cheap growth
      else if (peg < 1.0) pegAdj = 1.0;    // cheap growth
      else if (peg < 1.5) pegAdj = 0.5;    // fair growth
      else if (peg < 2.0) pegAdj = 0;      // neutral
      else if (peg < 3.0) pegAdj = -0.5;   // expensive growth
      else pegAdj = -1.0;                   // very expensive growth
      valuationScore = clamp(valuationScore + pegAdj);
    }
  } else if (pe < 0) {
    valuationScore = 1.5; // negative PE = losses
  }

  // ── 5. Size (Market Cap) ──
  //    Continuous curve. Mega-cap = most stable/liquid/diversified.
  let sizeScore = 5;
  if (marketCap > 0) {
    const capB = marketCap / 1e9;
    sizeScore = lerp(capB, [
      [0.3, 1],     // nano/micro cap
      [0.5, 2.5],   // micro cap
      [2, 4.5],     // small cap
      [10, 7],      // mid cap
      [50, 8.5],    // large cap
      [200, 9.5],   // mega cap
      [500, 10],    // ultra mega cap
    ]);
  }

  // ── 6. Dividend ──
  //    No dividend = neutral (5): Berkshire, Google, Amazon are very safe.
  //    Sweet spot: 2-4% yield. High yield (> 6%) flags potential trap,
  //    especially combined with negative growth or negative margins.
  let dividendScore = 5;
  if (dividendYield > 0) {
    const yieldPct = dividendYield * 100;
    if (yieldPct <= 6) {
      dividendScore = lerp(yieldPct, [
        [0.1, 5.5],  // token dividend
        [0.5, 6],    // small but consistent
        [1.0, 7],    // moderate
        [2.0, 9],    // sweet spot start
        [3.0, 9.5],  // sweet spot
        [4.0, 9],    // still good
        [5.0, 7.5],  // high but watch payout
        [6.0, 6],    // elevated risk
      ]);
    } else {
      // High yield trap zone: yield > 6% is often unsustainable
      dividendScore = lerp(yieldPct, [
        [6, 5.5],
        [7, 4],
        [8, 3],
        [10, 1.5],
        [15, 0.5],
      ]);
      // Extra penalty: high yield + deteriorating fundamentals = classic trap
      if (earningsGrowth < -0.05 || profitMargins < 0) {
        dividendScore = Math.min(dividendScore, 2.5);
      }
    }
  }

  // Apply per-factor adjustments (Strict -1 / Normal 0 / Souple +1)
  if (adjustments) {
    balanceSheetScore = clamp(balanceSheetScore + (adjustments.balanceSheet ?? 0));
    betaScore = clamp(betaScore + (adjustments.beta ?? 0));
    profitabilityScore = clamp(profitabilityScore + (adjustments.profitability ?? 0));
    valuationScore = clamp(valuationScore + (adjustments.valuation ?? 0));
    sizeScore = clamp(sizeScore + (adjustments.size ?? 0));
    dividendScore = clamp(dividendScore + (adjustments.dividend ?? 0));
  }

  // Weighted total (normalized)
  let total = clamp(
    balanceSheetScore * w.balanceSheet +
    betaScore * w.beta +
    profitabilityScore * w.profitability +
    valuationScore * w.valuation +
    sizeScore * w.size +
    dividendScore * w.dividend
  );

  // ── Red-flag overrides — hard caps on final score ──
  // These catch structurally dangerous situations that weighted averages
  // might miss. Each flag prevents a dangerously high composite.
  let redFlag: string | null = null;

  // RF1: Negative earnings + high leverage = distress risk
  if (eps < 0 && debtToEquity > 200 && !isFinancial) {
    total = Math.min(total, 2.5);
    redFlag = 'L\'entreprise perd de l\'argent et a beaucoup de dettes';
  }
  // RF2: Negative margins + low liquidity = operational distress
  if (profitMargins < 0 && currentRatio > 0 && currentRatio < 0.8 && !isFinancial) {
    total = Math.min(total, 3);
    redFlag = redFlag ?? 'L\'entreprise perd de l\'argent et manque de liquidites';
  }
  // RF3: Extreme volatility + speculative valuation
  if (beta > 2.0 && pe > 70) {
    total = Math.min(total, 3.5);
    redFlag = redFlag ?? 'Titre tres volatile avec un prix speculatif';
  }
  // RF4: Micro cap with no earnings
  if (marketCap > 0 && marketCap < 300_000_000 && eps <= 0) {
    total = Math.min(total, 2.5);
    redFlag = redFlag ?? 'Tres petite entreprise sans profits';
  }
  // RF5: Extreme leverage alone (even with positive EPS)
  if (debtToEquity > 500 && !isFinancial) {
    total = Math.min(total, 3.5);
    redFlag = redFlag ?? 'Niveau de dettes extremement eleve';
  }
  // RF6: High yield trap — yield > 8% with negative earnings
  if (dividendYield > 0.08 && eps < 0) {
    total = Math.min(total, 3);
    redFlag = redFlag ?? 'Dividende eleve mais l\'entreprise perd de l\'argent — possible piege';
  }

  const rounded = rd(total);

  let label: string;
  let color: string;
  if (rounded >= 8) { label = 'Tres solide'; color = '#10b981'; }
  else if (rounded >= 6) { label = 'Solide'; color = '#22d3ee'; }
  else if (rounded >= 4) { label = 'Correct'; color = '#f59e0b'; }
  else if (rounded >= 2) { label = 'A surveiller'; color = '#f97316'; }
  else { label = 'Risque eleve'; color = '#ef4444'; }

  return {
    balanceSheetScore: rd(balanceSheetScore),
    betaScore: rd(betaScore),
    profitabilityScore: rd(profitabilityScore),
    valuationScore: rd(valuationScore),
    sizeScore: rd(sizeScore),
    dividendScore: rd(dividendScore),
    total: rounded,
    label,
    color,
    redFlag,
  };
}

// ── Upside Score Calculation ─────────────────────────────────────

export function calculateUpsideScore(
  inputs: UpsideScoreInputs,
  customWeights?: Partial<UpsideWeights>,
  adjustments?: Partial<UpsideWeights>,
): UpsideScoreBreakdown {
  const {
    currentPrice, targetPrice, week52High, week52Low,
    avgIntrinsic, pe, sectorBenchmarkPE, earningsGrowth,
  } = inputs;
  const w = normalizeWeights({ ...DEFAULT_UPSIDE_WEIGHTS, ...customWeights });

  // 1. Cible analystes vs prix
  let analystUpside = 5;
  if (targetPrice > 0 && currentPrice > 0) {
    const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
    if (upside >= 40) analystUpside = 10;
    else if (upside >= 25) analystUpside = 8.5;
    else if (upside >= 15) analystUpside = 7;
    else if (upside >= 5) analystUpside = 6.5;
    else if (upside >= 0) analystUpside = 3;
    else if (upside >= -10) analystUpside = 2;
    else analystUpside = 1;
  }

  // 2. Position 52 semaines — room to grow
  let week52Room = 5;
  if (week52High > week52Low && week52High > 0) {
    const range = week52High - week52Low;
    const positionPct = (currentPrice - week52Low) / range;
    week52Room = clamp(10 - positionPct * 7);
  }

  // 3. Upside valorisation DCF
  let valuationUpside = 5;
  if (avgIntrinsic > 0 && currentPrice > 0) {
    const dcfUpside = ((avgIntrinsic - currentPrice) / currentPrice) * 100;
    if (dcfUpside >= 50) valuationUpside = 10;
    else if (dcfUpside >= 30) valuationUpside = 8;
    else if (dcfUpside >= 15) valuationUpside = 7;
    else if (dcfUpside >= 5) valuationUpside = 5.5;
    else if (dcfUpside >= 0) valuationUpside = 4;
    else if (dcfUpside >= -15) valuationUpside = 2.5;
    else valuationUpside = 1;
  }

  // 4. PE vs secteur — PE below benchmark = expansion potential
  let peSectorGap = 5;
  if (pe > 0 && sectorBenchmarkPE > 0) {
    const ratio = pe / sectorBenchmarkPE;
    if (ratio < 0.5) peSectorGap = 9;
    else if (ratio < 0.75) peSectorGap = 8;
    else if (ratio < 1.0) peSectorGap = 6.5;
    else if (ratio < 1.2) peSectorGap = 4;
    else peSectorGap = 2;
  }

  // 5. Croissance EPS
  let epsGrowthScore = 5;
  if (earningsGrowth !== 0) {
    const gr = earningsGrowth * 100;
    if (gr >= 30) epsGrowthScore = 10;
    else if (gr >= 20) epsGrowthScore = 8;
    else if (gr >= 10) epsGrowthScore = 7;
    else if (gr >= 5) epsGrowthScore = 6;
    else if (gr >= 0) epsGrowthScore = 4;
    else epsGrowthScore = 2;
  }

  // Apply per-factor adjustments
  if (adjustments) {
    analystUpside = clamp(analystUpside + (adjustments.analyst ?? 0));
    week52Room = clamp(week52Room + (adjustments.week52 ?? 0));
    valuationUpside = clamp(valuationUpside + (adjustments.dcf ?? 0));
    peSectorGap = clamp(peSectorGap + (adjustments.peSector ?? 0));
    epsGrowthScore = clamp(epsGrowthScore + (adjustments.epsGrowth ?? 0));
  }

  // Weighted total (normalized)
  const total = clamp(
    analystUpside * w.analyst +
    week52Room * w.week52 +
    valuationUpside * w.dcf +
    peSectorGap * w.peSector +
    epsGrowthScore * w.epsGrowth
  );

  const rounded = rd(total);

  let label: string;
  let color: string;
  if (rounded >= 8) { label = 'Excellent'; color = '#10b981'; }
  else if (rounded >= 6) { label = 'Bon'; color = '#22d3ee'; }
  else if (rounded >= 4) { label = 'Modere'; color = '#f59e0b'; }
  else if (rounded >= 2) { label = 'Faible'; color = '#f97316'; }
  else { label = 'Tres faible'; color = '#ef4444'; }

  return {
    analystUpside: rd(analystUpside),
    week52Room: rd(week52Room),
    valuationUpside: rd(valuationUpside),
    peSectorGap: rd(peSectorGap),
    epsGrowth: rd(epsGrowthScore),
    totalReturn: 0,
    total: rounded,
    label,
    color,
  };
}

// ── Combined Dual Scoring ────────────────────────────────────────

interface DualScoreHolding {
  symbol: string;
  companyName: string;
  currentPrice: number;
  weight: number;
  beta: number;
  pe: number;
  eps: number;
  week52High: number;
  week52Low: number;
  dividendYield: number;
  earningsGrowth: number;
  targetPrice: number;
  estimatedGainPercent: number;
  sector: string;
  assetClass: string;
  profitMargins: number;
  debtToEquity: number;
  currentRatio: number;
  marketCap: number;
}

interface DualScoreValuation {
  symbol: string;
  avgIntrinsic: number;
}

export function calculateDualScores(
  holdings: DualScoreHolding[],
  valuations: DualScoreValuation[],
  benchmarkMap?: Map<string, BenchmarkData>,
  weights?: CustomWeights,
): StockDualScore[] {
  const valMap = new Map(valuations.map(v => [v.symbol, v]));
  const scores: StockDualScore[] = [];

  for (const h of holdings) {
    if (h.assetClass === 'CASH') continue;

    const bench = benchmarkMap?.get(h.symbol) ?? getBenchmarkData(h.symbol, h.sector);
    const val = valMap.get(h.symbol);

    // Confidence based on available data points
    let realDataPoints = 0;
    if (h.pe > 0) realDataPoints++;
    if (h.beta > 0) realDataPoints++;
    if (h.profitMargins !== 0) realDataPoints++;
    if (h.debtToEquity > 0) realDataPoints++;
    if (h.currentRatio > 0) realDataPoints++;
    if (h.marketCap > 0) realDataPoints++;
    if (h.earningsGrowth !== 0) realDataPoints++;
    if (h.dividendYield > 0) realDataPoints++;

    let confidence: 'high' | 'medium' | 'low';
    if (realDataPoints >= 6) confidence = 'high';
    else if (realDataPoints >= 3) confidence = 'medium';
    else confidence = 'low';

    const safety = calculateSafetyScore({
      beta: h.beta,
      dividendYield: h.dividendYield,
      pe: h.pe,
      eps: h.eps,
      profitMargins: h.profitMargins,
      debtToEquity: h.debtToEquity,
      currentRatio: h.currentRatio,
      earningsGrowth: h.earningsGrowth,
      marketCap: h.marketCap,
      sector: h.sector,
      week52High: h.week52High,
      week52Low: h.week52Low,
      currentPrice: h.currentPrice,
    }, weights?.safety, weights?.safetyAdj);

    const upside = calculateUpsideScore({
      currentPrice: h.currentPrice,
      targetPrice: h.targetPrice,
      week52High: h.week52High,
      week52Low: h.week52Low,
      avgIntrinsic: val?.avgIntrinsic ?? 0,
      pe: h.pe,
      sectorBenchmarkPE: bench.pe,
      earningsGrowth: h.earningsGrowth,
      dividendYield: h.dividendYield,
      estimatedGainPercent: h.estimatedGainPercent,
    }, weights?.upside, weights?.upsideAdj);

    let quadrant: 'star' | 'safe' | 'growth' | 'watch';
    if (safety.total >= 6 && upside.total >= 6) quadrant = 'star';
    else if (safety.total >= 6) quadrant = 'safe';
    else if (upside.total >= 6) quadrant = 'growth';
    else quadrant = 'watch';

    scores.push({
      symbol: h.symbol,
      companyName: h.companyName,
      weight: h.weight,
      safety,
      upside,
      rank: 0,
      quadrant,
      confidence,
    });
  }

  return scores;
}

// ── Ranking ──────────────────────────────────────────────────────

export function rankStocks(scores: StockDualScore[]): StockDualScore[] {
  const sorted = [...scores].sort((a, b) => {
    const compositeA = a.safety.total * 0.5 + a.upside.total * 0.5;
    const compositeB = b.safety.total * 0.5 + b.upside.total * 0.5;
    return compositeB - compositeA;
  });

  sorted.forEach((s, i) => { s.rank = i + 1; });
  return sorted;
}

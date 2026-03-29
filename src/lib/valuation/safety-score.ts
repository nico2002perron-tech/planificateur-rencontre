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
  businessGrowth: number;      // 0-10 (revenue + earnings growth)
  analystTarget: number;       // 0-10 (analyst consensus target)
  valuationDiscount: number;   // 0-10 (DCF + forward PE discount)
  fcfYield: number;            // 0-10 (free cash flow / market cap)
  totalReturn: number;         // 0-10 (dividend income yield)
  capitalEfficiency: number;   // 0-10 (ROE — return on equity)
  total: number;               // 0-10 weighted
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
  narrative: string;  // qualitative mini-analysis explaining the scores
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
  revenueGrowth?: number;  // decimal, e.g. 0.08 = 8% (for growth-adjusted size)
  marketCap: number;       // dollars
  sector: string;          // for sector-adjusted D/E (financials)
  sectorGrowthRate?: number; // decimal, e.g. 0.12 = 12% (from benchmarks, for growth context)
  week52High: number;      // for realized volatility calculation
  week52Low: number;
  currentPrice: number;
}

export interface UpsideScoreInputs {
  currentPrice: number;
  targetPrice: number;       // analyst consensus
  avgIntrinsic: number;      // DCF valuation (0 if unavailable)
  pe: number;                // trailing PE
  forwardPE: number;         // forward PE (analyst estimates)
  earningsGrowth: number;    // decimal, e.g. 0.12 = 12%
  revenueGrowth: number;     // decimal, e.g. 0.08 = 8%
  dividendYield: number;     // decimal, e.g. 0.025 = 2.5%
  freeCashflow: number;      // absolute $ (from Yahoo financialData)
  marketCap: number;         // absolute $ (for FCF yield calculation)
  returnOnEquity: number;    // decimal, e.g. 0.18 = 18%
  estimatedGainPercent: number; // analyst target upside %
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
  businessGrowth: number;
  analystTarget: number;
  valuationDiscount: number;
  fcfYield: number;
  totalReturn: number;
  capitalEfficiency: number;
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
  businessGrowth: 20,
  analystTarget: 20,
  valuationDiscount: 20,
  fcfYield: 15,
  totalReturn: 15,
  capitalEfficiency: 10,
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

  // ── 5. Size (Market Cap) — Growth-Adjusted ──
  //    Base: mega-cap = most stable/liquid/diversified.
  //    Adjustment: small/mid caps in high-growth sectors with strong revenue
  //    growth get a bonus — they're small because they're early-stage, not weak.
  //    A $3B company growing 25%/year in cybersecurity ≠ a $3B company
  //    stagnating in a declining industry.
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

    // Growth-adjusted size bonus for companies < $50B
    // Gate: company must be profitable (eps > 0) — unprofitable growth
    // could just be cash burn, not genuine scaling.
    // Curve peaks at $2-5B ("proven small-cap") rather than at the smallest
    // sizes, because sub-$500M companies haven't yet proven they can scale.
    if (capB < 50 && eps > 0) {
      const companyGr = Math.max(
        (inputs.revenueGrowth ?? 0) * 100,
        earningsGrowth * 100,
      );
      const sectorGr = (inputs.sectorGrowthRate ?? 0) * 100;
      const growthSignal = Math.max(companyGr, sectorGr);

      if (growthSignal > 8) {
        // Peaks at $2-5B: proven enough to deserve the bonus.
        // Sub-$500M: reduced bonus (not yet proven).
        // >$30B: minimal bonus (already large enough).
        const sizeFactor = lerp(capB, [
          [0.3, 0.3],   // micro-cap: limited (unproven)
          [0.5, 0.5],   // small micro
          [1, 0.7],     // approaching small-cap
          [3, 1.0],     // sweet spot: proven small-cap
          [10, 0.6],    // mid-cap: less needed
          [30, 0.2],
          [50, 0],
        ]);
        const growthFactor = lerp(growthSignal, [
          [8, 0.3],
          [15, 0.6],
          [25, 0.9],
          [35, 1.0],
        ]);
        const bonus = sizeFactor * growthFactor * 2; // max ~2 pts (was 2.5)
        sizeScore = clamp(sizeScore + bonus);
      }
    }
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
// 6 institutional-quality factors with continuous interpolation.
// Measures: business growth, analyst targets, valuation discount,
// free cash flow yield, total return, and capital efficiency.

export function calculateUpsideScore(
  inputs: UpsideScoreInputs,
  customWeights?: Partial<UpsideWeights>,
  adjustments?: Partial<UpsideWeights>,
): UpsideScoreBreakdown {
  const {
    currentPrice, targetPrice, avgIntrinsic, pe, forwardPE,
    earningsGrowth, revenueGrowth, dividendYield, freeCashflow,
    marketCap, returnOnEquity, estimatedGainPercent,
  } = inputs;
  const w = normalizeWeights({ ...DEFAULT_UPSIDE_WEIGHTS, ...customWeights });

  // ── 1. Croissance des affaires (revenus × 0.4 + BPA × 0.6) ──
  //    Le moteur fondamental: le business grossit-il vraiment?
  //    Revenue = top line (dur à manipuler), earnings = bottom line.
  let revSub = 5;
  if (revenueGrowth !== 0) {
    revSub = lerp(revenueGrowth * 100, [
      [-20, 1],    // revenus en chute libre
      [-5, 3],     // baisse moderee
      [0, 4.5],    // stagnation
      [5, 6.5],    // croissance moderee
      [10, 7.5],   // bonne croissance
      [20, 9],     // forte croissance
      [35, 10],    // exceptionnelle
    ]);
  }

  let earnSub = 5;
  if (earningsGrowth !== 0) {
    earnSub = lerp(earningsGrowth * 100, [
      [-30, 1],    // effondrement des profits
      [-10, 3],    // baisse significative
      [0, 4.5],    // stagnation
      [5, 6],      // croissance modeste
      [10, 7.5],   // bonne croissance
      [20, 8.5],   // forte croissance
      [35, 10],    // exceptionnelle
    ]);
  }

  let businessGrowth = revSub * 0.4 + earnSub * 0.6;

  // Small-cap runway bonus: same growth rate has MORE upside potential
  // when the company is smaller. A $3B company growing 20% can realistically
  // double; a $300B company growing 20% cannot. Only amplifies existing growth.
  // Peaks at $2-5B (proven small-cap), not at micro-cap (too speculative).
  // Micro-caps (<$500M) get a reduced bonus — high growth at that size
  // hasn't been proven to be sustainable yet.
  if (marketCap > 0 && marketCap < 50e9 && businessGrowth > 6) {
    const capB = marketCap / 1e9;
    const runwayBonus = lerp(capB, [
      [0.3, 0.5],   // micro-cap: small bonus (unproven)
      [1, 0.8],     // approaching small-cap
      [3, 1.2],     // sweet spot: proven small-cap
      [10, 0.6],    // mid-cap
      [30, 0.2],
      [50, 0],
    ]);
    businessGrowth = clamp(businessGrowth + runwayBonus);
  }

  // ── 2. Cible des analystes ──
  //    Ecart entre le prix actuel et la cible consensus 12 mois.
  let analystTarget = 5;
  if (targetPrice > 0 && currentPrice > 0) {
    const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
    analystTarget = lerp(upside, [
      [-20, 1],    // les analystes voient une forte baisse
      [-10, 2],    // baisse attendue
      [-5, 3],     // leger recul
      [0, 4.5],    // au prix cible (neutre-bas, pas de hausse prevue)
      [3, 5.5],    // tres leger potentiel
      [8, 6.5],    // potentiel correct
      [15, 7.5],   // bon potentiel
      [25, 8.5],   // fort potentiel
      [40, 10],    // potentiel exceptionnel
    ]);
  }

  // ── 3. Sous-evaluation (DCF + Forward PE discount) ──
  //    Combine la valeur intrinseque DCF (si dispo) et l'amelioration
  //    du PE forward vs trailing (les profits vont augmenter).
  let dcfSub = 5;
  let forwardSub = 5;
  let hasValuationData = false;

  // DCF component
  if (avgIntrinsic > 0 && currentPrice > 0) {
    hasValuationData = true;
    const dcfUpside = ((avgIntrinsic - currentPrice) / currentPrice) * 100;
    dcfSub = lerp(dcfUpside, [
      [-30, 1],    // tres surevalue
      [-15, 2.5],  // surevalue
      [0, 4],      // a sa juste valeur
      [10, 6],     // legerement sous-evalue
      [20, 7.5],   // sous-evalue
      [35, 9],     // tres sous-evalue
      [50, 10],    // aubaine
    ]);
  }

  // Forward PE discount: si le forward PE est plus bas que le trailing,
  // les analystes anticipent une hausse des benefices.
  if (forwardPE > 0 && pe > 0) {
    hasValuationData = true;
    const peImprovement = ((pe - forwardPE) / pe) * 100;
    forwardSub = lerp(peImprovement, [
      [-20, 2],    // PE forward plus eleve = benefices prevus en baisse
      [0, 5],      // stable
      [10, 6.5],   // legere amelioration
      [20, 8],     // bonne amelioration
      [35, 9],     // forte amelioration
      [50, 10],    // transformation des benefices
    ]);
  }

  // Blend: DCF (60%) + Forward PE discount (40%) when both available
  let valuationDiscount: number;
  if (avgIntrinsic > 0 && forwardPE > 0) {
    valuationDiscount = dcfSub * 0.6 + forwardSub * 0.4;
  } else if (avgIntrinsic > 0) {
    valuationDiscount = dcfSub;
  } else if (forwardPE > 0) {
    valuationDiscount = forwardSub;
  } else {
    valuationDiscount = 5; // aucune donnee
  }

  // ── 4. Rendement en cash (FCF Yield) ──
  //    Free Cash Flow / Market Cap = combien de cash reel l'entreprise
  //    genere par dollar de capitalisation. Le Buffett ratio.
  let fcfYieldScore = 5;
  if (freeCashflow !== 0 && marketCap > 0) {
    const fcfYieldPct = (freeCashflow / marketCap) * 100;
    fcfYieldScore = lerp(fcfYieldPct, [
      [-5, 1],     // brule du cash
      [-1, 3],     // leger deficit
      [0, 4],      // seuil
      [2, 5.5],    // faible rendement
      [4, 7],      // correct
      [6, 8],      // bon
      [8, 9],      // tres bon
      [12, 10],    // exceptionnel
    ]);
  }

  // ── 5. Revenu de dividende (potentiel d'income) ──
  //    Le rendement passif pour l'investisseur. Le prix cible est deja capture
  //    dans le facteur 2 (analystTarget) — ici on isole le dividende
  //    pour eviter un double-comptage du upside de prix.
  //    Un dividende eleve + croissant = source de rendement stable.
  let totalReturnScore = 5;
  if (dividendYield > 0) {
    const divPct = dividendYield * 100;
    totalReturnScore = lerp(divPct, [
      [0.3, 5.5],   // dividende symbolique
      [1.0, 6],     // petit mais present
      [2.0, 7],     // rendement correct
      [3.0, 8],     // bon rendement
      [4.0, 8.5],   // tres bon
      [5.0, 9],     // excellent
      [6.5, 9.5],   // exceptionnel
      [9.0, 8],     // signal d'alarme — rendement trop eleve
      [12.0, 5],    // probablement insoutenable
    ]);
  }

  // ── 6. Efficacite du capital (ROE) ──
  //    Un ROE eleve signifie que l'entreprise utilise bien l'argent
  //    des actionnaires pour generer des profits. Buffett + Munger.
  let capitalEfficiency = 5;
  if (returnOnEquity !== 0) {
    const roePct = returnOnEquity * 100;
    capitalEfficiency = lerp(roePct, [
      [-10, 1],    // detruit de la valeur
      [0, 3],      // aucun retour
      [5, 4.5],    // faible
      [10, 6],     // correct
      [15, 7],     // bon
      [20, 8],     // tres bon
      [30, 9],     // excellent
      [40, 10],    // exceptionnel (rare)
    ]);
  }

  // Apply per-factor adjustments (Strict -1 / Normal 0 / Souple +1)
  if (adjustments) {
    businessGrowth = clamp(businessGrowth + (adjustments.businessGrowth ?? 0));
    analystTarget = clamp(analystTarget + (adjustments.analystTarget ?? 0));
    valuationDiscount = clamp(valuationDiscount + (adjustments.valuationDiscount ?? 0));
    fcfYieldScore = clamp(fcfYieldScore + (adjustments.fcfYield ?? 0));
    totalReturnScore = clamp(totalReturnScore + (adjustments.totalReturn ?? 0));
    capitalEfficiency = clamp(capitalEfficiency + (adjustments.capitalEfficiency ?? 0));
  }

  // Dynamic weight: if no valuation data, redistribute DCF weight to others
  const effectiveWeights = { ...DEFAULT_UPSIDE_WEIGHTS, ...customWeights };
  if (!hasValuationData) {
    const vdWeight = effectiveWeights.valuationDiscount;
    effectiveWeights.valuationDiscount = 0;
    // Redistribute proportionally to other factors
    const others = effectiveWeights.businessGrowth + effectiveWeights.analystTarget +
      effectiveWeights.fcfYield + effectiveWeights.totalReturn + effectiveWeights.capitalEfficiency;
    if (others > 0) {
      const factor = 1 + vdWeight / others;
      effectiveWeights.businessGrowth *= factor;
      effectiveWeights.analystTarget *= factor;
      effectiveWeights.fcfYield *= factor;
      effectiveWeights.totalReturn *= factor;
      effectiveWeights.capitalEfficiency *= factor;
    }
  }
  const wFinal = normalizeWeights(effectiveWeights);

  // Weighted total
  const total = clamp(
    businessGrowth * wFinal.businessGrowth +
    analystTarget * wFinal.analystTarget +
    valuationDiscount * wFinal.valuationDiscount +
    fcfYieldScore * wFinal.fcfYield +
    totalReturnScore * wFinal.totalReturn +
    capitalEfficiency * wFinal.capitalEfficiency
  );

  const rounded = rd(total);

  let label: string;
  let color: string;
  if (rounded >= 8) { label = 'Fort potentiel'; color = '#10b981'; }
  else if (rounded >= 6) { label = 'Bon potentiel'; color = '#22d3ee'; }
  else if (rounded >= 4) { label = 'Potentiel modere'; color = '#f59e0b'; }
  else if (rounded >= 2) { label = 'Faible potentiel'; color = '#f97316'; }
  else { label = 'Tres faible'; color = '#ef4444'; }

  return {
    businessGrowth: rd(businessGrowth),
    analystTarget: rd(analystTarget),
    valuationDiscount: rd(valuationDiscount),
    fcfYield: rd(fcfYieldScore),
    totalReturn: rd(totalReturnScore),
    capitalEfficiency: rd(capitalEfficiency),
    total: rounded,
    label,
    color,
  };
}

// ── Qualitative Narrative Generator ──────────────────────────────
// Generates a 2-4 sentence French mini-analysis for each stock,
// highlighting key strengths, weaknesses, and sector context.
// Rule-based (no AI), purely derived from the computed scores + inputs.

function generateNarrative(
  h: DualScoreHolding,
  safety: SafetyScoreBreakdown,
  upside: UpsideScoreBreakdown,
  quadrant: string,
  sectorBench: BenchmarkData,
): string {
  const parts: string[] = [];
  const capB = h.marketCap > 0 ? h.marketCap / 1e9 : 0;
  const sectorGr = sectorBench.gr_sales;

  // ── 1. Lead with quadrant personality ──
  if (quadrant === 'star') {
    parts.push('Titre solide avec un bon potentiel de hausse.');
  } else if (quadrant === 'safe') {
    parts.push('Titre defensif qui privilegie la stabilite.');
  } else if (quadrant === 'growth') {
    parts.push('Profil de croissance avec un risque plus eleve.');
  } else {
    parts.push('Titre a surveiller de pres.');
  }

  // ── 2. Key strengths (score >= 7.5) ──
  const strengthNames: string[] = [];
  if (safety.balanceSheetScore >= 7.5) strengthNames.push('bilan solide');
  if (safety.betaScore >= 7.5) strengthNames.push('prix stable');
  if (safety.profitabilityScore >= 7.5) strengthNames.push('bonne rentabilite');
  if (safety.valuationScore >= 7.5) strengthNames.push('prix raisonnable');
  if (safety.sizeScore >= 7.5) strengthNames.push('grande entreprise');
  if (safety.dividendScore >= 7.5) strengthNames.push('dividende attractif');
  if (upside.businessGrowth >= 7.5) strengthNames.push('forte croissance');
  if (upside.analystTarget >= 7.5) strengthNames.push('cible analystes favorable');
  if (upside.valuationDiscount >= 7.5) strengthNames.push('sous-evalue');
  if (upside.fcfYield >= 7.5) strengthNames.push('genere beaucoup de cash');
  if (upside.capitalEfficiency >= 7.5) strengthNames.push('capital bien utilise');

  const top = strengthNames.slice(0, 3);
  if (top.length === 1) {
    parts.push(`Point fort : ${top[0]}.`);
  } else if (top.length >= 2) {
    parts.push(`Points forts : ${top.slice(0, -1).join(', ')} et ${top[top.length - 1]}.`);
  }

  // ── 3. Key weaknesses (score <= 3.5), expressed as concerns ──
  const weakNames: string[] = [];
  if (safety.balanceSheetScore <= 3.5 && safety.balanceSheetScore > 0) weakNames.push('endettement eleve');
  if (safety.betaScore <= 3.5 && safety.betaScore > 0) weakNames.push('prix volatile');
  if (safety.profitabilityScore <= 3.5) weakNames.push('faible rentabilite');
  if (safety.valuationScore <= 3.5 && safety.valuationScore > 0) weakNames.push('valorisation elevee');
  if (safety.sizeScore <= 3.5 && safety.sizeScore > 0) weakNames.push('petite capitalisation');
  if (upside.businessGrowth <= 3.5 && upside.businessGrowth > 0) weakNames.push('croissance faible');
  if (upside.fcfYield <= 3.5 && upside.fcfYield > 0) weakNames.push('cash flow limite');
  if (upside.capitalEfficiency <= 3.5 && upside.capitalEfficiency > 0) weakNames.push('faible retour sur capitaux');

  const weak = weakNames.slice(0, 2);
  if (weak.length === 1) {
    parts.push(`Point a surveiller : ${weak[0]}.`);
  } else if (weak.length >= 2) {
    parts.push(`Points a surveiller : ${weak[0]} et ${weak[1]}.`);
  }

  // ── 4. Sector & growth context ──
  if (capB > 0 && capB < 10 && h.revenueGrowth > 0.10 && sectorGr > 10) {
    parts.push(`Small-cap dans un secteur en expansion (${sectorBench.name}, +${sectorGr}%/an) — piste de croissance importante.`);
  } else if (capB > 0 && capB < 10 && h.revenueGrowth > 0.10) {
    parts.push(`Petite entreprise en forte croissance (revenus +${Math.round(h.revenueGrowth * 100)}%).`);
  } else if (sectorGr > 15 && capB < 50) {
    parts.push(`Secteur porteur (${sectorBench.name}, +${sectorGr}%/an).`);
  } else if (capB >= 200) {
    parts.push('Mega-cap — grande liquidite et diversification.');
  } else if (capB >= 50) {
    parts.push('Grande entreprise — bonne stabilite.');
  }

  // ── 5. Dividend context (when significant) ──
  if (h.dividendYield > 0.035) {
    parts.push(`Dividende de ${(h.dividendYield * 100).toFixed(1)}% qui ajoute un coussin de revenu.`);
  }

  // ── 6. Red flag ──
  if (safety.redFlag) {
    parts.push(`Attention : ${safety.redFlag}.`);
  }

  return parts.join(' ');
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
  revenueGrowth: number;
  freeCashflow: number;
  returnOnEquity: number;
  forwardPE: number;
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

    // Sector growth rate from benchmarks (for growth-adjusted size scoring)
    const sectorGrowthRate = bench.gr_sales / 100; // e.g. 12% → 0.12

    const safety = calculateSafetyScore({
      beta: h.beta,
      dividendYield: h.dividendYield,
      pe: h.pe,
      eps: h.eps,
      profitMargins: h.profitMargins,
      debtToEquity: h.debtToEquity,
      currentRatio: h.currentRatio,
      earningsGrowth: h.earningsGrowth,
      revenueGrowth: h.revenueGrowth,
      marketCap: h.marketCap,
      sector: h.sector,
      sectorGrowthRate,
      week52High: h.week52High,
      week52Low: h.week52Low,
      currentPrice: h.currentPrice,
    }, weights?.safety, weights?.safetyAdj);

    const upside = calculateUpsideScore({
      currentPrice: h.currentPrice,
      targetPrice: h.targetPrice,
      avgIntrinsic: val?.avgIntrinsic ?? 0,
      pe: h.pe,
      forwardPE: h.forwardPE,
      earningsGrowth: h.earningsGrowth,
      revenueGrowth: h.revenueGrowth,
      dividendYield: h.dividendYield,
      freeCashflow: h.freeCashflow,
      marketCap: h.marketCap,
      returnOnEquity: h.returnOnEquity,
      estimatedGainPercent: h.estimatedGainPercent,
    }, weights?.upside, weights?.upsideAdj);

    let quadrant: 'star' | 'safe' | 'growth' | 'watch';
    if (safety.total >= 6 && upside.total >= 6) quadrant = 'star';
    else if (safety.total >= 6) quadrant = 'safe';
    else if (upside.total >= 6) quadrant = 'growth';
    else quadrant = 'watch';

    const narrative = generateNarrative(h, safety, upside, quadrant, bench);

    scores.push({
      symbol: h.symbol,
      companyName: h.companyName,
      weight: h.weight,
      safety,
      upside,
      rank: 0,
      quadrant,
      confidence,
      narrative,
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

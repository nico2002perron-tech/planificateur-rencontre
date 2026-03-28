/**
 * stock-scorer.ts
 *
 * Pure scoring module for portfolio stock ranking.
 * No server dependencies — safe for use in any environment.
 *
 * Composite score combines four dimensions:
 *   Type Priority (25%) | Position Rank (20%) | Sector Fit (30%) | Fundamentals (25%)
 *   When fundamentals data is unavailable the weights redistribute:
 *   Type Priority (35%) | Position Rank (25%) | Sector Fit (40%)
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SectorConfig {
  sector: string;
  weight_pct: number;
  nb_titles: number;
}

export interface CachedFundamentals {
  pe_ratio?: number | null;
  dividend_yield?: number | null;
  market_cap?: number | null;
}

export interface StockInput {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  stock_type: 'obligatoire' | 'variable';
  position: number;
}

export interface StockScore {
  stockId: string;
  symbol: string;
  composite: number;
  typePriority: number;
  positionRank: number;
  sectorFit: number;
  fundamentals: number | null;
  recommendation: 'top' | 'bon' | 'neutre' | 'faible';
}

// ---------------------------------------------------------------------------
// Dimension scorers (each returns 0-10)
// ---------------------------------------------------------------------------

/** obligatoire = 10, variable = 5 */
function calcTypePriority(stockType: StockInput['stock_type']): number {
  return stockType === 'obligatoire' ? 10 : 5;
}

/** Position 1 = 10, position 2 = 9, ..., position 10+ = max(0, 11 - position) */
function calcPositionRank(position: number): number {
  return Math.max(0, 11 - position);
}

/** Sector present in profile config: 5 + min(weight_pct/5, 5). Otherwise 0. */
function calcSectorFit(sector: string, sectorConfigs: SectorConfig[]): number {
  const match = sectorConfigs.find(
    (sc) => sc.sector.toLowerCase() === sector.toLowerCase(),
  );
  if (!match) return 0;
  return 5 + Math.min(match.weight_pct / 5, 5);
}

/**
 * Fundamentals score derived from cached price data.
 * Returns null when no data is available.
 *
 * P/E scoring:
 *   5-25 (healthy)  -> 7-10 (linear interpolation, lower is better)
 *   >40  (expensive)-> 3
 *   25-40           -> linear 7 down to 3
 *   <0   (negative) -> 5 (ambiguous — could be growth or distress)
 *   null/undefined  -> contributes 5 (neutral baseline)
 *
 * Bonuses:
 *   dividend_yield > 0 -> +min(yield * 1.5, 4)
 *   market_cap > 10B   -> +1 stability
 *
 * Final result clamped to [0, 10].
 */
function calcFundamentals(cached?: CachedFundamentals | null): number | null {
  if (!cached) return null;

  // If every field is null/undefined, treat as no data
  const { pe_ratio, dividend_yield, market_cap } = cached;
  if (pe_ratio == null && dividend_yield == null && market_cap == null) {
    return null;
  }

  let score = 0;

  // --- P/E component (0-10 base) ---
  if (pe_ratio == null) {
    score = 5; // neutral when unknown
  } else if (pe_ratio < 0) {
    score = 5; // negative earnings — ambiguous
  } else if (pe_ratio >= 5 && pe_ratio <= 25) {
    // Healthy range: lower P/E is better. 5 -> 10, 25 -> 7
    score = 10 - ((pe_ratio - 5) / 20) * 3;
  } else if (pe_ratio > 25 && pe_ratio <= 40) {
    // Getting expensive: 25 -> 7, 40 -> 3
    score = 7 - ((pe_ratio - 25) / 15) * 4;
  } else if (pe_ratio > 40) {
    score = 3; // very expensive
  } else {
    // pe_ratio between 0 and 5 — very cheap, treat as top score
    score = 10;
  }

  // --- Dividend yield bonus ---
  if (dividend_yield != null && dividend_yield > 0) {
    score += Math.min(dividend_yield * 1.5, 4);
  }

  // --- Large-cap stability bonus ---
  if (market_cap != null && market_cap > 10_000_000_000) {
    score += 1;
  }

  return Math.min(10, Math.max(0, score));
}

// ---------------------------------------------------------------------------
// Recommendation label
// ---------------------------------------------------------------------------

function toRecommendation(composite: number): StockScore['recommendation'] {
  if (composite >= 8.0) return 'top';
  if (composite >= 6.0) return 'bon';
  if (composite >= 4.0) return 'neutre';
  return 'faible';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a single stock across all four dimensions and produce a composite.
 *
 * @param stock         - The stock to evaluate
 * @param sectorConfigs - Profile sector allocations
 * @param cached        - Optional cached fundamentals for the stock
 */
export function scoreStock(
  stock: StockInput,
  sectorConfigs: SectorConfig[],
  cached?: CachedFundamentals | null,
): StockScore {
  const typePriority = calcTypePriority(stock.stock_type);
  const positionRank = calcPositionRank(stock.position);
  const sectorFit = calcSectorFit(stock.sector, sectorConfigs);
  const fundamentals = calcFundamentals(cached);

  let composite: number;

  if (fundamentals != null) {
    // Full weighting: Type 25% + Position 20% + Sector 30% + Fundamentals 25%
    composite =
      typePriority * 0.25 +
      positionRank * 0.20 +
      sectorFit * 0.30 +
      fundamentals * 0.25;
  } else {
    // No fundamentals: Type 35% + Position 25% + Sector 40%
    composite =
      typePriority * 0.35 +
      positionRank * 0.25 +
      sectorFit * 0.40;
  }

  // Round to two decimal places for readability
  composite = Math.round(composite * 100) / 100;

  return {
    stockId: stock.id,
    symbol: stock.symbol,
    composite,
    typePriority,
    positionRank,
    sectorFit,
    fundamentals,
    recommendation: toRecommendation(composite),
  };
}

/**
 * Score an entire universe of stocks and return results sorted by composite descending.
 *
 * @param stocks       - Array of stocks to evaluate
 * @param sectorConfigs - Profile sector allocations
 * @param cachedMap    - Optional map of symbol -> cached fundamentals
 */
export function scoreUniverse(
  stocks: StockInput[],
  sectorConfigs: SectorConfig[],
  cachedMap?: Map<string, CachedFundamentals>,
): StockScore[] {
  return stocks
    .map((stock) => {
      const cached = cachedMap?.get(stock.symbol) ?? null;
      return scoreStock(stock, sectorConfigs, cached);
    })
    .sort((a, b) => b.composite - a.composite);
}

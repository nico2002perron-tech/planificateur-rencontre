/**
 * Benchmark comparison data — builds normalized (base 100) growth curves
 * for portfolio vs selected market indices over 10 years.
 */

import type { YahooChartPoint } from '@/lib/yahoo/client';

// ─── Types ───────────────────────────────────────────────────────

export interface BenchmarkIndex {
  key: string;        // e.g. 'sp500', 'tsx'
  label: string;      // e.g. 'S&P 500'
  symbol: string;     // Yahoo symbol: ^GSPC, ^GSPTSE
  color: string;      // Chart line color
}

export interface GrowthPoint {
  date: string;       // YYYY-MM-DD
  value: number;      // Normalized value (starts at 100)
}

export interface BenchmarkSeries {
  key: string;
  label: string;
  color: string;
  points: GrowthPoint[];
  finalValue: number; // Last normalized value (e.g. 234.5 = +134.5%)
}

export interface BenchmarkComparisonData {
  portfolio: BenchmarkSeries;
  indices: BenchmarkSeries[];
  startDate: string;
  endDate: string;
  /** Pre-computed text for the PDF */
  summaryText: string;
}

// ─── Available Benchmarks ────────────────────────────────────────

export const AVAILABLE_BENCHMARKS: BenchmarkIndex[] = [
  { key: 'sp500', label: 'S&P 500', symbol: '^GSPC', color: '#ef4444' },
  { key: 'tsx', label: 'S&P/TSX', symbol: '^GSPTSE', color: '#f59e0b' },
];

// ─── Helpers ─────────────────────────────────────────────────────

/** Normalize an array of chart points to base 100 from the first value */
function normalizeToBase100(points: YahooChartPoint[]): GrowthPoint[] {
  if (points.length === 0) return [];
  const base = points[0].adjClose;
  if (base <= 0) return [];
  return points.map((p) => ({
    date: p.date,
    value: Math.round(((p.adjClose / base) * 100) * 100) / 100,
  }));
}

/**
 * Align all series to a common set of dates (intersection).
 * This ensures all lines start and end at the same point.
 */
function alignDates(
  series: { key: string; points: GrowthPoint[] }[]
): Map<string, Set<string>> {
  if (series.length === 0) return new Map();

  // Find common dates across all series
  const dateSets = series.map((s) => new Set(s.points.map((p) => p.date)));
  const commonDates = new Set(
    [...dateSets[0]].filter((d) => dateSets.every((ds) => ds.has(d)))
  );

  const result = new Map<string, Set<string>>();
  result.set('common', commonDates);
  return result;
}

// ─── Main Builder ────────────────────────────────────────────────

/**
 * Build benchmark comparison data from raw Yahoo chart data.
 *
 * @param holdingWeights Array of { symbol, weight } — portfolio composition
 * @param holdingHistories Map of symbol → monthly adjusted close points
 * @param indexHistories Map of index key → monthly adjusted close points
 * @param selectedBenchmarks Which benchmarks the user selected
 */
export function buildBenchmarkComparison(
  holdingWeights: { symbol: string; weight: number }[],
  holdingHistories: Record<string, YahooChartPoint[]>,
  indexHistories: Record<string, YahooChartPoint[]>,
  selectedBenchmarks: BenchmarkIndex[]
): BenchmarkComparisonData | null {
  // ── 1. Build portfolio monthly returns using weighted holdings ──
  // Find common date range across all holdings that have data
  const holdingsWithData = holdingWeights.filter(
    (h) => (holdingHistories[h.symbol]?.length ?? 0) > 6
  );
  if (holdingsWithData.length === 0) return null;

  // Build date → price maps for each holding
  const holdingDateMaps: Record<string, Map<string, number>> = {};
  for (const h of holdingsWithData) {
    const pts = holdingHistories[h.symbol];
    const map = new Map<string, number>();
    for (const p of pts) map.set(p.date, p.adjClose);
    holdingDateMaps[h.symbol] = map;
  }

  // Get dates where ALL holdings have data
  const allDateSets = holdingsWithData.map(
    (h) => new Set(holdingHistories[h.symbol].map((p) => p.date))
  );
  let commonHoldingDates = [...allDateSets[0]].filter((d) =>
    allDateSets.every((ds) => ds.has(d))
  );
  commonHoldingDates.sort();

  if (commonHoldingDates.length < 6) return null;

  // Re-normalize weights for holdings that have data
  const totalWeight = holdingsWithData.reduce((s, h) => s + h.weight, 0);
  const normalizedWeights = holdingsWithData.map((h) => ({
    symbol: h.symbol,
    weight: totalWeight > 0 ? h.weight / totalWeight : 1 / holdingsWithData.length,
  }));

  // Build portfolio growth curve (base 100)
  // For each date, compute weighted portfolio value
  const basePrices: Record<string, number> = {};
  for (const h of normalizedWeights) {
    basePrices[h.symbol] = holdingDateMaps[h.symbol].get(commonHoldingDates[0]) || 1;
  }

  const portfolioPoints: GrowthPoint[] = commonHoldingDates.map((date) => {
    let portfolioValue = 0;
    for (const h of normalizedWeights) {
      const price = holdingDateMaps[h.symbol].get(date) || basePrices[h.symbol];
      const basePrice = basePrices[h.symbol];
      // Each holding contributes: weight × (currentPrice / basePrice)
      portfolioValue += h.weight * (price / basePrice);
    }
    return {
      date,
      value: Math.round(portfolioValue * 100 * 100) / 100, // base 100
    };
  });

  // ── 2. Build index curves ──
  const indexSeries: BenchmarkSeries[] = [];
  for (const bench of selectedBenchmarks) {
    const rawPoints = indexHistories[bench.key];
    if (!rawPoints || rawPoints.length < 6) continue;
    const normalized = normalizeToBase100(rawPoints);
    if (normalized.length === 0) continue;
    indexSeries.push({
      key: bench.key,
      label: bench.label,
      color: bench.color,
      points: normalized,
      finalValue: normalized[normalized.length - 1].value,
    });
  }

  if (indexSeries.length === 0) return null;

  // ── 3. Align all series to common dates ──
  const allSeries = [
    { key: 'portfolio', points: portfolioPoints },
    ...indexSeries.map((s) => ({ key: s.key, points: s.points })),
  ];
  const commonResult = alignDates(allSeries);
  const commonDates = commonResult.get('common');
  if (!commonDates || commonDates.size < 6) {
    // Fallback: use portfolio dates and interpolate indices
    // Just filter each index to dates that exist in portfolio
    const portfolioDates = new Set(portfolioPoints.map((p) => p.date));
    for (const idx of indexSeries) {
      idx.points = idx.points.filter((p) => portfolioDates.has(p.date));
      if (idx.points.length > 0) {
        idx.finalValue = idx.points[idx.points.length - 1].value;
      }
    }
  } else {
    // Filter all series to common dates & renormalize to base 100
    const sortedCommon = [...commonDates].sort();
    const filterAndRenormalize = (points: GrowthPoint[]): GrowthPoint[] => {
      const filtered = points.filter((p) => commonDates.has(p.date));
      if (filtered.length === 0) return [];
      const base = filtered[0].value;
      return filtered.map((p) => ({
        date: p.date,
        value: Math.round(((p.value / base) * 100) * 100) / 100,
      }));
    };

    const newPortfolioPoints = filterAndRenormalize(portfolioPoints);
    portfolioPoints.length = 0;
    portfolioPoints.push(...newPortfolioPoints);

    for (const idx of indexSeries) {
      const newPoints = filterAndRenormalize(idx.points);
      idx.points = newPoints;
      idx.finalValue = newPoints.length > 0 ? newPoints[newPoints.length - 1].value : 100;
    }
  }

  const portfolioFinal = portfolioPoints.length > 0
    ? portfolioPoints[portfolioPoints.length - 1].value
    : 100;

  const portfolioSeries: BenchmarkSeries = {
    key: 'portfolio',
    label: 'Portefeuille',
    color: '#00b4d8', // brand cyan
    points: portfolioPoints,
    finalValue: portfolioFinal,
  };

  // ── 4. Build summary text ──
  const startDate = portfolioPoints[0]?.date || '';
  const endDate = portfolioPoints[portfolioPoints.length - 1]?.date || '';
  const startYear = startDate.substring(0, 4);
  const endYear = endDate.substring(0, 4);

  let summaryText = `A titre illustratif, un investissement de 100 $ dans ce portefeuille depuis ${startYear} aurait atteint une valeur de ${portfolioFinal.toFixed(0)} $`;
  for (const idx of indexSeries) {
    summaryText += `, comparativement a ${idx.finalValue.toFixed(0)} $ pour le ${idx.label}`;
  }
  summaryText += ` en date de ${endYear}. `;
  summaryText += 'Ces resultats sont bases sur les rendements historiques ajustes (total return) et ne garantissent pas les rendements futurs.';

  return {
    portfolio: portfolioSeries,
    indices: indexSeries,
    startDate,
    endDate,
    summaryText,
  };
}

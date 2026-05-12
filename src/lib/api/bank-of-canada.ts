/**
 * Bank of Canada Valet API — Government bond yields
 * Free, no API key required.
 * https://www.bankofcanada.ca/valet/docs
 */

import 'server-only';

const VALET_BASE = 'https://www.bankofcanada.ca/valet';
const FETCH_TIMEOUT_MS = 10_000;

// ── Series codes ────────────────────────────────────────────────────────────

export const BOC_SERIES = {
  OVERNIGHT: 'V39079',
  CA_2Y: 'BD.CDN.2YR.DQ.YLD',
  CA_5Y: 'BD.CDN.5YR.DQ.YLD',
  CA_10Y: 'BD.CDN.10YR.DQ.YLD',
  CA_30Y: 'BD.CDN.LONG.DQ.YLD',
} as const;

export type BocSeriesKey = keyof typeof BOC_SERIES;

// All yield curve series (excludes overnight which is a rate, not yield)
const YIELD_CURVE_SERIES = [
  BOC_SERIES.CA_2Y,
  BOC_SERIES.CA_5Y,
  BOC_SERIES.CA_10Y,
  BOC_SERIES.CA_30Y,
] as const;

const ALL_SERIES = [
  BOC_SERIES.OVERNIGHT,
  ...YIELD_CURVE_SERIES,
] as const;

// ── Types ───────────────────────────────────────────────────────────────────

export interface BocYieldPoint {
  term: string;    // '2Y', '5Y', '10Y', '30Y', 'OVERNIGHT'
  years: number;   // 0 for overnight, 2, 5, 10, 30
  yield: number;   // percentage (e.g. 3.47)
}

export interface BocYieldCurve {
  date: string;              // ISO date YYYY-MM-DD
  overnight: number | null;  // Bank of Canada overnight rate
  points: BocYieldPoint[];   // yield curve points sorted by term
}

interface ValetObservation {
  d: string;
  [seriesCode: string]: { v: string } | string;
}

interface ValetResponse {
  observations: ValetObservation[];
}

// ── Fetch helper ────────────────────────────────────────────────────────────

async function valetFetch(seriesCodes: string[], recent = 1): Promise<ValetResponse> {
  const url = `${VALET_BASE}/observations/${seriesCodes.join(',')}/json?recent=${recent}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const res = await fetch(url, {
    signal: controller.signal,
    next: { revalidate: 3600 }, // cache 1h at Next.js level
  }).finally(() => clearTimeout(timer));

  if (!res.ok) {
    throw new Error(`Bank of Canada API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ── Map series code to term info ────────────────────────────────────────────

function seriesToTerm(code: string): { term: string; years: number } | null {
  switch (code) {
    case BOC_SERIES.OVERNIGHT: return { term: 'OVERNIGHT', years: 0 };
    case BOC_SERIES.CA_2Y: return { term: '2Y', years: 2 };
    case BOC_SERIES.CA_5Y: return { term: '5Y', years: 5 };
    case BOC_SERIES.CA_10Y: return { term: '10Y', years: 10 };
    case BOC_SERIES.CA_30Y: return { term: '30Y', years: 30 };
    default: return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch the latest Canadian government yield curve + overnight rate.
 */
export async function getYieldCurve(): Promise<BocYieldCurve | null> {
  try {
    const data = await valetFetch([...ALL_SERIES], 1);
    if (!data.observations || data.observations.length === 0) return null;

    const obs = data.observations[data.observations.length - 1];
    const points: BocYieldPoint[] = [];
    let overnight: number | null = null;

    for (const code of ALL_SERIES) {
      const raw = obs[code];
      if (!raw || typeof raw === 'string') continue;
      const val = parseFloat(raw.v);
      if (!isFinite(val)) continue;

      const info = seriesToTerm(code);
      if (!info) continue;

      if (info.term === 'OVERNIGHT') {
        overnight = val;
      } else {
        points.push({ term: info.term, years: info.years, yield: val });
      }
    }

    points.sort((a, b) => a.years - b.years);

    return { date: obs.d, overnight, points };
  } catch (e) {
    console.error('Bank of Canada yield curve error:', e);
    return null;
  }
}

/**
 * Fetch historical yields for a specific term (recent N observations).
 */
export async function getHistoricalYields(
  seriesKey: BocSeriesKey,
  recent = 30
): Promise<{ date: string; yield: number }[]> {
  try {
    const code = BOC_SERIES[seriesKey];
    const data = await valetFetch([code], recent);
    if (!data.observations) return [];

    return data.observations
      .map((obs) => {
        const raw = obs[code];
        if (!raw || typeof raw === 'string') return null;
        const val = parseFloat(raw.v);
        if (!isFinite(val)) return null;
        return { date: obs.d, yield: val };
      })
      .filter((x): x is { date: string; yield: number } => x !== null);
  } catch (e) {
    console.error(`Bank of Canada historical yields error (${seriesKey}):`, e);
    return [];
  }
}

/**
 * Interpolate a yield for a given maturity in years from the yield curve.
 * Uses linear interpolation between known points.
 */
export function interpolateYield(curve: BocYieldPoint[], maturityYears: number): number | null {
  if (curve.length === 0) return null;
  if (maturityYears <= curve[0].years) return curve[0].yield;
  if (maturityYears >= curve[curve.length - 1].years) return curve[curve.length - 1].yield;

  for (let i = 0; i < curve.length - 1; i++) {
    if (maturityYears >= curve[i].years && maturityYears <= curve[i + 1].years) {
      const t = (maturityYears - curve[i].years) / (curve[i + 1].years - curve[i].years);
      return curve[i].yield + t * (curve[i + 1].yield - curve[i].yield);
    }
  }

  return null;
}

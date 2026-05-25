import 'server-only';
import { yahooFetch, toYahooSymbol } from '@/lib/yahoo/client';

/**
 * Batch holding-metadata resolver for the price-targets PDF.
 *
 * One Yahoo Finance `assetProfile` call returns BOTH the GICS-style sector
 * (mapped to the app's internal codes, as in /api/models/stock-sector) and the
 * company's business summary (English) — reused for the sector donut and the
 * "Descriptions des titres" section. Failures are silent.
 */

const YAHOO_SECTOR_MAP: Record<string, string> = {
  'Technology':              'TECHNOLOGY',
  'Healthcare':              'HEALTHCARE',
  'Financial Services':      'FINANCIALS',
  'Energy':                  'ENERGY',
  'Basic Materials':         'MATERIALS',
  'Industrials':             'INDUSTRIALS',
  'Consumer Cyclical':       'CONSUMER_DISC',
  'Consumer Defensive':      'CONSUMER_STAPLES',
  'Utilities':               'UTILITIES',
  'Real Estate':             'REAL_ESTATE',
  'Communication Services':  'TELECOM',
};

export interface HoldingMeta {
  sector: string | null;   // internal sector code, or null
  summary: string | null;  // English business summary, or null
}

// Process-level cache: this metadata rarely changes.
const cache = new Map<string, HoldingMeta>();

/** Strip a Canadian exchange suffix to reach the underlying US ticker. */
function toUnderlyingUS(symbol: string): string | null {
  const m = symbol.match(/^([A-Z]{1,5})(?:[.-][A-Z]{1,3})?\.(TO|V|NE)$/i);
  return m ? m[1].toUpperCase() : null;
}

async function fetchProfile(ySym: string): Promise<{ sectorRaw: string | null; summary: string | null }> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=assetProfile`;
  const res = await yahooFetch(url);
  if (!res.ok) return { sectorRaw: null, summary: null };
  const json = await res.json();
  const p = json?.quoteSummary?.result?.[0]?.assetProfile;
  return { sectorRaw: p?.sector ?? null, summary: p?.longBusinessSummary ?? null };
}

async function resolveMeta(symbol: string): Promise<HoldingMeta> {
  if (cache.has(symbol)) return cache.get(symbol)!;
  let meta: HoldingMeta = { sector: null, summary: null };
  try {
    let p = await fetchProfile(toYahooSymbol(symbol));
    if (!p.sectorRaw && !p.summary) {
      const us = toUnderlyingUS(symbol);
      if (us) p = await fetchProfile(us);
    }
    meta = {
      sector: p.sectorRaw ? (YAHOO_SECTOR_MAP[p.sectorRaw] ?? null) : null,
      summary: p.summary,
    };
  } catch {
    meta = { sector: null, summary: null };
  }
  cache.set(symbol, meta);
  return meta;
}

/** Resolve sector + summary for a list of symbols in parallel. */
export async function fetchHoldingMeta(symbols: string[]): Promise<Record<string, HoldingMeta>> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const out: Record<string, HoldingMeta> = {};
  await Promise.all(
    unique.map(async (sym) => {
      out[sym] = await resolveMeta(sym);
    })
  );
  return out;
}

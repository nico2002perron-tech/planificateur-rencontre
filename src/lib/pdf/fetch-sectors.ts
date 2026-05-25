import 'server-only';
import { yahooFetch, toYahooSymbol } from '@/lib/yahoo/client';

/**
 * Batch sector resolver for the price-targets PDF.
 *
 * Mirrors /api/models/stock-sector: pulls the GICS-style sector from Yahoo
 * Finance assetProfile and maps it to the app's internal sector codes. Used
 * server-side to enrich equity/ETF holdings before rendering the sector donut.
 * Failures are silent — a symbol with no sector is simply omitted.
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

// Process-level cache: sectors rarely change, so reuse across requests.
const cache = new Map<string, string | null>();

/** Strip a Canadian exchange suffix to reach the underlying US ticker. */
function toUnderlyingUS(symbol: string): string | null {
  const m = symbol.match(/^([A-Z]{1,5})(?:[.-][A-Z]{1,3})?\.(TO|V|NE)$/i);
  return m ? m[1].toUpperCase() : null;
}

async function fetchProfileSector(ySym: string): Promise<string | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=assetProfile`;
  const res = await yahooFetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.quoteSummary?.result?.[0]?.assetProfile?.sector ?? null;
}

async function resolveSector(symbol: string): Promise<string | null> {
  if (cache.has(symbol)) return cache.get(symbol) ?? null;
  let sector: string | null = null;
  try {
    let raw = await fetchProfileSector(toYahooSymbol(symbol));
    if (!raw) {
      const us = toUnderlyingUS(symbol);
      if (us) raw = await fetchProfileSector(us);
    }
    sector = raw ? (YAHOO_SECTOR_MAP[raw] ?? null) : null;
  } catch {
    sector = null;
  }
  cache.set(symbol, sector);
  return sector;
}

/**
 * Resolve sectors for a list of symbols in parallel.
 * Returns a map of symbol → internal sector code (only entries that resolved).
 */
export async function fetchSectors(symbols: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async (sym) => {
      const s = await resolveSector(sym);
      if (s) out[sym] = s;
    })
  );
  return out;
}

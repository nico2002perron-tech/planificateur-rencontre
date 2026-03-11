import 'server-only';
import type {
  FMPQuote,
  FMPProfile,
  FMPHistoricalPrice,
  FMPPriceTarget,
  FMPSearchResult,
  FMPSectorPerformance,
  FMPPriceTargetConsensus,
} from './types';

const API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/stable';

// ─── Generic fetch helper for /stable/ API ──────────────────────

async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) throw new Error('FMP_API_KEY is not configured');

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('apikey', API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  // FMP returns error strings for premium endpoints instead of JSON errors
  if (text.startsWith('Premium') || text.includes('not available under your current subscription')) {
    return [] as unknown as T;
  }
  if (text.startsWith('{') && text.includes('Error Message')) {
    return [] as unknown as T;
  }

  try {
    return JSON.parse(text);
  } catch {
    return [] as unknown as T;
  }
}

// ─── Quote: /stable/quote?symbol=AAPL ───────────────────────────
// Free plan: single US symbol only, no batch, no .TO

export async function getQuote(symbol: string): Promise<FMPQuote | null> {
  try {
    const data = await fmpFetch<FMPQuote[]>('/quote', { symbol });
    if (Array.isArray(data) && data.length > 0) return data[0];
  } catch { /* fallback below */ }

  // Fallback: use profile endpoint (works for CA .TO stocks too)
  return getQuoteFromProfile(symbol);
}

export async function getQuotes(symbols: string[]): Promise<FMPQuote[]> {
  if (symbols.length === 0) return [];

  // /stable/ doesn't support batch quotes on free plan
  // Fetch one by one in parallel
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        return await getQuote(symbol);
      } catch {
        return null;
      }
    })
  );

  return results.filter((q): q is FMPQuote => q !== null);
}

// ─── Profile: /stable/profile?symbol=RY.TO ──────────────────────
// Works for both US and CA stocks on free plan

export async function getProfile(symbol: string): Promise<FMPProfile | null> {
  const data = await fmpFetch<FMPProfile[]>('/profile', { symbol });
  if (Array.isArray(data) && data.length > 0) return data[0];
  return null;
}

// Helper: build a FMPQuote from profile data (for .TO stocks)
async function getQuoteFromProfile(symbol: string): Promise<FMPQuote | null> {
  const profile = await getProfile(symbol);
  if (!profile) return null;

  return {
    symbol: profile.symbol,
    name: profile.companyName,
    price: profile.price,
    changesPercentage: profile.changes ? (profile.changes / (profile.price - profile.changes)) * 100 : 0,
    change: profile.changes || 0,
    dayLow: 0,
    dayHigh: 0,
    yearHigh: 0,
    yearLow: 0,
    marketCap: profile.mktCap,
    priceAvg50: 0,
    priceAvg200: 0,
    volume: 0,
    avgVolume: 0,
    exchange: profile.exchangeShortName || profile.exchange,
    open: 0,
    previousClose: 0,
    eps: 0,
    pe: 0,
    timestamp: Date.now(),
  };
}

// ─── Historical: /stable/historical-price-eod/full ──────────────
// Free plan: US only. CA (.TO) returns premium error.

export async function getHistoricalPrices(
  symbol: string,
  from?: string,
  to?: string
): Promise<FMPHistoricalPrice[]> {
  const params: Record<string, string> = { symbol };
  if (from) params.from = from;
  if (to) params.to = to;

  const data = await fmpFetch<FMPHistoricalPrice[]>(
    '/historical-price-eod/full',
    params
  );

  // Stable API returns flat array (not nested { historical: [...] })
  if (Array.isArray(data)) return data;
  // Handle legacy nested format just in case
  if (data && typeof data === 'object' && 'historical' in data) {
    return (data as { historical: FMPHistoricalPrice[] }).historical || [];
  }
  return [];
}

// ─── Price Targets: /stable/price-target-consensus ──────────────
// Free plan: US only. CA (.TO) returns premium error.

export async function getPriceTargets(symbol: string): Promise<FMPPriceTarget[]> {
  // Legacy endpoint — return empty, use getTargetConsensus instead
  return [];
}

export async function getTargetConsensus(symbol: string): Promise<FMPPriceTargetConsensus | null> {
  const data = await fmpFetch<FMPPriceTargetConsensus[]>('/price-target-consensus', { symbol });
  if (Array.isArray(data) && data.length > 0) return data[0];
  return null;
}

// ─── Search: /stable/search-symbol + /stable/search-name ────────
// FMP stable API split search into two endpoints (search-symbol for ticker, search-name for company name)

export async function searchSymbol(query: string): Promise<FMPSearchResult[]> {
  // Run both searches in parallel and merge results
  const [bySymbol, byName] = await Promise.all([
    fmpFetch<{ symbol: string; name: string; currency: string; exchangeFullName: string; exchange: string }[]>(
      '/search-symbol', { query, limit: '6' }
    ).catch(() => [] as { symbol: string; name: string; currency: string; exchangeFullName: string; exchange: string }[]),
    fmpFetch<{ symbol: string; name: string; currency: string; exchangeFullName: string; exchange: string }[]>(
      '/search-name', { query, limit: '6' }
    ).catch(() => [] as { symbol: string; name: string; currency: string; exchangeFullName: string; exchange: string }[]),
  ]);

  // Merge and deduplicate by symbol
  const seen = new Set<string>();
  const results: FMPSearchResult[] = [];

  for (const item of [...(Array.isArray(bySymbol) ? bySymbol : []), ...(Array.isArray(byName) ? byName : [])]) {
    if (!item?.symbol || seen.has(item.symbol)) continue;
    seen.add(item.symbol);
    results.push({
      symbol: item.symbol,
      name: item.name,
      currency: item.currency || '',
      stockExchange: item.exchangeFullName || '',
      exchangeShortName: item.exchange || '',
    });
  }

  return results.slice(0, 10);
}

// ─── Sector Performance ─────────────────────────────────────────

export async function getSectorPerformance(): Promise<FMPSectorPerformance[]> {
  const data = await fmpFetch<FMPSectorPerformance[]>('/sector-performance');
  return Array.isArray(data) ? data : [];
}

// ─── Exchange Rate ──────────────────────────────────────────────

export async function getExchangeRate(from: string, to: string): Promise<number> {
  try {
    const data = await fmpFetch<{ rate: number }[]>(`/fx`, { symbol: `${from}${to}` });
    if (Array.isArray(data) && data.length > 0) return data[0].rate || 0;
  } catch { /* */ }
  return 0;
}

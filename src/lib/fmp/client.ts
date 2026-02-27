import 'server-only';
import { FMP_BASE_URL } from '@/lib/utils/constants';
import type {
  FMPQuote,
  FMPProfile,
  FMPHistoricalPrice,
  FMPPriceTarget,
  FMPSearchResult,
  FMPSectorPerformance,
} from './types';

const API_KEY = process.env.FMP_API_KEY;

async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) throw new Error('FMP_API_KEY is not configured');

  const url = new URL(`${FMP_BASE_URL}${endpoint}`);
  url.searchParams.set('apikey', API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getQuote(symbol: string): Promise<FMPQuote | null> {
  const data = await fmpFetch<FMPQuote[]>(`/quote/${encodeURIComponent(symbol)}`);
  return data?.[0] || null;
}

export async function getQuotes(symbols: string[]): Promise<FMPQuote[]> {
  if (symbols.length === 0) return [];
  const joined = symbols.join(',');
  return fmpFetch<FMPQuote[]>(`/quote/${encodeURIComponent(joined)}`);
}

export async function getProfile(symbol: string): Promise<FMPProfile | null> {
  const data = await fmpFetch<FMPProfile[]>(`/profile/${encodeURIComponent(symbol)}`);
  return data?.[0] || null;
}

export async function getHistoricalPrices(
  symbol: string,
  from?: string,
  to?: string
): Promise<FMPHistoricalPrice[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const data = await fmpFetch<{ historical: FMPHistoricalPrice[] }>(
    `/historical-price-full/${encodeURIComponent(symbol)}`,
    params
  );
  return data?.historical || [];
}

export async function getPriceTargets(symbol: string): Promise<FMPPriceTarget[]> {
  return fmpFetch<FMPPriceTarget[]>(`/price-target/${encodeURIComponent(symbol)}`);
}

export async function searchSymbol(query: string): Promise<FMPSearchResult[]> {
  return fmpFetch<FMPSearchResult[]>('/search', { query, limit: '10' });
}

export async function getSectorPerformance(): Promise<FMPSectorPerformance[]> {
  return fmpFetch<FMPSectorPerformance[]>('/sector-performance');
}

export async function getExchangeRate(from: string, to: string): Promise<number> {
  const data = await fmpFetch<{ rate: number }[]>(`/fx/${from}${to}`);
  return data?.[0]?.rate || 0;
}

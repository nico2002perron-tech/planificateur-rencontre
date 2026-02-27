import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { CACHE_TTL } from '@/lib/utils/constants';

export async function getCachedPrice(symbol: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('price_cache')
    .select('*')
    .eq('symbol', symbol)
    .single();

  if (!data) return null;

  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > CACHE_TTL.QUOTE) return null;

  return data;
}

export async function getCachedPrices(symbols: string[]) {
  if (symbols.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from('price_cache')
    .select('*')
    .in('symbol', symbols);

  if (!data) return [];

  const cutoff = Date.now() - CACHE_TTL.QUOTE;
  return data.filter((d) => new Date(d.fetched_at).getTime() > cutoff);
}

export async function setCachedPrice(
  symbol: string,
  priceData: {
    price: number;
    change_percent: number;
    market_cap?: number;
    pe_ratio?: number;
    dividend_yield?: number;
    fifty_two_week_high?: number;
    fifty_two_week_low?: number;
    company_name?: string;
    sector?: string;
    industry?: string;
    exchange?: string;
  }
) {
  const supabase = createClient();
  await supabase.from('price_cache').upsert({
    symbol,
    ...priceData,
    fetched_at: new Date().toISOString(),
  });
}

export async function getCachedExchangeRate(pair: string): Promise<number | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('exchange_rates')
    .select('rate, fetched_at')
    .eq('pair', pair)
    .single();

  if (!data) return null;

  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > CACHE_TTL.EXCHANGE_RATE) return null;

  return data.rate;
}

export async function setCachedExchangeRate(pair: string, rate: number) {
  const supabase = createClient();
  await supabase.from('exchange_rates').upsert({
    pair,
    rate,
    fetched_at: new Date().toISOString(),
  });
}

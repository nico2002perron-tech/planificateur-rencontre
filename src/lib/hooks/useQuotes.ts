import useSWR from 'swr';

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
};

interface QuoteData {
  symbol: string;
  price: number;
  change_percent: number;
  company_name: string;
  market_cap: number;
  pe_ratio: number;
  exchange: string;
  cached?: boolean;
}

export function useQuotes(symbols: string[]) {
  const key = symbols.length > 0
    ? `/api/fmp/quote?symbols=${symbols.join(',')}`
    : null;

  const { data, error, isLoading } = useSWR<QuoteData[]>(key, fetcher, {
    refreshInterval: 60_000, // Refresh every 60s
    dedupingInterval: 30_000,
  });

  const safeData = Array.isArray(data) ? data : [];
  const quotesMap = new Map<string, QuoteData>();
  safeData.forEach((q) => quotesMap.set(q.symbol, q));

  return { quotes: safeData, quotesMap, error, isLoading };
}

export function useSymbolSearch(query: string) {
  const key = query.length >= 1
    ? `/api/fmp/search?q=${encodeURIComponent(query)}`
    : null;

  const { data, error, isLoading } = useSWR(key, fetcher, {
    dedupingInterval: 5_000,
  });

  return { results: Array.isArray(data) ? data : [], error, isLoading };
}

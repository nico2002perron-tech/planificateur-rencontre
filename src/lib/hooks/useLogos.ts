import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Fetch TradingView logos for a list of symbols.
 * Cached aggressively — logos rarely change.
 */
export function useSymbolLogos(symbols: string[]) {
  const key = symbols.length > 0 ? `/api/logos?symbols=${symbols.join(',')}` : null;

  const { data, isLoading } = useSWR<{ logos: Record<string, string | null> }>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000, // 1 hour
    revalidateIfStale: false,
  });

  return { logos: data?.logos || {}, isLoading };
}

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface HistoricalPoint {
  date: string;
  close: number;
}

export function useHistoricalPrices(symbol: string, from?: string, to?: string) {
  const params = new URLSearchParams({ symbol });
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const key = symbol ? `/api/fmp/historical?${params}` : null;

  const { data, error, isLoading } = useSWR<HistoricalPoint[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000 * 5,
  });

  return { prices: data || [], error, isLoading };
}

export function useSectorPerformance() {
  const { data, error, isLoading } = useSWR('/api/fmp/sector-performance', fetcher, {
    refreshInterval: 5 * 60_000,
  });

  return { sectors: data || [], error, isLoading };
}

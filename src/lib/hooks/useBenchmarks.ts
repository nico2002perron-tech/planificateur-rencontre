import useSWR from 'swr';
import { BENCHMARK_DEFAULTS } from '@/lib/utils/constants';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useBenchmarks() {
  const symbols = BENCHMARK_DEFAULTS.map((b) => b.symbol);
  const key = `/api/fmp/quote?symbols=${symbols.join(',')}`;

  const { data, error, isLoading } = useSWR(key, fetcher, {
    refreshInterval: 60_000,
  });

  const benchmarks = BENCHMARK_DEFAULTS.map((b) => {
    const quote = data?.find((q: { symbol: string }) => q.symbol === b.symbol);
    return {
      ...b,
      price: quote?.price || null,
      change_percent: quote?.change_percent || null,
    };
  });

  return { benchmarks, error, isLoading };
}

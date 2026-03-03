import useSWR from 'swr';

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
};

export interface PriceTargetConsensus {
  targetConsensus: number;
  targetHigh: number;
  targetLow: number;
  numberOfAnalysts: number;
  source: 'yahoo' | 'fmp' | 'manual';
}

export function usePriceTargetConsensus(symbols: string[]) {
  const key = symbols.length > 0
    ? `/api/fmp/price-target-consensus?symbols=${symbols.join(',')}`
    : null;

  const { data, error, isLoading } = useSWR<Record<string, PriceTargetConsensus>>(key, fetcher, {
    refreshInterval: 300_000, // Refresh every 5 min
    dedupingInterval: 60_000,
  });

  return { targets: data || {}, error, isLoading };
}

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
  source: 'yahoo' | 'fmp' | 'manual' | 'historical';
}

/**
 * @param symbols List of symbols to fetch targets for
 * @param cdrMap  Optional map of symbol → underlying US symbol for CDRs
 */
export function usePriceTargetConsensus(symbols: string[], cdrMap?: Record<string, string>) {
  // Build CDR query param if any CDRs exist
  const cdrParam = cdrMap && Object.keys(cdrMap).length > 0
    ? `&cdrs=${encodeURIComponent(JSON.stringify(cdrMap))}`
    : '';

  const key = symbols.length > 0
    ? `/api/fmp/price-target-consensus?symbols=${symbols.join(',')}${cdrParam}`
    : null;

  const { data, error, isLoading } = useSWR<Record<string, PriceTargetConsensus>>(key, fetcher, {
    refreshInterval: 300_000,
    dedupingInterval: 60_000,
  });

  return { targets: data || {}, error, isLoading };
}

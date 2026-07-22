import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Taux USD→CAD live (mêmes réglages que la copie locale de PretAColler :
 * /api/yahoo-rate, rafraîchi aux 5 min). `rate` est null tant qu'il n'est pas
 * chargé — les consommateurs doivent gérer ce cas (jamais supposer 1:1).
 */
export function useUsdCadRate() {
  const { data, isLoading } = useSWR<{ rate: number }>(
    '/api/yahoo-rate',
    fetcher,
    { refreshInterval: 300_000, dedupingInterval: 60_000, revalidateOnFocus: true }
  );
  return { rate: data?.rate ?? null, isLoading };
}

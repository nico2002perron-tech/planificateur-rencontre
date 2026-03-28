import { useMemo } from 'react';
import useSWR from 'swr';
import type { StockScore } from '@/lib/models/stock-scorer';

export function useStockScores(profileId: string | null) {
  const { data, error, isLoading } = useSWR<{ scores: StockScore[] }>(
    profileId ? ['score-universe', profileId] : null,
    () => fetch('/api/models/score-universe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId }),
    }).then(r => r.json()),
  );

  const scores = data?.scores ?? [];

  // Memoize so downstream useEffects don't fire on every render
  const scoresMap = useMemo(() => {
    const map = new Map<string, StockScore>();
    for (const s of scores) map.set(s.stockId, s);
    return map;
  }, [scores]);

  return { scores, scoresMap, error, isLoading };
}

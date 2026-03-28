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

  // Map by stockId for quick lookup
  const scoresMap = new Map<string, StockScore>();
  for (const s of scores) scoresMap.set(s.stockId, s);

  return { scores, scoresMap, error, isLoading };
}

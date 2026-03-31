import useSWR from 'swr';
import type { NewsResponse, SymbolNews } from '@/lib/yahoo/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Fetch news for a list of symbols.
 * Refreshes every 5 minutes.
 */
export function useSymbolsNews(symbols: string[]) {
  const key = symbols.length > 0 ? `/api/news?symbols=${symbols.join(',')}` : null;

  const { data, error, isLoading } = useSWR<NewsResponse>(key, fetcher, {
    refreshInterval: 5 * 60 * 1000, // 5 min
    revalidateOnFocus: false,
    dedupingInterval: 60 * 1000,
  });

  const newsMap: Record<string, SymbolNews> = data?.news || {};

  return { newsMap, error, isLoading };
}

/**
 * Translate a text via the /api/translate route.
 * Returns the translated string, or the original on error.
 */
export async function translateText(text: string): Promise<string> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang: 'FR' }),
    });

    if (!res.ok) return text;

    const data = await res.json();
    return data.translated || text;
  } catch {
    return text;
  }
}

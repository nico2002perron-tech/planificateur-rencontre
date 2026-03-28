import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface UniverseStock {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  industry: string | null;
  stock_type: 'obligatoire' | 'variable';
  position: number;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useStockUniverse() {
  const { data, error, isLoading, mutate } = useSWR<{ stocks: UniverseStock[] }>(
    '/api/models/universe',
    fetcher
  );

  const stocks = data?.stocks || [];

  // Grouper par secteur
  const bySector = stocks.reduce<Record<string, UniverseStock[]>>((acc, s) => {
    if (!acc[s.sector]) acc[s.sector] = [];
    acc[s.sector].push(s);
    return acc;
  }, {});

  const sectors = Object.keys(bySector).sort();

  return { stocks, bySector, sectors, error, isLoading, mutate };
}

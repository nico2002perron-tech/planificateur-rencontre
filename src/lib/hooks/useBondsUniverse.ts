import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface UniverseBond {
  id: string;
  description: string;
  issuer: string | null;
  cusip: string | null;
  coupon: number | null;
  maturity: string | null;
  price: number | null;
  yield: number | null;
  spread: number | null;
  category: string | null;
  source: 'CAD' | 'US' | 'MANUAL';
  rating_sp: string | null;
  rating_dbrs: string | null;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export function useBondsUniverse(source?: string) {
  const url = source
    ? `/api/models/bonds?source=${source}`
    : '/api/models/bonds';

  const { data, error, isLoading, mutate } = useSWR<{ bonds: UniverseBond[] }>(
    url,
    fetcher
  );

  const bonds = data?.bonds || [];

  // Grouper par catégorie
  const byCategory = bonds.reduce<Record<string, UniverseBond[]>>((acc, b) => {
    const cat = b.category || 'Autre';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(b);
    return acc;
  }, {});

  const categories = Object.keys(byCategory).sort();

  const stats = {
    total: bonds.length,
    cad: bonds.filter(b => b.source === 'CAD').length,
    us: bonds.filter(b => b.source === 'US').length,
    manual: bonds.filter(b => b.source === 'MANUAL').length,
    mandatory: bonds.filter(b => b.is_mandatory).length,
  };

  return { bonds, byCategory, categories, stats, error, isLoading, mutate };
}

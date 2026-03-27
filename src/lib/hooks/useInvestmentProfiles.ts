import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface SectorConfig {
  id: string;
  profile_id: string;
  sector: string;
  weight_pct: number;
  nb_titles: number;
}

export interface BondConfig {
  id: string;
  profile_id: string;
  price_min: number;
  price_max: number;
}

export interface InvestmentProfile {
  id: string;
  name: string;
  slug: string;
  profile_number: number;
  equity_pct: number;
  bond_pct: number;
  nb_bonds: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  sectors: SectorConfig[];
  bond_config: BondConfig | null;
  created_at: string;
  updated_at: string;
}

export function useInvestmentProfiles() {
  const { data, error, isLoading, mutate } = useSWR<{ profiles: InvestmentProfile[] }>(
    '/api/models/profiles',
    fetcher
  );
  return { profiles: data?.profiles || [], error, isLoading, mutate };
}

export function useInvestmentProfile(id: string) {
  const { data, error, isLoading, mutate } = useSWR<{ profile: InvestmentProfile }>(
    id ? `/api/models/profiles/${id}` : null,
    fetcher
  );
  return { profile: data?.profile || null, error, isLoading, mutate };
}

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface ModelHolding {
  symbol: string;
  name: string;
  weight: number;
  asset_class: string;
  region?: string;
  sector?: string;
}

export interface ModelPortfolio {
  id: string;
  name: string;
  description: string | null;
  risk_level: string;
  holdings: ModelHolding[];
  created_by: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useModels() {
  const { data, error, isLoading, mutate } = useSWR<ModelPortfolio[]>('/api/models', fetcher);
  return { models: data, error, isLoading, mutate };
}

export function useModel(id: string) {
  const { data, error, isLoading, mutate } = useSWR<ModelPortfolio>(
    id ? `/api/models/${id}` : null,
    fetcher
  );
  return { model: data, error, isLoading, mutate };
}

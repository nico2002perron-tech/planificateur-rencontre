import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Holding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  asset_class: string;
  sector: string;
  region: string;
  current_price?: number;
  market_value?: number;
  gain_loss?: number;
  gain_loss_pct?: number;
  weight?: number;
}

interface Portfolio {
  id: string;
  name: string;
  account_type: string;
  currency: 'CAD' | 'USD';
  client_id: string;
  client_name: string;
  benchmark_symbols: string[];
  status: string;
  total_value?: number;
  ytd_return?: number;
  holdings_count: number;
  created_at: string;
}

interface PortfolioDetail extends Portfolio {
  holdings: Holding[];
}

export function usePortfolios() {
  const { data, error, isLoading, mutate } = useSWR<Portfolio[]>('/api/portfolios', fetcher);
  return { portfolios: data, error, isLoading, mutate };
}

export function usePortfolio(id: string) {
  const { data, error, isLoading, mutate } = useSWR<PortfolioDetail>(
    id ? `/api/portfolios/${id}` : null,
    fetcher
  );

  return {
    portfolio: data,
    holdings: data?.holdings || [],
    error,
    isLoading,
    mutate,
  };
}

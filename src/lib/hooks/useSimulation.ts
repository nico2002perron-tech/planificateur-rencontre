import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface ETFSectorWeight { sector: string; weight: number }

export interface SimHolding {
  symbol: string;
  name: string;
  quantity: number;
  purchase_price: number;
  weight: number;
  asset_class: string;
  region?: string;
  sector?: string;
  etf_sector_weights?: ETFSectorWeight[];
}

export interface LiveHolding {
  symbol: string;
  name: string;
  quantity: number;
  purchase_price: number;
  current_price: number;
  market_value: number;
  cost_basis: number;
  gain_loss: number;
  gain_loss_pct: number;
  weight: number;
  asset_class: string;
  region?: string;
  sector?: string;
  etf_sector_weights?: ETFSectorWeight[];
}

export interface SimulationSnapshot {
  id: number;
  simulation_id: string;
  date: string;
  total_value: number;
  daily_return: number | null;
  holdings_detail: { symbol: string; price: number; market_value: number; daily_change_pct: number }[];
  benchmark_values: Record<string, number>;
}

export interface Simulation {
  id: string;
  model_id: string;
  name: string;
  initial_value: number;
  currency: string;
  status: 'active' | 'paused' | 'closed';
  start_date: string;
  end_date: string | null;
  holdings_snapshot: SimHolding[];
  benchmarks: string[];
  benchmark_start_prices: Record<string, number>;
  created_at: string;
}

export interface SimulationStats {
  total_return: number;
  total_return_pct: number;
  capital_gain: number;
  capital_gain_pct: number;
  dividend_income: number;
  fixed_income: number;
  total_income: number;
  annualized_return: number;
  volatility: number;
  max_drawdown: number;
  best_day: number;
  worst_day: number;
  days_active: number;
  sharpe: number;
}

export interface BenchmarkPerf {
  current: number;
  start: number;
  return_pct: number;
}

export interface SimulationData {
  simulation: Simulation | null;
  snapshots: SimulationSnapshot[];
  live: {
    total_value: number;
    holdings: LiveHolding[];
    benchmarks: Record<string, BenchmarkPerf>;
  } | null;
  stats: SimulationStats | null;
}

export function useSimulation(modelId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<SimulationData>(
    modelId ? `/api/models/${modelId}/simulation` : null,
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false }
  );

  return {
    data: data ?? null,
    error,
    isLoading,
    mutate,
  };
}

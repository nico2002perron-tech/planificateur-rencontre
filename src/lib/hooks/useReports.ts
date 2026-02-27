import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface Report {
  id: string;
  title: string;
  status: string;
  config: Record<string, unknown>;
  generated_at: string;
  created_at: string;
  portfolio_id: string;
  client_id: string;
  portfolio_name: string;
  client_name: string;
}

export function useReports() {
  const { data, error, isLoading, mutate } = useSWR<Report[]>('/api/reports', fetcher);
  return { reports: data, error, isLoading, mutate };
}

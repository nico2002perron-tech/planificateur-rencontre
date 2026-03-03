import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  type: string;
  risk_profile: string;
  objectives: string;
  investment_horizon: string;
  created_at: string;
  updated_at: string;
}

export function useClients() {
  const { data, error, isLoading, mutate } = useSWR<Client[]>('/api/clients', fetcher);
  return { clients: Array.isArray(data) ? data : [], error, isLoading, mutate };
}

export function useClient(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Client>(
    id ? `/api/clients/${id}` : null,
    fetcher
  );
  return { client: data, error, isLoading, mutate };
}

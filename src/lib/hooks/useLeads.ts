import useSWR from 'swr';
import type { Lead, LeadActivity, LeadStats } from '@/lib/prospection/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLeadPool(search?: string) {
  const params = new URLSearchParams({ view: 'pool' });
  if (search) params.set('search', search);
  const { data, error, isLoading, mutate } = useSWR<Lead[]>(
    `/api/prospection/leads?${params}`,
    fetcher
  );
  return { leads: Array.isArray(data) ? data : [], error, isLoading, mutate };
}

export function useMyLeads(status?: string, search?: string) {
  const params = new URLSearchParams({ view: 'mine' });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const { data, error, isLoading, mutate } = useSWR<Lead[]>(
    `/api/prospection/leads?${params}`,
    fetcher
  );
  return { leads: Array.isArray(data) ? data : [], error, isLoading, mutate };
}

export function useLeadActivities(leadId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<LeadActivity[]>(
    leadId ? `/api/prospection/leads/${leadId}/activities` : null,
    fetcher
  );
  return { activities: Array.isArray(data) ? data : [], error, isLoading, mutate };
}

export function useLeadStats() {
  const { data, error, isLoading } = useSWR<LeadStats>('/api/prospection/stats', fetcher, {
    refreshInterval: 30000,
  });
  return { stats: data, error, isLoading };
}

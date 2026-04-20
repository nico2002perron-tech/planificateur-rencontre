import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export interface MeetingNote {
  id: string;
  advisor_id: string;
  client_name: string;
  account_number: string;
  meeting_date: string;
  meeting_time: string;
  meeting_type: 'phone' | 'in_person' | 'video';
  subject: 'revision' | 'placement' | 'both';
  compliance: Record<string, string>;
  transaction: {
    solicited: boolean;
    type: string;
    orderType: string;
    price?: number;
    quantity?: number;
    symbol?: string;
  } | null;
  notes: {
    topics?: string;
    decisions?: string;
    followups?: string;
    nextMeeting?: string;
  };
  transcription: string | null;
  ai_summary_advisor: string | null;
  ai_summary_client: string | null;
  status: 'draft' | 'completed';
  created_at: string;
  updated_at: string;
}

export function useMeetingNotes() {
  const { data, error, isLoading, mutate } = useSWR<MeetingNote[]>('/api/meeting-notes', fetcher);
  return { notes: Array.isArray(data) ? data : [], error, isLoading, mutate };
}

export function useMeetingNote(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<MeetingNote>(
    id ? `/api/meeting-notes/${id}` : null,
    fetcher
  );
  return { note: data, error, isLoading, mutate };
}

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export interface MeetingTransaction {
  id: string;
  type: 'buy' | 'sell' | 'switch';
  symbol: string;
  quantity: string;
  price: string;
  solicited: boolean;
  orderType: string;
}

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
  transaction: MeetingTransaction[] | null;
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

/** Normalize legacy single-transaction objects to array format */
function normalizeTransactions(tx: unknown): MeetingTransaction[] | null {
  if (!tx) return null;
  if (Array.isArray(tx)) return tx;
  // Legacy single object format — wrap in array
  if (typeof tx === 'object' && tx !== null && 'type' in tx) {
    const legacy = tx as Record<string, unknown>;
    return [{
      id: crypto.randomUUID(),
      type: (legacy.type as MeetingTransaction['type']) || 'buy',
      symbol: (legacy.symbol as string) || '',
      quantity: String(legacy.quantity || ''),
      price: String(legacy.price || ''),
      solicited: (legacy.solicited as boolean) ?? true,
      orderType: (legacy.orderType as string) || '',
    }];
  }
  return null;
}

function normalizeNote(raw: MeetingNote): MeetingNote {
  return { ...raw, transaction: normalizeTransactions(raw.transaction) };
}

export function useMeetingNotes() {
  const { data, error, isLoading, mutate } = useSWR<MeetingNote[]>('/api/meeting-notes', fetcher);
  const notes = Array.isArray(data) ? data.map(normalizeNote) : [];
  return { notes, error, isLoading, mutate };
}

export function useMeetingNote(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<MeetingNote>(
    id ? `/api/meeting-notes/${id}` : null,
    fetcher
  );
  return { note: data ? normalizeNote(data) : undefined, error, isLoading, mutate };
}

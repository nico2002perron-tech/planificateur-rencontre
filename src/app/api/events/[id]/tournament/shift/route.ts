import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState, MATCH_COLUMNS, type TournamentMatch } from '@/lib/tournament/state';
import { addMinutes } from '@/lib/tournament/scheduler';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// POST /api/events/[id]/tournament/shift — le tournoi prend du retard (ou de
// l'avance) : décale d'un coup TOUTES les parties restantes (ni terminées ni
// annulées) de ± X minutes. Les journées ne changent pas.
// Body : { minutes } — entier entre -120 et 120, non nul.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const minutes = Math.trunc(Number(body.minutes));
  if (!Number.isFinite(minutes) || minutes === 0 || Math.abs(minutes) > 120) {
    return NextResponse.json({ error: 'minutes requis (entier non nul entre -120 et 120).' }, { status: 400 });
  }

  const { data: rawMatches, error } = await supabase
    .from('event_matches')
    .select(MATCH_COLUMNS)
    .eq('event_id', eventId)
    .in('status', ['scheduled', 'in_progress']);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const remaining = (rawMatches as TournamentMatch[]) || [];
  if (remaining.length === 0) {
    return NextResponse.json({ error: 'Aucune partie restante à décaler.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  for (const m of remaining) {
    if (!m.scheduled_time) continue;
    await supabase
      .from('event_matches')
      .update({ scheduled_time: addMinutes(m.scheduled_time, minutes), updated_at: now })
      .eq('id', m.id)
      .eq('event_id', eventId);
  }

  const state = await fetchTournamentState(supabase, eventId, true);
  return NextResponse.json({ ...state, shifted: remaining.length, minutes });
}

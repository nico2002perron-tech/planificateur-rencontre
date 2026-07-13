import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState } from '@/lib/tournament/state';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// PATCH /api/events/[id]/tournament/matches/[matchId] — saisie/correction d'un pointage
// Body : { score_a?, score_b?, status?, court?, scheduled_time? }
//  - scores number → la partie passe automatiquement à « finished » ;
//  - scores null   → efface le résultat, la partie redevient « scheduled ».
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId, matchId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const parseScore = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (!Number.isFinite(n) || n < 0 || n > 999) return undefined;
    return Math.floor(n);
  };

  const scoreA = parseScore(body.score_a);
  const scoreB = parseScore(body.score_b);
  if (scoreA !== undefined) patch.score_a = scoreA;
  if (scoreB !== undefined) patch.score_b = scoreB;

  // Statut : explicite, ou déduit des scores (les deux saisis → terminée ; effacés → à venir)
  if (body.status !== undefined && ['scheduled', 'in_progress', 'finished', 'cancelled'].includes(String(body.status))) {
    patch.status = String(body.status);
  } else if (scoreA !== undefined || scoreB !== undefined) {
    if (scoreA === null && scoreB === null) patch.status = 'scheduled';
    else if (scoreA !== undefined && scoreB !== undefined && scoreA !== null && scoreB !== null) patch.status = 'finished';
  }

  if (body.court !== undefined) {
    const c = parseInt(String(body.court), 10);
    if (Number.isFinite(c) && c >= 1 && c <= 8) patch.court = c;
  }
  if (body.scheduled_time !== undefined && /^\d{1,2}:\d{2}$/.test(String(body.scheduled_time))) {
    patch.scheduled_time = String(body.scheduled_time);
  }
  if (body.scheduled_date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(body.scheduled_date))) {
    patch.scheduled_date = String(body.scheduled_date);
  }

  const { data: updated, error } = await supabase
    .from('event_matches')
    .update(patch)
    .eq('id', matchId)
    .eq('event_id', eventId)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Partie introuvable' }, { status: 404 });

  const state = await fetchTournamentState(supabase, eventId, true);
  return NextResponse.json(state);
}

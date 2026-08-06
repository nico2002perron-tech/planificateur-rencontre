import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState, MATCH_COLUMNS, type TournamentMatch } from '@/lib/tournament/state';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

interface SwapSlot {
  matchId: string;
  side: 'a' | 'b';
}

function slotValue(m: TournamentMatch, side: 'a' | 'b'): { teamId: string | null; source: string } {
  return side === 'a'
    ? { teamId: m.team_a_id, source: m.source_a }
    : { teamId: m.team_b_id, source: m.source_b };
}

// POST /api/events/[id]/tournament/swap-teams — deux gestes du mode « Échanger » :
//  - { a: { matchId, side }, b: { matchId, side } } → échange deux équipes de place ;
//  - { a: { matchId, side }, teamId }               → place une équipe de la banque
//    (toutes les équipes inscrites) dans la case choisie, peu importe où elle joue déjà.
// Refusé sur une partie terminée ou annulée (le résultat serait corrompu).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const a = body.a as SwapSlot | undefined;
  const b = body.b as SwapSlot | undefined;
  const validSlot = (s: SwapSlot | undefined): s is SwapSlot =>
    !!s && typeof s.matchId === 'string' && (s.side === 'a' || s.side === 'b');

  // Placement direct depuis la banque d'équipes
  if (validSlot(a) && b === undefined && typeof body.teamId === 'string' && body.teamId) {
    return assignFromBank(supabase, eventId, a, body.teamId);
  }

  if (!validSlot(a) || !validSlot(b)) {
    return NextResponse.json({ error: 'a et b requis : { matchId, side }' }, { status: 400 });
  }
  if (a.matchId === b.matchId && a.side === b.side) {
    return NextResponse.json({ error: 'Choisis deux positions différentes.' }, { status: 400 });
  }

  const ids = [...new Set([a.matchId, b.matchId])];
  const { data: rows, error: readError } = await supabase
    .from('event_matches')
    .select(MATCH_COLUMNS)
    .eq('event_id', eventId)
    .in('id', ids);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const matches = (rows as TournamentMatch[]) || [];
  const ma = matches.find(m => m.id === a.matchId);
  const mb = matches.find(m => m.id === b.matchId);
  if (!ma || !mb) return NextResponse.json({ error: 'Partie introuvable' }, { status: 404 });
  if (['finished', 'cancelled'].includes(ma.status) || ['finished', 'cancelled'].includes(mb.status)) {
    return NextResponse.json({ error: 'Impossible d\'échanger sur une partie terminée ou annulée.' }, { status: 400 });
  }

  const va = slotValue(ma, a.side);
  const vb = slotValue(mb, b.side);
  const now = new Date().toISOString();
  const patchFor = (side: 'a' | 'b', v: { teamId: string | null; source: string }) =>
    side === 'a'
      ? { team_a_id: v.teamId, source_a: v.source }
      : { team_b_id: v.teamId, source_b: v.source };

  if (ma.id === mb.id) {
    // Échange à l'intérieur d'une même partie (inverser receveur/visiteur)
    const { error } = await supabase
      .from('event_matches')
      .update({ ...patchFor(a.side, vb), ...patchFor(b.side, va), updated_at: now })
      .eq('id', ma.id)
      .eq('event_id', eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error: errA } = await supabase
      .from('event_matches')
      .update({ ...patchFor(a.side, vb), updated_at: now })
      .eq('id', ma.id)
      .eq('event_id', eventId);
    if (errA) return NextResponse.json({ error: errA.message }, { status: 500 });

    const { error: errB } = await supabase
      .from('event_matches')
      .update({ ...patchFor(b.side, va), updated_at: now })
      .eq('id', mb.id)
      .eq('event_id', eventId);
    if (errB) {
      // Remettre la première position comme avant (l'échange doit être tout ou rien)
      await supabase
        .from('event_matches')
        .update({ ...patchFor(a.side, va), updated_at: now })
        .eq('id', ma.id)
        .eq('event_id', eventId);
      return NextResponse.json({ error: errB.message }, { status: 500 });
    }
  }

  const state = await fetchTournamentState(supabase, eventId, true);
  return NextResponse.json(state);
}

// Place une équipe inscrite dans une case précise de l'horaire. On ne touche
// qu'au team id : la source (« Gagnant M5 »…) reste en place, donc les cases
// de séries continuent de suivre les résultats si un pointage change ensuite.
async function assignFromBank(
  supabase: SupabaseClient,
  eventId: string,
  slot: SwapSlot,
  teamId: string,
): Promise<NextResponse> {
  const [{ data: match, error: matchError }, { data: team }] = await Promise.all([
    supabase.from('event_matches').select(MATCH_COLUMNS).eq('id', slot.matchId).eq('event_id', eventId).maybeSingle(),
    supabase.from('event_teams').select('id, team_name').eq('id', teamId).eq('event_id', eventId).maybeSingle(),
  ]);
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });
  if (!match) return NextResponse.json({ error: 'Partie introuvable' }, { status: 404 });
  if (!team) return NextResponse.json({ error: 'Cette équipe n\'est pas inscrite à l\'événement.' }, { status: 400 });

  const m = match as TournamentMatch;
  if (['finished', 'cancelled'].includes(m.status)) {
    return NextResponse.json({ error: 'Impossible de modifier une partie terminée ou annulée.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('event_matches')
    .update({
      ...(slot.side === 'a' ? { team_a_id: teamId } : { team_b_id: teamId }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', m.id)
    .eq('event_id', eventId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const state = await fetchTournamentState(supabase, eventId, true);
  return NextResponse.json(state);
}

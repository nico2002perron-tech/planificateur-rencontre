import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSchedule } from '@/lib/tournament/scheduler';
import { fetchTournamentState } from '@/lib/tournament/state';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// POST /api/events/[id]/tournament/generate — (re)génère l'horaire des parties
// garanties depuis les équipes inscrites et la configuration.
// Body : { force?: boolean } — force=true écrase un horaire où des pointages existent déjà.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const force = !!body.force;

  // Config (créée avec les défauts si l'organisateur génère avant d'avoir sauvegardé)
  let { data: config } = await supabase
    .from('event_tournaments')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!config) {
    const { data: created, error } = await supabase
      .from('event_tournaments')
      .insert({ event_id: eventId })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    config = created;
  }

  // Équipes inscrites
  const { data: teams } = await supabase
    .from('event_teams')
    .select('id, team_name')
    .eq('event_id', eventId)
    .order('team_name');
  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: 'Il faut au moins 2 équipes inscrites pour générer un horaire.' }, { status: 400 });
  }

  // Garde-fou : ne pas écraser des pointages déjà saisis sans confirmation
  const { count: scoredCount } = await supabase
    .from('event_matches')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .not('score_a', 'is', null);
  if ((scoredCount || 0) > 0 && !force) {
    return NextResponse.json(
      { error: 'Des pointages sont déjà saisis. Régénérer effacera tout l\'horaire et les résultats.', needsForce: true },
      { status: 409 },
    );
  }

  const schedule = generateSchedule(
    teams.map(t => ({ id: t.id, name: t.team_name })),
    {
      guaranteedGames: config.guaranteed_games,
      courts: config.courts,
      startTime: config.start_time,
      gameMinutes: config.game_minutes,
      breakMinutes: config.break_minutes,
    },
  );

  // Remplacement complet (les éliminatoires seront régénérées aussi — elles
  // dépendent du classement des parties garanties de toute façon).
  const { error: delError } = await supabase.from('event_matches').delete().eq('event_id', eventId);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  if (schedule.matches.length > 0) {
    const rows = schedule.matches.map(m => ({
      event_id: eventId,
      phase: 'garantie',
      round_number: m.roundNumber,
      match_number: m.matchNumber,
      court: m.court,
      scheduled_time: m.scheduledTime,
      team_a_id: m.teamAId,
      team_b_id: m.teamBId,
    }));
    const { error: insError } = await supabase.from('event_matches').insert(rows);
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  const state = await fetchTournamentState(supabase, eventId, true);
  return NextResponse.json({ ...state, summary: schedule.summary });
}

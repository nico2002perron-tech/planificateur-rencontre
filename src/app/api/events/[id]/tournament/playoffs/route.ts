import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState, applyPlayoffResolution, MATCH_COLUMNS, type TournamentMatch } from '@/lib/tournament/state';
import { buildPlayoffMatches, type PlayoffSize } from '@/lib/tournament/playoffs';
import { makeSlotProvider, type SchedulerDay } from '@/lib/tournament/scheduler';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// POST /api/events/[id]/tournament/playoffs — génère les séries éliminatoires
// À LA SUITE de l'horaire existant (finale seule, top 4 ou top 8 selon la
// config). Les cases sont d'abord textuelles (« 1er au classement »,
// « Gagnant M9 ») puis remplies automatiquement à mesure que les pointages
// rentrent. Body : { force?: boolean } — force=true régénère même si des
// pointages de séries existent déjà.
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

  const { data: config } = await supabase
    .from('event_tournaments')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!config) {
    return NextResponse.json({ error: 'Configure et génère d\'abord l\'horaire des parties garanties.' }, { status: 400 });
  }
  if (!config.playoffs_enabled) {
    return NextResponse.json({ error: 'Les séries sont désactivées dans la configuration.' }, { status: 400 });
  }
  const size = ([2, 4, 8].includes(config.playoffs_team_count) ? config.playoffs_team_count : 4) as PlayoffSize;

  const { count: teamCount } = await supabase
    .from('event_teams')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if ((teamCount || 0) < size) {
    return NextResponse.json({ error: `Séries à ${size} équipes impossibles : seulement ${teamCount || 0} équipe(s) inscrite(s).` }, { status: 400 });
  }

  const { data: rawMatches } = await supabase
    .from('event_matches')
    .select(MATCH_COLUMNS)
    .eq('event_id', eventId)
    .order('match_number');
  const matches = (rawMatches as TournamentMatch[]) || [];
  const garantie = matches.filter(m => m.phase === 'garantie');
  const playoffs = matches.filter(m => m.phase !== 'garantie');
  if (garantie.length === 0) {
    return NextResponse.json({ error: 'Génère d\'abord l\'horaire des parties garanties.' }, { status: 400 });
  }

  // Garde-fou : ne pas écraser des résultats de séries sans confirmation
  if (playoffs.some(m => m.score_a !== null || m.score_b !== null) && !force) {
    return NextResponse.json(
      { error: 'Des pointages de séries sont déjà saisis. Régénérer les séries les effacera.', needsForce: true },
      { status: 409 },
    );
  }
  if (playoffs.length > 0) {
    const { error: delError } = await supabase
      .from('event_matches')
      .delete()
      .eq('event_id', eventId)
      .neq('phase', 'garantie');
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  // Cédule : les séries commencent au créneau suivant la dernière partie garantie.
  const { data: ev } = await supabase.from('events').select('date').eq('id', eventId).single();
  const eventDate = ev?.date || '';
  const days: SchedulerDay[] = Array.isArray(config.days) && config.days.length > 0
    ? config.days
    : [{ date: eventDate, start: config.start_time || '09:00', end: '23:59' }];
  const getSlot = makeSlotProvider(days, config.game_minutes, config.break_minutes);

  const lastKey = garantie.reduce((max, m) => {
    const key = `${m.scheduled_date || eventDate}|${m.scheduled_time}`;
    return key > max ? key : max;
  }, '');
  let k = 0;
  while (`${getSlot(k).date}|${getSlot(k).time}` <= lastKey) k++;

  const startNumber = matches.reduce((max, m) => Math.max(max, m.match_number), 0) + 1;
  const specs = buildPlayoffMatches(size, startNumber);

  // Chaque ronde occupe ses propres créneaux (bronze puis finale en dernier)
  const rows: Record<string, unknown>[] = [];
  let overflowMatches = 0;
  const rounds = [...new Set(specs.map(s => s.round_number))].sort((a, b) => a - b);
  for (const round of rounds) {
    const roundSpecs = specs.filter(s => s.round_number === round);
    for (let i = 0; i < roundSpecs.length; i += config.courts) {
      const slot = getSlot(k++);
      const chunk = roundSpecs.slice(i, i + config.courts);
      if (slot.overflow) overflowMatches += chunk.length;
      chunk.forEach((spec, courtIdx) => {
        rows.push({
          event_id: eventId,
          phase: spec.phase,
          round_number: spec.round_number,
          match_number: spec.match_number,
          court: courtIdx + 1,
          scheduled_date: slot.date,
          scheduled_time: slot.time,
          source_a: spec.source_a,
          source_b: spec.source_b,
        });
      });
    }
  }

  const { error: insError } = await supabase.from('event_matches').insert(rows);
  if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });

  // Si les parties garanties sont déjà toutes jouées, les seeds se placent maintenant
  await applyPlayoffResolution(supabase, eventId);

  const state = await fetchTournamentState(supabase, eventId, true);
  return NextResponse.json({ ...state, playoffsGenerated: rows.length, overflowMatches });
}

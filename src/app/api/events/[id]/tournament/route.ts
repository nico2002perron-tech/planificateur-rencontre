import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState } from '@/lib/tournament/state';
import { normaliserSport } from '@/lib/tournament/terrains';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// GET /api/events/[id]/tournament — état complet du tournoi.
// Public (page en direct) : les parties ne sortent que si l'horaire est publié.
// Organisateur connecté : voit aussi le brouillon.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = createClient();

  const session = await getServerSession(authOptions);
  const includeDraft = !!session && (await checkPermission(supabase, eventId, session.user.id, session.user.role));

  const state = await fetchTournamentState(supabase, eventId, includeDraft);
  if (!state) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });

  return NextResponse.json(state);
}

// PUT /api/events/[id]/tournament — crée ou met à jour la configuration.
// Body : { guaranteed_games?, courts?, start_time?, game_minutes?, break_minutes?,
//          playoffs_enabled?, playoffs_team_count?, points_win?, points_tie?, points_loss?, status? }
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();

  const int = (v: unknown, min: number, max: number, fallback: number): number => {
    const n = typeof v === 'number' ? Math.floor(v) : parseInt(String(v), 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.guaranteed_games !== undefined) patch.guaranteed_games = int(body.guaranteed_games, 1, 5, 2);
  if (body.courts !== undefined) patch.courts = int(body.courts, 1, 8, 2);
  if (body.start_time !== undefined && /^\d{1,2}:\d{2}$/.test(String(body.start_time))) patch.start_time = String(body.start_time);

  // Journées du tournoi : [{ date, start, end }] — triées, bornées, validées.
  if (body.days !== undefined) {
    const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const isTime = (v: unknown) => typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v);
    const days = Array.isArray(body.days)
      ? body.days
          .filter((d: Record<string, unknown>) => d && isDate(d.date) && isTime(d.start) && isTime(d.end) && String(d.start) < String(d.end))
          .slice(0, 7)
          .map((d: Record<string, unknown>) => ({ date: String(d.date), start: String(d.start), end: String(d.end) }))
          .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
      : [];
    if (days.length === 0) {
      return NextResponse.json({ error: 'Au moins une journée valide est requise (l\'heure de fin doit suivre l\'heure de début).' }, { status: 400 });
    }
    patch.days = days;
    patch.start_time = days[0].start; // cohérence avec l'ancien champ
  }
  if (body.game_minutes !== undefined) patch.game_minutes = int(body.game_minutes, 5, 240, 25);
  if (body.break_minutes !== undefined) patch.break_minutes = int(body.break_minutes, 0, 60, 5);
  if (body.playoffs_enabled !== undefined) patch.playoffs_enabled = !!body.playoffs_enabled;
  if (body.playoffs_team_count !== undefined) patch.playoffs_team_count = [2, 4, 8].includes(Number(body.playoffs_team_count)) ? Number(body.playoffs_team_count) : 4;
  if (body.points_win !== undefined) patch.points_win = int(body.points_win, 0, 10, 2);
  if (body.points_tie !== undefined) patch.points_tie = int(body.points_tie, 0, 10, 1);
  if (body.points_loss !== undefined) patch.points_loss = int(body.points_loss, 0, 10, 0);
  if (body.status !== undefined && ['draft', 'published'].includes(String(body.status))) patch.status = String(body.status);
  if (body.sport !== undefined) patch.sport = normaliserSport(body.sport);

  const enregistrer = (p: Record<string, unknown>) =>
    supabase.from('event_tournaments').upsert({ event_id: eventId, ...p }, { onConflict: 'event_id' });

  let { error } = await enregistrer(patch);

  // La colonne « sport » n'existe qu'à partir de la migration v4 : tant qu'elle
  // n'est pas passée, on enregistre tout le reste et on le dit clairement,
  // plutôt que de faire échouer la sauvegarde de la configuration.
  let sportIgnore = false;
  if (error && patch.sport !== undefined && /sport/i.test(error.message)) {
    const { sport: _sport, ...sansSport } = patch;
    ({ error } = await enregistrer(sansSport));
    sportIgnore = !error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const state = await fetchTournamentState(supabase, eventId, true);
  return NextResponse.json(
    sportIgnore
      ? { ...state, avertissement: 'Le sport n’a pas été enregistré : exécute la migration supabase/migration_event_tournament_v4.sql.' }
      : state,
  );
}

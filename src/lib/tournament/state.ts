/**
 * État complet d'un tournoi — assemblé côté serveur pour la console
 * organisateur ET la page publique en direct (même forme de réponse).
 *
 * Le classement n'est jamais lu de la base : il est recalculé ici à chaque
 * requête depuis les parties terminées (source de vérité = event_matches).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStandings, type StandingRow } from './standings';

export interface TournamentConfig {
  id: string;
  event_id: string;
  guaranteed_games: number;
  courts: number;
  start_time: string;
  game_minutes: number;
  break_minutes: number;
  playoffs_enabled: boolean;
  playoffs_team_count: number;
  points_win: number;
  points_tie: number;
  points_loss: number;
  status: 'draft' | 'published';
  schedule_sent_at: string | null;
}

export interface TournamentTeam {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface TournamentMatch {
  id: string;
  phase: string;
  round_number: number;
  match_number: number;
  court: number;
  scheduled_time: string;
  team_a_id: string | null;
  team_b_id: string | null;
  source_a: string;
  source_b: string;
  score_a: number | null;
  score_b: number | null;
  status: string;
}

export interface TournamentState {
  event: { id: string; title: string; date: string; location: string };
  config: TournamentConfig | null;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  standings: StandingRow[];
}

const MATCH_COLUMNS =
  'id, phase, round_number, match_number, court, scheduled_time, team_a_id, team_b_id, source_a, source_b, score_a, score_b, status';

/**
 * @param includeDraft faux pour la page publique : tant que l'horaire n'est
 *        pas publié, les parties ne sortent pas (la config reste visible pour
 *        afficher « horaire à venir »).
 */
export async function fetchTournamentState(
  supabase: SupabaseClient,
  eventId: string,
  includeDraft: boolean,
): Promise<TournamentState | null> {
  const { data: event } = await supabase
    .from('events')
    .select('id, title, date, location')
    .eq('id', eventId)
    .single();
  if (!event) return null;

  const [{ data: config }, { data: rawTeams }] = await Promise.all([
    supabase.from('event_tournaments').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('event_teams').select('id, team_name, logo_url').eq('event_id', eventId).order('team_name'),
  ]);

  const teams: TournamentTeam[] = (rawTeams || []).map(t => ({
    id: t.id,
    name: t.team_name,
    logo_url: t.logo_url || null,
  }));

  const showMatches = !!config && (includeDraft || config.status === 'published');
  let matches: TournamentMatch[] = [];
  if (showMatches) {
    const { data } = await supabase
      .from('event_matches')
      .select(MATCH_COLUMNS)
      .eq('event_id', eventId)
      .order('match_number');
    matches = (data as TournamentMatch[]) || [];
  }

  const standings = config
    ? computeStandings(
        teams.map(t => ({ id: t.id, name: t.name })),
        matches.map(m => ({
          phase: m.phase,
          status: m.status,
          teamAId: m.team_a_id,
          teamBId: m.team_b_id,
          scoreA: m.score_a,
          scoreB: m.score_b,
        })),
        { win: config.points_win, tie: config.points_tie, loss: config.points_loss },
      )
    : [];

  return {
    event: { id: event.id, title: event.title, date: event.date, location: event.location || '' },
    config: (config as TournamentConfig) || null,
    teams,
    matches,
    standings,
  };
}

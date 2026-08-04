/**
 * État complet d'un tournoi — assemblé côté serveur pour la console
 * organisateur ET la page publique en direct (même forme de réponse).
 *
 * Deux mondes bien séparés :
 *  - CONSOLE (includeDraft=true)  : les parties VIVANTES (event_matches) —
 *    l'organisateur y réarrange tout, saisit les pointages, etc.
 *  - PUBLIC  (includeDraft=false) : la PHOTO publiée (published_snapshot),
 *    prise au clic « Mettre à jour le site ». Rien ne bouge publiquement
 *    sans un geste explicite de l'organisateur.
 *
 * Le classement n'est jamais lu de la base : il est recalculé ici à chaque
 * requête depuis les parties (vivantes ou publiées, selon le monde).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStandings, type StandingRow } from './standings';
import { resolvePlayoffSlots } from './playoffs';
import type { SportId } from './terrains';

export interface TournamentDay {
  date: string;  // 'YYYY-MM-DD'
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
}

export interface TournamentConfig {
  id: string;
  event_id: string;
  guaranteed_games: number;
  courts: number;
  /** Sport du tournoi — sert au dessin du terrain. Absent avant la migration v4. */
  sport?: SportId | null;
  start_time: string;
  days: TournamentDay[] | null; // null = une seule journée (date de l'événement)
  game_minutes: number;
  break_minutes: number;
  playoffs_enabled: boolean;
  playoffs_team_count: number;
  points_win: number;
  points_tie: number;
  points_loss: number;
  status: 'draft' | 'published';
  schedule_sent_at: string | null;
  published_at: string | null;
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
  scheduled_date: string; // '' = date de l'événement (parties d'avant la v3)
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
  published_at: string | null;
  // Console seulement : vrai si les parties vivantes diffèrent de la photo publiée
  has_unpublished_changes?: boolean;
}

export const MATCH_COLUMNS =
  'id, phase, round_number, match_number, court, scheduled_date, scheduled_time, team_a_id, team_b_id, source_a, source_b, score_a, score_b, status';

// Forme comparable d'un jeu de parties (ordre stable, sans horodatages)
function comparable(ms: TournamentMatch[]): string {
  return JSON.stringify(
    [...ms]
      .sort((a, b) => a.match_number - b.match_number)
      .map(m => [m.phase, m.match_number, m.court, m.scheduled_date ?? '', m.scheduled_time, m.team_a_id, m.team_b_id, m.source_a, m.source_b, m.score_a, m.score_b, m.status]),
  );
}

async function fetchLiveMatches(supabase: SupabaseClient, eventId: string): Promise<TournamentMatch[]> {
  const { data } = await supabase
    .from('event_matches')
    .select(MATCH_COLUMNS)
    .eq('event_id', eventId)
    .order('match_number');
  return (data as TournamentMatch[]) || [];
}

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

  const [{ data: rawConfig }, { data: rawTeams }] = await Promise.all([
    supabase.from('event_tournaments').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('event_teams').select('id, team_name, logo_url').eq('event_id', eventId).order('team_name'),
  ]);

  const teams: TournamentTeam[] = (rawTeams || []).map(t => ({
    id: t.id,
    name: t.team_name,
    logo_url: t.logo_url || null,
  }));

  const snapshot: TournamentMatch[] | null = Array.isArray(rawConfig?.published_snapshot)
    ? (rawConfig.published_snapshot as TournamentMatch[])
    : null;
  const isPublished = rawConfig?.status === 'published';

  let matches: TournamentMatch[] = [];
  let hasUnpublishedChanges: boolean | undefined;

  if (includeDraft) {
    // Console : toujours les parties vivantes
    matches = rawConfig ? await fetchLiveMatches(supabase, eventId) : [];
    if (rawConfig) {
      hasUnpublishedChanges = isPublished
        // Ancien tournoi publié avant la v2 (pas de photo) : proposer une mise à jour
        ? (snapshot === null ? matches.length > 0 : comparable(matches) !== comparable(snapshot))
        : matches.length > 0;
    }
  } else if (isPublished) {
    // Public : la photo publiée — repli sur les vivantes pour les tournois
    // publiés avant la v2 (le premier « Mettre à jour le site » crée la photo).
    matches = snapshot ?? await fetchLiveMatches(supabase, eventId);
  }

  // La photo (JSONB) ne sort jamais telle quelle vers le client
  let config: TournamentConfig | null = null;
  if (rawConfig) {
    const clean = { ...rawConfig } as Record<string, unknown>;
    delete clean.published_snapshot;
    config = clean as unknown as TournamentConfig;
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
    config,
    teams,
    matches,
    standings,
    published_at: config?.published_at || null,
    ...(includeDraft ? { has_unpublished_changes: hasUnpublishedChanges } : {}),
  };
}

/**
 * Résolution automatique des séries : remplit/vide les cases « 1er au
 * classement » et « Gagnant/Perdant MX » selon l'état ACTUEL des parties.
 * À appeler après chaque saisie de pointage et après la génération des séries.
 * Retourne le nombre de cases mises à jour.
 */
export async function applyPlayoffResolution(supabase: SupabaseClient, eventId: string): Promise<number> {
  const [{ data: config }, { data: rawTeams }, { data: rawMatches }] = await Promise.all([
    supabase.from('event_tournaments').select('points_win, points_tie, points_loss').eq('event_id', eventId).maybeSingle(),
    supabase.from('event_teams').select('id, team_name').eq('event_id', eventId),
    supabase.from('event_matches').select(MATCH_COLUMNS).eq('event_id', eventId).order('match_number'),
  ]);
  const matches = (rawMatches as TournamentMatch[]) || [];
  if (!config || !matches.some(m => m.phase !== 'garantie')) return 0;

  const standings = computeStandings(
    (rawTeams || []).map(t => ({ id: t.id, name: t.team_name })),
    matches.map(m => ({
      phase: m.phase,
      status: m.status,
      teamAId: m.team_a_id,
      teamBId: m.team_b_id,
      scoreA: m.score_a,
      scoreB: m.score_b,
    })),
    { win: config.points_win, tie: config.points_tie, loss: config.points_loss },
  );

  const changes = resolvePlayoffSlots(matches, standings);
  const now = new Date().toISOString();
  for (const c of changes) {
    await supabase
      .from('event_matches')
      .update({ team_a_id: c.team_a_id, team_b_id: c.team_b_id, updated_at: now })
      .eq('id', c.id)
      .eq('event_id', eventId);
  }
  return changes.length;
}

/**
 * URL de la page publique en direct si (et seulement si) l'événement a un
 * tournoi PUBLIÉ — sinon undefined. Sert aux courriels (confirmation, rappel…)
 * pour afficher le bouton « Planning du tournoi » uniquement quand il existe.
 */
export async function publishedTournamentUrl(supabase: SupabaseClient, eventId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from('event_tournaments')
    .select('status')
    .eq('event_id', eventId)
    .maybeSingle();
  if (data?.status !== 'published') return undefined;
  const appUrl = process.env.NEXTAUTH_URL || 'https://planificateur-rencontre.vercel.app';
  return `${appUrl}/tournoi/${eventId}`;
}

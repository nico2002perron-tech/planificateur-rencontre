/**
 * Séries éliminatoires — fonctions PURES (testables sans DB).
 *
 * 1. buildPlayoffMatches : construit le bracket (finale seule, top 4 ou top 8)
 *    avec des SOURCES textuelles plutôt que des équipes :
 *      « 1er au classement », « Gagnant M9 », « Perdant M10 »…
 *    Le bracket existe donc AVANT de connaître les équipes.
 *
 * 2. resolvePlayoffSlots : remplit (et vide) ces cases automatiquement.
 *      - « Ne au classement » se place DÈS QUE LE RANG EST MATHÉMATIQUEMENT
 *        VERROUILLÉ (moteur certitude.ts) : pas besoin d'attendre la fin de la
 *        phase garantie — une équipe sait qui elle affronte et à quelle heure
 *        aussitôt que plus aucun scénario ne peut la déloger. Le bris d'égalité
 *        « moins de points contre » (standings.ts) rend ça rapide ;
 *      - « Gagnant/Perdant MX » se place dès que MX est terminée ;
 *      - un pointage corrigé ou effacé re-propage tout en aval ;
 *      - une partie de séries TERMINÉE n'est JAMAIS retouchée (résultat sacré).
 *    Appelée après chaque saisie de pointage : le bracket vit en temps réel.
 */

import type { TournamentMatch } from './state';
import type { StandingRow, PointsConfig } from './standings';
// Extension explicite : les scripts de régression roulent ces modules avec le
// décapage de types natif de Node, qui exige le chemin complet.
import { plagesDeRang, rangsVerrouilles } from './certitude.ts';

export type PlayoffSize = 2 | 4 | 8;

export interface PlayoffMatchSpec {
  phase: 'quart' | 'demi' | 'bronze' | 'finale';
  match_number: number;
  round_number: number; // 1 = premier tour des séries (ordre de cédule)
  source_a: string;
  source_b: string;
}

const seed = (rank: number) => rank === 1 ? '1er au classement' : `${rank}e au classement`;
const winnerOf = (n: number) => `Gagnant M${n}`;
const loserOf = (n: number) => `Perdant M${n}`;

/**
 * Bracket standard :
 *  - 2 : finale 1v2.
 *  - 4 : demis 1v4 et 2v3 → bronze (perdants) → finale (gagnants).
 *  - 8 : quarts 1v8, 4v5, 2v7, 3v6 → demis → bronze → finale.
 * Les rounds sont dans l'ordre de cédule (bronze AVANT la finale : la finale
 * clôt le tournoi).
 */
export function buildPlayoffMatches(size: PlayoffSize, startNumber: number): PlayoffMatchSpec[] {
  const specs: PlayoffMatchSpec[] = [];
  const n = startNumber;

  if (size === 2) {
    specs.push({ phase: 'finale', match_number: n, round_number: 1, source_a: seed(1), source_b: seed(2) });
    return specs;
  }

  if (size === 4) {
    const d1 = n, d2 = n + 1;
    specs.push({ phase: 'demi', match_number: d1, round_number: 1, source_a: seed(1), source_b: seed(4) });
    specs.push({ phase: 'demi', match_number: d2, round_number: 1, source_a: seed(2), source_b: seed(3) });
    specs.push({ phase: 'bronze', match_number: n + 2, round_number: 2, source_a: loserOf(d1), source_b: loserOf(d2) });
    specs.push({ phase: 'finale', match_number: n + 3, round_number: 3, source_a: winnerOf(d1), source_b: winnerOf(d2) });
    return specs;
  }

  // size === 8
  const q1 = n, q2 = n + 1, q3 = n + 2, q4 = n + 3;
  specs.push({ phase: 'quart', match_number: q1, round_number: 1, source_a: seed(1), source_b: seed(8) });
  specs.push({ phase: 'quart', match_number: q2, round_number: 1, source_a: seed(4), source_b: seed(5) });
  specs.push({ phase: 'quart', match_number: q3, round_number: 1, source_a: seed(2), source_b: seed(7) });
  specs.push({ phase: 'quart', match_number: q4, round_number: 1, source_a: seed(3), source_b: seed(6) });
  const s1 = n + 4, s2 = n + 5;
  specs.push({ phase: 'demi', match_number: s1, round_number: 2, source_a: winnerOf(q1), source_b: winnerOf(q2) });
  specs.push({ phase: 'demi', match_number: s2, round_number: 2, source_a: winnerOf(q3), source_b: winnerOf(q4) });
  specs.push({ phase: 'bronze', match_number: n + 6, round_number: 3, source_a: loserOf(s1), source_b: loserOf(s2) });
  specs.push({ phase: 'finale', match_number: n + 7, round_number: 4, source_a: winnerOf(s1), source_b: winnerOf(s2) });
  return specs;
}

export interface SlotResolution {
  id: string;
  team_a_id: string | null;
  team_b_id: string | null;
}

/** Toutes les parties garanties sont-elles réglées (au moins une jouée) ? */
export function guaranteedPhaseComplete(matches: Pick<TournamentMatch, 'phase' | 'status'>[]): boolean {
  const garantie = matches.filter(m => m.phase === 'garantie');
  return garantie.length > 0
    && garantie.every(m => m.status === 'finished' || m.status === 'cancelled')
    && garantie.some(m => m.status === 'finished');
}

const POINTS_DEFAUT: PointsConfig = { win: 2, tie: 1, loss: 0 };

/**
 * Calcule les équipes que chaque case de séries DEVRAIT contenir maintenant,
 * et retourne les différences à persister. Une source non résoluble (rang pas
 * encore verrouillé, match amont non joué, égalité en séries) donne null — la
 * case redevient « 1er au classement » / « Gagnant MX » à l'affichage.
 */
export function resolvePlayoffSlots(
  matches: TournamentMatch[],
  standings: StandingRow[],
  points: PointsConfig = POINTS_DEFAUT,
): SlotResolution[] {
  const byNumber = new Map(matches.map(m => [m.match_number, m]));

  // « Ne au classement » : rempli dès que le rang N est VERROUILLÉ — plus aucun
  // scénario des parties restantes ne peut y mettre une autre équipe. (Quand
  // tout est joué, tous les rangs sont verrouillés : même résultat qu'avant.)
  const rangs = rangsVerrouilles(plagesDeRang(matches, standings, points));

  const resolveSource = (source: string): string | null => {
    const rank = source.match(/^(\d+)(?:er|e)\s+au\s+classement$/i);
    if (rank) return rangs.get(parseInt(rank[1], 10)) ?? null;
    const winner = source.match(/^gagnant\s+m(\d+)$/i);
    const loser = source.match(/^perdant\s+m(\d+)$/i);
    const ref = winner || loser;
    if (!ref) return null;
    const m = byNumber.get(parseInt(ref[1], 10));
    if (!m || m.status !== 'finished' || m.score_a === null || m.score_b === null) return null;
    if (m.score_a === m.score_b) return null; // égalité : impossible de départager
    const aWins = m.score_a > m.score_b;
    return (winner ? (aWins ? m.team_a_id : m.team_b_id) : (aWins ? m.team_b_id : m.team_a_id)) ?? null;
  };

  const changes: SlotResolution[] = [];
  for (const m of matches) {
    if (m.phase === 'garantie') continue;
    if (m.status === 'finished' || m.status === 'cancelled') continue; // résultat sacré
    const teamA = m.source_a ? resolveSource(m.source_a) : m.team_a_id;
    const teamB = m.source_b ? resolveSource(m.source_b) : m.team_b_id;
    if (teamA !== m.team_a_id || teamB !== m.team_b_id) {
      changes.push({ id: m.id, team_a_id: teamA, team_b_id: teamB });
    }
  }
  return changes;
}

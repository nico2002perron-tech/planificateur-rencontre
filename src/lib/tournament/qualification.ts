/**
 * « Qui passe, qui sort, qui gagne » — fonction PURE (sans DB), pour rendre les
 * éliminations SUPER claires partout : classement (ligne des séries), bracket,
 * bannière champion, PDF. Aucune donnée stockée : tout est déduit de l'état.
 *
 * Deux moments distincts :
 *   1. La COUPE après la phase garantie : les N premières au classement passent
 *      en séries, les autres sont éliminées (N = playoffs_team_count).
 *   2. Le PARCOURS en séries : à mesure qu'on joue, chaque équipe qualifiée finit
 *      championne, finaliste, médaillée de bronze, ou éliminée à une ronde donnée.
 */
import type { TournamentMatch } from './state';
import type { PointsConfig } from './standings';
import { plagesDeRang } from './certitude.ts';

/**
 * Le classement, réduit à ce dont ce module a besoin (accepte StandingRow & co).
 * points/pointsAgainst alimentent le moteur de certitude quand ils sont là —
 * sans eux, les statuts avant la fin de la phase retombent sur « En lice ».
 */
type RankedTeam = { teamId: string; rank: number; points?: number; pointsAgainst?: number };

/**
 * Toutes les parties garanties sont-elles réglées (au moins une jouée) ?
 * Miroir volontaire de playoffs.guaranteedPhaseComplete — gardé local pour que
 * ce module n'importe rien qui touche à la DB (seul certitude.ts, pur lui
 * aussi, est importé au runtime).
 */
function guaranteedPhaseComplete(matches: Pick<TournamentMatch, 'phase' | 'status'>[]): boolean {
  const g = matches.filter(m => m.phase === 'garantie');
  return g.length > 0
    && g.every(m => m.status === 'finished' || m.status === 'cancelled')
    && g.some(m => m.status === 'finished');
}

export type QualStatus =
  | 'contention'   // phase garantie pas finie : encore en lice pour une place
  | 'qualified'    // a atteint les séries, toujours en vie
  | 'champion'     // a gagné la finale
  | 'finalist'     // a perdu la finale (2e)
  | 'bronze'       // a gagné la petite finale (3e)
  | 'eliminated'   // sortie (hors des séries, ou battue en séries)
  | 'none';        // pas de séries configurées

export interface TeamQual {
  teamId: string;
  rank: number;
  status: QualStatus;
  /** Étiquette courte prête à afficher (« Passe en séries », « Éliminé en quart »…). */
  label: string;
  /** Place finale 1-4 quand elle est connue (podium). */
  placement: number | null;
  /** true = fait partie des N qualifiées après la coupe. */
  inPlayoffs: boolean;
}

export interface QualificationResult {
  playoffSize: number;         // 0 si pas de séries
  guaranteedComplete: boolean; // la coupe est-elle tranchée ?
  cutRank: number;             // dernière place qualifiée (= playoffSize) ; 0 si pas de séries
  championId: string | null;
  runnerUpId: string | null;
  bronzeId: string | null;
  byTeam: Map<string, TeamQual>;
}

const PHASE_LABEL: Record<string, string> = {
  quart: 'en quart', demi: 'en demi-finale', bronze: 'à la petite finale', finale: 'en finale',
};

/** Gagnant/perdant d'une partie terminée sans égalité, sinon null. */
function decide(m: TournamentMatch): { winner: string | null; loser: string | null } {
  if (m.status !== 'finished' || m.score_a === null || m.score_b === null || m.score_a === m.score_b) {
    return { winner: null, loser: null };
  }
  const aWins = m.score_a > m.score_b;
  return {
    winner: (aWins ? m.team_a_id : m.team_b_id) ?? null,
    loser: (aWins ? m.team_b_id : m.team_a_id) ?? null,
  };
}

export function computeQualification(
  standings: readonly RankedTeam[],
  matches: TournamentMatch[],
  opts: { playoffsEnabled: boolean; playoffSize: number; points?: PointsConfig },
): QualificationResult {
  const playoffSize = opts.playoffsEnabled ? Math.max(0, opts.playoffSize) : 0;
  const guaranteedComplete = guaranteedPhaseComplete(matches);

  // Avant la fin de la phase : qui est DÉJÀ mathématiquement fixé ? (une équipe
  // dont le pire rang possible reste dans le top N est sûre de passer ; une
  // équipe dont le meilleur rang possible est sous la coupe est sortie)
  let plages: ReturnType<typeof plagesDeRang> | null = null;
  if (playoffSize > 0 && !guaranteedComplete
    && standings.every(r => typeof r.points === 'number' && typeof r.pointsAgainst === 'number')) {
    plages = plagesDeRang(
      matches,
      standings.map(r => ({ teamId: r.teamId, points: r.points as number, pointsAgainst: r.pointsAgainst as number })),
      opts.points ?? { win: 2, tie: 1, loss: 0 },
    );
  }
  const playoffMatches = matches.filter(m => m.phase !== 'garantie' && m.status !== 'cancelled');

  const finale = playoffMatches.find(m => m.phase === 'finale');
  const bronze = playoffMatches.find(m => m.phase === 'bronze');
  const finaleRes = finale ? decide(finale) : { winner: null, loser: null };
  const bronzeRes = bronze ? decide(bronze) : { winner: null, loser: null };

  // Une équipe est-elle encore VIVANTE en séries ? (présente dans une partie de
  // séries pas encore terminée) — sert à ne pas la déclarer éliminée trop tôt.
  const aliveInPlayoffs = new Set<string>();
  for (const m of playoffMatches) {
    if (m.status !== 'finished') {
      if (m.team_a_id) aliveInPlayoffs.add(m.team_a_id);
      if (m.team_b_id) aliveInPlayoffs.add(m.team_b_id);
    }
  }
  // Dernière ronde où chaque équipe a été BATTUE (pour « éliminé en quart/demi »).
  const lostAt = new Map<string, string>();
  const roundOrder = ['quart', 'demi', 'bronze', 'finale'];
  for (const m of playoffMatches) {
    const { loser } = decide(m);
    if (!loser) continue;
    const prev = lostAt.get(loser);
    if (!prev || roundOrder.indexOf(m.phase) > roundOrder.indexOf(prev)) lostAt.set(loser, m.phase);
  }

  const byTeam = new Map<string, TeamQual>();
  for (const row of standings) {
    const inPlayoffs = playoffSize > 0 && guaranteedComplete && row.rank <= playoffSize;
    let status: QualStatus;
    let label: string;
    let placement: number | null = null;

    if (playoffSize === 0) {
      status = 'none'; label = '';
    } else if (!guaranteedComplete) {
      // Certitude en direct : déjà placée dans le bracket → « En séries » ;
      // sûre de passer (pire rang ≤ coupe) → « Qualifié » ; plus aucun scénario
      // pour passer → « Éliminé » ; sinon encore « En lice ».
      const p = plages?.get(row.teamId);
      if (aliveInPlayoffs.has(row.teamId)) { status = 'qualified'; label = 'En séries'; }
      else if (p && p.max <= playoffSize) { status = 'qualified'; label = 'Qualifié'; }
      else if (p && p.min > playoffSize) { status = 'eliminated'; label = 'Éliminé'; }
      else { status = 'contention'; label = 'En lice'; }
    } else if (!inPlayoffs) {
      status = 'eliminated'; label = 'Éliminé';
    } else if (finaleRes.winner === row.teamId) {
      status = 'champion'; label = '🏆 Champion'; placement = 1;
    } else if (finaleRes.loser === row.teamId) {
      status = 'finalist'; label = '🥈 Finaliste'; placement = 2;
    } else if (bronzeRes.winner === row.teamId) {
      status = 'bronze'; label = '🥉 Bronze'; placement = 3;
    } else if (bronzeRes.loser === row.teamId) {
      status = 'eliminated'; label = '4e place'; placement = 4;
    } else if (aliveInPlayoffs.has(row.teamId)) {
      status = 'qualified'; label = 'En séries';
    } else if (lostAt.has(row.teamId)) {
      status = 'eliminated'; label = `Éliminé ${PHASE_LABEL[lostAt.get(row.teamId)!] ?? ''}`.trim();
    } else {
      // Qualifiée mais sa 1re partie de séries n'est pas encore jouée/résolue.
      status = 'qualified'; label = 'En séries';
    }

    byTeam.set(row.teamId, { teamId: row.teamId, rank: row.rank, status, label, placement, inPlayoffs });
  }

  return {
    playoffSize,
    guaranteedComplete,
    cutRank: playoffSize,
    championId: finaleRes.winner,
    runnerUpId: finaleRes.loser,
    bronzeId: bronzeRes.winner,
    byTeam,
  };
}

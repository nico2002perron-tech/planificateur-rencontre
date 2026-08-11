/**
 * Classement de tournoi — fonction PURE, calculée à la volée depuis les
 * parties TERMINÉES. Jamais stocké en base : impossible d'être désynchronisé.
 *
 * Bris d'égalité (dans l'ordre) : points → POINTS CONTRE (le moins = devant,
 * comme dans les tournois de balle : ça décourage de gonfler les pointages) →
 * différentiel → points pour → nom.
 * (Le face-à-face n'est pas implanté — à considérer si un tournoi le réclame.)
 */

export interface StandingsMatch {
  phase: string;
  status: string;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
}

export interface PointsConfig {
  win: number;
  tie: number;
  loss: number;
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  rank: number;
  played: number;
  wins: number;
  ties: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  points: number;
}

/**
 * @param phases parties comptabilisées — par défaut la phase « garantie »
 *               seulement (les éliminatoires ne changent pas le classement).
 */
export function computeStandings(
  teams: { id: string; name: string }[],
  matches: StandingsMatch[],
  points: PointsConfig,
  phases: string[] = ['garantie'],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map(t => [t.id, {
      teamId: t.id,
      teamName: t.name,
      rank: 0,
      played: 0,
      wins: 0,
      ties: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      points: 0,
    }]),
  );

  for (const m of matches) {
    if (m.status !== 'finished' || !phases.includes(m.phase)) continue;
    if (!m.teamAId || !m.teamBId || m.scoreA === null || m.scoreB === null) continue;
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b) continue;

    a.played++;
    b.played++;
    a.pointsFor += m.scoreA;
    a.pointsAgainst += m.scoreB;
    b.pointsFor += m.scoreB;
    b.pointsAgainst += m.scoreA;

    if (m.scoreA > m.scoreB) {
      a.wins++;
      b.losses++;
      a.points += points.win;
      b.points += points.loss;
    } else if (m.scoreA < m.scoreB) {
      b.wins++;
      a.losses++;
      b.points += points.win;
      a.points += points.loss;
    } else {
      a.ties++;
      b.ties++;
      a.points += points.tie;
      b.points += points.tie;
    }
  }

  const sorted = [...rows.values()];
  sorted.forEach(r => { r.diff = r.pointsFor - r.pointsAgainst; });
  sorted.sort((x, y) =>
    y.points - x.points ||
    x.pointsAgainst - y.pointsAgainst ||
    y.diff - x.diff ||
    y.pointsFor - x.pointsFor ||
    x.teamName.localeCompare(y.teamName, 'fr'),
  );
  sorted.forEach((r, i) => { r.rank = i + 1; });
  return sorted;
}

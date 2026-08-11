/**
 * Certitude des rangs — moteur PUR (sans DB) : pendant la phase garantie, quel
 * rang final chaque équipe peut-elle ENCORE atteindre, compte tenu des parties
 * restantes ? C'est ce qui permet de remplir le bracket « au fur et à mesure
 * que c'est sûr » (qui passe, contre qui, à quelle heure) sans attendre que
 * tout soit joué.
 *
 * Principe : pour chaque équipe, bornes de points (elle gagne/perd tout ce qui
 * lui reste) et borne de points contre (ils ne peuvent que MONTER — c'est ce
 * qui rend le bris d'égalité « moins de points contre » si vite verrouillable).
 * Deux équipes se comparent par meilleur cas contre pire cas : le doute profite
 * toujours à l'incertitude — on ne déclare JAMAIS un rang sûr à tort. Quand
 * toutes les parties sont jouées, les plages se referment sur le classement.
 */

import type { PointsConfig } from './standings';

/** Ce que le moteur a besoin de savoir d'une partie (structurel, sans DB). */
export interface PartieCertitude {
  phase: string;
  status: string;
  team_a_id: string | null;
  team_b_id: string | null;
}

/** Une ligne de classement réduite au nécessaire (StandingRow convient). */
export interface EquipeClassee {
  teamId: string;
  points: number;
  pointsAgainst: number;
}

export interface PlageDeRang {
  min: number; // meilleur rang final encore atteignable
  max: number; // pire rang final encore possible
}

/**
 * @param classement dans l'ORDRE ACTUEL du classement (computeStandings) — cet
 *                   ordre sert de verdict exact entre deux équipes qui ont fini.
 */
export function plagesDeRang(
  matches: readonly PartieCertitude[],
  classement: readonly EquipeClassee[],
  pts: PointsConfig,
): Map<string, PlageDeRang> {
  // Parties garanties restantes par équipe (annulées exclues)
  const restantes = new Map<string, number>();
  for (const m of matches) {
    if (m.phase !== 'garantie' || m.status === 'finished' || m.status === 'cancelled') continue;
    for (const id of [m.team_a_id, m.team_b_id]) {
      if (id) restantes.set(id, (restantes.get(id) || 0) + 1);
    }
  }

  const meilleur = Math.max(pts.win, pts.tie, pts.loss);
  const pire = Math.min(pts.win, pts.tie, pts.loss);
  const position = new Map(classement.map((r, i) => [r.teamId, i]));
  const infos = classement.map(r => {
    const reste = restantes.get(r.teamId) || 0;
    return {
      id: r.teamId,
      reste,
      ptsMax: r.points + reste * meilleur,
      ptsMin: r.points + reste * pire,
      pc: r.pointsAgainst,
    };
  });
  type Info = (typeof infos)[number];

  // B peut-elle encore finir DEVANT A ? Meilleur cas de B contre pire cas de A.
  const peutDevancer = (b: Info, a: Info): boolean => {
    // Deux fiches terminées : le classement actuel est leur verdict final.
    if (b.reste === 0 && a.reste === 0) return (position.get(b.id) ?? 0) < (position.get(a.id) ?? 0);
    if (b.ptsMax > a.ptsMin) return true;
    if (b.ptsMax < a.ptsMin) return false;
    // Égalité de points atteignable → points contre : ceux de B ne peuvent que
    // monter (meilleur cas = actuels), ceux de A montent sans limite si elle
    // joue encore.
    const pcB = b.pc;
    const pcA = a.reste > 0 ? Infinity : a.pc;
    if (pcB < pcA) return true;
    if (pcB > pcA) return false;
    return true; // même points contre possibles → départage plus fin : prudence
  };

  const plages = new Map<string, PlageDeRang>();
  for (const a of infos) {
    let devantAssurees = 0;  // équipes devant A dans TOUS les scénarios
    let devantPossibles = 0; // équipes qui PEUVENT encore finir devant A
    for (const b of infos) {
      if (b.id === a.id) continue;
      if (peutDevancer(b, a)) devantPossibles++;
      if (!peutDevancer(a, b)) devantAssurees++;
    }
    plages.set(a.id, { min: devantAssurees + 1, max: devantPossibles + 1 });
  }
  return plages;
}

/**
 * rang → équipe, pour les seuls rangs VERROUILLÉS (min = max, une seule équipe
 * possible). C'est ce que le bracket consomme : « 2e au classement » se remplit
 * dès que le rang 2 est verrouillé, même s'il reste des parties ailleurs.
 */
export function rangsVerrouilles(plages: Map<string, PlageDeRang>): Map<number, string> {
  const candidates = new Map<number, string[]>();
  for (const [id, p] of plages) {
    if (p.min !== p.max) continue;
    const liste = candidates.get(p.min) ?? [];
    liste.push(id);
    candidates.set(p.min, liste);
  }
  const verrouilles = new Map<number, string>();
  for (const [rang, ids] of candidates) {
    if (ids.length === 1) verrouilles.set(rang, ids[0]);
  }
  return verrouilles;
}

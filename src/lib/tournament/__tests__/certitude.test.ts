/**
 * Moteur de certitude des rangs : plages [meilleur, pire] rang final possibles
 * par équipe, et rangs verrouillés (plus aucun scénario ne peut les changer).
 * Le bris d'égalité « moins de points contre » est la clé : les points contre
 * ne peuvent que monter, ce qui fige les rangs bien avant la fin de la phase.
 */
import { describe, it, expect } from 'vitest';
import { plagesDeRang, rangsVerrouilles, type PartieCertitude, type EquipeClassee } from '../certitude';
import { computeQualification } from '../qualification';
import type { TournamentMatch } from '../state';

const P = { win: 2, tie: 1, loss: 0 };

const g = (a: string, b: string, sa: number | null = null, sb: number | null = null): PartieCertitude & {
  score_a: number | null; score_b: number | null;
} => ({
  phase: 'garantie',
  status: sa === null ? 'scheduled' : 'finished',
  team_a_id: a, team_b_id: b, score_a: sa, score_b: sb,
});

const ligne = (teamId: string, points: number, pointsAgainst: number): EquipeClassee => ({ teamId, points, pointsAgainst });

describe('plagesDeRang', () => {
  it('tout joué → chaque plage se referme sur le rang du classement', () => {
    const matches = [g('t1', 't2', 10, 5), g('t3', 't4', 8, 6)];
    const cl = [ligne('t1', 2, 5), ligne('t3', 2, 6), ligne('t4', 0, 8), ligne('t2', 0, 10)];
    const plages = plagesDeRang(matches, cl, P);
    expect(plages.get('t1')).toEqual({ min: 1, max: 1 });
    expect(plages.get('t3')).toEqual({ min: 2, max: 2 });
    expect(plages.get('t2')).toEqual({ min: 4, max: 4 });
    expect(rangsVerrouilles(plages).size).toBe(4);
  });

  it('le rang 1 se verrouille tôt quand les points contre des poursuivantes sont déjà trop hauts', () => {
    // t1 a fini : 4 pts, 15 PC. t4 peut encore atteindre 4 pts mais traîne 16 PC.
    const matches = [
      g('t1', 't2', 10, 8), g('t1', 't3', 9, 7), g('t2', 't4', 16, 17),
      g('t3', 't4'), // à venir
    ];
    const cl = [ligne('t1', 4, 15), ligne('t4', 2, 16), ligne('t3', 0, 9), ligne('t2', 0, 27)];
    const plages = plagesDeRang(matches, cl, P);
    expect(plages.get('t1')).toEqual({ min: 1, max: 1 });
    expect(rangsVerrouilles(plages).get(1)).toBe('t1');
    // t4 n'est pas verrouillée : t3 peut encore la doubler (9 PC, une partie à jouer)
    expect(plages.get('t4')?.min).toBe(2);
    expect(plages.get('t4')?.max).toBeGreaterThan(2);
  });

  it('une équipe à points contre plus bas peut toujours doubler → rien de verrouillé', () => {
    const matches = [g('t1', 't2', 10, 8), g('t3', 't4')];
    const cl = [ligne('t1', 2, 8), ligne('t3', 0, 0), ligne('t4', 0, 0), ligne('t2', 0, 10)];
    const plages = plagesDeRang(matches, cl, P);
    expect(plages.get('t1')).toEqual({ min: 1, max: 3 }); // t3 ou t4 peuvent gagner avec moins de PC
    expect(rangsVerrouilles(plages).has(1)).toBe(false);
  });

  it('les parties annulées ne comptent pas comme restantes', () => {
    const matches = [
      g('t1', 't2', 10, 5),
      { ...g('t3', 't4'), status: 'cancelled' },
    ];
    const cl = [ligne('t1', 2, 5), ligne('t3', 0, 0), ligne('t4', 0, 0), ligne('t2', 0, 10)];
    // plus aucune partie restante → fiches finies → classement = verdict
    expect(rangsVerrouilles(plagesDeRang(matches, cl, P)).size).toBe(4);
  });
});

describe('computeQualification — statuts sûrs avant la fin de la phase', () => {
  const M = (over: Partial<TournamentMatch> & { n: number }): TournamentMatch => ({
    id: `m${over.n}`, phase: 'garantie', round_number: 1, court: 1,
    scheduled_date: '', scheduled_time: '09:00',
    team_a_id: null, team_b_id: null, source_a: '', source_b: '',
    score_a: null, score_b: null, status: 'scheduled',
    ...over, match_number: over.n,
  } as TournamentMatch);

  it('« Qualifié » dès que le pire rang tient dans la coupe, « Éliminé » dès que le meilleur n\'y tient plus', () => {
    // Finale à 2 : t1 finie à 4 pts (sûre de passer), t3 finie à 0 pt avec
    // 3 équipes assurées devant (sortie), t2/t4 encore en lice.
    const matches = [
      M({ n: 1, team_a_id: 't1', team_b_id: 't3', score_a: 10, score_b: 2, status: 'finished' }),
      M({ n: 2, team_a_id: 't1', team_b_id: 't3', score_a: 8, score_b: 1, status: 'finished' }),
      M({ n: 3, team_a_id: 't2', team_b_id: 't4', score_a: 6, score_b: 3, status: 'finished' }),
      M({ n: 4, team_a_id: 't2', team_b_id: 't4' }), // à venir
    ];
    const standings = [
      { teamId: 't1', rank: 1, points: 4, pointsAgainst: 3 },
      { teamId: 't2', rank: 2, points: 2, pointsAgainst: 3 },
      { teamId: 't4', rank: 3, points: 0, pointsAgainst: 6 },
      { teamId: 't3', rank: 4, points: 0, pointsAgainst: 18 },
    ];
    const qual = computeQualification(standings, matches, { playoffsEnabled: true, playoffSize: 2, points: P });
    expect(qual.guaranteedComplete).toBe(false);
    expect(qual.byTeam.get('t1')?.label).toBe('Qualifié');
    expect(qual.byTeam.get('t3')?.label).toBe('Éliminé');
    expect(qual.byTeam.get('t2')?.label).toBe('En lice');
    expect(qual.byTeam.get('t4')?.label).toBe('En lice');
  });

  it('sans points/pointsAgainst dans le classement, on retombe sur « En lice » (aucune fausse certitude)', () => {
    const matches = [
      M({ n: 1, team_a_id: 't1', team_b_id: 't2', score_a: 10, score_b: 2, status: 'finished' }),
      M({ n: 2, team_a_id: 't1', team_b_id: 't2' }),
    ];
    const qual = computeQualification(
      [{ teamId: 't1', rank: 1 }, { teamId: 't2', rank: 2 }],
      matches,
      { playoffsEnabled: true, playoffSize: 2 },
    );
    expect(qual.byTeam.get('t1')?.label).toBe('En lice');
  });
});

/**
 * Remplissage du bracket par CERTITUDE : une case « Ne au classement » se
 * remplit dès que le rang N est mathématiquement verrouillé (aucun scénario des
 * parties restantes ne peut y mettre une autre équipe) — l'équipe sait qui elle
 * affronte et à quelle heure sans attendre la fin de la phase garantie.
 */
import { describe, it, expect } from 'vitest';
import { buildPlayoffMatches, resolvePlayoffSlots } from '../playoffs';
import { computeStandings } from '../standings';
import type { TournamentMatch } from '../state';

type Sur = Partial<TournamentMatch> & { id: string; n: number };

const M = (over: Sur): TournamentMatch => ({
  phase: 'garantie', round_number: 1, court: 1,
  scheduled_date: '', scheduled_time: '09:00',
  team_a_id: null, team_b_id: null, source_a: '', source_b: '',
  score_a: null, score_b: null, status: 'scheduled',
  ...over, match_number: over.n,
} as TournamentMatch);

const finie = (over: Sur): TournamentMatch => M({ status: 'finished', ...over });

const P = { win: 2, tie: 1, loss: 0 };
const equipes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `t${i + 1}` }));
const classement = (ms: TournamentMatch[], n = 4) => computeStandings(equipes(n), ms.map(m => ({
  phase: m.phase, status: m.status, teamAId: m.team_a_id, teamBId: m.team_b_id, scoreA: m.score_a, scoreB: m.score_b,
})), P);

const finale = (over: Partial<TournamentMatch> = {}) =>
  M({ id: 'f', n: 10, phase: 'finale', source_a: '1er au classement', source_b: '2e au classement', ...over });

describe('buildPlayoffMatches', () => {
  it('appariements standards 1v4/2v3 et 1v8/4v5/2v7/3v6', () => {
    const s4 = buildPlayoffMatches(4, 10);
    expect(s4[0].source_a).toBe('1er au classement');
    expect(s4[0].source_b).toBe('4e au classement');
    expect(s4[1].source_a).toBe('2e au classement');
    expect(s4[3].source_b).toBe('Gagnant M11');
    expect(buildPlayoffMatches(8, 20)[0].source_b).toBe('8e au classement');
    expect(buildPlayoffMatches(2, 5)[0].source_b).toBe('2e au classement');
  });
});

describe('resolvePlayoffSlots — remplissage dès que le rang est verrouillé', () => {
  it('le 1er au classement se place AVANT la fin de la phase quand plus personne ne peut le déloger', () => {
    // t1 a fini 2-0 avec très peu de points contre ; t2/t3/t4 peuvent encore
    // atteindre ses points mais leurs points contre sont déjà plus hauts.
    const matches = [
      finie({ id: 'g1', n: 1, team_a_id: 't1', team_b_id: 't2', score_a: 10, score_b: 8 }),
      finie({ id: 'g2', n: 2, team_a_id: 't1', team_b_id: 't3', score_a: 9, score_b: 7 }),
      finie({ id: 'g3', n: 3, team_a_id: 't2', team_b_id: 't4', score_a: 6, score_b: 12 }),
      M({ id: 'g4', n: 4, team_a_id: 't3', team_b_id: 't4' }), // reste une partie
      finale(),
    ];
    // t1 : 4 pts, 15 PC, fiche finie. t4 : 2 pts (max 4), déjà 6 PC… mais 6 < 15 !
    // → t4 pourrait finir 1re : rang 1 PAS verrouillé. Refaisons t4 avec PC plus haut.
    const durci = matches.map(m => m.id === 'g3' ? finie({ id: 'g3', n: 3, team_a_id: 't2', team_b_id: 't4', score_a: 16, score_b: 17 }) : m);
    // t4 : 2 pts (max 4), 16 PC > 15 → même à 4 pts elle reste derrière t1.
    const changes = resolvePlayoffSlots(durci, classement(durci), P);
    expect(changes).toEqual([{ id: 'f', team_a_id: 't1', team_b_id: null }]);
  });

  it('rien ne se place tant qu\'un scénario peut encore tout changer', () => {
    const matches = [
      finie({ id: 'g1', n: 1, team_a_id: 't1', team_b_id: 't2', score_a: 10, score_b: 8 }),
      M({ id: 'g2', n: 2, team_a_id: 't3', team_b_id: 't4' }), // t3/t4 à 0 PC : tout est ouvert
      finale(),
    ];
    expect(resolvePlayoffSlots(matches, classement(matches), P)).toEqual([]);
  });

  it('toutes les parties jouées : tous les rangs verrouillés (comportement final inchangé)', () => {
    const matches = [
      finie({ id: 'g1', n: 1, team_a_id: 't1', team_b_id: 't2', score_a: 10, score_b: 5 }),
      finie({ id: 'g2', n: 2, team_a_id: 't3', team_b_id: 't4', score_a: 8, score_b: 6 }),
      finale(),
    ];
    // t1 et t3 gagnantes (2 pts) ; PC : t1 = 5 < t3 = 6 → t1 première
    const changes = resolvePlayoffSlots(matches, classement(matches), P);
    expect(changes).toEqual([{ id: 'f', team_a_id: 't1', team_b_id: 't3' }]);
  });

  it('correction : un score remis en attente déverrouille le rang → case vidée', () => {
    const matches = [
      finie({ id: 'g1', n: 1, team_a_id: 't1', team_b_id: 't2', score_a: 10, score_b: 5 }),
      M({ id: 'g2', n: 2, team_a_id: 't3', team_b_id: 't4' }), // remise en attente
      finale({ team_a_id: 't1' }), // t1 avait été placée
    ];
    const changes = resolvePlayoffSlots(matches, classement(matches), P);
    expect(changes).toEqual([{ id: 'f', team_a_id: null, team_b_id: null }]);
  });

  it('une partie de séries terminée n\'est jamais retouchée', () => {
    const matches = [
      finie({ id: 'd1', n: 2, phase: 'demi', team_a_id: 't1', team_b_id: 't4', score_a: 25, score_b: 10 }),
      finie({ id: 'f', n: 4, phase: 'finale', team_a_id: 't9', team_b_id: 't8', score_a: 20, score_b: 18, source_a: 'Gagnant M2', source_b: '' }),
    ];
    expect(resolvePlayoffSlots(matches, [], P)).toEqual([]);
  });

  it('Gagnant/Perdant MX : propagation inchangée, égalité jamais départagée', () => {
    const matches = [
      finie({ id: 'd1', n: 2, phase: 'demi', team_a_id: 't1', team_b_id: 't4', score_a: 10, score_b: 21 }),
      M({ id: 'br', n: 3, phase: 'bronze', source_a: 'Perdant M2', source_b: 'Perdant M9' }),
      M({ id: 'f2', n: 4, phase: 'finale', source_a: 'Gagnant M2', source_b: '' }),
      finie({ id: 'd2', n: 9, phase: 'demi', team_a_id: 't5', team_b_id: 't6', score_a: 7, score_b: 7 }), // égalité
    ];
    const changes = resolvePlayoffSlots(matches, [], P);
    expect(changes.find(c => c.id === 'br')).toEqual({ id: 'br', team_a_id: 't1', team_b_id: null });
    expect(changes.find(c => c.id === 'f2')).toEqual({ id: 'f2', team_a_id: 't4', team_b_id: null });
  });
});

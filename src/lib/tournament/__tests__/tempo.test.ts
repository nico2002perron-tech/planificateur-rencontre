/**
 * Témoin d'avance/retard : compare l'heure réelle à la prochaine partie à
 * jouer de la journée. Les dates sans « Z » sont interprétées en heure LOCALE,
 * ce qui rend les tests déterministes peu importe le fuseau du poste.
 */
import { describe, it, expect } from 'vitest';
import { etatDuTempo } from '../tempo';

const JOUR = '2026-08-15';
const partie = (n: number, time: string, status = 'scheduled') => ({
  match_number: n, scheduled_date: JOUR, scheduled_time: time, status,
});

const GRILLE = [
  partie(1, '13:20', 'finished'),
  partie(2, '14:25'),
  partie(3, '15:30'),
];

describe('etatDuTempo', () => {
  it('terrain libre avant la prochaine partie → en avance', () => {
    const t = etatDuTempo(GRILLE, JOUR, JOUR, 60, new Date('2026-08-15T14:00:00'));
    expect(t).toEqual({ etat: 'avance', minutes: 25, matchNumber: 2 });
  });

  it('dans la fenêtre de la partie en cours → à l\'heure', () => {
    const t = etatDuTempo(GRILLE, JOUR, JOUR, 60, new Date('2026-08-15T14:30:00'));
    expect(t).toEqual({ etat: 'heure', matchNumber: 2 });
  });

  it('la partie devrait être finie et n\'a pas de pointage → en retard', () => {
    const t = etatDuTempo(GRILLE, JOUR, JOUR, 60, new Date('2026-08-15T15:40:00'));
    expect(t).toEqual({ etat: 'retard', minutes: 15, matchNumber: 2 });
  });

  it('une partie écourtée réglée tôt → l\'avance saute à la partie suivante', () => {
    const grille = [partie(1, '13:20', 'finished'), partie(2, '14:25', 'finished'), partie(3, '15:30')];
    const t = etatDuTempo(grille, JOUR, JOUR, 60, new Date('2026-08-15T14:50:00'));
    expect(t).toEqual({ etat: 'avance', minutes: 40, matchNumber: 3 });
  });

  it('toutes les parties de la journée réglées → fini', () => {
    const grille = GRILLE.map(m => ({ ...m, status: 'finished' }));
    expect(etatDuTempo(grille, JOUR, JOUR, 60, new Date('2026-08-15T16:00:00'))).toEqual({ etat: 'fini' });
  });

  it('la veille du tournoi → null (le témoin n\'a de sens que le jour même)', () => {
    expect(etatDuTempo(GRILLE, JOUR, JOUR, 60, new Date('2026-08-14T14:00:00'))).toBeNull();
  });

  it('les parties annulées ne comptent pas', () => {
    const grille = [partie(1, '13:20', 'finished'), partie(2, '14:25', 'cancelled'), partie(3, '15:30')];
    const t = etatDuTempo(grille, JOUR, JOUR, 60, new Date('2026-08-15T14:00:00'));
    expect(t).toEqual({ etat: 'avance', minutes: 90, matchNumber: 3 });
  });
});

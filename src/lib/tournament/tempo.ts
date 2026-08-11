/**
 * Témoin « suis-je en avance ? » — fonction PURE (testable sans DB).
 *
 * L'horaire ne bouge JAMAIS tout seul : les heures annoncées sont des promesses
 * aux équipes. Ce témoin compare plutôt l'heure RÉELLE à la prochaine partie à
 * jouer de la journée affichée :
 *  - avance : toutes les parties d'avant sont réglées et la prochaine ne
 *             commence que dans X minutes — le terrain est libre (une partie
 *             écourtée par la règle des 10 points, par exemple) ;
 *  - heure  : on est dans la fenêtre prévue de la partie en cours ;
 *  - retard : la partie devrait être finie depuis X minutes et n'a toujours
 *             pas de pointage — les chips « Décaler le reste » sont juste à côté.
 * Retourne null hors du jour même (le témoin n'a aucun sens la veille) ou si
 * la journée n'a pas de partie.
 */

import type { TournamentMatch } from './state';

export type Tempo =
  | { etat: 'fini' }
  | { etat: 'avance'; minutes: number; matchNumber: number }
  | { etat: 'heure'; matchNumber: number }
  | { etat: 'retard'; minutes: number; matchNumber: number };

type PartieTempo = Pick<TournamentMatch, 'match_number' | 'scheduled_date' | 'scheduled_time' | 'status'>;

export function etatDuTempo(
  matches: readonly PartieTempo[],
  jour: string,
  dateEvenement: string,
  minutesParPartie: number,
  maintenant: Date,
): Tempo | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  const aujourdhui = `${maintenant.getFullYear()}-${pad(maintenant.getMonth() + 1)}-${pad(maintenant.getDate())}`;
  if (!jour || jour !== aujourdhui) return null;

  const duJour = matches
    .filter(m => (m.scheduled_date || dateEvenement) === jour && m.status !== 'cancelled' && !!m.scheduled_time)
    .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
  if (duJour.length === 0) return null;

  const prochaine = duJour.find(m => m.status !== 'finished');
  if (!prochaine) return { etat: 'fini' };

  const [h, mn] = prochaine.scheduled_time.split(':').map(n => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(mn)) return null;
  const debut = h * 60 + mn;
  const finPrevue = debut + Math.max(1, minutesParPartie);
  const laMinute = maintenant.getHours() * 60 + maintenant.getMinutes();

  if (laMinute < debut) return { etat: 'avance', minutes: debut - laMinute, matchNumber: prochaine.match_number };
  if (laMinute > finPrevue) return { etat: 'retard', minutes: laMinute - finPrevue, matchNumber: prochaine.match_number };
  return { etat: 'heure', matchNumber: prochaine.match_number };
}

/**
 * Générateur d'horaire de tournoi — fonctions PURES (testables sans DB).
 *
 * Format « parties garanties » : chaque équipe doit jouer AU MOINS N parties
 * (N = 1 à 5, configuré par l'organisateur). Les adversaires sont tous
 * différents tant que le nombre d'équipes le permet (méthode du cercle,
 * la rotation classique du round-robin, tronquée à N rondes).
 *
 * Contraintes respectées :
 *  - une équipe ne joue jamais deux fois dans le même créneau horaire ;
 *  - les parties remplissent les terrains disponibles créneau par créneau ;
 *  - on évite (au mieux) qu'une équipe joue deux créneaux de suite ;
 *  - nombre impair d'équipes : certaines joueront une partie DE PLUS que N
 *    (jamais moins) — le résumé les identifie pour l'aperçu de l'organisateur.
 */

export interface SchedulerTeam {
  id: string;
  name: string;
}

export interface SchedulerConfig {
  guaranteedGames: number; // parties garanties par équipe (minimum)
  courts: number;          // terrains disponibles
  startTime: string;       // 'HH:MM'
  gameMinutes: number;     // durée d'une partie
  breakMinutes: number;    // pause entre les créneaux
}

export interface GeneratedMatch {
  matchNumber: number;     // M1, M2, … dans l'ordre chronologique
  roundNumber: number;     // ronde d'origine de la rotation (référence)
  court: number;           // 1-based
  slot: number;            // créneau horaire 0-based
  scheduledTime: string;   // 'HH:MM'
  teamAId: string;
  teamBId: string;
}

export interface ScheduleSummary {
  gamesPerTeam: Record<string, number>;
  teamsWithExtraGame: string[];  // ids des équipes au-dessus du minimum garanti
  hasRematches: boolean;         // vrai si N > équipes-1 a forcé des revanches
  totalSlots: number;
  endTime: string;               // 'HH:MM' — fin estimée de la dernière partie
}

export interface GeneratedSchedule {
  matches: GeneratedMatch[];
  summary: ScheduleSummary;
}

// ── Heures ───────────────────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 9 * 60;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const mn = total % 60;
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

export function slotTime(startTime: string, slot: number, gameMinutes: number, breakMinutes: number): string {
  return fromMinutes(toMinutes(startTime) + slot * (gameMinutes + breakMinutes));
}

export function addMinutes(hhmm: string, minutes: number): string {
  return fromMinutes(toMinutes(hhmm) + minutes);
}

// ── Rotation (méthode du cercle) ─────────────────────────────────────────────

interface Pairing { a: string; b: string; round: number }

/**
 * Génère les paires ronde par ronde. Équipe fictive (bye) si nombre impair.
 * Si N dépasse le round-robin complet (équipes-1 rondes), la rotation
 * recommence — des revanches deviennent inévitables et sont signalées.
 */
function circlePairings(teamIds: string[], roundsNeeded: number): { pairings: Pairing[]; hasRematches: boolean } {
  const BYE = '__bye__';
  const ring = [...teamIds];
  if (ring.length % 2 === 1) ring.push(BYE);
  const n = ring.length;
  const fullCycle = n - 1;
  const hasRematches = roundsNeeded > fullCycle;

  const pairings: Pairing[] = [];
  for (let r = 0; r < roundsNeeded; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a !== BYE && b !== BYE) pairings.push({ a, b, round: r + 1 });
    }
    // Rotation : le premier reste fixe, les autres tournent d'un cran
    ring.splice(1, 0, ring.pop() as string);
  }
  return { pairings, hasRematches };
}

// ── Génération principale ────────────────────────────────────────────────────

export function generateSchedule(teams: SchedulerTeam[], config: SchedulerConfig): GeneratedSchedule {
  const N = Math.max(1, Math.floor(config.guaranteedGames));
  const courts = Math.max(1, Math.floor(config.courts));
  const teamIds = teams.map(t => t.id);

  if (teamIds.length < 2) {
    return {
      matches: [],
      summary: { gamesPerTeam: {}, teamsWithExtraGame: [], hasRematches: false, totalSlots: 0, endTime: config.startTime },
    };
  }

  // 1. Assez de rondes pour garantir N parties à tout le monde.
  //    Nombre impair → une équipe saute chaque ronde, il faut une ronde de plus.
  const odd = teamIds.length % 2 === 1;
  const roundsNeeded = odd ? N + 1 : N;
  const { pairings, hasRematches } = circlePairings(teamIds, roundsNeeded);

  // 2. Élagage : on retire (en partant de la fin) les parties dont LES DEUX
  //    équipes dépassent déjà le minimum garanti — personne ne descend sous N.
  const count: Record<string, number> = Object.fromEntries(teamIds.map(id => [id, 0]));
  pairings.forEach(p => { count[p.a]++; count[p.b]++; });
  const kept: Pairing[] = [...pairings];
  for (let i = kept.length - 1; i >= 0; i--) {
    const { a, b } = kept[i];
    if (count[a] > N && count[b] > N) {
      count[a]--;
      count[b]--;
      kept.splice(i, 1);
    }
  }

  // 3. Placement en créneaux : glouton dans l'ordre des rondes.
  //    Passe 1 — équipes qui ne jouaient PAS au créneau précédent (évite le dos-à-dos).
  //    Passe 2 — s'il reste des terrains libres, on accepte le dos-à-dos.
  const pending = [...kept];
  const slots: Pairing[][] = [];
  let prevSlotTeams = new Set<string>();

  while (pending.length > 0) {
    const slotMatches: Pairing[] = [];
    const busy = new Set<string>();

    const tryFill = (allowBackToBack: boolean) => {
      for (let i = 0; i < pending.length && slotMatches.length < courts; i++) {
        const p = pending[i];
        if (busy.has(p.a) || busy.has(p.b)) continue;
        if (!allowBackToBack && (prevSlotTeams.has(p.a) || prevSlotTeams.has(p.b))) continue;
        slotMatches.push(p);
        busy.add(p.a);
        busy.add(p.b);
        pending.splice(i, 1);
        i--;
      }
    };

    tryFill(false);
    tryFill(true);

    // Sécurité anti-boucle : impossible en pratique (le premier match en attente
    // est toujours plaçable en passe 2), mais on ne prend aucun risque.
    if (slotMatches.length === 0) {
      slotMatches.push(pending.shift() as Pairing);
    }

    slots.push(slotMatches);
    prevSlotTeams = busy;
  }

  // 4. Heures + numérotation chronologique.
  const matches: GeneratedMatch[] = [];
  let matchNumber = 1;
  slots.forEach((slotMatches, slot) => {
    const time = slotTime(config.startTime, slot, config.gameMinutes, config.breakMinutes);
    slotMatches.forEach((p, courtIdx) => {
      matches.push({
        matchNumber: matchNumber++,
        roundNumber: p.round,
        court: courtIdx + 1,
        slot,
        scheduledTime: time,
        teamAId: p.a,
        teamBId: p.b,
      });
    });
  });

  // Fin estimée = début du dernier créneau + durée d'une partie
  const lastSlotStart = slots.length > 0
    ? slotTime(config.startTime, slots.length - 1, config.gameMinutes, config.breakMinutes)
    : config.startTime;
  const endTime = slots.length > 0 ? addMinutes(lastSlotStart, config.gameMinutes) : config.startTime;

  return {
    matches,
    summary: {
      gamesPerTeam: count,
      teamsWithExtraGame: teamIds.filter(id => count[id] > N),
      hasRematches,
      totalSlots: slots.length,
      endTime,
    },
  };
}

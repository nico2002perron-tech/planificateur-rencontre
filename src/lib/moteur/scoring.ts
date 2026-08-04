// SCORING — agrège les axes disponibles en un score global, identifie les axes
// faibles et l'ordre du récit (du plus faible au plus fort).

import type { ResultatAxe, ScoreGlobal, NomAxe } from "@/types/diagnostic";

/** En deçà de ce score, un axe est considéré « faible » (mis de l'avant). */
const SEUIL_FAIBLE = 60;

export function calculerScoreGlobal(axes: ResultatAxe[]): ScoreGlobal {
  // Un axe indisponible (donnée manquante) ne pénalise pas le score global.
  const disponibles = axes.filter((a) => a.disponible);

  const score =
    disponibles.length > 0
      ? Math.round(disponibles.reduce((s, a) => s + a.score, 0) / disponibles.length)
      : 0;

  const tries = [...disponibles].sort((a, b) => a.score - b.score);
  const ordreNarratif: NomAxe[] = tries.map((a) => a.nom);
  const axesFaibles: NomAxe[] = tries
    .filter((a) => a.score < SEUIL_FAIBLE)
    .slice(0, 3)
    .map((a) => a.nom);

  return { score, axesFaibles, ordreNarratif };
}

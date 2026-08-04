// CONTRE-PROPOSITION (privé) — « ce qu'il possède vs ce que je propose ».
// Cœur pur : on fait tourner les MÊMES axes du moteur sur les deux portefeuilles
// (actuel, proposé) et on diffe. Réutilise frais + géographie → cohérence garantie
// avec le diagnostic public. Déterministe et testable ; aucune I/O.

import type { PositionResolue, ProjectionFrais } from "@/types/diagnostic";
import { analyserFrais } from "@/lib/moteur/frais";
import { analyserGeographie } from "@/lib/moteur/geographie";
import { arrondir } from "@/lib/moteur/communs";

type FraisD = { rfgPondere?: number };
type GeoD = { canada?: number };

export interface Comparatif {
  valeurTotale: number;
  rfgActuel: number; // pondéré
  rfgPropose: number;
  ecartRfg: number; // actuel − proposé (> 0 = économie de frais)
  economieAnnuelle: number; // approximation année 1 : valeur × écart
  economie: ProjectionFrais; // économie composée (frais évités) à 10/15/25 ans
  canadaActuel: number;
  canadaPropose: number;
}

export function executerComparatif(
  actuel: PositionResolue[],
  propose: PositionResolue[],
): Comparatif {
  const fa = analyserFrais(actuel);
  const fp = analyserFrais(propose);
  const rfgActuel = (fa.axe.donnees as FraisD).rfgPondere ?? 0;
  const rfgPropose = (fp.axe.donnees as FraisD).rfgPondere ?? 0;

  const valeurTotale = actuel.reduce((s, p) => s + p.montant, 0);
  const ecartRfg = rfgActuel - rfgPropose;

  // L'économie composée = coût des frais actuel − coût des frais proposé, aux mêmes horizons.
  const economie: ProjectionFrais = {
    h10: arrondir(fa.projection.h10 - fp.projection.h10),
    h15: arrondir(fa.projection.h15 - fp.projection.h15),
    h25: arrondir(fa.projection.h25 - fp.projection.h25),
  };

  const ga = analyserGeographie(actuel);
  const gp = analyserGeographie(propose);

  return {
    valeurTotale,
    rfgActuel,
    rfgPropose,
    ecartRfg,
    economieAnnuelle: arrondir(valeurTotale * ecartRfg),
    economie,
    canadaActuel: (ga.donnees as GeoD).canada ?? 0,
    canadaPropose: (gp.donnees as GeoD).canada ?? 0,
  };
}

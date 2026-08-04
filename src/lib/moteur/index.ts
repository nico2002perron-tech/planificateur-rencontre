// Cœur du diagnostic — 100 % pur : positions + catalogue de fonds → Diagnostic.
// Aucune I/O, aucun accès réseau/DB. La résolution (table `fonds`, Yahoo) se fait en
// amont et injecte ici le `catalogue`. Chaque chiffre est déterministe et testable.

import type { Position, PositionResolue, Diagnostic } from "@/types/diagnostic";
import type { Fonds } from "@/types/fonds";
import { analyserFrais } from "./frais";
import { analyserChevauchement } from "./chevauchement";
import { analyserConcentration } from "./concentration";
import { analyserGeographie } from "./geographie";
import { calculerScoreGlobal } from "./scoring";

export function executerDiagnostic(
  positions: Position[],
  catalogue: Map<string, Fonds>,
): Diagnostic {
  const valeurTotale = positions.reduce((s, p) => s + p.montant, 0);

  const resolues: PositionResolue[] = positions.map((p) => {
    const fonds = catalogue.get(p.code.trim().toUpperCase());
    return {
      ...p,
      poids: valeurTotale > 0 ? p.montant / valeurTotale : 0,
      fonds,
      nonResolu: !fonds,
    };
  });

  const fondsNonResolus = resolues.filter((r) => r.nonResolu).map((r) => r.code);

  const frais = analyserFrais(resolues);
  const chevauchement = analyserChevauchement(resolues);
  const concentration = analyserConcentration(resolues);
  const geographie = analyserGeographie(resolues);
  const axes = [frais.axe, chevauchement, concentration, geographie];

  return {
    scoreGlobal: calculerScoreGlobal(axes),
    axes,
    positions: resolues,
    fondsNonResolus,
    projectionFrais: frais.projection,
    valeurTotale,
    couvertureFrais: frais.couverture,
  };
}

export {
  analyserFrais,
  analyserChevauchement,
  analyserConcentration,
  analyserGeographie,
  calculerScoreGlobal,
};
export { coutDesFrais } from "./frais";

// Axe GÉOGRAPHIE — biais domestique : poids du Canada vs son poids dans l'indice
// mondial MSCI ACWI (~3 %). Exposition mesurée sur la portion dont la répartition
// géographique est connue (couverture reportée honnêtement).

import type { PositionResolue, ResultatAxe } from "@/types/diagnostic";
import { SEUILS } from "@/config/seuils";
import { borner, arrondir, pct } from "./communs";

export function analyserGeographie(positions: PositionResolue[]): ResultatAxe {
  const valeurTotale = positions.reduce((s, p) => s + p.montant, 0);
  const geoPos = positions.filter((p) => p.fonds?.allocationGeo);
  const valeurGeo = geoPos.reduce((s, p) => s + p.montant, 0);

  if (geoPos.length === 0 || valeurGeo === 0) {
    return {
      nom: "geographie",
      score: 0,
      disponible: false,
      constats: ["La répartition géographique n'est pas disponible pour ces positions."],
      donnees: { disponible: false },
    };
  }

  // Exposition en part de la portion géographiquement connue.
  const expo = new Map<string, number>();
  for (const p of geoPos) {
    const w = p.montant / valeurGeo;
    for (const [region, part] of Object.entries(p.fonds!.allocationGeo!)) {
      expo.set(region, (expo.get(region) ?? 0) + w * part);
    }
  }

  const canada = expo.get("canada") ?? 0;
  const reference = SEUILS.poidsCanadaACWI;
  const biais = canada - reference;
  const couverture = valeurTotale > 0 ? valeurGeo / valeurTotale : 0;

  const regions = [...expo.entries()]
    .map(([region, poids]) => ({ region, poids }))
    .sort((a, b) => b.poids - a.poids);

  // ── Constats ──
  const surPortion =
    couverture < 0.999 ? ` (sur ${pct(couverture, 0)} du portefeuille)` : "";
  const constats: string[] = [];
  constats.push(`Votre exposition au Canada est d'environ ${pct(canada)}${surPortion}.`);
  constats.push(
    `Le poids du Canada dans l'indice mondial MSCI ACWI est d'environ ${pct(reference)}.`,
  );
  if (biais > SEUILS.biaisDomestiqueNotable) {
    constats.push(
      "Votre portefeuille est donc nettement plus exposé au Canada que le marché mondial (biais domestique).",
    );
  }

  // Score de diversification : 100 = aligné ou sous le poids mondial ;
  // décroît avec la surpondération domestique.
  const score = arrondir(borner(100 - (Math.max(0, biais) / (1 - reference)) * 100, 0, 100));

  return {
    nom: "geographie",
    score,
    disponible: true,
    constats,
    donnees: {
      disponible: true,
      canada,
      biais,
      referenceCanadaACWI: reference,
      couverture,
      regions,
    },
  };
}

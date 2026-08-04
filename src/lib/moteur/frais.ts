// Axe FRAIS — RFG pondéré, comparaison à la médiane de catégorie,
// et projection composée du coût des frais. Pur et déterministe.

import type { PositionResolue, ResultatAxe, ProjectionFrais } from "@/types/diagnostic";
import { SEUILS } from "@/config/seuils";
import { borner, arrondir, pct, dollars } from "./communs";

export interface ResultatFrais {
  axe: ResultatAxe;
  projection: ProjectionFrais;
  couverture: number; // 0-1 : part du portefeuille dont le RFG est connu
}

/**
 * Coût cumulé des frais sur `annees`, à rendement brut constant.
 * On compare la valeur finale « sans frais » à la valeur « avec frais » au même
 * rendement brut : la différence capte les frais ET leur effet composé (le manque
 * à gagner sur les frais eux-mêmes).
 *
 *   coût = V0 · [ (1 + g)^n − (1 + g − f)^n ]
 *
 * Propriétés vérifiables : f = 0 → 0 ; g = 0 → V0·(1 − (1 − f)^n).
 */
export function coutDesFrais(
  valeur: number,
  rfg: number,
  tauxBrut: number,
  annees: number,
): number {
  const sansFrais = (1 + tauxBrut) ** annees;
  const avecFrais = (1 + tauxBrut - rfg) ** annees;
  return valeur * (sansFrais - avecFrais);
}

/** Normalise le RFG pondéré sur 0-100 (100 = très bon marché). */
function scoreFrais(rfg: number): number {
  const t = (rfg - SEUILS.rfgExcellent) / (SEUILS.rfgMauvais - SEUILS.rfgExcellent);
  return arrondir(borner(100 - t * 100, 0, 100));
}

export function analyserFrais(positions: PositionResolue[]): ResultatFrais {
  // On ne pondère que sur les positions dont le RFG est connu (couverture honnête).
  const couvertes = positions.filter((p) => p.fonds && typeof p.fonds.rfg === "number");
  const valeurTotale = positions.reduce((s, p) => s + p.montant, 0);
  const valeurCouverte = couvertes.reduce((s, p) => s + p.montant, 0);
  const couverture = valeurTotale > 0 ? valeurCouverte / valeurTotale : 0;

  if (valeurCouverte === 0) {
    // Aucune donnée de frais : échec EXPLICITE, jamais un score silencieux.
    return {
      axe: {
        nom: "frais",
        score: 0,
        disponible: false,
        constats: [
          "Aucun des fonds soumis n'a de RFG connu : les frais ne peuvent pas être calculés.",
        ],
        donnees: { couverture: 0 },
      },
      projection: { h10: 0, h15: 0, h25: 0 },
      couverture: 0,
    };
  }

  const rfgPondere =
    couvertes.reduce((s, p) => s + p.montant * p.fonds!.rfg, 0) / valeurCouverte;

  // Médiane de catégorie pondérée — seulement si connue pour TOUTES les positions couvertes.
  const avecMediane = couvertes.filter(
    (p) => typeof p.fonds!.rfgMedianCategorie === "number",
  );
  const medianePonderee =
    avecMediane.length === couvertes.length
      ? avecMediane.reduce(
          (s, p) => s + p.montant * (p.fonds!.rfgMedianCategorie as number),
          0,
        ) / valeurCouverte
      : null;

  const taux = SEUILS.tauxRendementHypothetique;
  const projection: ProjectionFrais = {
    h10: arrondir(coutDesFrais(valeurCouverte, rfgPondere, taux, 10)),
    h15: arrondir(coutDesFrais(valeurCouverte, rfgPondere, taux, 15)),
    h25: arrondir(coutDesFrais(valeurCouverte, rfgPondere, taux, 25)),
  };

  // ── Constats (des FAITS, jamais une recommandation) ──
  const constats: string[] = [];
  const surPortion =
    couverture < 0.999
      ? ` (sur ${pct(couverture, 0)} du portefeuille — le reste n'est pas résolu)`
      : "";
  constats.push(`Le RFG pondéré de votre portefeuille est de ${pct(rfgPondere, 2)}${surPortion}.`);

  if (medianePonderee !== null) {
    const ecart = rfgPondere - medianePonderee;
    constats.push(
      `La médiane des frais pour des catégories comparables est de ${pct(medianePonderee, 2)}.`,
    );
    if (ecart > 0.0005) {
      constats.push(`Vous payez environ ${pct(ecart, 2)} de plus que cette médiane.`);
    } else if (ecart < -0.0005) {
      constats.push(`C'est inférieur à cette médiane d'environ ${pct(-ecart, 2)}.`);
    } else {
      constats.push("C'est comparable à cette médiane.");
    }
  }

  constats.push(
    `À titre indicatif, avec un rendement hypothétique de ${pct(taux, 0)} par an, ces frais représenteraient environ ${dollars(projection.h25)} sur 25 ans.`,
  );

  return {
    axe: {
      nom: "frais",
      score: scoreFrais(rfgPondere),
      disponible: true,
      constats,
      donnees: {
        rfgPondere,
        rfgMedianPondere: medianePonderee,
        ecartMediane: medianePonderee !== null ? rfgPondere - medianePonderee : null,
        couverture,
        valeurCouverte,
        tauxHypothetique: taux,
        projection,
      },
    },
    projection,
    couverture,
  };
}

// Axe CHEVAUCHEMENT — un même titre détenu à travers PLUSIEURS fonds. La
// diversification apparente (« j'ai plusieurs fonds ») peut cacher un recoupement
// réel : deux FNB canadiens qui détiennent tous deux RBC/TD, un fonds indiciel et
// un fonds de croissance qui pèsent tous deux Apple/Microsoft, etc.
//
// Look-through : pour chaque titre, on additionne, sur le portefeuille TOTAL, sa
// part au sein de chaque fonds × le poids de ce fonds. On ne dispose que des
// PRINCIPAUX titres (top_holdings), donc chaque poids est une BORNE INFÉRIEURE :
// les titres hors top-10 et les fonds non détaillés ne peuvent que l'augmenter.
// Choix conservateur assumé — on ne sur-signale jamais ; les constats disent
// « au moins ». Pur et déterministe.

import type { PositionResolue, ResultatAxe } from "@/types/diagnostic";
import { SEUILS } from "@/config/seuils";
import { borner, arrondir, pct } from "./communs";

/** Un titre recoupé : détenu par ≥2 fonds, avec sa part look-through du portefeuille. */
export interface TitreRecoupe {
  titre: string;
  poids: number; // 0-1, part du portefeuille TOTAL (borne inférieure)
  fonds: string[]; // codes des fonds qui le détiennent
  nbFonds: number;
}

interface Agrege {
  titre: string; // libellé d'affichage (première graphie rencontrée)
  poids: number;
  fonds: Set<string>;
}

/** Clé de rapprochement d'un titre : insensible à la casse et aux espaces. */
function cleTitre(t: string): string {
  return t.trim().toLowerCase();
}

export function analyserChevauchement(positions: PositionResolue[]): ResultatAxe {
  const valeurTotale = positions.reduce((s, p) => s + p.montant, 0);
  const couverts = positions.filter(
    (p) => (p.fonds?.topHoldings?.length ?? 0) > 0 && p.montant > 0,
  );

  // Il faut au moins DEUX fonds détaillés pour qu'un chevauchement soit mesurable.
  if (couverts.length < 2 || valeurTotale === 0) {
    const constat =
      couverts.length === 0
        ? "Le détail des titres composant vos fonds n'est pas disponible : le chevauchement ne peut pas être évalué."
        : "Un seul de vos fonds a un détail de titres connu ; il en faut au moins deux pour mesurer un chevauchement.";
    return {
      nom: "chevauchement",
      score: 0,
      disponible: false,
      constats: [constat],
      donnees: { disponible: false, nbFondsCouverts: couverts.length },
    };
  }

  // ── Look-through : agrégation des titres sur le portefeuille TOTAL ──
  const agrege = new Map<string, Agrege>();
  for (const p of couverts) {
    const poidsFonds = p.montant / valeurTotale; // part du portefeuille total
    for (const h of p.fonds!.topHoldings!) {
      const cle = cleTitre(h.titre);
      if (!cle) continue;
      const a = agrege.get(cle) ?? { titre: h.titre.trim(), poids: 0, fonds: new Set() };
      a.poids += poidsFonds * h.poids;
      a.fonds.add(p.code);
      agrege.set(cle, a);
    }
  }

  const parPoids = (a: { poids: number }, b: { poids: number }) => b.poids - a.poids;

  const titresRecoupes: TitreRecoupe[] = [...agrege.values()]
    .filter((a) => a.fonds.size >= 2)
    .map((a) => ({ titre: a.titre, poids: a.poids, fonds: [...a.fonds], nbFonds: a.fonds.size }))
    .sort(parPoids);

  const topTitres = [...agrege.values()]
    .map((a) => ({ titre: a.titre, poids: a.poids }))
    .sort(parPoids)
    .slice(0, 8);

  const poidsRecoupement = titresRecoupes.reduce((s, t) => s + t.poids, 0);
  const valeurCouverte = couverts.reduce((s, p) => s + p.montant, 0);
  const couverture = valeurCouverte / valeurTotale;

  // ── Constats (des FAITS, en borne inférieure — jamais une recommandation) ──
  const surPortion =
    couverture < 0.999 ? ` (sur ${pct(couverture, 0)} du portefeuille dont les titres sont connus)` : "";
  const constats: string[] = [];

  if (titresRecoupes.length === 0) {
    constats.push(
      "Aucun titre commun n'a été détecté entre vos fonds, sur la base de leurs principaux titres connus.",
    );
  } else {
    const n = titresRecoupes.length;
    constats.push(
      n === 1
        ? "Un titre se retrouve dans plusieurs de vos fonds."
        : `${n} titres se retrouvent dans plusieurs de vos fonds.`,
    );
    const t0 = titresRecoupes[0];
    constats.push(
      `« ${t0.titre} » est détenu par ${t0.nbFonds} de vos fonds, pour au moins ${pct(t0.poids)} du portefeuille.`,
    );
    constats.push(
      `Au total, les titres détenus via plusieurs fonds représentent au moins ${pct(poidsRecoupement)} de votre portefeuille.`,
    );
    if (poidsRecoupement > SEUILS.chevauchementEleve) {
      constats.push(
        "Une partie notable de votre diversification apparente se recoupe donc entre vos fonds.",
      );
    } else if (poidsRecoupement > SEUILS.chevauchementNotable) {
      constats.push("Une partie de vos fonds se recoupe sur les mêmes titres.");
    }
  }
  constats.push(`Cette lecture ne porte que sur les principaux titres connus de chaque fonds${surPortion}.`);

  // Score : décroît avec le recoupement cumulé. 0 recoupement → 100.
  const score = arrondir(
    borner(100 - (poidsRecoupement / SEUILS.chevauchementPlafond) * 100, 0, 100),
  );

  return {
    nom: "chevauchement",
    score,
    disponible: true,
    constats,
    donnees: {
      disponible: true,
      couverture,
      nbFondsCouverts: couverts.length,
      poidsRecoupement,
      titresRecoupes,
      topTitres,
      maxTitreRecoupe: titresRecoupes[0] ?? null,
    },
  };
}

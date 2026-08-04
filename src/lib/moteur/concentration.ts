// Axe CONCENTRATION — au niveau des PRODUITS (fonds) au Sprint 1.
// Le look-through des titres sous-jacents (émetteur unique, titre > 10 %) viendra
// au Sprint 2, quand `fonds.top_holdings` sera peuplé. On le dit dans les constats.

import type { PositionResolue, ResultatAxe } from "@/types/diagnostic";
import { SEUILS } from "@/config/seuils";
import { borner, arrondir, pct } from "./communs";

type NiveauProduit = "Faible" | "Modéré" | "Élevé" | "Très élevé";

function niveauProduit(maxPoids: number): NiveauProduit {
  if (maxPoids <= 0.2) return "Faible";
  if (maxPoids <= 0.35) return "Modéré";
  if (maxPoids <= 0.5) return "Élevé";
  return "Très élevé";
}

export function analyserConcentration(positions: PositionResolue[]): ResultatAxe {
  const valeurTotale = positions.reduce((s, p) => s + p.montant, 0);
  const poids = positions.map((p) => (valeurTotale > 0 ? p.montant / valeurTotale : 0));
  const nbPositions = positions.length;

  // Indice Herfindahl au niveau des positions (donnée d'appoint ; logique alignée
  // sur portfolio/statistics.ts → calculateConcentration).
  const hhi = poids.reduce((s, w) => s + (w * 100) ** 2, 0);
  const positionsEffectives = hhi > 0 ? 10000 / hhi : nbPositions;

  const idxMax = poids.reduce((best, w, i) => (w > poids[best] ? i : best), 0);
  const maxPoids = poids[idxMax] ?? 0;
  const codeMax = positions[idxMax]?.code ?? "";

  // Concentration sectorielle par look-through, en part du portefeuille TOTAL
  // (choix conservateur : ne peut pas sur-signaler quand la couverture est partielle).
  const expoSecteurs = new Map<string, number>();
  let secteursDisponibles = false;
  positions.forEach((p, i) => {
    const alloc = p.fonds?.allocationSecteurs;
    if (alloc) {
      secteursDisponibles = true;
      for (const [secteur, part] of Object.entries(alloc)) {
        expoSecteurs.set(secteur, (expoSecteurs.get(secteur) ?? 0) + poids[i] * part);
      }
    }
  });
  const secteurs = [...expoSecteurs.entries()]
    .map(([secteur, p]) => ({ secteur, poids: p }))
    .sort((a, b) => b.poids - a.poids);
  const secteursDepassant = secteurs.filter((s) => s.poids > SEUILS.concentrationSecteur);

  // ── Constats ──
  const constats: string[] = [];
  constats.push(
    nbPositions <= 1
      ? "Votre portefeuille repose sur un seul produit."
      : `Votre portefeuille est réparti sur ${nbPositions} produits.`,
  );
  if (nbPositions > 1) {
    constats.push(`Le plus important en représente ${pct(maxPoids)} (${codeMax}).`);
  }
  if (maxPoids > SEUILS.produitImportant && nbPositions > 1) {
    constats.push("Une part importante de votre portefeuille repose sur un seul produit.");
  }
  for (const s of secteursDepassant) {
    constats.push(
      `Le secteur « ${s.secteur} » représente environ ${pct(s.poids)} du portefeuille, au-delà de 30 %.`,
    );
  }

  // Score piloté par la concentration en un seul produit.
  const score = arrondir(borner(100 - (Math.max(0, maxPoids - 0.2) / 0.8) * 100, 0, 100));

  return {
    nom: "concentration",
    score,
    disponible: true,
    constats,
    donnees: {
      nbPositions,
      hhi: arrondir(hhi),
      positionsEffectives: arrondir(positionsEffectives, 1),
      produitMax: { code: codeMax, poids: maxPoids },
      niveauProduit: niveauProduit(maxPoids),
      secteursDisponibles,
      secteurs,
      secteursDepassant,
    },
  };
}

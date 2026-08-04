// Catalogue de fonds FICTIFS mais réalistes, aux chiffres ronds pour la validation
// à la main, + quelques portefeuilles types. Sert uniquement aux tests du moteur.

import type { Fonds } from "@/types/fonds";
import type { Position } from "@/types/diagnostic";

export const FONDS: Fonds[] = [
  {
    code: "RBF460",
    nom: "Fonds d'actions canadiennes",
    type: "fonds_commun",
    categorie: "Actions canadiennes",
    rfg: 0.0223,
    rfgMedianCategorie: 0.021,
    allocationGeo: { canada: 0.95, usa: 0.03, autre: 0.02 },
    allocationSecteurs: { finance: 0.35, energie: 0.18, materiaux: 0.12, industrie: 0.1, autre: 0.25 },
    topHoldings: [
      { titre: "Banque Royale", poids: 0.1 },
      { titre: "Banque TD", poids: 0.1 },
      { titre: "Enbridge", poids: 0.05 },
    ],
    source: "manuel",
  },
  {
    code: "MMF559",
    nom: "Fonds d'actions mondiales",
    type: "fonds_commun",
    categorie: "Actions mondiales",
    rfg: 0.0255,
    rfgMedianCategorie: 0.019,
    allocationGeo: { canada: 0.05, usa: 0.6, europe: 0.25, autre: 0.1 },
    // Pas d'allocation sectorielle : sert à tester l'absence de donnée.
    source: "manuel",
  },
  {
    code: "XEQT",
    nom: "FNB de répartition tout en actions",
    type: "fnb",
    categorie: "Répartition d'actifs — croissance",
    rfg: 0.002,
    rfgMedianCategorie: 0.0025,
    allocationGeo: { canada: 0.25, usa: 0.45, europe: 0.15, asie_pacifique: 0.1, marches_emergents: 0.05 },
    allocationSecteurs: { technologie: 0.24, finance: 0.17, sante: 0.11, industrie: 0.1, autre: 0.38 },
    // Titres américains : disjoints des banques canadiennes (test « aucun recoupement »).
    topHoldings: [
      { titre: "Apple", poids: 0.05 },
      { titre: "Microsoft", poids: 0.04 },
      { titre: "Amazon", poids: 0.03 },
    ],
    source: "manuel",
  },
  {
    code: "ZAG",
    nom: "FNB d'obligations canadiennes",
    type: "fnb",
    categorie: "Revenu fixe canadien",
    rfg: 0.0009,
    rfgMedianCategorie: 0.0012,
    allocationGeo: { canada: 1.0 },
    source: "manuel",
  },
  {
    code: "TDB900",
    nom: "Fonds indiciel d'actions canadiennes",
    type: "fonds_commun",
    categorie: "Actions canadiennes",
    rfg: 0.0033,
    rfgMedianCategorie: 0.021,
    allocationGeo: { canada: 1.0 },
    // « BANQUE ROYALE » en MAJUSCULES : vérifie le rapprochement insensible à la casse.
    topHoldings: [
      { titre: "BANQUE ROYALE", poids: 0.08 },
      { titre: "Banque TD", poids: 0.06 },
      { titre: "Shopify", poids: 0.04 },
    ],
    source: "manuel",
  },
];

export function catalogueTest(): Map<string, Fonds> {
  return new Map(FONDS.map((f) => [f.code.toUpperCase(), f]));
}

// ── Portefeuilles types ──
/** L'économe : 2 FNB bon marché, globalement diversifié. */
export const PORTE_ECONOME: Position[] = [
  { code: "XEQT", montant: 80000 },
  { code: "ZAG", montant: 20000 },
];

/** Le coûteux : un seul fonds commun à 2,55 %. */
export const PORTE_COUTEUX: Position[] = [{ code: "MMF559", montant: 100000 }];

/** Le tout-Canada : biais domestique marqué. */
export const PORTE_TOUT_CANADA: Position[] = [
  { code: "TDB900", montant: 60000 },
  { code: "RBF460", montant: 40000 },
];

/** Avec un fonds inconnu (non résolu) : moitié du portefeuille sans donnée. */
export const PORTE_AVEC_INCONNU: Position[] = [
  { code: "XEQT", montant: 50000 },
  { code: "ZZZ999", montant: 50000 },
];

/** Chevauchement : deux fonds canadiens qui détiennent les mêmes banques. */
export const PORTE_RECOUPEMENT: Position[] = [
  { code: "RBF460", montant: 50000 },
  { code: "TDB900", montant: 50000 },
];

/** Deux fonds détaillés mais aux titres disjoints (banques CA vs techno US). */
export const PORTE_SANS_RECOUPEMENT: Position[] = [
  { code: "RBF460", montant: 50000 },
  { code: "XEQT", montant: 50000 },
];

/** Recoupement sur une portion seulement : moitié du portefeuille non résolue. */
export const PORTE_RECOUPEMENT_PARTIEL: Position[] = [
  { code: "RBF460", montant: 50000 },
  { code: "TDB900", montant: 50000 },
  { code: "ZZZ999", montant: 100000 },
];

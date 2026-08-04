// Types du diagnostic produit par le moteur (lib/moteur).

import type { Fonds } from "./fonds";

export type TypeCompte = "celi" | "reer" | "cri" | "non_enregistre" | "societe";

/** Une position brute telle que saisie par l'usager. */
export interface Position {
  code: string;
  montant: number; // $ investis dans cette position
  typeCompte?: TypeCompte;
}

/** Une position après résolution contre le catalogue de fonds. */
export interface PositionResolue extends Position {
  poids: number; // 0-1, part du portefeuille (par montant)
  fonds?: Fonds; // données résolues (absent si non résolu)
  nonResolu: boolean;
}

export type NomAxe = "frais" | "chevauchement" | "concentration" | "geographie";

/** Résultat d'un axe d'analyse. Les `constats` sont FACTUELS (jamais un conseil). */
export interface ResultatAxe {
  nom: NomAxe;
  score: number; // 0-100 (100 = idéal)
  disponible: boolean; // false = donnée manquante → constat explicite, pas de score silencieux
  constats: string[];
  donnees: Record<string, unknown>; // chiffres bruts pour l'UI et le PDF
}

/** Coût composé des frais aux trois horizons (en $). */
export interface ProjectionFrais {
  h10: number;
  h15: number;
  h25: number;
}

export interface ScoreGlobal {
  score: number; // 0-100
  axesFaibles: NomAxe[]; // 2-3 axes les plus faibles
  ordreNarratif: NomAxe[]; // axes du plus faible au plus fort (ordre de récit)
}

export interface Diagnostic {
  scoreGlobal: ScoreGlobal;
  axes: ResultatAxe[];
  positions: PositionResolue[];
  fondsNonResolus: string[];
  projectionFrais: ProjectionFrais;
  valeurTotale: number;
  couvertureFrais: number; // 0-1, part du portefeuille dont le RFG est connu
}

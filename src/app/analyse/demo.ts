// Diagnostic d'EXEMPLE — pour prévisualiser le rapport sans base de données.
// Utilise le vrai moteur (pur, importable côté client) sur un portefeuille fictif
// « cher + biais domestique », histoire que les trois axes soient parlants.

import { executerDiagnostic } from "@/lib/moteur";
import type { Fonds } from "@/types/fonds";
import type { Position, Diagnostic } from "@/types/diagnostic";

const CATALOGUE: Fonds[] = [
  {
    code: "RBF460",
    nom: "Fonds d'actions canadiennes",
    type: "fonds_commun",
    categorie: "Actions canadiennes",
    rfg: 0.0221,
    rfgMedianCategorie: 0.021,
    allocationGeo: { canada: 0.96, usa: 0.03, autre: 0.01 },
    allocationSecteurs: { finance: 0.36, energie: 0.17, materiaux: 0.12, industrie: 0.1, autre: 0.25 },
    topHoldings: [
      { titre: "Banque Royale", poids: 0.09 },
      { titre: "Banque TD", poids: 0.08 },
      { titre: "Enbridge", poids: 0.05 },
      { titre: "Banque Scotia", poids: 0.05 },
      { titre: "Canadien National", poids: 0.04 },
    ],
  },
  {
    code: "PMO205",
    nom: "Fonds équilibré mondial",
    type: "fonds_commun",
    categorie: "Équilibré mondial",
    rfg: 0.0238,
    rfgMedianCategorie: 0.0195,
    allocationGeo: { canada: 0.45, usa: 0.3, europe: 0.15, asie_pacifique: 0.06, autre: 0.04 },
    topHoldings: [
      { titre: "Banque Royale", poids: 0.05 },
      { titre: "Banque TD", poids: 0.04 },
      { titre: "Apple", poids: 0.04 },
      { titre: "Microsoft", poids: 0.03 },
      { titre: "Banque Scotia", poids: 0.03 },
    ],
  },
];

const POSITIONS: Position[] = [
  { code: "RBF460", montant: 65000 },
  { code: "PMO205", montant: 45000 },
];

export function diagnosticDemo(): Diagnostic {
  const catalogue = new Map(CATALOGUE.map((f) => [f.code.toUpperCase(), f]));
  return executerDiagnostic(POSITIONS, catalogue);
}

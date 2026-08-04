// Types du référentiel de fonds (table `fonds` — base propriétaire GFSF).

export type TypeFonds = "fonds_commun" | "fnb" | "action" | "obligation" | "autre";

export type SourceFonds = "manuel" | "yahoo" | "apercu_fonds";

export interface TopHolding {
  titre: string;
  poids: number; // 0-1
}

/** Répartition géographique en parts (0-1). Clés usuelles :
 *  canada, usa, europe, asie_pacifique, marches_emergents, autre. */
export type AllocationGeo = Record<string, number>;

/** Répartition sectorielle en parts (0-1). */
export type AllocationSecteurs = Record<string, number>;

export interface Fonds {
  code: string; // ticker ou code de fonds (RBF460, XEQT, ...)
  nom: string;
  type: TypeFonds;
  categorie: string;
  rfg: number; // décimal : 0.0225 = 2,25 %
  rfgMedianCategorie?: number | null; // médiane de la catégorie (calculée)
  topHoldings?: TopHolding[]; // top 10 (Sprint 2 — chevauchement)
  allocationGeo?: AllocationGeo;
  allocationSecteurs?: AllocationSecteurs;
  source?: SourceFonds;
  verifieLe?: string | null; // date de dernière vérification manuelle (ISO)
  aEnrichir?: boolean; // soumis par un usager mais incomplet
}

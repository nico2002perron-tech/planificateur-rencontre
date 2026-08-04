// Correspondance ligne Supabase (snake_case) ↔ Fonds (camelCase). Pur et testable :
// aucune dépendance au client Supabase ici.

import type { Fonds } from "@/types/fonds";

type LigneFonds = Record<string, unknown>;

function nombre(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function versFonds(row: LigneFonds): Fonds {
  return {
    code: String(row.code ?? ""),
    nom: String(row.nom ?? ""),
    type: (row.type as Fonds["type"]) ?? "autre",
    categorie: String(row.categorie ?? ""),
    rfg: nombre(row.rfg) ?? 0,
    rfgMedianCategorie: nombre(row.rfg_median_categorie),
    topHoldings: (row.top_holdings as Fonds["topHoldings"]) ?? undefined,
    allocationGeo: (row.allocation_geo as Fonds["allocationGeo"]) ?? undefined,
    allocationSecteurs: (row.allocation_secteurs as Fonds["allocationSecteurs"]) ?? undefined,
    source: (row.source as Fonds["source"]) ?? undefined,
    verifieLe: (row.verifie_le as string | null) ?? null,
    aEnrichir: Boolean(row.a_enrichir ?? false),
  };
}

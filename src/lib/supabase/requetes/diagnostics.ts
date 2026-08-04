// Sauvegarde ANONYME des diagnostics (le flywheel). Aucune identité n'est écrite —
// c'est garanti par le schéma de la table, pas seulement ici.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Diagnostic, Position } from "@/types/diagnostic";

export type TrancheValeur = "<100k" | "100-250k" | "250-500k" | "500k-1M" | ">1M";

/** Convertit une valeur exacte en tranche — on ne stocke JAMAIS le montant exact du total. */
export function trancheValeur(total: number): TrancheValeur {
  if (total < 100_000) return "<100k";
  if (total < 250_000) return "100-250k";
  if (total < 500_000) return "250-500k";
  if (total < 1_000_000) return "500k-1M";
  return ">1M";
}

export async function sauvegarderDiagnostic(params: {
  positions: Position[];
  diagnostic: Diagnostic;
  trancheAge?: string | null;
  sourceUtm?: string | null;
}): Promise<string> {
  const { positions, diagnostic, trancheAge, sourceUtm } = params;

  const scores: Record<string, number> = { global: diagnostic.scoreGlobal.score };
  for (const a of diagnostic.axes) scores[a.nom] = a.score;

  const constats: Record<string, string[]> = {};
  for (const a of diagnostic.axes) constats[a.nom] = a.constats;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagnostics")
    .insert({
      positions, // [{code, montant, typeCompte}] — aucune identité
      valeur_totale_tranche: trancheValeur(diagnostic.valeurTotale),
      tranche_age: trancheAge ?? null,
      scores,
      constats,
      fonds_non_resolus: diagnostic.fondsNonResolus,
      source_utm: sourceUtm ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`sauvegarderDiagnostic : ${error.message}`);
  return data.id as string;
}

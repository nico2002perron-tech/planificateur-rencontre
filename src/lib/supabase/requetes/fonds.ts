// Requêtes Supabase pour la table `fonds` (service role → server-only).
// Sert de ChargeurFonds réel à la résolution du moteur, et d'autocomplete public.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { versFonds } from "./fonds-mapper";
import type { Fonds } from "@/types/fonds";

/** Charge les fonds pour une liste de codes (ChargeurFonds réel du moteur). */
export async function obtenirFonds(codes: string[]): Promise<Fonds[]> {
  if (codes.length === 0) return [];
  const codesMaj = [...new Set(codes.map((c) => c.trim().toUpperCase()))];
  const supabase = createClient();
  const { data, error } = await supabase.from("fonds").select("*").in("code", codesMaj);
  if (error) throw new Error(`obtenirFonds : ${error.message}`);
  return (data ?? []).map(versFonds);
}

/** Autocomplete public : max 8 résultats, SANS le RFG (pas de scraping de la table). */
export async function rechercherFonds(
  q: string,
): Promise<Array<Pick<Fonds, "code" | "nom" | "type" | "categorie">>> {
  const terme = q.trim();
  if (terme.length < 2) return [];
  const supabase = createClient();
  const motif = `%${terme}%`;
  const { data, error } = await supabase
    .from("fonds")
    .select("code, nom, type, categorie")
    .or(`code.ilike.${motif},nom.ilike.${motif}`)
    .limit(8);
  if (error) throw new Error(`rechercherFonds : ${error.message}`);
  return (data ?? []) as Array<Pick<Fonds, "code" | "nom" | "type" | "categorie">>;
}

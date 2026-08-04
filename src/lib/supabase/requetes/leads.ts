// Création d'un lead ENTRANT (analyse_leads), sur consentement. Server-only.

import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function creerLead(params: {
  diagnosticId?: string | null;
  prenom: string;
  nom: string;
  courriel: string;
  telephone?: string | null;
  consentementVersion: string;
}): Promise<{ id: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("analyse_leads")
    .insert({
      diagnostic_id: params.diagnosticId ?? null,
      prenom: params.prenom,
      nom: params.nom,
      courriel: params.courriel,
      telephone: params.telephone ?? null,
      consentement_transmission: true, // validé en amont ; toujours true par construction
      consentement_texte_version: params.consentementVersion,
    })
    .select("id")
    .single();
  if (error) throw new Error(`creerLead : ${error.message}`);
  return { id: data.id as string };
}

export type StatutLead = "nouveau" | "contacte" | "rencontre" | "converti" | "perdu";

export interface DiagnosticLead {
  positions: { code: string; montant: number; typeCompte?: string }[] | null;
  valeur_totale_tranche: string | null;
  scores: Record<string, number> | null;
  constats: Record<string, string[]> | null;
}

export interface LeadResume {
  id: string;
  cree_le: string;
  prenom: string;
  nom: string;
  courriel: string;
  telephone: string | null;
  statut: StatutLead;
  diagnostic: DiagnosticLead | null;
}

/** Liste les analyses reçues, avec le diagnostic soumis (jointure). Plus récentes d'abord. */
export async function listerLeads(): Promise<LeadResume[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("analyse_leads")
    .select(
      "id, cree_le, prenom, nom, courriel, telephone, statut, diagnostics(positions, valeur_totale_tranche, scores, constats)",
    )
    .order("cree_le", { ascending: false });
  if (error) throw new Error(`listerLeads : ${error.message}`);

  type Ligne = Omit<LeadResume, "diagnostic"> & { diagnostics: DiagnosticLead | null };
  return ((data ?? []) as unknown as Ligne[]).map((r) => ({
    id: r.id,
    cree_le: r.cree_le,
    prenom: r.prenom,
    nom: r.nom,
    courriel: r.courriel,
    telephone: r.telephone,
    statut: r.statut,
    diagnostic: r.diagnostics ?? null,
  }));
}

export async function changerStatut(id: string, statut: StatutLead): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("analyse_leads").update({ statut }).eq("id", id);
  if (error) throw new Error(`changerStatut : ${error.message}`);
}

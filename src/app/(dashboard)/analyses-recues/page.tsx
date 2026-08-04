"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Statut = "nouveau" | "contacte" | "rencontre" | "converti" | "perdu";

type Diagnostic = {
  positions: { code: string; montant: number }[] | null;
  valeur_totale_tranche: string | null;
  scores: Record<string, number> | null;
} | null;

type Lead = {
  id: string;
  cree_le: string;
  prenom: string;
  nom: string;
  courriel: string;
  telephone: string | null;
  statut: Statut;
  diagnostic: Diagnostic;
};

const META: Record<Statut, { label: string; variant: "info" | "warning" | "default" | "success" | "danger" }> = {
  nouveau: { label: "Nouveau", variant: "info" },
  contacte: { label: "Contacté", variant: "warning" },
  rencontre: { label: "Rencontré", variant: "default" },
  converti: { label: "Converti", variant: "success" },
  perdu: { label: "Perdu", variant: "danger" },
};
const STATUTS: Statut[] = ["nouveau", "contacte", "rencontre", "converti", "perdu"];
const AXES: [string, string][] = [
  ["global", "Global"],
  ["frais", "Frais"],
  ["chevauchement", "Chevauch."],
  ["concentration", "Concentr."],
  ["geographie", "Géo"],
];

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
const dollars = (n: number) => `${Math.round(n).toLocaleString("fr-CA")} $`;

export default function AnalysesRecuesPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [err, setErr] = useState("");

  async function charger() {
    try {
      const r = await fetch("/api/analyse-leads");
      const j = await r.json();
      if (!r.ok) {
        setErr(j.erreur ?? "Erreur de chargement.");
        return;
      }
      setLeads(j.leads as Lead[]);
    } catch {
      setErr("Impossible de charger les analyses.");
    }
  }
  useEffect(() => {
    charger();
  }, []);

  async function majStatut(id: string, statut: Statut) {
    setLeads((ls) => ls?.map((l) => (l.id === id ? { ...l, statut } : l)) ?? ls);
    await fetch(`/api/analyse-leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
  }

  return (
    <div>
      <PageHeader
        title="Analyses reçues"
        description="Portefeuilles transmis par le public, avec consentement — le diagnostic soumis est joint."
      />

      {err && (
        <Card>
          <p className="text-sm text-red-600">{err}</p>
        </Card>
      )}
      {!err && !leads && <p className="text-sm text-text-muted">Chargement…</p>}
      {leads && leads.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Aucune analyse reçue pour l&apos;instant.</p>
        </Card>
      )}

      <div className="space-y-4">
        {leads?.map((l) => {
          const m = META[l.statut] ?? META.nouveau;
          const scores = l.diagnostic?.scores ?? null;
          return (
            <Card key={l.id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-text-main">
                      {l.prenom} {l.nom}
                    </h3>
                    <Badge variant={m.variant}>{m.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-text-muted">
                    <a href={`mailto:${l.courriel}`} className="text-brand-accent">
                      {l.courriel}
                    </a>
                    {l.telephone ? ` · ${l.telephone}` : ""} · reçu le {dateFr(l.cree_le)}
                  </p>
                </div>
                <select
                  value={l.statut}
                  onChange={(e) => majStatut(l.id, e.target.value as Statut)}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                >
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>
                      {META[s].label}
                    </option>
                  ))}
                </select>
              </div>

              {l.diagnostic ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {l.diagnostic.valeur_totale_tranche && (
                      <Badge variant="outline">Tranche&nbsp;: {l.diagnostic.valeur_totale_tranche}</Badge>
                    )}
                    {scores &&
                      AXES.map(([k, lab]) =>
                        typeof scores[k] === "number" ? (
                          <span key={k} className="text-xs text-text-muted">
                            {lab} <strong className="text-text-main">{scores[k]}</strong>
                          </span>
                        ) : null,
                      )}
                  </div>
                  {l.diagnostic.positions && l.diagnostic.positions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {l.diagnostic.positions.map((p, i) => (
                        <span key={i} className="rounded-lg bg-bg-light px-2 py-1 text-xs text-text-main">
                          <strong>{p.code}</strong> · {dollars(p.montant)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-text-light">Diagnostic non lié.</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

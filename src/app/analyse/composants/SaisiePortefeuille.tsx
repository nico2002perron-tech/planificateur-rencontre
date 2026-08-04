"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { AutocompleteFonds } from "./AutocompleteFonds";
import type { TypeCompte } from "@/types/diagnostic";

type Ligne = { id: number; code: string; nom: string; montant: string; typeCompte: "" | TypeCompte };

const COMPTES: { v: "" | TypeCompte; label: string }[] = [
  { v: "", label: "Compte (opt.)" },
  { v: "celi", label: "CELI" },
  { v: "reer", label: "REER" },
  { v: "cri", label: "CRI" },
  { v: "non_enregistre", label: "Non-enregistré" },
  { v: "societe", label: "Société" },
];

let compteur = 1;
const nouvelleLigne = (): Ligne => ({ id: compteur++, code: "", nom: "", montant: "", typeCompte: "" });

// Le montant se lit comme de l'argent pendant la frappe : « 25 000 », pas « 25000 ».
// On stocke la chaîne formatée et on ne relit que les chiffres au moment de calculer.
const chiffres = (s: string) => s.replace(/\D/g, "");
const enNombre = (s: string) => Number(chiffres(s)) || 0;
const formater = (s: string) => {
  const c = chiffres(s).slice(0, 12);
  return c ? Number(c).toLocaleString("fr-CA") : "";
};

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #dbe4ef",
  background: "#fff",
  padding: "11px 13px",
  fontSize: 14,
  outline: "none",
  color: "var(--ink)",
} as const;

export function SaisiePortefeuille() {
  const router = useRouter();
  const [lignes, setLignes] = useState<Ligne[]>([nouvelleLigne(), nouvelleLigne()]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const total = lignes.reduce((s, l) => s + enNombre(l.montant), 0);
  const nbCompletes = lignes.filter((l) => l.code.trim() && enNombre(l.montant) > 0).length;

  function maj(id: number, p: Partial<Ligne>) {
    setLignes((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));
  }

  async function soumettre() {
    setErreur("");
    const positions = lignes
      .map((l) => ({ code: l.code.trim().toUpperCase(), montant: enNombre(l.montant), typeCompte: l.typeCompte || undefined }))
      .filter((p) => p.code && p.montant > 0);

    if (positions.length === 0) {
      setErreur("Ajoutez au moins un fonds avec un montant.");
      return;
    }
    setEnvoi(true);
    try {
      const r = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErreur(j.erreur ?? "Une erreur est survenue.");
        setEnvoi(false);
        return;
      }
      sessionStorage.setItem("gfsf_diagnostic", JSON.stringify(j.diagnostic));
      sessionStorage.setItem("gfsf_diagnostic_id", j.diagnosticId ?? "");
      router.push("/analyse/resultats");
    } catch {
      setErreur("Impossible de joindre le service. Réessayez.");
      setEnvoi(false);
    }
  }

  return (
    <div
      className="an-card"
      style={{ padding: "24px 22px", borderRadius: 26 }}
      onKeyDown={(e) => {
        // Entrée soumet — sauf si l'autocomplétion vient de l'intercepter pour choisir un fonds.
        if (e.key === "Enter" && !e.defaultPrevented && !envoi && nbCompletes > 0) {
          e.preventDefault();
          void soumettre();
        }
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lignes.map((l) => (
          <div key={l.id} className="an-saisie-ligne">
            <div className="an-saisie-fonds" style={{ minWidth: 0 }}>
              <AutocompleteFonds code={l.code} nom={l.nom} onSelect={(v) => maj(l.id, v)} />
            </div>
            <input
              className="an-saisie-montant"
              inputMode="numeric"
              aria-label="Montant investi"
              value={l.montant}
              onChange={(e) => maj(l.id, { montant: formater(e.target.value) })}
              placeholder="25 000 $"
              style={{ ...inputStyle, minWidth: 0 }}
            />
            <select
              className="an-saisie-compte"
              aria-label="Type de compte"
              value={l.typeCompte}
              onChange={(e) => maj(l.id, { typeCompte: e.target.value as Ligne["typeCompte"] })}
              style={{ ...inputStyle, minWidth: 0, color: l.typeCompte ? "var(--ink)" : "#9aa9bb" }}
            >
              {COMPTES.map((c) => (
                <option key={c.v} value={c.v}>{c.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="an-saisie-retirer"
              onClick={() => setLignes((ls) => ls.filter((x) => x.id !== l.id))}
              aria-label={`Retirer la ligne ${l.code || "vide"}`}
              disabled={lignes.length === 1}
              style={{ height: 38, width: 38, borderRadius: 10, border: "none", background: "transparent", color: "#9aa9bb", cursor: lignes.length === 1 ? "default" : "pointer", visibility: lignes.length === 1 ? "hidden" : "visible", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button
          type="button"
          onClick={() => setLignes((ls) => [...ls, nouvelleLigne()])}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "var(--mid)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={16} /> Ajouter un fonds
        </button>
        {total > 0 && (
          <div style={{ fontSize: 14, color: "var(--muted)" }}>
            Total&nbsp;: <strong style={{ color: "var(--navy)", fontFamily: "Montserrat, sans-serif" }}>{total.toLocaleString("fr-CA")} $</strong>
          </div>
        )}
      </div>

      {erreur && <p role="alert" style={{ marginTop: 12, fontSize: 14, color: "#e0483d" }}>{erreur}</p>}

      <button type="button" onClick={soumettre} disabled={envoi || nbCompletes === 0} className="an-btn" style={{ marginTop: 18, width: "100%", padding: "14px", fontSize: 15 }}>
        {envoi
          ? "Analyse en cours…"
          : nbCompletes === 0
            ? "Entrez un fonds et un montant"
            : `Analyser mon portefeuille (${nbCompletes} fonds)`}
      </button>
      <p style={{ marginTop: 12, textAlign: "center", fontSize: 12.5, color: "#8a9bb0" }}>
        Gratuit, sans engagement. Aucune coordonnée demandée à cette étape.
      </p>
    </div>
  );
}

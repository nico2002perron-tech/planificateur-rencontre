"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { code: string; nom: string; type: string; categorie: string };

export function AutocompleteFonds({
  code,
  nom,
  onSelect,
  placeholder,
}: {
  code: string;
  nom: string;
  onSelect: (v: { code: string; nom: string }) => void;
  placeholder?: string;
}) {
  const [terme, setTerme] = useState(nom || code || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1); // suggestion survolée au clavier
  const boite = useRef<HTMLDivElement>(null);
  const listeId = useId();

  useEffect(() => {
    setTerme(nom || code || "");
  }, [code, nom]);

  useEffect(() => {
    const t = terme.trim();
    if (t.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`/api/fonds/recherche?q=${encodeURIComponent(t)}`, { signal: ctrl.signal });
        const j = await r.json();
        setSuggestions(j.resultats ?? []);
        setActif(-1);
      } catch {
        /* réseau interrompu */
      }
    }, 250);
    return () => {
      clearTimeout(h);
      ctrl.abort();
    };
  }, [terme]);

  useEffect(() => {
    function clicExterieur(e: MouseEvent) {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", clicExterieur);
    return () => document.removeEventListener("mousedown", clicExterieur);
  }, []);

  function choisir(s: Suggestion) {
    onSelect({ code: s.code, nom: s.nom });
    setTerme(s.nom);
    setOuvert(false);
    setActif(-1);
  }

  const listeVisible = ouvert && suggestions.length > 0;

  /** Clavier : ↓/↑ parcourent, Entrée choisit, Échap ferme.
   *  Entrée sans suggestion active n'est PAS interceptée → elle soumet le formulaire. */
  function auClavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOuvert(false);
      setActif(-1);
      return;
    }
    if (!listeVisible) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setOuvert(true);
        setActif(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && actif >= 0) {
      e.preventDefault();
      choisir(suggestions[actif]);
    }
  }

  return (
    <div ref={boite} style={{ position: "relative" }}>
      <input
        value={terme}
        onChange={(e) => {
          setTerme(e.target.value);
          setOuvert(true);
          onSelect({ code: e.target.value, nom: "" });
        }}
        onFocus={() => setOuvert(true)}
        onKeyDown={auClavier}
        placeholder={placeholder ?? "Code ou nom du fonds (ex. XEQT)"}
        autoComplete="off"
        role="combobox"
        aria-expanded={listeVisible}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={actif >= 0 ? `${listeId}-${actif}` : undefined}
        style={{ width: "100%", borderRadius: 12, border: "1px solid #dbe4ef", background: "#fff", padding: "11px 13px", fontSize: 14, outline: "none", color: "var(--ink)" }}
      />
      {listeVisible && (
        <div
          id={listeId}
          role="listbox"
          style={{ position: "absolute", zIndex: 20, marginTop: 6, width: "100%", maxHeight: 256, overflow: "auto", borderRadius: 14, border: "1px solid #e4ebf3", background: "#fff", boxShadow: "0 16px 40px rgba(3,30,78,.14)" }}
        >
          {suggestions.map((s, i) => (
            <button
              key={s.code}
              id={`${listeId}-${i}`}
              type="button"
              role="option"
              aria-selected={i === actif}
              ref={i === actif ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(s);
              }}
              onMouseEnter={() => setActif(i)}
              style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 13px", textAlign: "left", fontSize: 14, background: i === actif ? "#f3f7fc" : "transparent", border: "none", cursor: "pointer" }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: "var(--navy)" }}>{s.code}</span>
                <span style={{ marginLeft: 8, color: "var(--muted)" }}>{s.nom}</span>
              </span>
              <span style={{ flexShrink: 0, fontSize: 11, color: "#9aa9bb" }}>{s.categorie}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

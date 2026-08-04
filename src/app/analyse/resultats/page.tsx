"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Percent, Layers, Target, Globe2, Sparkles, RefreshCw, Download } from "lucide-react";
import type { Diagnostic, NomAxe, ResultatAxe } from "@/types/diagnostic";
import { coutDesFrais } from "@/lib/moteur/frais";
import { diagnosticDemo } from "../demo";
import { CONSENTEMENT_TRANSMISSION } from "@/lib/analyse/textes";
import { CompteurAnime } from "../composants/CompteurAnime";

// ── Formatage fr-CA ──
const pct = (x: number, d = 1) => `${(x * 100).toLocaleString("fr-CA", { maximumFractionDigits: d })} %`;
const dollars = (x: number) => `${Math.round(x).toLocaleString("fr-CA")} $`;

const REGIONS: Record<string, string> = {
  canada: "Canada", usa: "États-Unis", europe: "Europe",
  asie_pacifique: "Asie-Pacifique", marches_emergents: "Marchés émergents", autre: "Autre",
};

const A = {
  frais: { color: "var(--a-frais)", bg: "var(--a-frais-bg)" },
  chevauchement: { color: "var(--a-chev)", bg: "var(--a-chev-bg)" },
  concentration: { color: "var(--a-conc)", bg: "var(--a-conc-bg)" },
  geographie: { color: "var(--a-geo)", bg: "var(--a-geo-bg)" },
};

// ── Règle d'échelle des barres — une seule, appliquée partout ──
// • Axes dont les parts somment à 100 % (concentration, géographie) → échelle ABSOLUE :
//   la barre se lit directement comme une part du portefeuille.
// • Palmarès de titres (vrai portrait, chevauchement) → normalisé au plus gros, mais
//   PLAFONNÉ : aucune barre ne remplit le rail, sinon 7 % se lirait « tout le portefeuille ».
const PLAFOND = 0.86;
const relatif = (poids: number, max: number) => (max > 0 ? (poids / max) * PLAFOND : 0);

type FraisD = {
  rfgPondere?: number;
  rfgMedianPondere?: number | null;
  tauxHypothetique?: number;
  valeurCouverte?: number;
};
type ConcD = { nbPositions?: number; niveauProduit?: string };
type GeoD = { canada?: number; referenceCanadaACWI?: number; regions?: { region: string; poids: number }[] };
type ChevD = { poidsRecoupement?: number; titresRecoupes?: { titre: string; nbFonds: number }[]; topTitres?: { titre: string; poids: number }[] };

function cssd(d: string, extra: CSSProperties = {}): CSSProperties {
  return { "--d": d, ...extra } as CSSProperties;
}

function Barre({ label, valeur, part, accent = "var(--cyan)", sourdine, badge, survol }: {
  label: string; valeur: string; part: number; accent?: string; sourdine?: boolean; badge?: string; survol?: string;
}) {
  const infobulle = survol ?? `${label} — ${valeur}`;
  return (
    <div className="an-ligne" title={infobulle} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 13.5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0, color: sourdine ? "#9aa9bb" : "var(--ink)" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          {badge && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(124,92,255,.12)", color: "var(--a-chev)" }}>{badge}</span>}
        </span>
        <span style={{ flexShrink: 0, color: "var(--muted)", fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{valeur}</span>
      </div>
      <div className="an-bar" role="img" aria-label={infobulle}>
        <span style={{ width: `${Math.max(2, Math.min(100, part * 100))}%`, background: sourdine ? "#c9d3de" : accent }} />
      </div>
    </div>
  );
}

/** Petit jeton de contexte (valeur analysée, nombre de produits, couverture). */
function Jeton({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 12px", fontSize: 13, background: "rgba(3,4,94,.05)", border: "1px solid rgba(3,4,94,.07)", color: "var(--muted)" }}>
      {children}
    </span>
  );
}

/** `omettre` retire les constats qui redisent un chiffre déjà mis en vedette dans la carte
 *  (le PDF, lui, garde le texte complet). Si la chaîne ne correspond plus, le constat
 *  réapparaît simplement — aucune information n'est perdue. */
function Constats({ axe, accent, omettre }: { axe?: ResultatAxe; accent: string; omettre?: string }) {
  const constats = (axe?.constats ?? []).filter((c) => !omettre || !c.includes(omettre));
  if (!constats.length) return null;
  return (
    <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
      {constats.map((c, i) => (
        <li key={i} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.45, color: "var(--muted)" }}>
          <span style={{ marginTop: 6, height: 6, width: 6, borderRadius: 999, background: accent, flexShrink: 0 }} />
          <span>{c}</span>
        </li>
      ))}
    </ul>
  );
}

function AxeCarte({ icon, accent, tint, titre, delay, children, axe, omettre }: {
  icon: ReactNode; accent: string; tint: string; titre: string; delay: string; children: ReactNode; axe?: ResultatAxe; omettre?: string;
}) {
  return (
    <div className="an-card lift an-fadeup" style={cssd(delay, { padding: 24 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div className="an-chip" style={{ background: tint, color: accent }}>{icon}</div>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17, color: "var(--navy)", margin: 0 }}>{titre}</h2>
      </div>
      {children}
      <Constats axe={axe} accent={accent} omettre={omettre} />
    </div>
  );
}

function VraiPortrait({ d }: { d: Diagnostic }) {
  const chev = d.axes.find((a) => a.nom === "chevauchement");
  const chd = (chev?.donnees ?? {}) as ChevD;
  const top = chd.topTitres ?? [];
  const nbFondsParTitre = new Map((chd.titresRecoupes ?? []).map((t) => [t.titre, t.nbFonds]));
  const nbProduits = d.positions.length;
  const lookThrough = Boolean(chev?.disponible) && top.length > 0;

  const tous = lookThrough
    ? top.map((t) => ({ titre: t.titre, poids: t.poids, nbFonds: nbFondsParTitre.get(t.titre) ?? 1 }))
    : d.positions.map((p) => ({ titre: p.code, poids: p.poids, nbFonds: 1 }));
  const rangs = tous.slice(0, 8);
  const reste = tous.length - rangs.length;
  const max = Math.max(...rangs.map((r) => r.poids), 0.01);

  return (
    <div className="an-card an-fadeup" style={{ padding: "28px 28px 24px", borderRadius: 26, background: "linear-gradient(135deg,#ffffff 0%,#eff9fd 100%)", border: "1px solid rgba(0,180,216,.2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div className="an-chip an-floaty" style={{ height: 36, width: 36, borderRadius: 12, background: "linear-gradient(135deg,var(--navy),var(--cyan))", color: "#fff" }}>
          <Sparkles size={18} />
        </div>
        <span className="an-eyebrow" style={{ color: "var(--a-frais)" }}>{lookThrough ? "Le vrai portrait" : "Votre portefeuille"}</span>
      </div>
      <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "clamp(20px,3vw,26px)", letterSpacing: "-.01em", color: "var(--navy)", margin: "0 0 18px", textWrap: "balance" }}>
        {lookThrough
          ? `${nbProduits} ${nbProduits > 1 ? "produits" : "produit"} en surface — voici les titres réels derrière.`
          : `Voici vos ${nbProduits} ${nbProduits > 1 ? "produits" : "produit"}.`}
      </h2>
      <div>
        {rangs.map((r) => (
          <Barre
            key={r.titre}
            label={r.titre}
            valeur={pct(r.poids)}
            part={relatif(r.poids, max)}
            survol={`${r.titre} — ${pct(r.poids)} du portefeuille${r.nbFonds >= 2 ? `, via ${r.nbFonds} de vos fonds` : ""}`}
            badge={r.nbFonds >= 2 ? `dans ${r.nbFonds} fonds` : undefined}
          />
        ))}
      </div>
      {reste > 0 && (
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>
          + {reste} {reste > 1 ? "autres titres" : "autre titre"} de moindre poids.
        </p>
      )}
      <p style={{ marginTop: 14, fontSize: 13, color: "#8a9bb0" }}>
        {lookThrough
          ? "Chaque pourcentage est une part de votre portefeuille total. Plusieurs fonds ne veulent pas dire plusieurs placements : certains titres reviennent d'un fonds à l'autre."
          : "Le détail des titres derrière vos fonds n'est pas disponible pour cette liste."}
      </p>
    </div>
  );
}

function FormulaireTransmission({ diagnosticId }: { diagnosticId: string | null }) {
  const [ouvert, setOuvert] = useState(false);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [telephone, setTelephone] = useState("");
  const [consent, setConsent] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState(false);

  const champ: CSSProperties = { width: "100%", borderRadius: 12, border: "1px solid #dbe4ef", padding: "10px 12px", fontSize: 14, outline: "none" };

  if (fait) {
    return (
      <div style={{ borderRadius: 14, padding: 14, textAlign: "center", fontSize: 14, background: "var(--a-geo-bg)", color: "var(--navy)" }}>
        Merci&nbsp;! Un conseiller de Groupe Financier Ste-Foy vous contactera.
      </div>
    );
  }
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} style={{ display: "block", width: "100%", borderRadius: 999, padding: "12px", fontSize: 14, fontWeight: 700, border: "1px solid var(--cyan)", background: "transparent", color: "var(--mid)", cursor: "pointer" }}>
        En parler à un conseiller
      </button>
    );
  }

  async function envoyer() {
    setErreur("");
    if (!prenom.trim() || !nom.trim() || !courriel.trim()) { setErreur("Prénom, nom et courriel sont requis."); return; }
    if (!consent) { setErreur("Merci de cocher le consentement."); return; }
    setEnvoi(true);
    try {
      const r = await fetch("/api/transmission", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosticId: diagnosticId || undefined, prenom, nom, courriel, telephone: telephone || undefined, consentement: true }),
      });
      const j = await r.json();
      if (!r.ok) { setErreur(j.erreur ?? "La transmission a échoué."); setEnvoi(false); return; }
      setFait(true);
    } catch { setErreur("Impossible de joindre le service. Réessayez."); setEnvoi(false); }
  }

  return (
    <div style={{ borderRadius: 14, border: "1px solid #e4ebf3", padding: 14, background: "#fbfdff" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", gap: 9 }}>
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" style={champ} />
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" style={champ} />
        </div>
        <input value={courriel} onChange={(e) => setCourriel(e.target.value)} type="email" placeholder="Courriel" style={champ} />
        <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone (optionnel)" style={champ} />
        <label style={{ display: "flex", gap: 9, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
          <span>{CONSENTEMENT_TRANSMISSION.texte}</span>
        </label>
      </div>
      {erreur && <p style={{ marginTop: 9, fontSize: 12.5, color: "#e0483d" }}>{erreur}</p>}
      <button type="button" onClick={envoyer} disabled={envoi} className="an-btn" style={{ marginTop: 12, width: "100%", padding: "11px", fontSize: 14 }}>
        {envoi ? "Transmission…" : "Transmettre au conseiller"}
      </button>
    </div>
  );
}

export default function ResultatsPage() {
  const [d, setD] = useState<Diagnostic | null>(null);
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    try {
      const brut = sessionStorage.getItem("gfsf_diagnostic");
      if (brut) {
        setD(JSON.parse(brut) as Diagnostic);
        setDiagnosticId(sessionStorage.getItem("gfsf_diagnostic_id"));
      } else if (new URLSearchParams(window.location.search).has("demo")) {
        setD(diagnosticDemo());
        setDemo(true);
      }
    } catch {
      /* ignore */
    }
    setPret(true);
  }, []);

  if (!pret) return <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px 20px", textAlign: "center", color: "#9aa9bb" }}>Chargement…</div>;

  if (!d) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <p style={{ marginBottom: 18, color: "var(--muted)" }}>Aucune analyse à afficher. Commencez par saisir votre portefeuille.</p>
        <Link href="/analyse" className="an-btn" style={{ display: "inline-block", padding: "12px 22px", fontSize: 14, textDecoration: "none" }}>Analyser mon portefeuille</Link>
      </div>
    );
  }

  const frais = d.axes.find((a) => a.nom === "frais");
  const chevauchement = d.axes.find((a) => a.nom === "chevauchement");
  const concentration = d.axes.find((a) => a.nom === "concentration");
  const geographie = d.axes.find((a) => a.nom === "geographie");
  const fd = (frais?.donnees ?? {}) as FraisD;
  const cd = (concentration?.donnees ?? {}) as ConcD;
  const gd = (geographie?.donnees ?? {}) as GeoD;
  const chd = (chevauchement?.donnees ?? {}) as ChevD;

  const rfgMax = Math.max(fd.rfgPondere ?? 0, fd.rfgMedianPondere ?? 0) * 1.25 || 1;
  const recoupes = (chd.titresRecoupes ?? []) as { titre: string; poids: number; nbFonds: number }[];
  const chevMax = Math.max(...recoupes.map((t) => t.poids), 0.01);

  // Ce qui donne son sens au chiffre-vedette : l'écart en dollars avec un portefeuille
  // au coût médian, au même horizon et avec la formule du moteur (aucun calcul dupliqué).
  const taux = fd.tauxHypothetique ?? 0.06;
  const surcout25 =
    typeof fd.rfgPondere === "number" &&
    typeof fd.rfgMedianPondere === "number" &&
    typeof fd.valeurCouverte === "number"
      ? coutDesFrais(fd.valeurCouverte, fd.rfgPondere, taux, 25) -
        coutDesFrais(fd.valeurCouverte, fd.rfgMedianPondere, taux, 25)
      : null;

  // Ordre du récit : le moteur classe les axes du plus faible au plus fort. Aucune note
  // n'est affichée — mais ce qui concerne CE portefeuille passe en premier.
  const ORDRE_REPLI: NomAxe[] = ["frais", "chevauchement", "concentration", "geographie"];
  const rang = (n: NomAxe) => {
    const i = d.scoreGlobal.ordreNarratif.indexOf(n);
    return i === -1 ? 90 + ORDRE_REPLI.indexOf(n) : i;
  };

  const cartes: { nom: NomAxe; rendu: (delay: string) => ReactNode }[] = [
    {
      nom: "frais",
      rendu: (delay) => (
        <AxeCarte key="frais" icon={<Percent size={22} />} accent={A.frais.color} tint={A.frais.bg} titre="Frais" delay={delay} axe={frais?.disponible ? frais : undefined} omettre={dollars(d.projectionFrais.h25)}>
          {frais?.disponible ? (
            <>
              <div style={{ borderRadius: 16, padding: 16, background: A.frais.bg }}>
                <div className="an-chiffre">
                  <CompteurAnime valeur={d.projectionFrais.h25} format={(n) => dollars(n)} />
                </div>
                <div style={{ marginTop: 3, fontSize: 13, color: "var(--muted)" }}>
                  en frais estimés sur 25 ans, à un rendement hypothétique de {pct(taux, 0)} par an.
                </div>
                {surcout25 !== null && Math.abs(surcout25) > 1 && (
                  <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px solid rgba(0,145,194,.2)", fontSize: 13.5, lineHeight: 1.45, color: "var(--ink)" }}>
                    {surcout25 > 0 ? "dont " : "soit "}
                    <strong style={{ color: A.frais.color, whiteSpace: "nowrap" }}>≈ {dollars(Math.abs(surcout25))}</strong>
                    {surcout25 > 0 ? " de plus" : " de moins"} qu'un portefeuille au coût médian.
                  </div>
                )}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12.5, color: "var(--muted)" }}>
                  <span>Sur 10 ans&nbsp;: <strong style={{ color: "var(--ink)" }}>{dollars(d.projectionFrais.h10)}</strong></span>
                  <span>Sur 15 ans&nbsp;: <strong style={{ color: "var(--ink)" }}>{dollars(d.projectionFrais.h15)}</strong></span>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                {typeof fd.rfgPondere === "number" && <Barre label="Vos frais (RFG)" valeur={pct(fd.rfgPondere, 2)} part={(fd.rfgPondere ?? 0) / rfgMax} accent={A.frais.color} survol={`Frais de gestion pondérés de votre portefeuille : ${pct(fd.rfgPondere, 2)} par an`} />}
                {typeof fd.rfgMedianPondere === "number" && <Barre label="Médiane comparable" valeur={pct(fd.rfgMedianPondere, 2)} part={(fd.rfgMedianPondere ?? 0) / rfgMax} sourdine survol={`Médiane des frais pour des catégories comparables : ${pct(fd.rfgMedianPondere, 2)} par an`} />}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 14, color: "var(--muted)" }}>{frais?.constats?.[0] ?? "Frais indisponibles."}</p>
          )}
        </AxeCarte>
      ),
    },
    {
      nom: "chevauchement",
      rendu: (delay) => (
        <AxeCarte key="chevauchement" icon={<Layers size={22} />} accent={A.chevauchement.color} tint={A.chevauchement.bg} titre="Chevauchement des titres" delay={delay} axe={chevauchement?.disponible ? chevauchement : undefined}>
          {chevauchement?.disponible && recoupes.length > 0 ? (
            <>
              <div style={{ borderRadius: 16, padding: 16, background: A.chevauchement.bg }}>
                <div className="an-chiffre">au moins {pct(chd.poidsRecoupement ?? 0)}</div>
                <div style={{ marginTop: 3, fontSize: 13, color: "var(--muted)" }}>de votre portefeuille repose sur des titres détenus par plusieurs fonds à la fois.</div>
              </div>
              <div style={{ marginTop: 16 }}>
                {recoupes.slice(0, 5).map((t) => (
                  <Barre key={t.titre} label={t.titre} valeur={pct(t.poids)} part={relatif(t.poids, chevMax)} accent={A.chevauchement.color} badge={`${t.nbFonds} fonds`} survol={`${t.titre} — ${pct(t.poids)} du portefeuille, détenu par ${t.nbFonds} de vos fonds`} />
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 14, color: "var(--muted)" }}>{chevauchement?.constats?.[0] ?? "Chevauchement indisponible."}</p>
          )}
        </AxeCarte>
      ),
    },
    {
      nom: "concentration",
      rendu: (delay) => (
        <AxeCarte key="concentration" icon={<Target size={22} />} accent={A.concentration.color} tint={A.concentration.bg} titre="Concentration" delay={delay} axe={concentration}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
            <div className="an-chiffre">{cd.nbPositions ?? d.positions.length}</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>produits{cd.niveauProduit ? ` · ${cd.niveauProduit}` : ""}</div>
          </div>
          {d.positions.map((p, i) => (
            <Barre key={i} label={p.code + (p.nonResolu ? "  (non reconnu)" : "")} valeur={pct(p.poids)} part={p.poids} accent={A.concentration.color} sourdine={p.nonResolu} survol={`${p.code} — ${pct(p.poids)} du portefeuille (${dollars(p.montant)})`} />
          ))}
        </AxeCarte>
      ),
    },
    {
      nom: "geographie",
      rendu: (delay) => (
        <AxeCarte key="geographie" icon={<Globe2 size={22} />} accent={A.geographie.color} tint={A.geographie.bg} titre="Répartition géographique" delay={delay} axe={geographie?.disponible ? geographie : undefined}>
          {geographie?.disponible ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
                <div className="an-chiffre">{pct(gd.canada ?? 0)}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>au Canada · indice mondial ~{pct(gd.referenceCanadaACWI ?? 0.03, 0)}</div>
              </div>
              {(gd.regions ?? []).map((r) => (
                <Barre key={r.region} label={REGIONS[r.region] ?? r.region} valeur={pct(r.poids)} part={r.poids} accent={A.geographie.color} survol={`${REGIONS[r.region] ?? r.region} — ${pct(r.poids)} du portefeuille`} />
              ))}
            </>
          ) : (
            <p style={{ fontSize: 14, color: "var(--muted)" }}>{geographie?.constats?.[0] ?? "Répartition indisponible."}</p>
          )}
        </AxeCarte>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px 20px" }}>
      <div className="an-fadeup" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "clamp(24px,4vw,32px)", letterSpacing: "-.02em", color: "var(--navy)", margin: 0 }}>Ce que nous observons</h1>
          {demo && <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, background: "rgba(0,180,216,.12)", color: "var(--mid)" }}>Exemple</span>}
        </div>
        <p style={{ marginTop: 6, fontSize: 15, color: "var(--muted)" }}>
          {demo ? "Un rapport fictif, juste pour montrer le rendu." : "Des constats factuels sur votre portefeuille — pas des recommandations."}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <Jeton>{dollars(d.valeurTotale)} analysés</Jeton>
          <Jeton>{d.positions.length} {d.positions.length > 1 ? "produits" : "produit"}</Jeton>
          {d.couvertureFrais > 0 && d.couvertureFrais < 0.999 && (
            <Jeton>frais connus sur {pct(d.couvertureFrais, 0)} du portefeuille</Jeton>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <VraiPortrait d={d} />
      </div>

      {d.fondsNonResolus.length > 0 && (
        <div className="an-fadeup" style={cssd("80ms", { marginBottom: 20, borderRadius: 16, padding: "14px 16px", fontSize: 14, background: "var(--a-conc-bg)", border: "1px solid rgba(240,147,11,.28)", color: "var(--ink)" })}>
          <strong>Fonds non reconnus :</strong> {d.fondsNonResolus.join(", ")}. Ils ne figurent pas dans notre référentiel et sont exclus des frais et de la répartition ci-dessous.
        </div>
      )}

      <div style={{ display: "grid", gap: 18, alignItems: "start", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        {[...cartes].sort((a, b) => rang(a.nom) - rang(b.nom)).map((c, i) => c.rendu(`${120 + i * 60}ms`))}
      </div>

      {/* ET MAINTENANT */}
      <div className="an-card an-fadeup" style={cssd("360ms", { marginTop: 20, padding: 24 })}>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17, color: "var(--navy)", margin: "0 0 6px" }}>Et maintenant ?</h2>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px", maxWidth: 620 }}>
          Ce diagnostic est à vous. Vous pouvez repartir avec, ou en discuter avec un conseiller de Groupe Financier Ste-Foy — sans obligation.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", alignItems: "start" }}>
          <Link href="/analyse" className="an-btn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", fontSize: 14, textDecoration: "none" }}>
            <RefreshCw size={16} /> Refaire une analyse
          </Link>
          <button
            type="button"
            onClick={async () => {
              const r = await fetch("/api/rapport", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ diagnostic: d }) });
              if (!r.ok) return;
              const blob = await r.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "analyse-portefeuille-gfsf.pdf";
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
            }}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, padding: "12px", fontSize: 14, fontWeight: 700, border: "1px solid var(--cyan)", background: "transparent", color: "var(--mid)", cursor: "pointer" }}
          >
            <Download size={16} /> Télécharger le PDF
          </button>
          <FormulaireTransmission diagnosticId={diagnosticId} />
        </div>
      </div>

      <p style={{ marginTop: 22, textAlign: "center", fontSize: 12.5, color: "#8a9bb0" }}>
        Outil informatif — ne constitue pas un conseil en placement. Valeurs fondées sur des hypothèses divulguées.
      </p>
    </div>
  );
}

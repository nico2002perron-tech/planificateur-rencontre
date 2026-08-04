// Rapport PDF public (constats) — refondu au langage du site : en-tête dégradé,
// sections codées par couleur (comme le web), « le vrai portrait » en vedette.
// react-pdf. Aucun conseil : uniquement des constats.

import React from "react";
import {
  Document, Page, Text, View, Font, Svg, Defs, LinearGradient, Stop, Rect,
  Path, Line, Circle, Polyline, Polygon,
} from "@react-pdf/renderer";
import path from "path";
import { styles, C } from "./styles";
import { AVIS_PUBLIC } from "@/lib/analyse/textes";
import type { Diagnostic, ResultatAxe } from "@/types/diagnostic";

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Montserrat",
  fonts: [
    { src: path.join(FONTS_DIR, "Montserrat-Bold.ttf"), fontWeight: 700 },
    { src: path.join(FONTS_DIR, "Montserrat-ExtraBold.ttf"), fontWeight: 800 },
  ],
});
Font.register({
  family: "Open Sans",
  fonts: [
    { src: path.join(FONTS_DIR, "OpenSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "OpenSans-SemiBold.ttf"), fontWeight: 600 },
  ],
});

// Largeur de contenu utile (LETTER 612 − 2×36 de marge).
const W = 540;
// Plafond de barres par bloc wrap={false} (évite la troncature silencieuse en bas de page).
const CAP = 18;

const AX = {
  frais: { c: "#0091c2", bg: "#e3f6fb" },
  chevauchement: { c: "#7c5cff", bg: "#eee9ff" },
  concentration: { c: "#f0930b", bg: "#fff2dc" },
  geographie: { c: "#1aa564", bg: "#e3f6ec" },
} as const;

// ── Formatage fr-CA (espace INSÉCABLE avant % et $, comme price-targets-template) ──
const pct = (x: number, d = 1) => `${(x * 100).toLocaleString("fr-CA", { maximumFractionDigits: d })} %`;
const dollars = (x: number) => `${Math.round(x).toLocaleString("fr-CA")} $`;

const REGIONS: Record<string, string> = {
  canada: "Canada", usa: "États-Unis", europe: "Europe",
  asie_pacifique: "Asie-Pacifique", marches_emergents: "Marchés émergents", autre: "Autre",
};

type FraisD = { rfgPondere?: number; rfgMedianPondere?: number | null; tauxHypothetique?: number };
type ChevD = { poidsRecoupement?: number; titresRecoupes?: { titre: string; poids: number; nbFonds: number }[]; topTitres?: { titre: string; poids: number }[] };
type ConcD = { nbPositions?: number; niveauProduit?: string };
type GeoD = { canada?: number; referenceCanadaACWI?: number; regions?: { region: string; poids: number }[] };

// ── Icônes d'axe (tracés lucide en primitives react-pdf, patron de pdf/sectors.tsx) ──
function IconeAxe({ nom, accent }: { nom: string; accent: string }) {
  const st = { stroke: accent, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icones: Record<string, React.ReactNode[]> = {
    frais: [
      <Line key="l" x1={19} y1={5} x2={5} y2={19} {...st} />,
      <Circle key="a" cx={6.5} cy={6.5} r={2.5} {...st} />,
      <Circle key="b" cx={17.5} cy={17.5} r={2.5} {...st} />,
    ],
    chevauchement: [
      <Polygon key="p" points="12,3 21,8 12,13 3,8" {...st} />,
      <Polyline key="a" points="3,12 12,17 21,12" {...st} />,
      <Polyline key="b" points="3,16 12,21 21,16" {...st} />,
    ],
    concentration: [
      <Circle key="o" cx={12} cy={12} r={9} {...st} />,
      <Circle key="m" cx={12} cy={12} r={5} {...st} />,
      <Circle key="i" cx={12} cy={12} r={1.6} fill={accent} />,
    ],
    geographie: [
      <Circle key="o" cx={12} cy={12} r={9} {...st} />,
      <Line key="e" x1={3} y1={12} x2={21} y2={12} {...st} />,
      <Path key="m" d="M12 3 C7 8 7 16 12 21 C17 16 17 8 12 3" {...st} />,
    ],
  };
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      {icones[nom]}
    </Svg>
  );
}

// ── Primitives ──
function Barre({ label, valeur, part, accent, badge, sourdine }: {
  label: string; valeur: string; part: number; accent: string; badge?: string; sourdine?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5.5 }}>
      <View style={{ width: "38%" }}>
        <Text style={{ fontSize: 8.5, color: sourdine ? "#9aa9bb" : C.text }}>
          {label}
          {badge ? <Text style={{ fontSize: 7, color: AX.chevauchement.c }}>{`   · ${badge}`}</Text> : ""}
        </Text>
      </View>
      <View style={{ flex: 1, height: 8, backgroundColor: "#eef2f7", borderRadius: 4, marginHorizontal: 8, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${Math.max(3, Math.min(100, part * 100))}%`, backgroundColor: sourdine ? "#c9d3de" : accent, borderRadius: 4 }} />
      </View>
      <Text style={{ width: "14%", fontSize: 8.5, fontFamily: "Open Sans", fontWeight: 600, color: C.navy, textAlign: "right" }}>{valeur}</Text>
    </View>
  );
}

function Constats({ axe, accent }: { axe?: ResultatAxe; accent: string }) {
  if (!axe?.constats?.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      {axe.constats.map((c, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: accent, marginTop: 4.5, marginRight: 7 }} />
          <Text style={{ flex: 1, fontSize: 8.5, color: C.textSec, lineHeight: 1.4 }}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

function Vedette({ tint, valeur, sous }: { tint: string; valeur: string; sous: string }) {
  return (
    <View style={{ backgroundColor: tint, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <Text style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 22, color: C.navy }}>{valeur}</Text>
      <Text style={{ fontSize: 8, color: C.textSec, marginTop: 2 }}>{sous}</Text>
    </View>
  );
}

// Chiffre-vedette « nu » (grand nombre + libellé) — pour concentration & géo, comme le web.
function VedetteNue({ valeur, sous }: { valeur: string; sous: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 8 }}>
      <Text style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 22, color: C.navy }}>{valeur}</Text>
      <Text style={{ fontSize: 8.5, color: C.textSec, marginLeft: 6 }}>{sous}</Text>
    </View>
  );
}

function SectionAxe({ nom, accent, tint, titre, children, axe }: {
  nom: string; accent: string; tint: string; titre: string; children: React.ReactNode; axe?: ResultatAxe;
}) {
  return (
    <View style={[styles.card, { marginBottom: 11 }]} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: tint, alignItems: "center", justifyContent: "center", marginRight: 9 }}>
          <IconeAxe nom={nom} accent={accent} />
        </View>
        <Text style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 12.5, color: C.navy }}>{titre}</Text>
      </View>
      {children}
      <Constats axe={axe} accent={accent} />
    </View>
  );
}

function Pied() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Outil informatif</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function RapportDiagnostic({ diagnostic, date }: { diagnostic: Diagnostic; date?: string }) {
  const d = diagnostic;
  const n = d.positions.length;
  const frais = d.axes.find((a) => a.nom === "frais");
  const chev = d.axes.find((a) => a.nom === "chevauchement");
  const conc = d.axes.find((a) => a.nom === "concentration");
  const geo = d.axes.find((a) => a.nom === "geographie");
  const fd = (frais?.donnees ?? {}) as FraisD;
  const chd = (chev?.donnees ?? {}) as ChevD;
  const cd = (conc?.donnees ?? {}) as ConcD;
  const gd = (geo?.donnees ?? {}) as GeoD;

  const rfgMax = Math.max(fd.rfgPondere ?? 0, fd.rfgMedianPondere ?? 0) * 1.25 || 1;
  const recoupes = chd.titresRecoupes ?? [];
  const chevMax = Math.max(...recoupes.map((t) => t.poids), 0.001);
  const regions = gd.regions ?? [];
  const geoMax = Math.max(...regions.map((r) => r.poids), 0.01);

  // Positions triées par poids décroissant (pour ne plafonner que les plus petites).
  const positionsTriees = [...d.positions].sort((a, b) => b.poids - a.poids);
  const nbConc = cd.nbPositions ?? n;

  // Vrai portrait (look-through) — plafonné, trié.
  const topTitres = chd.topTitres ?? [];
  const nbFondsParTitre = new Map(recoupes.map((t) => [t.titre, t.nbFonds]));
  const lookThrough = Boolean(chev?.disponible) && topTitres.length > 0;
  const portrait = lookThrough
    ? topTitres.map((t) => ({ titre: t.titre, poids: t.poids, nbFonds: nbFondsParTitre.get(t.titre) ?? 1 }))
    : positionsTriees.map((p) => ({ titre: p.code, poids: p.poids, nbFonds: 1 }));
  const portraitMax = Math.max(...portrait.map((r) => r.poids), 0.01);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* En-tête dégradé */}
        <View style={{ position: "relative", height: 72, marginBottom: 16 }}>
          <Svg width={W} height={72} style={{ position: "absolute", top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="hd" x1="0" y1="0" x2="1" y2="0.7">
                <Stop offset="0" stopColor="#03045e" />
                <Stop offset="0.55" stopColor="#023e8a" />
                <Stop offset="1" stopColor="#0077b6" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={W} height={72} rx={14} fill="url(#hd)" />
          </Svg>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
            <View>
              <Text style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 15, color: "#ffffff" }}>Groupe Financier Ste-Foy</Text>
              <Text style={{ fontSize: 8, color: "#cfe6ff", marginTop: 3 }}>Analyse de portefeuille — vos constats</Text>
            </View>
            {date ? <Text style={{ fontSize: 8, color: "#bcdcf5" }}>{date}</Text> : null}
          </View>
        </View>

        {/* Le vrai portrait */}
        <View style={[styles.card, { marginBottom: 11, backgroundColor: "#f1f9fd", borderColor: "#bfe8f4" }]} wrap={false}>
          <Text style={{ fontSize: 7.5, fontFamily: "Open Sans", fontWeight: 600, color: AX.frais.c, textTransform: "uppercase", letterSpacing: 1 }}>
            {lookThrough ? "Le vrai portrait" : "Votre portefeuille"}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Montserrat", fontWeight: 800, color: C.navy, marginTop: 3, marginBottom: 10 }}>
            {lookThrough
              ? `${n} ${n > 1 ? "produits" : "produit"} en surface — les titres réels derrière`
              : `Vos ${n} ${n > 1 ? "produits" : "produit"}`}
          </Text>
          {portrait.slice(0, CAP).map((r) => (
            <Barre key={r.titre} label={r.titre} valeur={pct(r.poids)} part={r.poids / portraitMax} accent={AX.frais.c} badge={r.nbFonds >= 2 ? `dans ${r.nbFonds} fonds` : undefined} />
          ))}
          {portrait.length > CAP ? <Text style={{ fontSize: 7.5, color: C.textTer, marginTop: 3 }}>+ {portrait.length - CAP} autres</Text> : null}
          <Text style={{ fontSize: 7.5, color: C.textTer, marginTop: 5 }}>
            {lookThrough
              ? "Plusieurs fonds ne veulent pas dire plusieurs placements : certains titres reviennent d'un fonds à l'autre."
              : "Le détail des titres derrière vos fonds n'est pas disponible pour cette liste."}
          </Text>
        </View>

        {d.fondsNonResolus.length > 0 ? (
          <View style={{ backgroundColor: AX.concentration.bg, borderRadius: 8, padding: 10, marginBottom: 11, flexDirection: "row" }}>
            <View style={{ width: 3, borderRadius: 2, backgroundColor: AX.concentration.c, marginRight: 9 }} />
            <Text style={{ flex: 1, fontSize: 8.5, color: C.text }}>
              <Text style={{ fontFamily: "Open Sans", fontWeight: 600 }}>Fonds non reconnus : </Text>
              {d.fondsNonResolus.join(", ")}. Exclus des frais et de la répartition.
            </Text>
          </View>
        ) : null}

        {/* FRAIS */}
        <SectionAxe nom="frais" accent={AX.frais.c} tint={AX.frais.bg} titre="Frais" axe={frais?.disponible ? frais : undefined}>
          {frais?.disponible ? (
            <>
              <Vedette tint={AX.frais.bg} valeur={dollars(d.projectionFrais.h25)} sous={`en frais estimés sur 25 ans (rendement hypothétique ${pct(fd.tauxHypothetique ?? 0.06, 0)}/an).`} />
              {typeof fd.rfgPondere === "number" ? <Barre label="Vos frais (RFG)" valeur={pct(fd.rfgPondere, 2)} part={fd.rfgPondere / rfgMax} accent={AX.frais.c} /> : null}
              {typeof fd.rfgMedianPondere === "number" ? <Barre label="Médiane comparable" valeur={pct(fd.rfgMedianPondere, 2)} part={fd.rfgMedianPondere / rfgMax} accent={AX.frais.c} sourdine /> : null}
            </>
          ) : (
            <Text style={{ fontSize: 8.5, color: C.textSec }}>{frais?.constats?.[0]}</Text>
          )}
        </SectionAxe>

        {/* CHEVAUCHEMENT */}
        <SectionAxe nom="chevauchement" accent={AX.chevauchement.c} tint={AX.chevauchement.bg} titre="Chevauchement des titres" axe={chev?.disponible ? chev : undefined}>
          {chev?.disponible && recoupes.length > 0 ? (
            <>
              <Vedette tint={AX.chevauchement.bg} valeur={`au moins ${pct(chd.poidsRecoupement ?? 0)}`} sous="de votre portefeuille repose sur des titres détenus par plusieurs de vos fonds." />
              {recoupes.slice(0, 5).map((t) => (
                <Barre key={t.titre} label={t.titre} valeur={pct(t.poids)} part={t.poids / chevMax} accent={AX.chevauchement.c} badge={`${t.nbFonds} fonds`} />
              ))}
            </>
          ) : (
            <Text style={{ fontSize: 8.5, color: C.textSec }}>{chev?.constats?.[0]}</Text>
          )}
        </SectionAxe>

        {/* CONCENTRATION */}
        <SectionAxe nom="concentration" accent={AX.concentration.c} tint={AX.concentration.bg} titre="Concentration" axe={conc}>
          <VedetteNue valeur={String(nbConc)} sous={`${nbConc > 1 ? "produits" : "produit"}${cd.niveauProduit ? ` · ${cd.niveauProduit}` : ""}`} />
          {positionsTriees.slice(0, CAP).map((p, i) => (
            <Barre key={i} label={p.code + (p.nonResolu ? " (non reconnu)" : "")} valeur={pct(p.poids)} part={p.poids} accent={AX.concentration.c} sourdine={p.nonResolu} />
          ))}
          {n > CAP ? <Text style={{ fontSize: 7.5, color: C.textTer, marginTop: 4 }}>+ {n - CAP} autres positions</Text> : null}
        </SectionAxe>

        {/* GÉOGRAPHIE */}
        <SectionAxe nom="geographie" accent={AX.geographie.c} tint={AX.geographie.bg} titre="Répartition géographique" axe={geo?.disponible ? geo : undefined}>
          {geo?.disponible ? (
            <>
              <VedetteNue valeur={pct(gd.canada ?? 0)} sous={`au Canada · indice mondial ~${pct(gd.referenceCanadaACWI ?? 0.03, 0)}`} />
              {regions.map((r) => (
                <Barre key={r.region} label={REGIONS[r.region] ?? r.region} valeur={pct(r.poids)} part={r.poids / geoMax} accent={AX.geographie.c} />
              ))}
            </>
          ) : (
            <Text style={{ fontSize: 8.5, color: C.textSec }}>{geo?.constats?.[0]}</Text>
          )}
        </SectionAxe>

        {/* Avis */}
        <View style={[styles.card, { backgroundColor: C.panel, marginTop: 2 }]} wrap={false}>
          <Text style={styles.label}>Avis important</Text>
          <Text style={styles.disclaimer}>
            {AVIS_PUBLIC} Le rendement hypothétique sert uniquement à illustrer l&apos;effet des frais. Pour une
            évaluation adaptée à votre situation, consultez un conseiller.
          </Text>
        </View>

        <Pied />
      </Page>
    </Document>
  );
}

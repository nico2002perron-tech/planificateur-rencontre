// « LE PARCOURS DE VOTRE ARGENT » — DEUX pages, chacune racontant UNE chose :
//
//   PAGE 1 · LE RÉCIT : trois chiffres géants (déposé → investi → ça vaut),
//            la timeline des dépôts, un résumé en deux phrases. Aérée, présentable
//            à un client en la tendant.
//   PAGE 2 · LA PREUVE : où l'argent est allé (ruban), chaque achat au tableau,
//            la note méthodologique complète.
//
// Décision propriétaire 2026-07-23 : la contrainte « tout sur une page » écrasait
// la clarté — on choisit deux pages qui respirent plutôt qu'une page compressée.
//
// Identité de page : accent ORANGE #FF9600 (texte orange sur clair = #b45309).
// Dépôts = #2563eb. duoGreen/duoBlue INTERDITS ici. Vert/rouge réservés aux
// écarts. Vocabulaire : « investi/achat/écart/valeur » — jamais « déployé/
// rendement/profit/performance » ; « suivi de », jamais « financé par » (dépôts).
//
// Gardes d'honnêteté (héritées des audits) :
// - écart affiché SEULEMENT si toutes les parts achetées sont encore détenues ;
// - « toutes revendues » affirmé SEULEMENT si closedCount === totalTitres ;
// - « à la revente » = gains/pertes inscrit par Croesus (portée divulguée) ;
// - la note méthodologique boucle : chaque transaction comptée UNE fois ;
// - plancher rendu pour Q1/Q2/Q3 (l'omission sélective est interdite), Q4 omis.

import React from 'react';
import { Page, Text, View, Svg, Path, Defs, LinearGradient, Stop, Rect } from '@react-pdf/renderer';
import { styles, C } from './styles';
import { SectionHeader, PageFooterV12 } from './year-activity-pages';
import type { DeploymentSummary, DeploymentLine, DepositChapter, GrowthFloor } from '@/lib/portfolio/deployment';

// ── Helpers locaux (copies volontaires : price-targets-template importera cette
// page — importer ses helpers créerait un cycle de modules) ──
function fmt(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}
function fmtFull(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(value);
}
function fmtDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${iso}T12:00:00`));
  return formatted.replace(/^1 /, '1er ');
}
function fmtDateCourt(iso: string): string {
  const formatted = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' })
    .format(new Date(`${iso}T12:00:00`));
  return formatted.replace(/^1 /, '1er ');
}
const fmtMois = (iso: string) =>
  new Intl.DateTimeFormat('fr-CA', { month: 'long' }).format(new Date(`${iso}T12:00:00`));
const plur = (n: number) => (n > 1 ? 's' : '');
const fmtPctFr = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} %`;
const fmtJours = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
/** Couleur de texte d'un écart : vert/rouge sémantiques, gris au neutre. */
const gc = (v: number) => (v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#94a3b8');

/** Rangée « ● Étiquette : montant » des bandeaux — point de couleur, étiquette
 *  grise, montant semi-gras navy. Net et aligné. */
function SourceRow({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1.5 }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dot }} />
      <Text style={{ fontSize: 7.5, color: '#64748b' }}>
        {label} : <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{value}</Text>
      </Text>
    </View>
  );
}

/** Pastille de pourcentage (patron PctPill du template ; `big` = héros de page 1). */
function PctPill({ value, big = false }: { value: number; big?: boolean }) {
  const palette = value > 0
    ? { bg: '#ecfdf5', text: '#059669' }
    : value < 0
      ? { bg: '#fef2f2', text: '#dc2626' }
      : { bg: '#f1f5f9', text: '#94a3b8' };
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <View style={{ backgroundColor: palette.bg, borderRadius: 7, paddingHorizontal: big ? 6 : 4, paddingVertical: big ? 2.5 : 1.5 }}>
        <Text style={{ fontSize: big ? 8.5 : 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: palette.text }}>
          {fmtPctFr(value)}
        </Text>
      </View>
    </View>
  );
}

// Rotation de teintes RÉSERVÉE aux achats (par rang de poids) ; résidu gris.
const DEPLOY_COLORS = ['#FF9600', '#0077b6', '#00b4d8', '#CE82FF', '#48cae4', '#c5a365'];
const RESIDUAL_COLOR = '#64748b';
const MAX_TABLE_LINES = 9;
const MAX_RIBBON_SEGMENTS = 6;
/** Au-delà de ce nombre de dépôts, la timeline passe en bande « cadence ». */
const MAX_CHAPTER_ROWS = 6;

const COL = { titre: '34%', prix: '20%', investi: '15%', vaut: '15%', ecart: '16%' } as const;

function lineColor(index: number): string {
  return index < MAX_RIBBON_SEGMENTS ? DEPLOY_COLORS[index] : RESIDUAL_COLOR;
}

/** Fond dégradé SVG doux — LE motif « carte-vedette » de la couverture du
 *  document (Svg absolu plein cadre + Rect). `id` unique dans le document.
 *  Le dégradé descend vers le blanc : de la profondeur, jamais un bloc plat. */
function GradientBg({ id, from, mid }: { id: string; from: string; mid: string }) {
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 300 200" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="300" y2="200" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={from} />
          <Stop offset="0.55" stopColor={mid} />
          <Stop offset="1" stopColor="#ffffff" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={300} height={200} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Chevron narratif du bandeau : la flèche porte l'identité orange et son
 *  micro-mot — elle raconte elle-même dépôt → achats → valeur. */
function Chevron({ label }: { label: string }) {
  return (
    <View style={{ width: 44, alignItems: 'center', alignSelf: 'center' }}>
      <Svg width={16} height={22}>
        <Path d="M4 4 L13 11 L4 18" stroke="#FF9600" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      </Svg>
      <Text style={{ marginTop: 1, fontSize: 6, color: '#94a3b8', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ── L'axe du temps muet ───────────────────────────────────────────────────────
/** Largeur utile : 595,28 (A4) − 2×36 (padding page) = 523,28 ; − 2×10 (padding
 *  carte) − 2×1 (bordure) ≈ 501. Couvert par les harnais de rendu. */
const AXIS_W = 501;

function joursDepuis(depart: string, date: string): number {
  return Math.round(
    (new Date(`${date}T12:00:00`).getTime() - new Date(`${depart}T12:00:00`).getTime()) / 86_400_000,
  );
}

/** Positions proportionnelles aux dates réelles — deux dépôts rapprochés se
 *  touchent, c'est LE FAIT (aucun déplacement). Marqueurs bleus = dépôts,
 *  marques orange = achats. */
function TimelineAxe({ d, numeros }: { d: DeploymentSummary; numeros: boolean }) {
  const totalJours = Math.max(1, joursDepuis(d.startDate, d.endDate));
  const x = (date: string, largeur: number) =>
    Math.max(0, Math.min(AXIS_W - largeur, (joursDepuis(d.startDate, date) / totalJours) * (AXIS_W - largeur)));
  const chapitres = d.depositChapters ?? [];
  const numPositions: { x: number; n: number }[] = [];
  if (numeros) {
    let dernier = -Infinity;
    chapitres.forEach((c, i) => {
      const px = x(c.date, 4);
      if (px - dernier >= 8) {
        numPositions.push({ x: px, n: i + 1 });
        dernier = px;
      }
    });
  }
  return (
    <View>
      {/* Dépôts et achats AU-DESSUS de la ligne ; ventes SOUS la ligne (en vert) —
          l'entrée et la sortie de titres se lisent d'un coup d'œil. */}
      <View style={{ height: 26, position: 'relative' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 8, height: 1, backgroundColor: '#e2e8f0' }} />
        {d.buyDates.map(b => (
          <View
            key={`a-${b.date}`}
            style={{ position: 'absolute', left: x(b.date, 2), bottom: 9, width: 2, height: 7, backgroundColor: '#FF9600' }}
          />
        ))}
        {chapitres.map(c => (
          <View
            key={c.date}
            style={{ position: 'absolute', left: x(c.date, 4), bottom: 9, width: 4, height: 11, borderRadius: 2, backgroundColor: '#2563eb' }}
          />
        ))}
        {d.sellDates.map(s => (
          <View
            key={`v-${s.date}`}
            style={{ position: 'absolute', left: x(s.date, 2), bottom: 2, width: 2, height: 6, backgroundColor: '#10b981' }}
          />
        ))}
      </View>
      {numeros && numPositions.length > 0 && (
        <View style={{ height: 9, position: 'relative' }}>
          {numPositions.map(p => (
            <Text key={p.n} style={{ position: 'absolute', left: Math.max(0, p.x - 2), width: 12, fontSize: 6.5, color: '#94a3b8' }}>
              {p.n}
            </Text>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 }}>
        <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>{fmtDateCourt(d.startDate)}</Text>
        <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>
          <Text style={{ color: '#2563eb' }}>▪</Text> dépôt   <Text style={{ color: '#FF9600' }}>▪</Text> achat
          {d.sellDates.length > 0 ? <Text>   <Text style={{ color: '#10b981' }}>▪</Text> vente (sous la ligne)</Text> : null}
        </Text>
        <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>{fmtDateCourt(d.endDate)}</Text>
      </View>
    </View>
  );
}

/** Une rangée-chapitre, généreuse (page 1 n'a plus à se compresser). */
function ChapitreRow({ c, index, dernier, sousLigneDelai }: {
  c: DepositChapter;
  index: number;
  dernier: boolean;
  sousLigneDelai: boolean;
}) {
  const labels = c.accounts.filter(a => a.label != null).map(a => a.label).join(' + ');
  const syms = c.buys.slice(0, 3).map(b => b.symbol);
  const extra = c.buys.length - syms.length;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        borderBottomWidth: dernier ? 0 : 0.5,
        borderBottomColor: '#f1f5f9',
        borderBottomStyle: 'solid',
      }}
    >
      <Text style={{ width: 12, fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8' }}>
        {index + 1}
      </Text>
      <Text style={{ width: 50, fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>
        {fmtDateCourt(c.date)}
      </Text>
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Text style={{ fontSize: 9.5, maxLines: 1, textOverflow: 'ellipsis' }}>
          <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: '#2563eb' }}>{fmt(c.amountCad)}</Text>
          {labels !== '' && <Text style={{ fontSize: 8, color: '#475569' }}> au {labels}</Text>}
        </Text>
        {sousLigneDelai && c.daysToFirstBuy != null && c.daysToFirstBuy > 0 && (
          <Text style={{ marginTop: 1, fontSize: 6.5, color: '#94a3b8' }}>
            premier achat {c.daysToFirstBuy} jour{plur(c.daysToFirstBuy)} plus tard
          </Text>
        )}
      </View>
      <View style={{ width: 36, alignItems: 'center' }}>
        <Svg width={10} height={10}>
          <Path d="M3 2 L8 5.5 L3 9" stroke="#FF9600" strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
        <Text style={{ fontSize: 5.5, color: '#94a3b8' }}>suivi de</Text>
      </View>
      <View style={{ width: 175, alignItems: 'flex-end' }}>
        {c.buys.length > 0 ? (
          <>
            <Text style={{ fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#b45309' }}>
              {c.buyCount} achat{plur(c.buyCount)} · {fmt(c.totalFollowedCad)}
            </Text>
            <Text style={{ fontSize: 7, color: '#64748b', maxLines: 1, textOverflow: 'ellipsis' }}>
              {syms.join(', ')}{extra > 0 ? ` +${extra}` : ''}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 7, color: '#94a3b8' }}>aucun achat n&apos;a suivi avant la fin de la période</Text>
        )}
      </View>
    </View>
  );
}

export function DeploymentPage({ deployment }: { deployment: DeploymentSummary }) {
  const d = deployment;
  if (d.buyCount === 0) return null;

  const hasHeld = d.heldCount > 0;
  const totalTitres = d.lines.length;
  const nonHeldCount = d.partialCount + d.closedCount + d.unmatchedCount + d.unpriceableCount;
  const tradedCount = d.partialCount + d.closedCount;        // achetés ET revendus (valeur = détenu + encaissé)
  const noValueCount = d.unmatchedCount + d.unpriceableCount; // seuls titres encore à « — »
  const allSold = d.closedCount === totalTitres;
  const top = d.lines[0];
  const zeroOverride = d.contributionsOverridden && d.contributions === 0;

  // ── Tableau clair des cotisations : « En argent » + une ligne par titre apporté,
  // avec le compte de destination. Simple à lire pour le client. ──
  const secByAcct = new Map<string, number>();
  for (const s of d.contributedSecurities) {
    const k = s.accountLabel ?? 'Autre compte';
    secByAcct.set(k, (secByAcct.get(k) ?? 0) + s.amountCad);
  }
  const cotisRows: { label: string; detail?: string; amountCad: number; account: string }[] = [];
  for (const a of d.contributionsByAccount ?? []) {
    const cash = a.amountCad - (secByAcct.get(a.label) ?? 0);
    if (cash > 0.5) cotisRows.push({ label: 'En argent', amountCad: cash, account: a.label });
  }
  for (const s of d.contributedSecurities) {
    cotisRows.push({
      label: 'En titres',
      detail: `${s.symbol}${s.quantity ? ` · ${s.quantity.toLocaleString('fr-CA')} u.` : ''}`,
      amountCad: s.amountCad,
      account: s.accountLabel ?? 'Autre compte',
    });
  }
  const compte = (a: string) => (a === 'Autre compte' ? 'Autre' : a);

  // Carte-vedette « valeur aujourd'hui » : dégradé doux (motif couverture),
  // teinté selon le SIGNE (gain vert, perte rouge doux, neutre bleu de marque).
  // Plus de bloc bleu foncé ; le focal tient au dégradé, à la bordure teintée et
  // au plus gros chiffre.
  const focalState = !hasHeld ? 'none' : d.deltaAbs > 0 ? 'gain' : d.deltaAbs < 0 ? 'loss' : 'flat';
  const focalGrad = focalState === 'gain'
    ? { from: '#d1fae5', mid: '#ecfdf5', border: '#a7f3d0' }
    : focalState === 'loss'
      ? { from: '#fee2e2', mid: '#fef2f2', border: '#fecaca' }
      : { from: '#e0eefb', mid: '#eef5fc', border: '#dbeafe' };

  // ── Mode de la timeline ──
  const chapters = d.depositChapters;
  const nChap = chapters?.length ?? 0;
  type TimelineMode = 'chapitres' | 'cadence' | 'strip' | 'absent';
  const timelineMode: TimelineMode = d.contributionsOverridden
    ? 'absent' // un montant saisi n'a ni date ni compte : pas de faits de dates à montrer
    : chapters == null || nChap === 0
      ? 'strip'
      : nChap > MAX_CHAPTER_ROWS ? 'cadence' : 'chapitres';

  // ── Plancher : la page choisit sa phrase par quadrant, sans re-déduire les signes ──
  const floor = d.growthFloor;
  const showFloor = floor != null && floor.quadrant <= 3;
  const floorSuffix = d.contributionsOverridden && d.withdrawals > 0
    ? ' (les dépôts nets combinent les cotisations saisies et les retraits de l’historique)'
    : '';
  const FloorText = ({ g }: { g: GrowthFloor }) => (
    <>
      {g.quadrant === 1 ? (
        <>
          Sur l&apos;ensemble du portefeuille, la valeur a augmenté de{' '}
          <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(g.totalChange)}</Text> ; vos dépôts nets en
          expliquent <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(g.netDeposits)}</Text> à eux seuls —
          avant même tout écart de valeur sur ces sommes.
        </>
      ) : g.quadrant === 2 ? (
        <>
          Sur l&apos;ensemble du portefeuille, la valeur a augmenté de{' '}
          <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(g.totalChange)}</Text> alors que vos dépôts nets
          totalisent <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(g.netDeposits)}</Text> : sans ces
          dépôts, sa valeur aurait diminué.
        </>
      ) : (
        <>
          Sur l&apos;ensemble du portefeuille, la valeur a diminué de{' '}
          <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(Math.abs(g.totalChange))}</Text> malgré{' '}
          <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(g.netDeposits)}</Text> de dépôts nets.
        </>
      )}
      {floorSuffix}
    </>
  );

  // ── Tableau (page 2) : ≤ 9 titres → tous ; sinon top 8 + « Autres achats ». ──
  const shown = totalTitres <= MAX_TABLE_LINES ? d.lines : d.lines.slice(0, MAX_TABLE_LINES - 1);
  const rest = d.lines.slice(shown.length);
  const restCost = rest.reduce((s, l) => s + l.totalCostCad, 0);
  const restWeight = rest.reduce((s, l) => s + l.weightPct, 0);
  // « Valeur aujourd'hui » de tous les titres agrégés qui en ont une (détenus,
  // partiels ET revendus) — même modèle que les lignes individuelles.
  const restValued = rest.filter(l => l.currentValue != null);
  const restValue = restValued.reduce((s, l) => s + (l.currentValue ?? 0), 0);
  const restDelta = restValued.reduce((s, l) => s + (l.deltaAbs ?? 0), 0);

  // ── Ruban (page 2) : CONCENTRATION RÉELLE du portefeuille (poids par titre =
  // valeur actuelle / valeur totale, données des cours cibles), PAS les achats. ──
  const ribbon = d.concentration.slice(0, MAX_RIBBON_SEGMENTS);
  const ribbonRest = d.concentration.slice(MAX_RIBBON_SEGMENTS);
  const ribbonRestWeight = ribbonRest.reduce((s, c) => s + c.weightPct, 0);
  const ribbonRestValue = ribbonRest.reduce((s, c) => s + c.marketValue, 0);

  const r = d.reconciliation;
  const usdPhrase = d.usdCadRate && d.usdCadRate > 0
    ? `Les montants en dollars américains sont convertis en dollars canadiens au taux de ${d.usdCadRate.toFixed(4).replace('.', ',')} appliqué à la date du rapport : l'écart reflète la variation des titres, non celle du change.`
    : 'Les montants en dollars américains sont additionnés tels quels, sans conversion.';

  return (
    <>
      {/* ════════════════ PAGE 1 · LE RÉCIT ════════════════ */}
      <Page size="A4" orientation="portrait" style={[styles.page, { backgroundColor: '#fbfdff' }]}>
        <SectionHeader
          title="LE PARCOURS DE VOTRE ARGENT"
          subtitle={`${d.periodLabel} — du dépôt à la valeur d'aujourd'hui, selon l'historique de vos transactions`}
          accent="#FF9600"
        />

        {/* ─ Bandeau à 4 chiffres : Déposé → Cotisé → Encaisse → Valeur ─ */}
        <View
          wrap={false}
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: 8,
            padding: 12,
            borderRadius: 10,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#dbeafe',
            borderStyle: 'solid',
          }}
        >
          {/* 1 · Déposé (argent frais) */}
          <View style={{ flex: 1, paddingTop: 8 }}>
            <View style={{ height: 20 }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Ce que vous avez déposé
              </Text>
            </View>
            {d.deposits > 0 ? (
              <>
                <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: '#2563eb' }}>{fmt(d.deposits)}</Text>
                <Text style={{ marginTop: 2, fontSize: 6.5, color: '#94a3b8' }}>
                  {d.reconciliation.depositCount} dépôt{plur(d.reconciliation.depositCount)} — {d.periodLabel.toLowerCase()}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: '#94a3b8' }}>Aucun dépôt</Text>
                <Text style={{ marginTop: 2, fontSize: 6.5, color: '#94a3b8' }}>pour la période</Text>
              </>
            )}
          </View>

          {/* 2 · Cotisé aux comptes (argent + titres) */}
          <View style={{ flex: 1.15, paddingTop: 8 }}>
            <View style={{ height: 20 }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Cotisé à vos comptes
              </Text>
            </View>
            {d.contributions > 0 ? (
              <>
                <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: '#2563eb' }}>{fmt(d.contributions)}</Text>
                {d.contributionsSecurities > 0 ? (
                  <Text style={{ marginTop: 2, fontSize: 6.5, color: '#94a3b8' }}>
                    {fmt(d.contributionsCash)} en argent · {fmt(d.contributionsSecurities)} en titres
                  </Text>
                ) : (
                  <Text style={{ marginTop: 2, fontSize: 6.5, color: '#94a3b8' }}>en argent — détail ci-dessous</Text>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: '#94a3b8' }}>—</Text>
            )}
          </View>

          {/* 3 · Encaisse actuelle (conditionnelle) */}
          {d.cashOnHand != null && d.cashOnHand > 0 && (
            <View style={{ flex: 0.95, paddingTop: 8 }}>
              <View style={{ height: 20 }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Encaisse au compte
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: '#475569' }}>{fmt(d.cashOnHand)}</Text>
              <Text style={{ marginTop: 2, fontSize: 6.5, color: '#94a3b8' }}>disponible aujourd&apos;hui</Text>
            </View>
          )}

          <Chevron label="valent aujourd'hui" />

          {/* 4 · Valeur des parts détenues — carte-vedette à dégradé */}
          <View style={{ flex: 1.3, borderRadius: 8, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: focalGrad.border, borderStyle: 'solid', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 }}>
            <GradientBg id="focalGrad" from={focalGrad.from} mid={focalGrad.mid} />
            <View style={{ height: 20 }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Valeur des parts encore détenues
              </Text>
            </View>
            {hasHeld ? (
              <>
                <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{fmt(d.valueEvaluated)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <PctPill value={d.deltaPct} big />
                  <Text style={{ flexShrink: 1, fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: gc(d.deltaAbs) }}>
                    {fmt(Math.abs(d.deltaAbs))} de {d.deltaAbs >= 0 ? 'plus' : 'moins'} que leur coût
                  </Text>
                </View>
                <Text style={{ marginTop: 2, fontSize: 6.5, color: '#94a3b8', lineHeight: 1.4 }}>
                  coût d&apos;achat : {fmt(d.costEvaluated)}
                  {nonHeldCount > 0 ? ` · ${d.heldCount}/${totalTitres} titre${plur(totalTitres)}` : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: '#94a3b8' }}>—</Text>
                <Text style={{ marginTop: 2, fontSize: 6.5, color: '#94a3b8' }}>
                  {allSold ? 'toutes les parts revendues — voir p. 2' : 'aucun titre suivi au complet — voir p. 2'}
                </Text>
              </>
            )}
          </View>
        </View>
        {/* ─ Tableau clair des cotisations : nature · montant · compte ─ */}
        {d.contributions > 0 && cotisRows.length > 0 && (
          <View
            wrap={false}
            style={{ marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: '#dbeafe', borderStyle: 'solid', backgroundColor: '#ffffff', overflow: 'hidden' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', paddingVertical: 5, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#dbeafe', borderBottomStyle: 'solid' }}>
              <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>Vos cotisations de l&apos;année</Text>
              <Text style={{ width: 70, textAlign: 'right', fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Montant</Text>
              <Text style={{ width: 82, textAlign: 'right', fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Compte</Text>
            </View>
            {cotisRows.map((r, i) => (
              <View key={`${r.label}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid' }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: r.label === 'En argent' ? '#2563eb' : '#0891b2' }} />
                  <Text style={{ fontSize: 8, color: C.text }}>
                    {r.label}
                    {r.detail ? <Text style={{ color: '#94a3b8' }}> · {r.detail}</Text> : null}
                  </Text>
                </View>
                <Text style={{ width: 70, textAlign: 'right', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(r.amountCad)}</Text>
                <Text style={{ width: 82, textAlign: 'right', fontSize: 7.5, color: '#475569' }}>{compte(r.account)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, backgroundColor: '#f8fbff', borderTopWidth: 1.5, borderTopColor: '#2563eb', borderTopStyle: 'solid' }}>
              <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total cotisé</Text>
              <Text style={{ width: 70, textAlign: 'right', fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: '#2563eb' }}>{fmt(d.contributions)}</Text>
              <Text style={{ width: 82 }} />
            </View>
          </View>
        )}
        {/* Note d'honnêteté condensée + garde-fou : dédup des transferts en nature. */}
        <Text style={{ marginTop: 4, fontSize: 6.5, color: '#94a3b8', lineHeight: 1.4 }}>
          {d.contributionsSecurities > 0
            ? 'Les apports en titres sont aussi comptés dans les achats ci-dessous. Une partie des dépôts peut demeurer en encaisse.'
            : 'Une partie des dépôts peut demeurer en encaisse ; les achats ci-dessous puisent aussi dans les ventes et l’argent déjà au compte.'}
          {d.mirrorsDropped > 0
            ? ` ${d.mirrorsDropped} transfert${d.mirrorsDropped > 1 ? 's' : ''} en nature compté${d.mirrorsDropped > 1 ? 's' : ''} une seule fois (jambe comptable miroir écartée).`
            : ''}
        </Text>

        {/* ─ La timeline, généreuse ─ */}
        {timelineMode !== 'absent' && (
          <View
            wrap={false}
            style={{
              marginTop: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#dbeafe',
              borderStyle: 'solid',
              backgroundColor: '#ffffff',
              padding: 10,
            }}
          >
            <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
              Votre année, dans l&apos;ordre
            </Text>

            <View style={{ marginTop: 6 }}>
              <TimelineAxe d={d} numeros={timelineMode === 'chapitres'} />
            </View>

            {timelineMode === 'strip' ? null : timelineMode === 'cadence' ? (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.5 }}>
                  {d.depositCadenceRegular === true
                    ? `${nChap} dépôts totalisant ${fmt(d.contributions)} — un chaque mois de ${fmtMois(chapters![0].date)} à ${fmtMois(chapters![nChap - 1].date)}.`
                    : `${nChap} dépôts totalisant ${fmt(d.contributions)}, entre le ${fmtDateCourt(chapters![0].date)} et le ${fmtDateCourt(chapters![nChap - 1].date)}.`}
                </Text>
                {d.medianDaysDepositToNextBuy != null && (
                  <Text style={{ marginTop: 2, fontSize: 9.5, color: '#475569', lineHeight: 1.5 }}>
                    Chaque dépôt a été suivi d&apos;un achat dans un délai médian de {fmtJours(d.medianDaysDepositToNextBuy)} jours
                    {d.depositsWithoutFollowingBuy > 0
                      ? ` (${d.depositsWithoutFollowingBuy} dépôt${plur(d.depositsWithoutFollowingBuy)} de fin de période sans achat suivant)`
                      : ''}.
                  </Text>
                )}
              </View>
            ) : (
              <View style={{ marginTop: 4 }}>
                {d.preDepositBuys != null && d.preDepositBuys.buyCount > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid' }}>
                    <View style={{ width: 12, alignItems: 'flex-start' }}>
                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#64748b' }} />
                    </View>
                    <Text style={{ flexGrow: 1, fontSize: 7.5, color: '#64748b', maxLines: 1, textOverflow: 'ellipsis' }}>
                      Avant votre premier dépôt — {d.preDepositBuys.buyCount} achat{plur(d.preDepositBuys.buyCount)} ({fmt(d.preDepositBuys.totalCad)}) : la période a commencé déjà investie
                    </Text>
                    <Text style={{ fontSize: 7, color: '#94a3b8' }}>{d.preDepositBuys.topSymbols.join(', ')}</Text>
                  </View>
                )}
                {chapters!.map((c, i) => (
                  <ChapitreRow
                    key={c.date}
                    c={c}
                    index={i}
                    dernier={i === nChap - 1}
                    sousLigneDelai={nChap <= 4}
                  />
                ))}
              </View>
            )}

            <Text style={{ marginTop: 6, fontSize: 6.5, color: '#64748b', lineHeight: 1.4 }}>
              « Suivi de » décrit l&apos;ordre des dates (même jour inclus), jamais l&apos;affectation d&apos;un dépôt à un achat précis.
            </Text>
          </View>
        )}

        {/* ─ En résumé ─ */}
        {(showFloor || hasHeld) && (
          <View
            wrap={false}
            style={{
              marginTop: 10,
              borderRadius: 10,
              padding: 12,
              backgroundColor: '#ffffff',
              borderWidth: 1,
              borderColor: '#dbeafe',
              borderStyle: 'solid',
              borderLeftWidth: 3,
              borderLeftColor: '#FF9600',
            }}
          >
            <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
              En résumé
            </Text>
            <Text style={{ marginTop: 5, fontSize: 9.5, lineHeight: 1.6, color: '#475569' }}>
              {hasHeld && (
                <>
                  Les parts achetées encore détenues aujourd&apos;hui valent{' '}
                  <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(d.valueEvaluated)}</Text>, soit{' '}
                  <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: gc(d.deltaAbs) }}>{fmt(Math.abs(d.deltaAbs))}</Text> de{' '}
                  {d.deltaAbs >= 0 ? 'plus' : 'moins'} que leur coût d&apos;achat de {fmt(d.costEvaluated)}.{' '}
                </>
              )}
              {showFloor && floor != null && <FloorText g={floor} />}
            </Text>
          </View>
        )}

        {/* ─ Renvoi vers la preuve ─ */}
        <Text style={{ marginTop: 'auto', paddingTop: 8, fontSize: 6.5, color: '#94a3b8', lineHeight: 1.45 }}>
          Ces montants sont des constats historiques : ils ne préjugent pas des résultats futurs et ne constituent ni une prévision,
          ni une recommandation, ni un conseil en placement. Le détail titre par titre, la méthode de calcul et les mises en garde
          complètes figurent à la page suivante.
        </Text>
        <PageFooterV12 />
      </Page>

      {/* ════════════════ PAGE 2 · LA PREUVE ════════════════ */}
      <Page size="A4" orientation="portrait" style={[styles.page, { backgroundColor: '#fbfdff' }]}>
        <SectionHeader
          title="LE DÉTAIL, TITRE PAR TITRE"
          subtitle={`${d.periodLabel} — chaque achat, son coût et sa valeur d'aujourd'hui`}
          accent="#FF9600"
        />

        {/* ─ Ruban : concentration RÉELLE du portefeuille (poids par titre) ─ */}
        {d.concentration.length > 0 && (
        <View
          wrap={false}
          style={{
            borderRadius: 10,
            padding: 10,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#dbeafe',
            borderStyle: 'solid',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
              Concentration du portefeuille
            </Text>
            <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Poids réel aujourd&apos;hui · {fmt(d.portfolioTotalValue)}
            </Text>
          </View>

          <View style={{ height: 16, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', marginTop: 8 }}>
            {ribbon.map((c, i) => (
              <View key={`${c.symbol || 'cash'}-${i}`} style={{ width: `${c.weightPct}%`, backgroundColor: c.isCash ? '#94a3b8' : lineColor(i) }} />
            ))}
            {ribbonRestWeight > 0 && (
              <View style={{ width: `${ribbonRestWeight}%`, backgroundColor: RESIDUAL_COLOR }} />
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 7 }}>
            {ribbon.map((c, i) => (
              <View key={`${c.symbol || 'cash'}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c.isCash ? '#94a3b8' : lineColor(i) }} />
                <Text style={{ fontSize: 7, color: '#64748b', maxLines: 1, textOverflow: 'ellipsis' }}>
                  {c.isCash ? 'Encaisse' : (c.weightPct > 80 ? `${c.symbol} — ${c.name}` : c.symbol)} {c.weightPct.toFixed(0)} % · {fmt(c.marketValue)}
                </Text>
              </View>
            ))}
            {ribbonRestWeight > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: RESIDUAL_COLOR }} />
                <Text style={{ fontSize: 7, color: '#64748b' }}>Autres {ribbonRestWeight.toFixed(0)} % · {fmt(ribbonRestValue)}</Text>
              </View>
            )}
          </View>
        </View>
        )}

        {/* ─ Tableau « chaque achat, aujourd'hui » ─ */}
        <View style={[styles.tablePremium, { marginTop: 10, marginBottom: 0 }]}>
          <View style={[styles.thPremium, { borderBottomColor: '#FF9600' }]} wrap={false}>
            <Text style={[styles.thCellPremium, { width: COL.titre }]}>Titre</Text>
            <Text style={[styles.thCellPremium, { width: COL.prix, textAlign: 'right' }]}>Prix moyen payé</Text>
            <Text style={[styles.thCellPremium, { width: COL.investi, textAlign: 'right' }]}>Coût des achats</Text>
            <Text style={[styles.thCellPremium, { width: COL.vaut, textAlign: 'right' }]}>Valeur aujourd&apos;hui</Text>
            <Text style={[styles.thCellPremium, { width: COL.ecart, textAlign: 'right' }]}>Écart</Text>
          </View>

          {shown.map((l: DeploymentLine, i: number) => {
            const isBoundary = (i + 1) % 5 === 0 && i < shown.length - 1;
            // Obligation : « quantité » = valeur nominale ($), prix coté par tranche
            // de 100 $ → on multiplie le prix unitaire par 100 pour l'affichage.
            const px = l.isBond ? 100 : 1;
            const prixAffiche = l.avgUnitCost > 0 ? fmtFull(l.avgUnitCost * px) : '—';
            const sousLignePrix = [
              l.boughtQty > 0
                ? (l.isBond ? `${l.boughtQty.toLocaleString('fr-CA')} $ nom.` : `${l.boughtQty.toLocaleString('fr-CA')} parts`)
                : '',
              l.currentUnitValue != null && l.status !== 'closed' ? `auj. ${fmtFull(l.currentUnitValue * px)}` : '',
            ].filter(Boolean).join(' · ');
            return (
              <View
                key={`${l.symbol}-${i}`}
                wrap={false}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 5,
                  paddingHorizontal: 8,
                  backgroundColor: '#ffffff',
                  borderBottomWidth: isBoundary ? 1.2 : 0.5,
                  borderBottomColor: isBoundary ? '#bae6fd' : '#f1f5f9',
                  borderBottomStyle: 'solid',
                }}
              >
                <View style={{ width: COL.titre, paddingHorizontal: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: lineColor(i) }} />
                    <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{l.symbol}</Text>
                    {l.status === 'closed' && <Text style={styles.badgeNeutral}>Revendu</Text>}
                  </View>
                  <Text style={{ marginTop: 1, fontSize: 6.5, color: '#64748b', maxLines: 1, textOverflow: 'ellipsis' }}>{l.name}</Text>
                  {(l.status === 'partial' || l.status === 'unmatched' || l.status === 'unpriceable') && (
                    <Text style={{ marginTop: 1, fontSize: 6.5, color: '#94a3b8' }}>
                      {l.status === 'partial'
                        ? 'revendu en partie'
                        : l.status === 'unmatched'
                        ? 'non retrouvé au portefeuille'
                        : 'prix actuel indisponible'}
                    </Text>
                  )}
                </View>
                <View style={{ width: COL.prix, paddingHorizontal: 4 }}>
                  <Text style={{ textAlign: 'right', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>
                    {prixAffiche}
                  </Text>
                  {sousLignePrix !== '' && (
                    <Text style={{ textAlign: 'right', fontSize: 6.5, color: '#94a3b8' }}>{sousLignePrix}</Text>
                  )}
                </View>
                <Text style={{ width: COL.investi, textAlign: 'right', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, paddingHorizontal: 4 }}>
                  {fmt(l.totalCostCad)}
                </Text>
                <View style={{ width: COL.vaut, paddingHorizontal: 4 }}>
                  <Text style={{ textAlign: 'right', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: l.currentValue != null ? C.navy : '#94a3b8' }}>
                    {l.currentValue != null ? fmt(l.currentValue) : '—'}
                  </Text>
                  {/* Titre acheté ET revendu (partiellement/complètement) : d'où vient la valeur. */}
                  {l.currentValue != null && l.soldProceeds > 0 && (
                    <Text style={{ textAlign: 'right', fontSize: 6, color: '#94a3b8' }}>
                      {l.heldMarketValue != null && l.heldMarketValue > 0
                        ? `détenu ${fmt(l.heldMarketValue)} + encaissé ${fmt(l.soldProceeds)}`
                        : 'encaissé (revendu)'}
                    </Text>
                  )}
                </View>
                <View style={{ width: COL.ecart, paddingHorizontal: 4, alignItems: 'flex-end' }}>
                  {l.deltaPct != null && l.deltaAbs != null ? (
                    <>
                      <PctPill value={l.deltaPct} />
                      <Text style={{ marginTop: 1, fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: gc(l.deltaAbs) }}>
                        {fmt(l.deltaAbs)}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 8, color: '#94a3b8' }}>—</Text>
                  )}
                </View>
              </View>
            );
          })}

          {rest.length > 0 && (
            <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#fafbfc' }}>
              <View style={{ width: COL.titre, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: RESIDUAL_COLOR }} />
                <Text style={{ fontSize: 7.5, color: '#64748b' }}>
                  Autres achats ({rest.length} titre{plur(rest.length)} · {restWeight.toFixed(0)} %)
                </Text>
              </View>
              <Text style={{ width: COL.prix }} />
              <Text style={{ width: COL.investi, textAlign: 'right', fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', paddingHorizontal: 4 }}>
                {fmt(restCost)}
              </Text>
              <Text style={{ width: COL.vaut, textAlign: 'right', fontSize: 8, color: '#64748b', paddingHorizontal: 4 }}>
                {restValued.length > 0 ? fmt(restValue) : '—'}
              </Text>
              <Text style={{ width: COL.ecart, textAlign: 'right', fontSize: 7, color: restValued.length > 0 ? gc(restDelta) : '#94a3b8', paddingHorizontal: 4 }}>
                {restValued.length > 0 ? fmt(restDelta) : '—'}
              </Text>
            </View>
          )}

          {/* TOTAL — la valeur posée en face de SON coût */}
          <View
            wrap={false}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 7,
              paddingHorizontal: 8,
              backgroundColor: C.navy,
              borderTopWidth: 2.5,
              borderTopColor: '#FF9600',
              borderTopStyle: 'solid',
            }}
          >
            <View style={{ width: COL.titre, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Total des achats
              </Text>
              <Text style={{ marginTop: 1, fontSize: 6.5, color: '#94a3b8' }}>
                {hasHeld
                  ? `valeur et écart sur les ${fmt(d.costEvaluated)} détenus au complet (${d.coveragePct.toFixed(0)} %)`
                  : 'aucune part suivie au complet'}
              </Text>
            </View>
            <Text style={{ width: COL.prix }} />
            <View style={{ width: COL.investi, paddingHorizontal: 4 }}>
              <Text style={{ textAlign: 'right', fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
                {fmt(d.totalBuys)}
              </Text>
              <Text style={{ textAlign: 'right', fontSize: 6.5, color: '#94a3b8' }}>investi au total</Text>
            </View>
            <View style={{ width: COL.vaut, paddingHorizontal: 4 }}>
              <Text style={{ textAlign: 'right', fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: '#fdba74' }}>
                {hasHeld ? fmt(d.valueEvaluated) : '—'}
              </Text>
              {hasHeld && (
                <Text style={{ textAlign: 'right', fontSize: 6.5, color: '#94a3b8' }}>des {fmt(d.costEvaluated)} détenus</Text>
              )}
            </View>
            <View style={{ width: COL.ecart, paddingHorizontal: 4, alignItems: 'flex-end' }}>
              {hasHeld ? (
                <>
                  <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: d.deltaAbs >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                    {fmtPctFr(d.deltaPct)}
                  </Text>
                  <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 800, color: d.deltaAbs >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                    {fmt(d.deltaAbs)}
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 9, color: '#94a3b8' }}>—</Text>
              )}
            </View>
          </View>
        </View>

        {/* Comment lire la valeur et le tiret, là où le client le voit */}
        <Text style={{ marginTop: 6, fontSize: 7.5, color: '#475569', lineHeight: 1.4 }}>
          {[
            hasHeld
              ? `Écart de ${fmt(d.deltaAbs)} sur les ${d.heldCount} titre${plur(d.heldCount)} détenus au complet (${d.coveragePct.toFixed(0)} % de l'investi).`
              : allSold
                ? 'Toutes les parts achetées ont été revendues durant la période.'
                : null,
            tradedCount > 0
              ? "Un titre revendu en partie affiche la valeur des parts détenues + l'argent encaissé (écart = latent + réalisé) ; il n'entre pas dans le total, pour ne pas compter deux fois l'argent réinvesti."
              : null,
            noValueCount > 0
              ? 'Un tiret (—) : titre non retrouvé au portefeuille ou sans prix actuel.'
              : null,
            'Revenus encaissés : voir la page Activité (non inclus ici).',
          ].filter(Boolean).join(' ')}
        </Text>

        {/* Note méthodologique complète — l'arithmétique boucle */}
        <View style={{ marginTop: 'auto', paddingTop: 8 }}>
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>
            Comment ces chiffres ont été comptés
          </Text>
          <Text style={{ marginTop: 2, fontSize: 6.5, color: '#64748b', lineHeight: 1.45 }}>
            Sur {r.windowTransactionCount > 1 ? 'les' : 'la'} {r.windowTransactionCount} transaction{plur(r.windowTransactionCount)} de la période du {fmtDate(d.startDate)} au {fmtDate(d.endDate)}, {r.buyCount} achat{plur(r.buyCount)} totalisant {fmt(d.totalBuys)} {r.buyCount > 1 ? 'sont présentés' : 'est présenté'} sur ces pages{r.sellCount > 0 ? ` et ${r.sellCount} vente${plur(r.sellCount)} ${r.sellCount > 1 ? 'sont prises' : 'est prise'} en compte dans les statuts du tableau` : ''} ; {r.incomeCount} versement{plur(r.incomeCount)} de revenus, {r.contributionCount} cotisation{plur(r.contributionCount)} (dépôts) et {r.withdrawalCount} retrait{plur(r.withdrawalCount)} figurent aux pages précédentes, et {r.otherCount} autre{plur(r.otherCount)} opération{plur(r.otherCount)} (frais, transferts internes) {r.otherCount > 1 ? 'sont exclues' : 'est exclue'}. Une partie des dépôts peut demeurer en encaisse au compte.
          </Text>
          <Text style={{ marginTop: 2, fontSize: 6.5, color: '#64748b', lineHeight: 1.45 }}>
            Le coût des achats correspond au montant net inscrit dans l&apos;historique Croesus ; lorsqu&apos;un titre a été acheté plusieurs fois, le prix moyen payé est pondéré par les quantités. La valeur d&apos;aujourd&apos;hui correspond à la quantité achetée multipliée par le dernier prix connu et n&apos;est affichée que lorsque la position détenue contient encore toutes les parts achetées ; elle n&apos;inclut ni les dividendes ni les intérêts encaissés. Pour les titres revendus, le montant « à la revente » est le gains/pertes inscrit par Croesus sur les ventes de la période ; il peut porter sur des parts acquises avant la période. {usdPhrase}{r.baseSymbolFallbackCount > 0 ? ' Lorsque le symbole de l’historique ne correspond pas exactement à celui du portefeuille, le rapprochement se fait sur la racine du symbole.' : ''}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 6.5, color: '#64748b', lineHeight: 1.45 }}>
            Ces écarts sont des constats historiques : ils ne préjugent pas des résultats futurs et ne constituent ni une prévision, ni une recommandation, ni un conseil en placement. Ce document ne remplace pas les relevés officiels ni le rapport annuel sur le rendement de votre courtier.
          </Text>
        </View>
        <PageFooterV12 />
      </Page>
    </>
  );
}

/**
 * « Proposition de portefeuille » — PDF client de présentation (4 pages), rendu
 * SERVEUR, dans le langage visuel de « Prêt à coller » (cours cibles) :
 *   1. Couverture : bandeau dégradé + pastilles + héros « Montant à investir →
 *      Valeur projetée 12 mois » avec l'éventail Prudent / Consensus / Optimiste.
 *   2. Répartition : donut par titre + barres + diversification.
 *   3. Détail titre par titre (tableau premium).
 *   4. Projection 12 mois + méthodologie & avertissements.
 *
 * Toutes les valeurs arrivent déjà en CAD depuis /proposition (le nom du client
 * n'est jamais stocké). Éventail = cibles basse/consensus/haute des analystes.
 */
import React from 'react';
import path from 'path';
import fs from 'fs';
import {
  Document, Page, Text, View, Image, Font, renderToBuffer,
  Svg, Defs, LinearGradient, Stop, Rect, Line, Circle, Polyline,
} from '@react-pdf/renderer';
import { styles as S, C } from './styles';
import { SectorDonut, type SectorSlice } from './sectors';

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');
function dataUri(filename: string): string | null {
  try { return `data:image/png;base64,${fs.readFileSync(path.join(process.cwd(), 'public', filename)).toString('base64')}`; }
  catch { return null; }
}
const LOGO_SRC = dataUri('logo.png');

Font.register({ family: 'Montserrat', fonts: [
  { src: path.join(FONTS_DIR, 'Montserrat-Bold.ttf'), fontWeight: 700 },
  { src: path.join(FONTS_DIR, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 },
] });
Font.register({ family: 'Open Sans', fonts: [
  { src: path.join(FONTS_DIR, 'OpenSans-Regular.ttf'), fontWeight: 400 },
  { src: path.join(FONTS_DIR, 'OpenSans-SemiBold.ttf'), fontWeight: 600 },
] });
Font.registerHyphenationCallback(word => [word]);

// ── Données ──
export interface PropositionRow {
  symbol: string;
  name: string;
  currency: 'CAD' | 'USD';
  weight: number;            // %
  price: number;             // CAD
  target: number;            // CAD (cible 12 m consensus)
  targetLow?: number;        // CAD (cible basse analystes)
  targetHigh?: number;       // CAD (cible haute analystes)
  alloc: number;             // CAD
  gainPct: number | null;
  source?: string;
  // ── Enrichissements (route serveur via /profile, /quote) ──
  pe?: number;               // ratio cours/bénéfice
  sector?: string;           // secteur (FMP, ex. « Technology »)
  country?: string;          // pays (« US », « CA », …)
  description?: string;      // description de l'entreprise (« pourquoi ce titre »)
  beta?: number;             // sensibilité au marché
  marketCap?: number;        // capitalisation (devise native, approx.)
  range52?: [number, number]; // fourchette 52 semaines, en CAD
  divYield?: number;         // rendement du dividende (fraction, ex. 0,032)
  logoDataUri?: string | null;
}
export interface PropositionInput {
  client: string;
  context: 'new' | 'elsewhere';
  amount: number;
  rows: PropositionRow[];
  generatedAt: string;
  advisor?: string;
}

// ── Formatage fr-CA ──
const fmt = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
const fmt2 = (n: number) => `${n.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const fmtPct = (n: number | null) => n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const fmtW = (n: number) => n.toLocaleString('fr-CA', { maximumFractionDigits: 1 });
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function frDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const SLICE = [C.duoBlue, C.duoGreen, C.duoPurple, C.duoOrange, C.cyan, C.gold, C.duoYellow, '#f472b6', '#34d399', '#60a5fa', '#fbbf24', '#a78bfa'];
const RESIDUAL = '#cbd5e1';

// Éventail de scénarios : gain en capital si toutes les cibles basses / consensus /
// hautes des analystes étaient atteintes (revenu non modélisé dans cette version).
function scenariosFromRows(rows: PropositionRow[]): { low: number; mid: number; high: number } {
  let low = 0, mid = 0, high = 0;
  for (const r of rows) {
    if (!(r.price > 0) || !(r.target > 0)) continue;
    const lo = r.targetLow && r.targetLow > 0 ? r.targetLow : r.target;
    const hi = r.targetHigh && r.targetHigh > 0 ? r.targetHigh : r.target;
    const g = (t: number) => (r.alloc * (t - r.price)) / r.price;
    low += g(Math.min(lo, r.target, hi));
    mid += g(r.target);
    high += g(Math.max(lo, r.target, hi));
  }
  return { low, mid, high };
}

function ScenarioGauge({ low, mid, high, width = 202, height = 12 }: { low: number; mid: number; high: number; width?: number; height?: number }) {
  const lo = Math.min(low, mid, high), hi = Math.max(low, mid, high);
  const pad = (hi - lo) * 0.12 || Math.max(Math.abs(hi) * 0.05, 1);
  const dMin = lo - pad, dMax = hi + pad, span = (dMax - dMin) || 1;
  const px = (v: number) => Math.max(2, Math.min(width - 2, ((v - dMin) / span) * width));
  const cy = height / 2;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={2} y1={cy} x2={width - 2} y2={cy} stroke="#d7ede1" strokeWidth={3} strokeLinecap="round" />
      <Rect x={px(lo)} y={cy - 3} width={Math.max(px(hi) - px(lo), 1)} height={6} rx={3} fill="#bbf7d0" />
      <Circle cx={px(lo)} cy={cy} r={2} fill="#94a3b8" />
      <Circle cx={px(hi)} cy={cy} r={2} fill="#94a3b8" />
      <Line x1={px(mid)} y1={cy - 5} x2={px(mid)} y2={cy + 5} stroke="#059669" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={px(mid)} cy={cy} r={3} fill="#059669" />
      <Circle cx={px(mid)} cy={cy} r={1.2} fill="#ffffff" />
    </Svg>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color }} />
      <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#334155' }}>{label}</Text>
    </View>
  );
}

function Footer({ advisor }: { advisor: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>Groupe Financier Ste-Foy · {advisor}</Text>
      <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// ── Secteurs / géographie ──
const SECTOR_FR: Record<string, string> = {
  'Technology': 'Technologies', 'Financial Services': 'Services financiers', 'Healthcare': 'Santé',
  'Consumer Cyclical': 'Consommation discrétionnaire', 'Consumer Defensive': 'Consommation de base',
  'Energy': 'Énergie', 'Industrials': 'Industrie', 'Basic Materials': 'Matériaux',
  'Communication Services': 'Communications', 'Utilities': 'Services publics', 'Real Estate': 'Immobilier',
};
const SECTOR_COLOR: Record<string, string> = {
  'Technologies': '#3b82f6', 'Services financiers': '#10b981', 'Santé': '#ef4444',
  'Consommation discrétionnaire': '#f59e0b', 'Consommation de base': '#8b5cf6', 'Énergie': '#14b8a6',
  'Industrie': '#6366f1', 'Matériaux': '#a3a3a3', 'Communications': '#ec4899', 'Services publics': '#0891b2',
  'Immobilier': '#84cc16', 'Autres': '#94a3b8',
};
const sectorFr = (s?: string) => (s && SECTOR_FR[s]) ? SECTOR_FR[s] : (s || 'Autres');
const geoBucket = (country?: string) => {
  const c = (country || '').toUpperCase();
  if (c === 'CA' || c === 'CANADA') return 'Canada';
  if (c === 'US' || c === 'USA' || c === 'UNITED STATES') return 'États-Unis';
  return country ? 'International' : 'Autres';
};
const GEO_COLOR: Record<string, string> = { 'Canada': C.duoBlue, 'États-Unis': C.duoPurple, 'International': C.gold, 'Autres': '#94a3b8' };

function aggregate(rows: PropositionRow[], keyFn: (r: PropositionRow) => string, colorMap: Record<string, string>, fallback: string[]): SectorSlice[] {
  const invested = rows.reduce((s, r) => s + r.alloc, 0) || 1;
  const map = new Map<string, number>();
  for (const r of rows) { const k = keyFn(r); map.set(k, (map.get(k) || 0) + r.alloc); }
  let ci = 0;
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
    code: label, label, value, pct: (value / invested) * 100,
    color: colorMap[label] || fallback[ci++ % fallback.length],
  }));
}

const fmtBig = (n: number) => n >= 1e9 ? `${(n / 1e9).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} G$` : n >= 1e6 ? `${(n / 1e6).toLocaleString('fr-CA', { maximumFractionDigits: 0 })} M$` : `${n.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $`;

// Barre de secteurs/géo (label · barre · %)
function AllocRow({ label, pct, color, muted }: { label: string; pct: number; color: string; muted?: boolean }) {
  return (
    <View style={S.sectorRow} wrap={false}>
      <Text style={[S.sectorLabel, { width: '32%', color: muted ? C.textTer : C.text }]}>{label}</Text>
      <View style={S.sectorBarOuter}><View style={[S.sectorBarInner, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} /></View>
      <Text style={[S.sectorPct, { width: '12%' }]}>{fmtW(pct)} %</Text>
    </View>
  );
}

// Fourchette 52 semaines : barre + marqueur du prix actuel
function RangeBar({ low, high, price, width = 130 }: { low: number; high: number; price: number; width?: number }) {
  const span = high - low;
  const pos = span > 0 ? Math.max(0, Math.min(1, (price - low) / span)) : 0.5;
  return (
    <View style={{ width }}>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: '#e8eef4', position: 'relative' }}>
        <View style={{ position: 'absolute', left: `${pos * 100}%`, top: -1.5, width: 3, height: 8, borderRadius: 1.5, backgroundColor: C.navy, marginLeft: -1.5 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 5.5, color: C.textTer }}>{fmt2(low)}</Text>
        <Text style={{ fontSize: 5.5, color: C.textTer }}>{fmt2(high)}</Text>
      </View>
    </View>
  );
}

function Initials({ symbol, color }: { symbol: string; color: string }) {
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color }}>{symbol.replace(/[.\-].*$/, '').slice(0, 3)}</Text>
    </View>
  );
}

// FICHE de titre — mini-note de recherche.
function HoldingCard({ r, color }: { r: PropositionRow; color: string }) {
  const qty = r.price > 0 ? r.alloc / r.price : 0;
  const gainCol = r.gainPct == null ? C.textTer : r.gainPct >= 0 ? C.up : C.down;
  const metrics = [
    r.divYield != null && r.divYield > 0 ? `Rendement ${(r.divYield * 100).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %` : null,
    r.pe && r.pe > 0 ? `C/B ${r.pe.toLocaleString('fr-CA', { maximumFractionDigits: 1 })}` : null,
    r.marketCap && r.marketCap > 0 ? `Cap. ${fmtBig(r.marketCap)}` : null,
    r.beta && r.beta > 0 ? `Bêta ${r.beta.toLocaleString('fr-CA', { maximumFractionDigits: 2 })}` : null,
  ].filter(Boolean) as string[];
  return (
    <View wrap={false} style={{ borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid', borderLeftWidth: 3, borderLeftColor: color, borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: '#fff' }}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        {r.logoDataUri
          // eslint-disable-next-line jsx-a11y/alt-text
          ? <Image src={r.logoDataUri} style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'contain' }} />
          : <Initials symbol={r.symbol} color={color} />}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{r.symbol}</Text>
            {r.sector ? <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 }}><Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#475569' }}>{sectorFr(r.sector)}</Text></View> : null}
            {r.country ? <Text style={{ fontSize: 6, color: C.textTer }}>{geoBucket(r.country)}</Text> : null}
          </View>
          <Text style={{ fontSize: 7, color: C.textSec, maxLines: 1, textOverflow: 'ellipsis' }}>{r.name}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{fmtW(r.weight)} %</Text>
          <Text style={{ fontSize: 7, color: C.textSec }}>{fmt(r.alloc)} · {qty.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} act.</Text>
        </View>
      </View>
      {/* Métriques + fourchette */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 7, color: C.textSec, marginBottom: 4 }}>{metrics.join('   ·   ') || 'Données de marché limitées'}</Text>
          {/* Éventail de cibles par titre */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontSize: 6.5, color: C.textTer }}>Cible 12 m :</Text>
            {r.targetLow && r.targetLow > 0 ? <Text style={{ fontSize: 6.5, color: C.textTer }}>{fmt2(r.targetLow)}</Text> : null}
            <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{r.target > 0 ? fmt2(r.target) : '—'}</Text>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: gainCol }}>{fmtPct(r.gainPct)}</Text>
            {r.targetHigh && r.targetHigh > 0 ? <Text style={{ fontSize: 6.5, color: C.textTer }}>{fmt2(r.targetHigh)}</Text> : null}
          </View>
        </View>
        {r.range52 && r.range52[1] > r.range52[0] ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 5.5, color: C.textTer, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>52 semaines</Text>
            <RangeBar low={r.range52[0]} high={r.range52[1]} price={r.price} width={124} />
          </View>
        ) : null}
      </View>
      {/* Description */}
      {r.description ? (
        <Text style={{ fontSize: 6.5, color: C.textSec, lineHeight: 1.4, marginTop: 6, maxLines: 2, textOverflow: 'ellipsis' }}>{r.description}</Text>
      ) : null}
    </View>
  );
}

export function PropositionReport({ data }: { data: PropositionInput }) {
  const advisor = data.advisor || 'Nicolas Perron';
  const rows = [...data.rows].sort((a, b) => b.weight - a.weight);
  const amount = data.amount;

  const invested = rows.reduce((s, r) => s + r.alloc, 0);
  const cash = Math.max(0, amount - invested);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const cashPct = Math.max(0, 100 - totalWeight);
  const uncovered = rows.filter(r => r.gainPct == null && r.weight > 0).length;
  const contextLabel = data.context === 'new' ? 'Nouvel investisseur' : 'Transfert d’une autre institution';
  const amountLabel = data.context === 'new' ? 'Montant à investir' : 'Valeur à transférer';

  const scen = scenariosFromRows(rows);
  const projMid = amount + scen.mid;
  const diffPct = amount > 0 ? (scen.mid / amount) * 100 : 0;
  const pctOf = (g: number) => amount > 0 ? (g / amount) * 100 : 0;
  const hasRange = Math.abs(scen.high - scen.low) > Math.max(1, amount * 0.002);
  const up = scen.mid >= 0;
  const gain = scen.mid;

  // Donut de répartition par titre (+ liquidités).
  const donutSlices: SectorSlice[] = rows.map((r, i) => ({ code: r.symbol, label: r.symbol, color: SLICE[i % SLICE.length], value: r.alloc, pct: r.weight }));
  if (cashPct >= 0.25) donutSlices.push({ code: 'CASH', label: 'Liquidités', color: RESIDUAL, value: cash, pct: cashPct });
  const usCount = rows.filter(r => r.currency === 'USD').length;

  // Enrichissements (présents seulement si la route a pu chercher les profils).
  const hasEnrichment = rows.some(r => r.sector || r.description || r.divYield != null);
  const sectorSlices = aggregate(rows, r => sectorFr(r.sector), SECTOR_COLOR, SLICE);
  const geoSlices = aggregate(rows, r => geoBucket(r.country), GEO_COLOR, SLICE);
  const hasSectors = rows.some(r => r.sector);
  const byWeight = [...rows].sort((a, b) => b.weight - a.weight);
  const topPos = byWeight[0]?.weight ?? 0;
  const top5 = byWeight.slice(0, 5).reduce((s, r) => s + r.weight, 0);
  const nbSectors = new Set(rows.map(r => sectorFr(r.sector)).filter(x => x !== 'Autres')).size;
  // Revenu de dividendes projeté
  const incomeRows = rows.map(r => ({ r, income: r.alloc * (r.divYield || 0) })).filter(x => x.income > 0).sort((a, b) => b.income - a.income);
  const annualDiv = incomeRows.reduce((s, x) => s + x.income, 0);
  const portYield = amount > 0 ? (annualDiv / amount) * 100 : 0;
  const hasIncome = annualDiv > 0;

  return (
    <Document title={`Proposition de portefeuille — ${data.client}`} author={advisor}>
      {/* ══ PAGE 1 — COUVERTURE ══ */}
      <Page size="A4" style={[S.page, { backgroundColor: '#f8fafc' }]}>
        {/* Bandeau dégradé bleu brume + filet cyan */}
        <View style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 600 210" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="pHeader" x1="0" y1="0" x2="600" y2="210" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#dbeafe" /><Stop offset="0.3" stopColor="#e8f2fc" />
                <Stop offset="0.65" stopColor="#f4f8fd" /><Stop offset="1" stopColor="#ffffff" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={600} height={210} fill="url(#pHeader)" />
          </Svg>
          <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3 }} viewBox="0 0 600 3" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="pAccent" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#00b4d8" /><Stop offset="0.5" stopColor="#38bdf8" /><Stop offset="1" stopColor="#93c5fd" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={600} height={3} fill="url(#pAccent)" />
          </Svg>
          <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#8faabe', position: 'absolute', top: 16, right: 24 }}>{frDate(data.generatedAt)}</Text>
            {LOGO_SRC
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image n'a pas de prop alt
              ? <Image src={LOGO_SRC} style={{ width: 76, height: 30, marginBottom: 8 }} />
              : <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, fontSize: 13, marginBottom: 8 }}>Groupe Financier Ste-Foy</Text>}
            <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 3 }}>Proposition de portefeuille</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: '#334155', marginBottom: 6 }}>{data.client}</Text>
            <View style={{ height: 1, backgroundColor: '#c7ddf0', marginBottom: 12, opacity: 0.6 }} />
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Pill color={C.cyan} label={`${rows.length} titre${rows.length > 1 ? 's' : ''}`} />
              {usCount > 0 && <Pill color={C.duoBlue} label={`${usCount} titre${usCount > 1 ? 's' : ''} US`} />}
              <Pill color={C.navy} label={`${amountLabel} : ${fmt(amount)}`} />
              <Pill color={C.duoGreen} label={contextLabel} />
            </View>
          </View>
        </View>

        {/* Héros : Montant à investir → Valeur projetée 12 mois */}
        <View style={{ flexDirection: 'row', marginBottom: 14, borderRadius: 10, overflow: 'hidden' }}>
          {/* Aujourd'hui */}
          <View style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: 16 }}>
            <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 300 110" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="pToday" x1="0" y1="0" x2="300" y2="110" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#e0eefb" /><Stop offset="0.5" stopColor="#eef5fc" /><Stop offset="1" stopColor="#f8fbff" />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={300} height={110} fill="url(#pToday)" />
            </Svg>
            <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{amountLabel}</Text>
            <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 8 }}>{fmt(amount)}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={{ fontSize: 6.5, color: '#64748b' }}>Investi : <Text style={{ fontFamily: 'Open Sans', fontWeight: 600 }}>{fmt(invested)}</Text></Text>
              {cash > 1 && <Text style={{ fontSize: 6.5, color: '#64748b' }}>Liquidités : <Text style={{ fontFamily: 'Open Sans', fontWeight: 600 }}>{fmt(cash)}</Text></Text>}
              <Text style={{ fontSize: 6.5, color: '#64748b' }}>{rows.length} titres</Text>
            </View>
          </View>
          {/* Flèche */}
          <View style={{ width: 40, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={16} height={12} viewBox="0 0 16 12">
              <Line x1={1} y1={6} x2={13} y2={6} stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" />
              <Polyline points="9,2 14,6 9,10" stroke="#ffffff" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={{ fontSize: 6, color: '#94a3b8', marginTop: 3 }}>12 mois</Text>
          </View>
          {/* Projeté — éventail */}
          <View style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: 14 }}>
            <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 300 110" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="pProj" x1="0" y1="0" x2="300" y2="110" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={up ? '#d5f5e3' : '#fde8e8'} /><Stop offset="0.5" stopColor={up ? '#e8faf0' : '#fef2f2'} /><Stop offset="1" stopColor={up ? '#f5fdf8' : '#fffafa'} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={300} height={110} fill="url(#pProj)" />
            </Svg>
            <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Valeur projetée 12 mois — consensus des analystes</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginBottom: hasRange ? 8 : 6 }}>
              <Text style={{ fontSize: 21, fontFamily: 'Montserrat', fontWeight: 800, color: up ? '#059669' : '#dc2626' }}>{fmt(projMid)}</Text>
              <View style={{ backgroundColor: up ? '#d1fae5' : '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 700, color: up ? '#047857' : '#b91c1c' }}>{fmtPct(diffPct)}</Text>
              </View>
            </View>
            {hasRange ? (
              <>
                <ScenarioGauge low={scen.low} mid={scen.mid} high={scen.high} width={202} />
                <View style={{ flexDirection: 'row', marginTop: 5, alignItems: 'flex-start' }}>
                  {([
                    { label: 'Prudent', g: scen.low, align: 'flex-start' as const, hero: false },
                    { label: 'Consensus', g: scen.mid, align: 'center' as const, hero: true },
                    { label: 'Optimiste', g: scen.high, align: 'flex-end' as const, hero: false },
                  ]).map(col => (
                    <View key={col.label} style={{ flex: 1, alignItems: col.align }}>
                      <Text style={{ fontSize: 5, fontFamily: 'Open Sans', fontWeight: 600, color: col.hero ? '#059669' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{col.label}</Text>
                      <Text style={{ fontSize: col.hero ? 11 : 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: col.hero ? '#047857' : '#94a3b8' }}>{fmt(amount + col.g)}</Text>
                      <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: col.hero ? (col.g >= 0 ? '#059669' : '#dc2626') : '#94a3b8' }}>{fmtPct(pctOf(col.g))}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 5.5, color: '#94a3b8', marginTop: 5 }}>Bornes = si toutes les cibles basses / hautes des analystes étaient atteintes. Des repères, pas des prévisions.</Text>
              </>
            ) : (
              <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: up ? '#059669' : '#dc2626' }}>{up ? '+' : ''}{fmt(gain)} de gain projeté sur 12 mois</Text>
            )}
          </View>
        </View>

        {/* Répartition compacte : donut par titre + légende */}
        <View style={[S.card, { flexDirection: 'row', gap: 16, alignItems: 'center', padding: 14 }]}>
          <SectorDonut slices={donutSlices} size={96} />
          <View style={{ flex: 1 }}>
            <Text style={[S.label, { marginBottom: 8 }]}>Répartition proposée</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {donutSlices.map((sl) => (
                <View key={sl.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, width: '30%' }}>
                  <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: sl.color }} />
                  <Text style={{ fontSize: 7.5, color: C.textSec }}>{sl.label} {fmtW(sl.pct)} %</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ marginTop: 'auto', paddingTop: 7, borderTopWidth: 0.5, borderTopColor: '#eef2f7', borderTopStyle: 'solid' }}>
          <Text style={{ fontSize: 6, color: '#94a3b8', lineHeight: 1.45 }}>
            Valeur projetée = consensus des cours cibles des analystes sur 12 mois, converti en dollars canadiens. Des repères indicatifs, pas une
            garantie de rendement. Document préparé à titre informatif et confidentiel — ne constitue pas un conseil en placement personnalisé.
          </Text>
        </View>
        <Footer advisor={advisor} />
      </Page>

      {/* ══ PAGE 2 — RÉPARTITION & DIVERSIFICATION ══ */}
      <Page size="A4" style={S.page}>
        <Text style={S.sectionTitle}>La répartition &amp; la diversification</Text>
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center', marginBottom: 14 }}>
          <SectorDonut slices={hasSectors ? sectorSlices : donutSlices} size={124} />
          <View style={{ flex: 1 }}>
            <View style={S.statsRow}>
              <View style={[S.statCard, { alignItems: 'flex-start' }]}>
                <Text style={S.kpiLabel}>Titres</Text>
                <Text style={[S.kpiValue, { fontSize: 19 }]}>{rows.length}</Text>
              </View>
              <View style={[S.statCard, { alignItems: 'flex-start' }]}>
                <Text style={S.kpiLabel}>Secteurs</Text>
                <Text style={[S.kpiValue, { fontSize: 19 }]}>{nbSectors || '—'}</Text>
              </View>
              <View style={[S.statCard, { alignItems: 'flex-start' }]}>
                <Text style={S.kpiLabel}>Plus grosse position</Text>
                <Text style={[S.kpiValue, { fontSize: 19 }]}>{fmtW(topPos)} %</Text>
              </View>
            </View>
            <Text style={{ fontSize: 7.5, color: C.textSec, marginTop: 2 }}>
              Les 5 plus grosses positions représentent <Text style={S.bold}>{fmtW(top5)} %</Text> du portefeuille · {fmt(invested)} investis, {fmt(cash)} en liquidités.
            </Text>
          </View>
        </View>

        {hasSectors ? (
          <>
            <Text style={S.subsectionTitle}>Par secteur</Text>
            {sectorSlices.map(sl => <AllocRow key={sl.code} label={sl.label} pct={sl.pct} color={sl.color} />)}
          </>
        ) : (
          <>
            <Text style={S.subsectionTitle}>Par titre</Text>
            {rows.map((r, i) => <AllocRow key={r.symbol} label={r.symbol} pct={r.weight} color={SLICE[i % SLICE.length]} />)}
          </>
        )}

        {rows.some(r => r.country) && (
          <>
            <Text style={S.subsectionTitle}>Par région</Text>
            {geoSlices.map(sl => <AllocRow key={sl.code} label={sl.label} pct={sl.pct} color={sl.color} />)}
          </>
        )}

        <Footer advisor={advisor} />
      </Page>

      {/* ══ PAGE — REVENU & DIVIDENDES ══ */}
      {hasIncome && (
        <Page size="A4" style={S.page}>
          <Text style={S.sectionTitle}>Le revenu de dividendes projeté</Text>
          <View style={S.statsRow}>
            <View style={[S.statCard, { alignItems: 'flex-start' }]}>
              <Text style={S.kpiLabel}>Revenu annuel projeté</Text>
              <Text style={[S.kpiValue, { fontSize: 20, color: C.duoGreenDark }]}>{fmt(annualDiv)}</Text>
            </View>
            <View style={[S.statCard, { alignItems: 'flex-start' }]}>
              <Text style={S.kpiLabel}>Rendement du portefeuille</Text>
              <Text style={[S.kpiValue, { fontSize: 20 }]}>{fmtW(portYield)} %</Text>
            </View>
            <View style={[S.statCard, { alignItems: 'flex-start' }]}>
              <Text style={S.kpiLabel}>≈ par mois</Text>
              <Text style={[S.kpiValue, { fontSize: 20 }]}>{fmt(annualDiv / 12)}</Text>
            </View>
          </View>
          <Text style={S.subsectionTitle}>Principaux payeurs de dividendes</Text>
          <View style={S.tablePremium}>
            <View style={S.thPremium}>
              <Text style={[S.thCellPremium, { width: '40%' }]}>Titre</Text>
              <Text style={[S.thCellPremium, { width: '20%', textAlign: 'right' }]}>Rendement</Text>
              <Text style={[S.thCellPremium, { width: '20%', textAlign: 'right' }]}>Montant investi</Text>
              <Text style={[S.thCellPremium, { width: '20%', textAlign: 'right' }]}>Revenu / an</Text>
            </View>
            {incomeRows.slice(0, 12).map(({ r, income }, i) => (
              <View key={r.symbol} style={i % 2 ? S.trAlt : S.tr} wrap={false}>
                <Text style={[S.td, { width: '40%', fontFamily: 'Open Sans', fontWeight: 600 }]}>{r.symbol}<Text style={{ fontSize: 6.5, color: C.textTer, fontWeight: 400 }}>  {r.name}</Text></Text>
                <Text style={[S.td, { width: '20%', textAlign: 'right' }]}>{r.divYield ? `${(r.divYield * 100).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %` : '—'}</Text>
                <Text style={[S.td, { width: '20%', textAlign: 'right' }]}>{fmt(r.alloc)}</Text>
                <Text style={[S.td, { width: '20%', textAlign: 'right', fontFamily: 'Open Sans', fontWeight: 600, color: C.duoGreenDark }]}>{fmt(income)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, backgroundColor: C.navy }} wrap={false}>
              <Text style={{ width: '60%', paddingHorizontal: 4, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#fff' }}>Revenu de dividendes total (projeté)</Text>
              <Text style={{ width: '20%', textAlign: 'right', paddingHorizontal: 4, fontSize: 7.5, color: '#93c5fd' }}>{fmtW(portYield)} %</Text>
              <Text style={{ width: '20%', textAlign: 'right', paddingHorizontal: 4, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#fff' }}>{fmt(annualDiv)}</Text>
            </View>
          </View>
          <Text style={S.noteText}>Revenu estimé à partir du dernier dividende annuel connu de chaque titre × le nombre d&apos;actions proposé. Les dividendes ne sont pas garantis et peuvent varier.</Text>
          <Footer advisor={advisor} />
        </Page>
      )}

      {/* ══ PAGE(S) — FICHES DE TITRES ══ */}
      {hasEnrichment && (
        <Page size="A4" style={S.page}>
          <Text style={S.sectionTitle}>Vos titres en détail</Text>
          {rows.map((r, i) => <HoldingCard key={r.symbol} r={r} color={SLICE[i % SLICE.length]} />)}
          <Footer advisor={advisor} />
        </Page>
      )}

      {/* ══ PAGE 3 — DÉTAIL TITRE PAR TITRE ══ */}
      <Page size="A4" style={S.page}>
        <Text style={S.sectionTitle}>Le détail, titre par titre</Text>
        <View style={S.tablePremium}>
          <View style={S.thPremium}>
            <Text style={[S.thCellPremium, { width: '34%' }]}>Titre</Text>
            <Text style={[S.thCellPremium, { width: '11%', textAlign: 'right' }]}>Poids</Text>
            <Text style={[S.thCellPremium, { width: '18%', textAlign: 'right' }]}>Montant</Text>
            <Text style={[S.thCellPremium, { width: '13%', textAlign: 'right' }]}>Prix</Text>
            <Text style={[S.thCellPremium, { width: '13%', textAlign: 'right' }]}>Cible 12 m</Text>
            <Text style={[S.thCellPremium, { width: '11%', textAlign: 'right' }]}>Gain</Text>
          </View>
          {rows.map((r, i) => (
            <View key={r.symbol} style={i % 2 ? S.trAlt : S.tr} wrap={false}>
              <View style={{ width: '34%', paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: SLICE[i % SLICE.length] }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>{r.symbol}{r.currency === 'USD' ? '  US$→CA$' : ''}</Text>
                  <Text style={{ fontSize: 6.5, color: C.textTer, maxLines: 1, textOverflow: 'ellipsis' }}>{r.name}</Text>
                </View>
              </View>
              <Text style={[S.td, { width: '11%', textAlign: 'right', fontFamily: 'Open Sans', fontWeight: 600 }]}>{fmtW(r.weight)} %</Text>
              <Text style={[S.td, { width: '18%', textAlign: 'right' }]}>{fmt(r.alloc)}</Text>
              <Text style={[S.td, { width: '13%', textAlign: 'right' }]}>{r.price > 0 ? fmt2(r.price) : '—'}</Text>
              <Text style={[S.td, { width: '13%', textAlign: 'right', fontFamily: 'Open Sans', fontWeight: 600 }]}>{r.target > 0 ? fmt2(r.target) : '—'}</Text>
              <Text style={[S.td, { width: '11%', textAlign: 'right', fontFamily: 'Open Sans', fontWeight: 600, color: r.gainPct == null ? C.textTer : r.gainPct >= 0 ? C.up : C.down }]}>{fmtPct(r.gainPct)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, backgroundColor: C.navy }} wrap={false}>
            <Text style={{ width: '34%', paddingHorizontal: 4, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#fff' }}>Total investi</Text>
            <Text style={{ width: '11%', textAlign: 'right', paddingHorizontal: 4, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#fff' }}>{fmtW(totalWeight)} %</Text>
            <Text style={{ width: '18%', textAlign: 'right', paddingHorizontal: 4, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#fff' }}>{fmt(invested)}</Text>
            <Text style={{ width: '37%', textAlign: 'right', paddingHorizontal: 4, fontSize: 7.5, color: '#93c5fd' }}>gain projeté consensus {fmtPct(diffPct)}</Text>
          </View>
        </View>
        {(cash > 1 || uncovered > 0) && (
          <Text style={S.noteText}>
            {cash > 1 ? `${fmt(cash)} en liquidités (${fmtW(cashPct)} %). ` : ''}
            {uncovered > 0 ? `${uncovered} titre${uncovered > 1 ? 's' : ''} sans cours cible : compté${uncovered > 1 ? 's' : ''} à 0 % de gain (prudence).` : ''}
          </Text>
        )}
        <Footer advisor={advisor} />
      </Page>

      {/* ══ PAGE 4 — PROJECTION & MÉTHODOLOGIE ══ */}
      <Page size="A4" style={S.page}>
        <Text style={S.sectionTitle}>La projection sur 12 mois</Text>
        <View style={[S.card, { padding: 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={S.kpiLabel}>Aujourd’hui</Text>
              <Text style={[S.kpiValue, { fontSize: 22 }]}>{fmt(amount)}</Text>
            </View>
            <Text style={{ fontSize: 22, color: C.textTer, marginHorizontal: 10 }}>→</Text>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={S.kpiLabel}>Dans 12 mois · consensus</Text>
              <Text style={[S.kpiValue, { fontSize: 22, color: up ? C.up : C.down }]}>{fmt(projMid)}</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={S.kpiLabel}>Gain projeté</Text>
              <Text style={[S.kpiValue, { fontSize: 22, color: up ? C.up : C.down }]}>{up ? '+' : ''}{fmt(gain)}</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: up ? C.up : C.down, marginTop: 2 }}>{fmtPct(diffPct)}</Text>
            </View>
          </View>
          {hasRange && (
            <View style={{ marginTop: 16 }}>
              <ScenarioGauge low={scen.low} mid={scen.mid} high={scen.high} width={510} height={14} />
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                {([
                  { label: 'Prudent', g: scen.low },
                  { label: 'Consensus', g: scen.mid },
                  { label: 'Optimiste', g: scen.high },
                ]).map((col, i) => (
                  <View key={col.label} style={{ flex: 1, alignItems: i === 0 ? 'flex-start' : i === 2 ? 'flex-end' : 'center' }}>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: i === 1 ? '#059669' : C.textTer, textTransform: 'uppercase', letterSpacing: 0.5 }}>{col.label}</Text>
                    <Text style={{ fontSize: i === 1 ? 13 : 10, fontFamily: 'Montserrat', fontWeight: 800, color: i === 1 ? '#047857' : C.textSec }}>{fmt(amount + col.g)}</Text>
                    <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: i === 1 ? (col.g >= 0 ? '#059669' : '#dc2626') : C.textTer }}>{fmtPct(pctOf(col.g))}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <Text style={S.subsectionTitle}>Comment cette projection est calculée</Text>
        <Text style={{ fontSize: 8.5, color: C.textSec, lineHeight: 1.55 }}>
          Pour chaque titre, on retient le <Text style={S.bold}>cours cible « consensus » des analystes sur 12 mois</Text> (moyenne des objectifs publiés),
          converti en dollars canadiens pour les titres américains. Le gain projeté d’un titre = (cours cible − prix actuel) / prix actuel. La valeur projetée
          du portefeuille additionne chaque montant investi porté à sa cible, plus les liquidités inchangées. Les bornes <Text style={S.bold}>Prudent</Text> et
          <Text style={S.bold}> Optimiste</Text> correspondent aux cibles basses et hautes des analystes. Les titres sans cours cible et les liquidités sont
          comptés à 0 % de croissance (approche prudente).
        </Text>

        <View style={[S.aiBlock, { marginTop: 16 }]}>
          <Text style={S.aiLabel}>À retenir</Text>
          <Text style={S.aiText}>
            Un cours cible est une <Text style={S.bold}>estimation d’analystes, pas une garantie</Text>. Les rendements réels varient et peuvent être négatifs.
            Cette proposition est un point de départ de discussion avec votre conseiller, pas un engagement de rendement ni une recommandation personnalisée définitive.
          </Text>
        </View>

        <Text style={[S.disclaimer, { marginTop: 16 }]}>
          Document préparé par {advisor}, Groupe Financier Ste-Foy, à titre indicatif et confidentiel pour {data.client}. Les prix et cours cibles proviennent de
          fournisseurs de données de marché et sont valides à la date d’émission ({frDate(data.generatedAt)}). Les objectifs des analystes portent sur un horizon
          d’environ 12 mois et ne constituent ni une garantie de rendement, ni un conseil fiscal ou juridique. Toute décision de placement devrait tenir compte de
          votre situation complète, de votre tolérance au risque et de votre horizon de placement.
        </Text>

        <Footer advisor={advisor} />
      </Page>
    </Document>
  );
}

export function renderPropositionReport(data: PropositionInput): Promise<Buffer> {
  return renderToBuffer(<PropositionReport data={data} />);
}

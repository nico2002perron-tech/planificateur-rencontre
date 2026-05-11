import React from 'react';
import path from 'path';
import {
  Document, Page, Text, View, Image, Font,
  Svg, Defs, LinearGradient, Stop, Rect,
} from '@react-pdf/renderer';
import { styles, C } from './styles';

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo.png');
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: path.join(FONTS_DIR, 'Montserrat-Bold.ttf'), fontWeight: 700 },
    { src: path.join(FONTS_DIR, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 },
  ],
});

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: path.join(FONTS_DIR, 'OpenSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONTS_DIR, 'OpenSans-SemiBold.ttf'), fontWeight: 600 },
  ],
});

// ── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalysisData = any;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} %`;
}

function fmtNum(v: number | null, d = 2): string {
  if (v === null || v === undefined) return '—';
  return v.toFixed(d);
}

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#1CB0F6', 'Information Technology': '#1CB0F6',
  'Financial Services': '#58CC02', 'Financials': '#58CC02',
  'Healthcare': '#CE82FF', 'Health Care': '#CE82FF',
  'Energy': '#FF9600',
  'Consumer Cyclical': '#FF6B6B', 'Consumer Discretionary': '#FF6B6B',
  'Industrials': '#00CD9C',
  'Communication Services': '#6C5CE7',
  'Consumer Defensive': '#FDCB6E', 'Consumer Staples': '#FDCB6E',
  'Utilities': '#A29BFE',
  'Real Estate': '#E17055',
  'Basic Materials': '#00CEC9', 'Materials': '#00CEC9',
};

const GEO_COLORS: Record<string, string> = {
  'Canada': '#FF4B4B', 'États-Unis': '#1CB0F6', 'Europe': '#CE82FF',
  'Asie-Pacifique': '#FF9600', 'Autre': '#94a3b8',
};

const STYLE_LABELS: Record<string, string> = {
  'large-value': 'GV', 'large-blend': 'GM', 'large-growth': 'GC',
  'mid-value': 'MV', 'mid-blend': 'MM', 'mid-growth': 'MC',
  'small-value': 'PV', 'small-blend': 'PM', 'small-growth': 'PC',
};

// ── Footer ───────────────────────────────────────────────────────────────────

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Portefeuille Modèle</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// ── Cover Page ───────────────────────────────────────────────────────────────

function CoverPage({ data }: { data: AnalysisData }) {
  const now = new Date(data.sources?.generatedAt ?? Date.now());
  const dateStr = now.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Page size="LETTER" style={{ ...styles.page, padding: 0 }}>
      {/* Navy gradient background */}
      <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 612 792" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="coverBg" x1="0" y1="0" x2="612" y2="792" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#03045e" />
            <Stop offset="0.5" stopColor="#023e8a" />
            <Stop offset="1" stopColor="#0077b6" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={612} height={792} fill="url(#coverBg)" />
      </Svg>

      {/* Accent line */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 5, backgroundColor: C.cyan }} />

      {/* Logo */}
      <View style={{ position: 'absolute', top: 40, left: 50 }}>
        <Image src={LOGO_PATH} style={{ width: 40, height: 40 }} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 60 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
          PORTEFEUILLE MODÈLE
        </Text>
        <Text style={{ fontSize: 32, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff', lineHeight: 1.2, marginBottom: 20 }}>
          {data.name}
        </Text>
        <View style={{ width: 60, height: 3, backgroundColor: C.cyan, borderRadius: 2, marginBottom: 24 }} />
        <Text style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Open Sans', marginBottom: 6 }}>
          {data.holdingsCount} positions · Benchmark: {data.benchmark}
        </Text>
        <Text style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Open Sans' }}>
          {dateStr}
        </Text>
      </View>

      {/* Bottom bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 50, backgroundColor: 'rgba(0,180,216,0.1)', paddingHorizontal: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 8, color: '#64748b' }}>Groupe Financier Ste-Foy</Text>
        <Text style={{ fontSize: 8, color: '#64748b' }}>Sources: EODHD · Yahoo Finance</Text>
      </View>
    </Page>
  );
}

// ── Sommaire Page ────────────────────────────────────────────────────────────

function SummaryPage({ data }: { data: AnalysisData }) {
  const rs = data.riskStats ?? {};
  const wf = data.weightedFundamentals ?? {};

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <Text style={styles.sectionTitle}>Sommaire exécutif</Text>

      {/* KPI cards row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'RENDEMENT 1 AN', value: fmtPct(rs.return1Y), color: rs.return1Y >= 0 ? C.up : C.down },
          { label: 'RENDEMENT 3 ANS', value: fmtPct(rs.return3Y), color: rs.return3Y >= 0 ? C.up : C.down },
          { label: 'SHARPE 3 ANS', value: fmtNum(rs.sharpe3Y), color: C.cyan },
          { label: 'MAX DRAWDOWN', value: fmtPct(rs.maxDrawdown), color: C.down },
        ].map((kpi, i) => (
          <View key={i} style={{ flex: 1, ...styles.card, alignItems: 'center', paddingVertical: 14 }}>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
            <Text style={{ ...styles.kpiValue, color: kpi.color, fontSize: 20 }}>{kpi.value}</Text>
          </View>
        ))}
      </View>

      {/* Fundamentals + Returns side by side */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
        {/* Fundamentals */}
        <View style={{ flex: 1, ...styles.card }}>
          <Text style={styles.subsectionTitle}>Fondamentaux pondérés</Text>
          {[
            { label: 'P/E ratio', value: fmtNum(wf.weightedPE, 1) },
            { label: 'P/B ratio', value: fmtNum(wf.weightedPB, 2) },
            { label: 'ROE', value: wf.weightedROE ? `${(wf.weightedROE * 100).toFixed(1)}%` : '—' },
            { label: 'Dividende', value: data.totalDivYield ? `${(data.totalDivYield * 100).toFixed(2)}%` : '—' },
            { label: 'Marge bénéf.', value: wf.weightedProfitMargin ? `${(wf.weightedProfitMargin * 100).toFixed(1)}%` : '—' },
            { label: 'Cap. bours. moy.', value: wf.avgMarketCapB ? `${wf.avgMarketCapB.toFixed(1)} G$` : '—' },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
              <Text style={{ fontSize: 8.5, color: C.textSec }}>{item.label}</Text>
              <Text style={{ fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Returns */}
        <View style={{ flex: 1, ...styles.card }}>
          <Text style={styles.subsectionTitle}>Rendements</Text>
          {[
            { label: 'YTD', value: rs.returnYTD },
            { label: '1 an', value: rs.return1Y },
            { label: '3 ans (ann.)', value: rs.return3Y },
            { label: '5 ans (ann.)', value: rs.return5Y },
            { label: '10 ans (ann.)', value: rs.return10Y },
            { label: 'Depuis inception', value: rs.returnSinceInception },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
              <Text style={{ fontSize: 8.5, color: C.textSec }}>{item.label}</Text>
              <Text style={{ fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: item.value !== null && item.value >= 0 ? C.up : C.down }}>{fmtPct(item.value)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Style Matrix */}
      <View style={styles.card}>
        <Text style={styles.subsectionTitle}>Style Matrix</Text>
        <View style={{ flexDirection: 'row', gap: 3, justifyContent: 'center' }}>
          {['large', 'mid', 'small'].map((size) => (
            <View key={size} style={{ flexDirection: 'row', gap: 3 }}>
              {['value', 'blend', 'growth'].map((value) => {
                const box = `${size}-${value}`;
                const weight = (data.styleMatrix?.[box] ?? 0) * 100;
                const intensity = Math.min(weight / 40, 1);
                return (
                  <View key={box} style={{
                    width: 52, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: weight > 0 ? `rgba(0, 180, 216, ${0.08 + intensity * 0.4})` : '#f8fafc',
                    borderWidth: 0.5, borderColor: weight > 0 ? 'rgba(0,180,216,0.3)' : '#e5e7eb',
                  }}>
                    <Text style={{ fontSize: 6, color: C.textTer }}>{STYLE_LABELS[box]}</Text>
                    {weight > 0 && <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan }}>{weight.toFixed(0)}%</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

// ── Allocation Page ──────────────────────────────────────────────────────────

function AllocationPage({ data }: { data: AnalysisData }) {
  const sectors = data.sectors ?? [];
  const geography = data.geography ?? [];
  const maxSectorWeight = Math.max(...sectors.map((s: { weight: number }) => s.weight), 1);

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <Text style={styles.sectionTitle}>Allocation du portefeuille</Text>

      {/* Sector allocation */}
      <View style={{ ...styles.card, marginBottom: 16 }}>
        <Text style={styles.subsectionTitle}>Répartition sectorielle</Text>
        {sectors.map((s: { sector: string; weight: number }, i: number) => {
          const color = SECTOR_COLORS[s.sector] ?? '#94a3b8';
          return (
            <View key={i} style={styles.sectorRow}>
              <Text style={styles.sectorLabel}>{s.sector}</Text>
              <View style={styles.sectorBarOuter}>
                <View style={{ ...styles.sectorBarInner, width: `${(s.weight / maxSectorWeight) * 100}%`, backgroundColor: color }} />
              </View>
              <Text style={styles.sectorPct}>{s.weight.toFixed(1)}%</Text>
            </View>
          );
        })}
      </View>

      {/* Geography */}
      <View style={styles.card}>
        <Text style={styles.subsectionTitle}>Répartition géographique</Text>
        {/* Allocation bar */}
        <View style={styles.allocBar}>
          {geography.map((g: { region: string; weight: number }, i: number) => (
            <View key={i} style={{ width: `${g.weight}%`, backgroundColor: GEO_COLORS[g.region] ?? '#94a3b8' }} />
          ))}
        </View>
        {/* Legend */}
        <View style={styles.legendWrap}>
          {geography.map((g: { region: string; weight: number }, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: GEO_COLORS[g.region] ?? '#94a3b8' }} />
              <Text style={{ fontSize: 8, color: C.text }}>{g.region}: {g.weight.toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

// ── Risk Page ────────────────────────────────────────────────────────────────

function RiskPage({ data }: { data: AnalysisData }) {
  const rs = data.riskStats ?? {};

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <Text style={styles.sectionTitle}>Statistiques de risque</Text>

      {/* Volatility row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'ÉCART-TYPE 1 AN', value: rs.stdDev1Y ? `${(rs.stdDev1Y * 100).toFixed(1)}%` : '—' },
          { label: 'ÉCART-TYPE 3 ANS', value: rs.stdDev3Y ? `${(rs.stdDev3Y * 100).toFixed(1)}%` : '—' },
          { label: 'ÉCART-TYPE 5 ANS', value: rs.stdDev5Y ? `${(rs.stdDev5Y * 100).toFixed(1)}%` : '—' },
        ].map((item, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.kpiLabel}>{item.label}</Text>
            <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Sharpe row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'SHARPE 1 AN', value: fmtNum(rs.sharpe1Y) },
          { label: 'SHARPE 3 ANS', value: fmtNum(rs.sharpe3Y) },
          { label: 'SHARPE 5 ANS', value: fmtNum(rs.sharpe5Y) },
          { label: 'SORTINO 3 ANS', value: fmtNum(rs.sortino3Y) },
        ].map((item, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.kpiLabel}>{item.label}</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan }}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Relative stats table */}
      <View style={{ ...styles.card, marginBottom: 16 }}>
        <Text style={styles.subsectionTitle}>Statistiques relatives (3 ans) vs {data.benchmark}</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, width: '35%' }}>Mesure</Text>
            <Text style={{ ...styles.thCellPremium, width: '25%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.thCellPremium, width: '40%' }}>Interprétation</Text>
          </View>
          {[
            { label: 'Alpha', value: rs.alpha3Y !== null ? fmtPct(rs.alpha3Y) : '—', desc: 'Surperformance ajustée au risque' },
            { label: 'Beta', value: fmtNum(rs.beta3Y), desc: rs.beta3Y > 1 ? 'Plus volatile que le marché' : rs.beta3Y < 1 ? 'Moins volatile que le marché' : 'En ligne avec le marché' },
            { label: 'R²', value: rs.rSquared3Y !== null ? `${(rs.rSquared3Y * 100).toFixed(0)}%` : '—', desc: 'Corrélation avec le benchmark' },
            { label: 'Tracking Error', value: rs.trackingError3Y !== null ? `${(rs.trackingError3Y * 100).toFixed(1)}%` : '—', desc: 'Écart annualisé vs benchmark' },
            { label: 'Info. Ratio', value: fmtNum(rs.informationRatio3Y), desc: 'Rendement excédentaire par unité de risque' },
            { label: 'Capture hausse', value: rs.captureUpside3Y !== null ? `${rs.captureUpside3Y.toFixed(0)}%` : '—', desc: 'Participation aux hausses du marché' },
            { label: 'Capture baisse', value: rs.captureDownside3Y !== null ? `${rs.captureDownside3Y.toFixed(0)}%` : '—', desc: 'Participation aux baisses du marché' },
          ].map((item, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
              <Text style={{ ...styles.tdBold, width: '35%' }}>{item.label}</Text>
              <Text style={{ ...styles.tdBold, width: '25%', textAlign: 'right', color: C.navy }}>{item.value}</Text>
              <Text style={{ ...styles.td, width: '40%', color: C.textSec, fontSize: 7.5 }}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Drawdown + Best/Worst */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>MAX DRAWDOWN</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.down }}>{fmtPct(rs.maxDrawdown)}</Text>
          <Text style={{ fontSize: 7, color: C.textTer, marginTop: 4 }}>{rs.maxDrawdownDate}</Text>
        </View>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>MEILLEUR MOIS</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.up }}>{fmtPct(rs.bestMonth)}</Text>
          <Text style={{ fontSize: 7, color: C.textTer, marginTop: 4 }}>{rs.bestMonthDate}</Text>
        </View>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>PIRE MOIS</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.down }}>{fmtPct(rs.worstMonth)}</Text>
          <Text style={{ fontSize: 7, color: C.textTer, marginTop: 4 }}>{rs.worstMonthDate}</Text>
        </View>
      </View>
    </Page>
  );
}

// ── Performance Page ─────────────────────────────────────────────────────────

function PerformancePage({ data }: { data: AnalysisData }) {
  const annualReturns = data.annualReturns ?? [];
  const gs = data.growthSeries ?? [];
  const lastGrowth = gs[gs.length - 1];

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <Text style={styles.sectionTitle}>Rendements historiques</Text>

      {/* Growth of $10K */}
      {lastGrowth && (
        <View style={{ ...styles.card, marginBottom: 16 }}>
          <Text style={styles.subsectionTitle}>Croissance de 10 000 $</Text>
          <View style={{ flexDirection: 'row', gap: 20, marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase', letterSpacing: 1 }}>PORTEFEUILLE</Text>
              <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan }}>{fmt(lastGrowth.portfolio)}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase', letterSpacing: 1 }}>BENCHMARK</Text>
              <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.textSec }}>{fmt(lastGrowth.benchmark)}</Text>
            </View>
          </View>
          {/* Simple bar comparison */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 7, color: C.textSec, width: 60 }}>Portefeuille</Text>
              <View style={{ flex: 1, height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${(lastGrowth.portfolio / Math.max(lastGrowth.portfolio, lastGrowth.benchmark)) * 100}%`, backgroundColor: C.cyan, borderRadius: 6 }} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 7, color: C.textSec, width: 60 }}>Benchmark</Text>
              <View style={{ flex: 1, height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${(lastGrowth.benchmark / Math.max(lastGrowth.portfolio, lastGrowth.benchmark)) * 100}%`, backgroundColor: '#94a3b8', borderRadius: 6 }} />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Annual returns table */}
      {annualReturns.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.subsectionTitle}>Rendements annuels</Text>
          <View style={styles.tablePremium}>
            <View style={styles.thPremium}>
              <Text style={{ ...styles.thCellPremium, width: '20%' }}>Année</Text>
              <Text style={{ ...styles.thCellPremium, width: '25%', textAlign: 'right' }}>Portefeuille</Text>
              <Text style={{ ...styles.thCellPremium, width: '25%', textAlign: 'right' }}>Benchmark</Text>
              <Text style={{ ...styles.thCellPremium, width: '30%', textAlign: 'right' }}>Écart</Text>
            </View>
            {annualReturns.map((ar: { year: number; portfolio: number; benchmark: number }, i: number) => {
              const diff = ar.portfolio - ar.benchmark;
              return (
                <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                  <Text style={{ ...styles.tdBold, width: '20%' }}>{ar.year}</Text>
                  <Text style={{ ...styles.tdBold, width: '25%', textAlign: 'right', color: ar.portfolio >= 0 ? C.up : C.down }}>{fmtPct(ar.portfolio)}</Text>
                  <Text style={{ ...styles.tdBold, width: '25%', textAlign: 'right', color: ar.benchmark >= 0 ? C.up : C.down }}>{fmtPct(ar.benchmark)}</Text>
                  <Text style={{ ...styles.tdBold, width: '30%', textAlign: 'right', color: diff >= 0 ? C.up : C.down }}>{fmtPct(diff)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Page>
  );
}

// ── Holdings Page ────────────────────────────────────────────────────────────

function HoldingsPage({ data }: { data: AnalysisData }) {
  const holdings = [...(data.holdings ?? [])].sort((a: { weight: number }, b: { weight: number }) => b.weight - a.weight);

  // Split into pages of ~20 holdings each
  const pages: typeof holdings[] = [];
  for (let i = 0; i < holdings.length; i += 20) {
    pages.push(holdings.slice(i, i + 20));
  }

  return (
    <>
      {pages.map((pageHoldings, pageIdx) => (
        <Page key={pageIdx} size="LETTER" style={styles.page}>
          <PageFooter />
          {pageIdx === 0 && <Text style={styles.sectionTitle}>Liste des avoirs</Text>}

          <View style={styles.tablePremium}>
            <View style={styles.thPremium}>
              <Text style={{ ...styles.thCellPremium, width: '12%' }}>Symbole</Text>
              <Text style={{ ...styles.thCellPremium, width: '22%' }}>Nom</Text>
              <Text style={{ ...styles.thCellPremium, width: '8%', textAlign: 'right' }}>Poids</Text>
              <Text style={{ ...styles.thCellPremium, width: '10%', textAlign: 'right' }}>Prix</Text>
              <Text style={{ ...styles.thCellPremium, width: '10%', textAlign: 'right' }}>Cible</Text>
              <Text style={{ ...styles.thCellPremium, width: '10%', textAlign: 'right' }}>Potentiel</Text>
              <Text style={{ ...styles.thCellPremium, width: '8%', textAlign: 'right' }}>P/E</Text>
              <Text style={{ ...styles.thCellPremium, width: '8%', textAlign: 'right' }}>Div %</Text>
              <Text style={{ ...styles.thCellPremium, width: '12%' }}>Secteur</Text>
            </View>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {pageHoldings.map((h: any, i: number) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.tdBold, width: '12%', color: C.navy }}>{h.symbol}</Text>
                <Text style={{ ...styles.td, width: '22%', fontSize: 7.5 }}>{h.name}</Text>
                <Text style={{ ...styles.tdBold, width: '8%', textAlign: 'right' }}>{h.weight.toFixed(1)}%</Text>
                <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>{h.price > 0 ? `$${h.price.toFixed(2)}` : '—'}</Text>
                <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>{h.targetPrice ? `$${h.targetPrice.toFixed(2)}` : '—'}</Text>
                <Text style={{ ...styles.tdBold, width: '10%', textAlign: 'right', color: h.upside !== null ? (h.upside >= 0 ? C.up : C.down) : C.textTer }}>
                  {h.upside !== null ? `${h.upside >= 0 ? '+' : ''}${h.upside.toFixed(1)}%` : '—'}
                </Text>
                <Text style={{ ...styles.td, width: '8%', textAlign: 'right' }}>{h.pe ? h.pe.toFixed(1) : '—'}</Text>
                <Text style={{ ...styles.td, width: '8%', textAlign: 'right' }}>{h.dividendYield ? `${(h.dividendYield * 100).toFixed(1)}` : '—'}</Text>
                <Text style={{ ...styles.td, width: '12%', fontSize: 6.5 }}>{h.gicSector || '—'}</Text>
              </View>
            ))}
          </View>
        </Page>
      ))}
    </>
  );
}

// ── Disclaimer Page ──────────────────────────────────────────────────────────

function DisclaimerPage({ data }: { data: AnalysisData }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <Text style={styles.sectionTitle}>Notes et avertissements</Text>

      <View style={styles.card}>
        <Text style={styles.disclaimer}>
          Ce rapport a été généré automatiquement à partir de données de marché publiques. Les rendements
          passés ne garantissent pas les rendements futurs. Les statistiques de risque et de rendement sont
          calculées à partir de données historiques et peuvent ne pas refléter les conditions futures du marché.
        </Text>
        <Text style={{ ...styles.disclaimer, marginTop: 8 }}>
          Les cours cibles proviennent du consensus des analystes via Yahoo Finance et représentent une
          estimation sur 12 mois. Ils ne constituent pas une recommandation d&apos;achat ou de vente.
        </Text>
        <Text style={{ ...styles.disclaimer, marginTop: 8 }}>
          Les fondamentaux (P/E, P/B, ROE, secteurs, etc.) proviennent d&apos;EODHD (eodhd.com) et sont
          sujets à des mises à jour périodiques. Les données historiques de prix proviennent de Yahoo Finance.
        </Text>
      </View>

      <View style={{ ...styles.card, marginTop: 12 }}>
        <Text style={styles.subsectionTitle}>Sources de données</Text>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 8, color: C.textSec }}>• Fondamentaux : EODHD (eodhd.com) — Fundamentals Data Feed</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>• Prix historiques : Yahoo Finance — Données mensuelles ajustées</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>• Cours cibles : Yahoo Finance — Consensus des analystes</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>• Benchmark : {data.benchmark}</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>• Taux sans risque : 4,0 % (obligations du gouvernement du Canada)</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>• Date de génération : {new Date(data.sources?.generatedAt).toLocaleDateString('fr-CA')}</Text>
        </View>
      </View>

      <View style={{ marginTop: 20, alignItems: 'center' }}>
        <Image src={LOGO_PATH} style={{ width: 30, height: 30, marginBottom: 8 }} />
        <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Groupe Financier Ste-Foy</Text>
        <Text style={{ fontSize: 7, color: C.textTer, marginTop: 4 }}>Document confidentiel — Usage interne seulement</Text>
      </View>
    </Page>
  );
}

// ── Main Document ────────────────────────────────────────────────────────────

export function StrategyReport({ data }: { data: AnalysisData }) {
  return (
    <Document>
      <CoverPage data={data} />
      <SummaryPage data={data} />
      <AllocationPage data={data} />
      <PerformancePage data={data} />
      <RiskPage data={data} />
      <HoldingsPage data={data} />
      <DisclaimerPage data={data} />
    </Document>
  );
}

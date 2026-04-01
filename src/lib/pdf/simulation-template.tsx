import React from 'react';
import { Document, Page, View, Text, Font, Image } from '@react-pdf/renderer';
import { C, styles } from './styles';
import path from 'path';

// ── Fonts ──
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

// ── Types ──
export interface SimulationPDFHolding {
  symbol: string;
  name: string;
  weight: number;
  market_value: number;
  cost_basis: number;
  gain_pct: number;
  dividend_yield: number;
  sector: string;
  region: string;
}

export interface SimulationPDFData {
  modelName: string;
  profileName: string;
  currency: string;
  startDate: string;
  currentDate: string;
  initialValue: number;
  currentValue: number;
  totalReturnPct: number;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  dividendIncome: number;
  holdings: SimulationPDFHolding[];
  sectorAllocation: { sector: string; pct: number }[];
  regionAllocation: { region: string; pct: number }[];
  benchmarks: { name: string; returnPct: number }[];
  topPerformers: { symbol: string; gainPct: number }[];
  worstPerformers: { symbol: string; gainPct: number }[];
}

// ── Helpers ──
function fmt(v: number, cur = 'CAD') {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtFull(v: number, cur = 'CAD') {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fmtPct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)} %`; }

const SECTOR_FR: Record<string, string> = {
  TECHNOLOGY: 'Technologie', HEALTHCARE: 'Santé', FINANCIALS: 'Finance',
  ENERGY: 'Énergie', MATERIALS: 'Matériaux', INDUSTRIALS: 'Industriels',
  CONSUMER_DISC: 'Cons. discrétionnaire', CONSUMER_STAPLES: 'Cons. de base',
  UTILITIES: 'Services publics', REAL_ESTATE: 'Immobilier',
  TELECOM: 'Télécommunications', COMMUNICATION: 'Communication',
};
const REGION_FR: Record<string, string> = { CA: 'Canada', US: 'États-Unis', INTL: 'International', EM: 'Marchés émergents' };

// ── Sub-components ──
function AccentBar() {
  return <View style={{ height: 4, backgroundColor: C.cyan, marginBottom: 0 }} />;
}

function PageFooter({ num, total }: { num: number; total: number }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={{ color: C.textTer, fontSize: 7 }}>Groupe Financier Ste-Foy — Simulation de portefeuille</Text>
      <Text style={{ color: C.textTer, fontSize: 7 }}>{num} / {total}</Text>
    </View>
  );
}

function KPICard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <View style={{
      flex: 1, padding: 10, borderRadius: 6,
      backgroundColor: accent ? C.navy : C.card,
      border: accent ? 'none' : `1px solid ${C.cardBorder}`,
    }}>
      <Text style={{ fontSize: 7, color: accent ? C.cyanLight : C.textTer, fontWeight: 600, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: accent ? C.white : C.text }}>{value}</Text>
      {sub && <Text style={{ fontSize: 7, color: accent ? C.cyanPale : C.textSec, marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT
// ═══════════════════════════════════════════════════════════════

export function SimulationPDFDocument({ data }: { data: SimulationPDFData }) {
  const totalPages = 3;
  const isPositive = data.totalReturn >= 0;
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');

  return (
    <Document>
      {/* ── PAGE 1: Cover + Summary ── */}
      <Page size="LETTER" style={styles.page}>
        <AccentBar />

        {/* Header with logo */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color: C.navy }}>
              Rapport de simulation
            </Text>
            <Text style={{ fontSize: 10, color: C.textSec, marginTop: 4 }}>{data.modelName} — {data.profileName}</Text>
          </View>
          <Image src={logoPath} style={{ width: 100, height: 40, objectFit: 'contain' }} />
        </View>

        {/* Date range */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View style={{ backgroundColor: C.panel, padding: '4 10', borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: C.textSec }}>Début: {data.startDate}</Text>
          </View>
          <View style={{ backgroundColor: C.panel, padding: '4 10', borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: C.textSec }}>Fin: {data.currentDate}</Text>
          </View>
          <View style={{ backgroundColor: C.panel, padding: '4 10', borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: C.textSec }}>Devise: {data.currency}</Text>
          </View>
        </View>

        {/* KPI cards */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <KPICard label="VALEUR INITIALE" value={fmt(data.initialValue, data.currency)} accent />
          <KPICard label="VALEUR ACTUELLE" value={fmt(data.currentValue, data.currency)} sub={fmtPct(data.totalReturnPct)} accent />
          <KPICard label="GAIN / PERTE" value={fmt(data.totalReturn, data.currency)} sub={isPositive ? 'Profit' : 'Perte'} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          <KPICard label="RENDEMENT ANNUALISÉ" value={fmtPct(data.annualizedReturn)} />
          <KPICard label="VOLATILITÉ" value={`${data.volatility.toFixed(1)} %`} />
          <KPICard label="RATIO DE SHARPE" value={data.sharpe.toFixed(2)} />
          <KPICard label="PERTE MAXIMALE" value={`${data.maxDrawdown.toFixed(1)} %`} />
        </View>

        {/* Benchmarks comparison */}
        {data.benchmarks.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.subsectionTitle}>Comparaison aux indices</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: isPositive ? C.upBg : C.downBg, border: `1px solid ${isPositive ? C.upBorder : C.downBorder}` }}>
                <Text style={{ fontSize: 7, color: C.textSec, marginBottom: 2 }}>PORTEFEUILLE</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: isPositive ? C.up : C.down }}>{fmtPct(data.totalReturnPct)}</Text>
              </View>
              {data.benchmarks.map((b) => (
                <View key={b.name} style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
                  <Text style={{ fontSize: 7, color: C.textSec, marginBottom: 2 }}>{b.name}</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: b.returnPct >= 0 ? C.up : C.down }}>{fmtPct(b.returnPct)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Dividend income */}
        {data.dividendIncome > 0 && (
          <View style={{ padding: 10, borderRadius: 6, backgroundColor: C.goldPale, border: `1px solid ${C.gold}40`, marginBottom: 16 }}>
            <Text style={{ fontSize: 8, color: C.gold, fontWeight: 600 }}>Revenus de dividendes accumulés: {fmtFull(data.dividendIncome, data.currency)}</Text>
          </View>
        )}

        {/* Top / Worst */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 600, color: C.up, marginBottom: 4 }}>Meilleurs performeurs</Text>
            {data.topPerformers.map((t) => (
              <View key={t.symbol} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ fontSize: 8, fontWeight: 600, color: C.text }}>{t.symbol}</Text>
                <Text style={{ fontSize: 8, fontWeight: 600, color: C.up }}>{fmtPct(t.gainPct)}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 600, color: C.down, marginBottom: 4 }}>Moins bons performeurs</Text>
            {data.worstPerformers.map((t) => (
              <View key={t.symbol} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ fontSize: 8, fontWeight: 600, color: C.text }}>{t.symbol}</Text>
                <Text style={{ fontSize: 8, fontWeight: 600, color: C.down }}>{fmtPct(t.gainPct)}</Text>
              </View>
            ))}
          </View>
        </View>

        <PageFooter num={1} total={totalPages} />
      </Page>

      {/* ── PAGE 2: Holdings Table ── */}
      <Page size="LETTER" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Détail des positions</Text>
        <Text style={{ fontSize: 8, color: C.textSec, marginBottom: 12 }}>{data.holdings.length} positions au {data.currentDate}</Text>

        {/* Table header */}
        <View style={{ flexDirection: 'row', backgroundColor: C.thBg, borderRadius: 4, padding: '5 8', marginBottom: 2 }}>
          <Text style={{ width: '15%', fontSize: 7, color: C.thText, fontWeight: 600 }}>Symbole</Text>
          <Text style={{ width: '25%', fontSize: 7, color: C.thText, fontWeight: 600 }}>Nom</Text>
          <Text style={{ width: '10%', fontSize: 7, color: C.thText, fontWeight: 600, textAlign: 'right' }}>Poids</Text>
          <Text style={{ width: '15%', fontSize: 7, color: C.thText, fontWeight: 600, textAlign: 'right' }}>Valeur</Text>
          <Text style={{ width: '12%', fontSize: 7, color: C.thText, fontWeight: 600, textAlign: 'right' }}>Gain</Text>
          <Text style={{ width: '10%', fontSize: 7, color: C.thText, fontWeight: 600, textAlign: 'right' }}>Div. %</Text>
          <Text style={{ width: '13%', fontSize: 7, color: C.thText, fontWeight: 600 }}>Secteur</Text>
        </View>

        {/* Table rows */}
        {data.holdings.map((h, i) => (
          <View key={h.symbol} style={{ flexDirection: 'row', padding: '4 8', backgroundColor: i % 2 === 0 ? C.white : C.trAlt, borderBottom: `0.5px solid ${C.border}` }}>
            <Text style={{ width: '15%', fontSize: 8, fontWeight: 600, color: C.cyan }}>{h.symbol}</Text>
            <Text style={{ width: '25%', fontSize: 7, color: C.text }}>{h.name}</Text>
            <Text style={{ width: '10%', fontSize: 7, color: C.textSec, textAlign: 'right' }}>{h.weight.toFixed(1)}%</Text>
            <Text style={{ width: '15%', fontSize: 7, color: C.text, fontWeight: 600, textAlign: 'right' }}>{fmt(h.market_value, data.currency)}</Text>
            <Text style={{ width: '12%', fontSize: 7, fontWeight: 600, textAlign: 'right', color: h.gain_pct >= 0 ? C.up : C.down }}>{fmtPct(h.gain_pct)}</Text>
            <Text style={{ width: '10%', fontSize: 7, color: C.textSec, textAlign: 'right' }}>{h.dividend_yield > 0 ? `${h.dividend_yield.toFixed(1)}%` : '—'}</Text>
            <Text style={{ width: '13%', fontSize: 7, color: C.textTer }}>{SECTOR_FR[h.sector] || h.sector}</Text>
          </View>
        ))}

        <PageFooter num={2} total={totalPages} />
      </Page>

      {/* ── PAGE 3: Allocation ── */}
      <Page size="LETTER" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Répartition du portefeuille</Text>

        {/* Sector allocation */}
        <Text style={[styles.subsectionTitle, { marginBottom: 8 }]}>Par secteur</Text>
        {data.sectorAllocation.map((s) => (
          <View key={s.sector} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ width: 120, fontSize: 8, color: C.text }}>{SECTOR_FR[s.sector] || s.sector}</Text>
            <View style={{ flex: 1, height: 10, backgroundColor: C.panel, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(s.pct, 100)}%`, height: '100%', backgroundColor: C.cyan, borderRadius: 3 }} />
            </View>
            <Text style={{ width: 40, fontSize: 8, fontWeight: 600, color: C.text, textAlign: 'right' }}>{s.pct.toFixed(1)}%</Text>
          </View>
        ))}

        {/* Region allocation */}
        <Text style={[styles.subsectionTitle, { marginTop: 20, marginBottom: 8 }]}>Par région</Text>
        {data.regionAllocation.map((r) => (
          <View key={r.region} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ width: 120, fontSize: 8, color: C.text }}>{REGION_FR[r.region] || r.region}</Text>
            <View style={{ flex: 1, height: 10, backgroundColor: C.panel, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(r.pct, 100)}%`, height: '100%', backgroundColor: C.navy, borderRadius: 3 }} />
            </View>
            <Text style={{ width: 40, fontSize: 8, fontWeight: 600, color: C.text, textAlign: 'right' }}>{r.pct.toFixed(1)}%</Text>
          </View>
        ))}

        {/* Disclaimer */}
        <View style={{ marginTop: 'auto', padding: 10, backgroundColor: C.panel, borderRadius: 6 }}>
          <Text style={{ fontSize: 6.5, color: C.textTer, lineHeight: 1.4 }}>
            Ce rapport est généré automatiquement à des fins informatives seulement. Il ne constitue pas un conseil en placement.
            Les rendements passés ne garantissent pas les rendements futurs. Consultez votre conseiller financier avant toute décision d&apos;investissement.
            Groupe Financier Ste-Foy — Planificateur de Rencontre.
          </Text>
        </View>

        <PageFooter num={3} total={totalPages} />
      </Page>
    </Document>
  );
}

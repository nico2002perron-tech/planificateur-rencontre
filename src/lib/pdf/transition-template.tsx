import React from 'react';
import path from 'path';
import {
  Document, Page, Text, View, Image, Font,
  Svg, Path, Circle, Rect, Defs,
  LinearGradient, Stop,
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

// ─── Types ──────────────────────────────────────────────────────

export interface TransitionPDFData {
  clientName?: string;
  date: string;
  totalValue: number;
  profileName: string;
  profileEquityPct: number;
  profileBondPct: number;
  matchScore: number;

  // Allocations before
  before: {
    equityPct: number;
    bondPct: number;
    etfPct: number;
    fundPct: number;
    preferredPct: number;
    cashPct: number;
    otherPct: number;
  };

  // Allocations after (model)
  after: {
    equityPct: number;
    bondPct: number;
    cashPct: number;
  };

  // Sector comparison
  sectors: {
    name: string;
    beforePct: number;
    afterPct: number;
  }[];

  // Transactions
  transactions: {
    priority: number;
    action: 'BUY' | 'SELL';
    symbol: string;
    name: string;
    assetType: string;
    quantity: number;
    price: number;
    value: number;
    reason: string;
    bookValue?: number;
    gainLoss?: number;
    gainLossPct?: number;
  }[];

  // Summary
  totalBuys: number;
  totalSells: number;
  netFlow: number;
  estimatedFees: number;

  // AI analysis (optional)
  aiAnalysis?: {
    profileAnalysis: string;
    transitionRisks: string;
    recommendations: string;
    taxConsiderations: string;
  };

  // Gain/loss summary
  totalGainLoss?: number;
  totalGains?: number;
  totalLosses?: number;

  // Income before/after
  incomeBefore?: number;
  incomeAfter?: number;

  // Holdings summary
  holdingsCount: number;
  modelStocksCount: number;
  modelBondsCount: number;

  // Advisor notes
  advisorNotes?: string;

  // Fee comparison
  feeComparison?: {
    currentFees: number;
    currentFeePct: number;
    modelFees: number;
    modelFeePct: number;
    annualSavings: number;
    savingsOver5Years: number;
    savingsOver10Years: number;
  };

  // Tax simulation
  taxSimulation?: {
    netCapitalGain: number;
    taxableAmount: number;
    estimatedTax30: number;
    estimatedTax40: number;
    estimatedTax50: number;
    lossCarryForward: number;
  };

  // Phases
  phases?: {
    phase: number;
    label: string;
    transactions: number;
    totalValue: number;
  }[];

  // Projected returns
  projectedReturns?: {
    year: number;
    actuel: number;
    modele: number;
  }[];

  // Concentration alerts
  concentrationAlerts?: string[];
}

// ─── Helpers ────────────────────────────────────────────────────

function fmt(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function fmtDec(value: number, d = 2): string {
  return new Intl.NumberFormat('fr-CA', { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
}

const ALLOC_COLORS = {
  equity: C.cyan,
  bond: '#6366f1',
  etf: '#8b5cf6',
  fund: '#f59e0b',
  preferred: '#ec4899',
  cash: '#10b981',
  other: '#94a3b8',
};

const ASSET_LABELS: Record<string, string> = {
  EQUITY: 'Action',
  FIXED_INCOME: 'Obligation',
  ETF: 'FNB',
  FUND: 'Fonds',
  PREFERRED: 'Privilegiee',
  CASH: 'Liquidite',
  OTHER: 'Autre',
};

// ─── Sub-Components ─────────────────────────────────────────────

function AccentBar() {
  return (
    <Svg width={792} height={4} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id="ab" x1="0" y1="0" x2="792" y2="0">
          <Stop offset="0%" stopColor={C.navy} />
          <Stop offset="30%" stopColor={C.blue} />
          <Stop offset="50%" stopColor={C.cyan} />
          <Stop offset="70%" stopColor={C.gold} />
          <Stop offset="100%" stopColor={C.navy} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={792} height={4} fill="url(#ab)" />
    </Svg>
  );
}

function PageFooter({ num, total }: { num: number; total: number }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Confidentiel</Text>
      <Text style={styles.footerText}>{num} / {total}</Text>
    </View>
  );
}

function KPICard({ label, value, sub, accent = C.cyan }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
    }}>
      <View style={{ width: 28, height: 3, borderRadius: 2, backgroundColor: accent, marginBottom: 8 }} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={{ ...styles.kpiValue, fontSize: 20, color: accent === C.gold ? C.gold : C.navy }}>{value}</Text>
      {sub && <Text style={{ fontSize: 8, color: C.textSec, marginTop: 3 }}>{sub}</Text>}
    </View>
  );
}

interface PieSlice { label: string; percentage: number; color: string; }

function DonutChart({ slices, size = 85, centerValue, centerLabel }: {
  slices: PieSlice[]; size?: number; centerValue?: string; centerLabel?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const innerR = r * 0.58;
  const filtered = slices.filter(s => s.percentage > 0.5);
  if (filtered.length === 0) return null;

  let cumulative = 0;
  const arcs = filtered.map(slice => {
    const startAngle = cumulative * 3.6 * (Math.PI / 180);
    cumulative += slice.percentage;
    const endAngle = cumulative * 3.6 * (Math.PI / 180);
    const x1 = cx + r * Math.sin(startAngle);
    const y1 = cy - r * Math.cos(startAngle);
    const x2 = cx + r * Math.sin(endAngle);
    const y2 = cy - r * Math.cos(endAngle);
    const largeArc = slice.percentage > 50 ? 1 : 0;
    if (slice.percentage >= 99.9) {
      return { d: '', color: slice.color, label: slice.label, pct: slice.percentage, full: true };
    }
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, color: slice.color, label: slice.label, pct: slice.percentage, full: false };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: size, height: size, position: 'relative' }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {arcs.map((arc, i) =>
              arc.full ? (
                <Circle key={i} cx={cx} cy={cy} r={r} fill={arc.color} />
              ) : (
                <Path key={i} d={arc.d} fill={arc.color} />
              )
            )}
            <Circle cx={cx} cy={cy} r={innerR} fill={C.white} />
          </Svg>
          {centerValue && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{centerValue}</Text>
              {centerLabel && <Text style={{ fontSize: 5, color: C.textTer, marginTop: 1 }}>{centerLabel}</Text>}
            </View>
          )}
        </View>
        <View style={{ maxWidth: 130, minWidth: 80 }}>
          {filtered.slice(0, 6).map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.color, marginRight: 4, flexShrink: 0 }} />
              <View style={{ flex: 1, marginRight: 3 }}>
                <Text style={{ fontSize: 7, color: C.text }}>{s.label.substring(0, 16)}</Text>
              </View>
              <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, flexShrink: 0 }}>
                {s.percentage.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SubsectionTitle({ children }: { children: string }) {
  return <Text style={styles.subsectionTitle}>{children}</Text>;
}

// ─── Sector comparison bars ─────────────────────────────────────

function SectorComparisonBars({ sectors }: { sectors: TransitionPDFData['sectors'] }) {
  const maxPct = Math.max(...sectors.flatMap(s => [s.beforePct, s.afterPct]), 1);

  return (
    <View>
      {/* Header */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        <Text style={{ width: '30%', fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer }}>SECTEUR</Text>
        <Text style={{ width: '25%', fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textAlign: 'center' }}>AVANT</Text>
        <Text style={{ width: '25%', fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textAlign: 'center' }}>APRES</Text>
        <Text style={{ width: '20%', fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textAlign: 'right' }}>ECART</Text>
      </View>

      {sectors.map((s, i) => {
        const diff = s.afterPct - s.beforePct;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <Text style={{ width: '30%', fontSize: 8, color: C.text }}>{s.name.substring(0, 20)}</Text>
            <View style={{ width: '25%', paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ flex: 1, height: 7, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' as const }}>
                  <View style={{ height: '100%', width: `${Math.max((s.beforePct / maxPct) * 100, 2)}%`, backgroundColor: '#ef4444', borderRadius: 3, opacity: 0.7 }} />
                </View>
                <Text style={{ fontSize: 7, color: C.textSec, width: 28, textAlign: 'right' }}>{s.beforePct.toFixed(1)}%</Text>
              </View>
            </View>
            <View style={{ width: '25%', paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ flex: 1, height: 7, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' as const }}>
                  <View style={{ height: '100%', width: `${Math.max((s.afterPct / maxPct) * 100, 2)}%`, backgroundColor: C.cyan, borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 7, color: C.textSec, width: 28, textAlign: 'right' }}>{s.afterPct.toFixed(1)}%</Text>
              </View>
            </View>
            <Text style={{
              width: '20%', fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, textAlign: 'right',
              color: Math.abs(diff) < 1 ? '#10b981' : diff > 0 ? C.cyan : '#ef4444',
            }}>
              {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
            </Text>
          </View>
        );
      })}

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 4, backgroundColor: '#ef4444', borderRadius: 2, marginRight: 4, opacity: 0.7 }} />
          <Text style={{ fontSize: 7, color: C.textSec }}>Avant (client)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 4, backgroundColor: C.cyan, borderRadius: 2, marginRight: 4 }} />
          <Text style={{ fontSize: 7, color: C.textSec }}>Apres (modele)</Text>
        </View>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN DOCUMENT
// ════════════════════════════════════════════════════════════════

export function TransitionDocument({ data }: { data: TransitionPDFData }) {
  const sells = data.transactions.filter(t => t.action === 'SELL');
  const buys = data.transactions.filter(t => t.action === 'BUY');

  // Calculate total pages
  let totalPages = 4; // Cover + Allocation + Sectors + Transactions
  const hasDetailedAnalysis = data.feeComparison || data.taxSimulation || (data.projectedReturns && data.projectedReturns.length > 0);
  if (hasDetailedAnalysis) totalPages++; // Detailed analysis page
  if (data.aiAnalysis) totalPages++;
  totalPages++; // Disclaimers

  let pageNum = 0;

  return (
    <Document>
      {/* ═══════════ PAGE 1 — COVER ═══════════ */}
      <Page size="LETTER" style={styles.page}>
        <AccentBar />
        <PageFooter num={++pageNum} total={totalPages} />

        {/* Logo + title */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
          <View>
            <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 4 }}>
              Plan de transition
            </Text>
            <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan }}>
              Gestion discretionnaire
            </Text>
          </View>
          <Image src={LOGO_PATH} style={{ width: 120, height: 40, objectFit: 'contain' as const }} />
        </View>

        {/* Client info bar */}
        <View style={{
          backgroundColor: C.navy, borderRadius: 12, padding: 16, marginBottom: 20,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <View>
            <Text style={{ fontSize: 7, color: C.cyanLight, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 4 }}>CLIENT</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: C.white }}>
              {data.clientName || 'Portefeuille client'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: C.cyanLight, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 4 }}>DATE</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Open Sans', fontWeight: 600, color: C.white }}>{data.date}</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <KPICard label="VALEUR TOTALE" value={fmt(data.totalValue)} />
          <KPICard label="PROFIL CIBLE" value={data.profileName} sub={`${data.profileEquityPct}% / ${data.profileBondPct}%`} accent={C.blue} />
          <KPICard label="CORRESPONDANCE" value={`${data.matchScore.toFixed(0)}%`} accent={data.matchScore >= 80 ? '#10b981' : data.matchScore >= 60 ? '#f59e0b' : '#ef4444'} />
          <KPICard label="TRANSACTIONS" value={`${data.transactions.length}`} sub={`${sells.length} ventes, ${buys.length} achats`} accent={C.gold} />
        </View>

        {/* Financial summary */}
        <View style={{ ...styles.card, flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>VENTES</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: '#ef4444' }}>{fmt(data.totalSells)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>ACHATS</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: '#10b981' }}>{fmt(data.totalBuys)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>FLUX NET</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: data.netFlow >= 0 ? '#10b981' : '#ef4444' }}>
              {data.netFlow >= 0 ? '+' : ''}{fmt(data.netFlow)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>FRAIS EST.</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: '#f59e0b' }}>~{fmt(data.estimatedFees)}</Text>
          </View>
        </View>

        {/* Gain/loss + Income summary */}
        {(data.totalGainLoss != null || data.incomeBefore != null) && (
          <View style={{ ...styles.card, flexDirection: 'row', gap: 12 }}>
            {data.totalGainLoss != null && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>G/P LATENT</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: data.totalGainLoss >= 0 ? '#10b981' : '#ef4444' }}>
                  {data.totalGainLoss >= 0 ? '+' : ''}{fmt(data.totalGainLoss)}
                </Text>
              </View>
            )}
            {data.totalGains != null && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>GAINS CAPITAL</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: '#10b981' }}>+{fmt(data.totalGains)}</Text>
                <Text style={{ fontSize: 7, color: C.textTer, marginTop: 2 }}>Imposable a 50%</Text>
              </View>
            )}
            {data.totalLosses != null && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>PERTES CAPITAL</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: '#ef4444' }}>{fmt(data.totalLosses)}</Text>
                <Text style={{ fontSize: 7, color: C.textTer, marginTop: 2 }}>Deductibles</Text>
              </View>
            )}
            {data.incomeBefore != null && data.incomeAfter != null && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>REVENU ANNUEL</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={{ fontSize: 10, color: C.textTer, textDecoration: 'line-through' as const }}>{fmt(data.incomeBefore)}</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan }}>{fmt(data.incomeAfter)}</Text>
                </View>
                <Text style={{ fontSize: 7, color: data.incomeAfter >= data.incomeBefore ? '#10b981' : '#ef4444', marginTop: 2 }}>
                  {data.incomeAfter >= data.incomeBefore ? '+' : ''}{fmt(data.incomeAfter - data.incomeBefore)}/an
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Portfolio summary */}
        <View style={{ ...styles.card }}>
          <Text style={{ fontSize: 9, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, marginBottom: 8 }}>Resume du portefeuille</Text>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <View>
              <Text style={{ fontSize: 7, color: C.textTer, marginBottom: 2 }}>Positions actuelles</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{data.holdingsCount}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 7, color: C.textTer, marginBottom: 2 }}>Titres modele</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan }}>{data.modelStocksCount}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 7, color: C.textTer, marginBottom: 2 }}>Obligations modele</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: '#6366f1' }}>{data.modelBondsCount}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ═══════════ PAGE 2 — ALLOCATION AVANT/APRES ═══════════ */}
      <Page size="LETTER" style={styles.page}>
        <AccentBar />
        <PageFooter num={++pageNum} total={totalPages} />

        <SectionTitle>Allocation avant / apres</SectionTitle>

        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
          {/* Before donut */}
          <View style={{ flex: 1, ...styles.card }}>
            <SubsectionTitle>Portefeuille actuel</SubsectionTitle>
            <DonutChart
              slices={[
                { label: 'Actions', percentage: data.before.equityPct, color: ALLOC_COLORS.equity },
                { label: 'Obligations', percentage: data.before.bondPct, color: ALLOC_COLORS.bond },
                { label: 'FNB', percentage: data.before.etfPct, color: ALLOC_COLORS.etf },
                { label: 'Fonds', percentage: data.before.fundPct, color: ALLOC_COLORS.fund },
                { label: 'Privilegiees', percentage: data.before.preferredPct, color: ALLOC_COLORS.preferred },
                { label: 'Liquidites', percentage: data.before.cashPct, color: ALLOC_COLORS.cash },
              ].filter(s => s.percentage > 0.5)}
              centerValue="AVANT"
            />
          </View>

          {/* After donut */}
          <View style={{ flex: 1, ...styles.card }}>
            <SubsectionTitle>Portefeuille modele cible</SubsectionTitle>
            <DonutChart
              slices={[
                { label: 'Actions', percentage: data.after.equityPct, color: ALLOC_COLORS.equity },
                { label: 'Obligations', percentage: data.after.bondPct, color: ALLOC_COLORS.bond },
                { label: 'Liquidites', percentage: data.after.cashPct, color: ALLOC_COLORS.cash },
              ].filter(s => s.percentage > 0.5)}
              centerValue="APRES"
            />
          </View>
        </View>

        {/* Allocation change summary */}
        <View style={styles.card}>
          <SubsectionTitle>Changements d&apos;allocation</SubsectionTitle>
          {[
            { label: 'Actions', before: data.before.equityPct + data.before.etfPct + data.before.preferredPct, after: data.after.equityPct, color: ALLOC_COLORS.equity },
            { label: 'Obligations', before: data.before.bondPct, after: data.after.bondPct, color: ALLOC_COLORS.bond },
            { label: 'Fonds communs', before: data.before.fundPct, after: 0, color: ALLOC_COLORS.fund },
            { label: 'Liquidites', before: data.before.cashPct, after: data.after.cashPct, color: ALLOC_COLORS.cash },
          ].map((item, i) => {
            const diff = item.after - item.before;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color, marginRight: 8 }} />
                <Text style={{ width: 100, fontSize: 8.5, color: C.text }}>{item.label}</Text>
                <Text style={{ width: 50, fontSize: 8, color: C.textSec, textAlign: 'right' }}>{item.before.toFixed(1)}%</Text>
                <Text style={{ width: 30, fontSize: 8, color: C.textTer, textAlign: 'center' }}>→</Text>
                <Text style={{ width: 50, fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, textAlign: 'right' }}>{item.after.toFixed(1)}%</Text>
                <Text style={{
                  width: 60, fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, textAlign: 'right',
                  color: Math.abs(diff) < 0.5 ? '#10b981' : diff > 0 ? C.cyan : '#ef4444',
                }}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                </Text>
              </View>
            );
          })}
        </View>
      </Page>

      {/* ═══════════ PAGE 3 — SECTEURS ═══════════ */}
      {data.sectors.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <AccentBar />
          <PageFooter num={++pageNum} total={totalPages} />

          <SectionTitle>Comparaison sectorielle</SectionTitle>
          <Text style={{ fontSize: 8.5, color: C.textSec, marginBottom: 14, lineHeight: 1.5 }}>
            Repartition des actions par secteur avant et apres la transition vers le modele {data.profileName}.
          </Text>

          <View style={styles.card}>
            <SectorComparisonBars sectors={data.sectors} />
          </View>
        </Page>
      )}

      {/* ═══════════ PAGE 4 — TRANSACTIONS ═══════════ */}
      <Page size="LETTER" style={styles.page}>
        <AccentBar />
        <PageFooter num={++pageNum} total={totalPages} />

        <SectionTitle>Plan de transition</SectionTitle>

        {/* Sells */}
        {sells.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 6 }} />
              <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: '#ef4444' }}>
                Ventes ({sells.length}) — {fmt(data.totalSells)}
              </Text>
            </View>

            <View style={styles.tablePremium}>
              <View style={{ ...styles.thPremium, backgroundColor: '#7f1d1d' }}>
                <Text style={{ ...styles.thCellPremium, width: 25 }}>#</Text>
                <Text style={{ ...styles.thCellPremium, width: 65 }}>Symbole</Text>
                <Text style={{ ...styles.thCellPremium, flex: 1 }}>Nom</Text>
                <Text style={{ ...styles.thCellPremium, width: 40 }}>Type</Text>
                <Text style={{ ...styles.thCellPremium, width: 35, textAlign: 'right' as const }}>Qte</Text>
                <Text style={{ ...styles.thCellPremium, width: 50, textAlign: 'right' as const }}>Prix</Text>
                <Text style={{ ...styles.thCellPremium, width: 58, textAlign: 'right' as const }}>Valeur</Text>
                <Text style={{ ...styles.thCellPremium, width: 58, textAlign: 'right' as const }}>G/P</Text>
              </View>
              {sells.slice(0, 20).map((t, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                  <Text style={{ ...styles.td, width: 25, color: C.textTer }}>{t.priority}</Text>
                  <Text style={{ ...styles.tdBold, width: 65, color: C.navy }}>{t.symbol}</Text>
                  <Text style={{ ...styles.td, flex: 1, color: C.textSec }}>{t.name.substring(0, 22)}</Text>
                  <Text style={{ ...styles.td, width: 40, fontSize: 6.5 }}>{ASSET_LABELS[t.assetType] || t.assetType}</Text>
                  <Text style={{ ...styles.tdBold, width: 35, textAlign: 'right' as const }}>{t.quantity}</Text>
                  <Text style={{ ...styles.td, width: 50, textAlign: 'right' as const }}>{fmtDec(t.price)}</Text>
                  <Text style={{ ...styles.tdBold, width: 58, textAlign: 'right' as const, color: '#ef4444' }}>{fmt(t.value)}</Text>
                  <Text style={{ ...styles.tdBold, width: 58, textAlign: 'right' as const, fontSize: 7, color: (t.gainLoss ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                    {t.gainLoss != null ? `${t.gainLoss >= 0 ? '+' : ''}${fmt(t.gainLoss)}` : '—'}
                  </Text>
                </View>
              ))}
              {sells.length > 20 && (
                <View style={{ ...styles.tr, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 7, color: C.textTer }}>+ {sells.length - 20} autres ventes</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Buys */}
        {buys.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 6 }} />
              <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: '#10b981' }}>
                Achats ({buys.length}) — {fmt(data.totalBuys)}
              </Text>
            </View>

            <View style={styles.tablePremium}>
              <View style={{ ...styles.thPremium, backgroundColor: '#064e3b' }}>
                <Text style={{ ...styles.thCellPremium, width: 25 }}>#</Text>
                <Text style={{ ...styles.thCellPremium, width: 70 }}>Symbole</Text>
                <Text style={{ ...styles.thCellPremium, flex: 1 }}>Nom</Text>
                <Text style={{ ...styles.thCellPremium, width: 45 }}>Type</Text>
                <Text style={{ ...styles.thCellPremium, width: 40, textAlign: 'right' as const }}>Qte</Text>
                <Text style={{ ...styles.thCellPremium, width: 55, textAlign: 'right' as const }}>Prix</Text>
                <Text style={{ ...styles.thCellPremium, width: 65, textAlign: 'right' as const }}>Valeur</Text>
              </View>
              {buys.slice(0, 20).map((t, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                  <Text style={{ ...styles.td, width: 25, color: C.textTer }}>{t.priority}</Text>
                  <Text style={{ ...styles.tdBold, width: 70, color: C.navy }}>{t.symbol}</Text>
                  <Text style={{ ...styles.td, flex: 1, color: C.textSec }}>{t.name.substring(0, 25)}</Text>
                  <Text style={{ ...styles.td, width: 45, fontSize: 7 }}>{ASSET_LABELS[t.assetType] || t.assetType}</Text>
                  <Text style={{ ...styles.tdBold, width: 40, textAlign: 'right' as const }}>{t.quantity}</Text>
                  <Text style={{ ...styles.td, width: 55, textAlign: 'right' as const }}>{fmtDec(t.price)}</Text>
                  <Text style={{ ...styles.tdBold, width: 65, textAlign: 'right' as const, color: '#10b981' }}>{fmt(t.value)}</Text>
                </View>
              ))}
              {buys.length > 20 && (
                <View style={{ ...styles.tr, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 7, color: C.textTer }}>+ {buys.length - 20} autres achats</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </Page>

      {/* ═══════════ PAGE 5 — DETAILED ANALYSIS (fees, tax, projections) ═══════════ */}
      {hasDetailedAnalysis && (
        <Page size="LETTER" style={styles.page}>
          <AccentBar />
          <PageFooter num={++pageNum} total={totalPages} />

          <SectionTitle>Analyse detaillee</SectionTitle>

          {/* Fee comparison */}
          {data.feeComparison && data.feeComparison.currentFees > 0 && (
            <View style={{ ...styles.card, marginBottom: 12 }}>
              <SubsectionTitle>Comparaison des frais de gestion (RFG)</SubsectionTitle>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                <View style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, color: '#ef4444', textTransform: 'uppercase' as const, marginBottom: 4 }}>Portefeuille actuel</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: '#ef4444' }}>{fmt(data.feeComparison.currentFees)}/an</Text>
                  <Text style={{ fontSize: 7, color: '#b91c1c', marginTop: 2 }}>{fmtDec(data.feeComparison.currentFeePct, 2)}% RFG moyen</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, color: '#10b981', textTransform: 'uppercase' as const, marginBottom: 4 }}>Portefeuille modele</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: '#10b981' }}>{fmt(data.feeComparison.modelFees)}/an</Text>
                  <Text style={{ fontSize: 7, color: '#059669', marginTop: 2 }}>0,00% RFG</Text>
                </View>
              </View>
              <View style={{ backgroundColor: C.cyanPale, borderRadius: 8, padding: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>Economie annuelle</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan }}>{fmt(data.feeComparison.annualSavings)}/an</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 7, color: C.textSec }}>Sur 5 ans: {fmt(data.feeComparison.savingsOver5Years)}</Text>
                  <Text style={{ fontSize: 7, color: C.textSec }}>Sur 10 ans: {fmt(data.feeComparison.savingsOver10Years)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Tax simulation */}
          {data.taxSimulation && (
            <View style={{ ...styles.card, marginBottom: 12 }}>
              <SubsectionTitle>Simulation fiscale</SubsectionTitle>
              {data.taxSimulation.netCapitalGain >= 0 ? (
                <View>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                    <View style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10 }}>
                      <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, marginBottom: 2 }}>Gain net en capital</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{fmt(data.taxSimulation.netCapitalGain)}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10 }}>
                      <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, marginBottom: 2 }}>Montant imposable (50%)</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: '#f59e0b' }}>{fmt(data.taxSimulation.taxableAmount)}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 7, color: C.textSec, marginBottom: 6 }}>Impot estime selon le taux marginal:</Text>
                  {[
                    { label: 'Taux 30% (~50K)', value: data.taxSimulation.estimatedTax30, color: '#10b981' },
                    { label: 'Taux 40% (~90K)', value: data.taxSimulation.estimatedTax40, color: '#f59e0b' },
                    { label: 'Taux 50% (~150K+)', value: data.taxSimulation.estimatedTax50, color: '#ef4444' },
                  ].map((r, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: i < 2 ? 0.5 : 0, borderBottomColor: '#f0f0f0' }}>
                      <Text style={{ fontSize: 8, color: C.textSec }}>{r.label}</Text>
                      <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: r.color }}>~{fmt(r.value)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Open Sans', fontWeight: 600, color: '#10b981', marginBottom: 4 }}>Perte nette en capital</Text>
                  <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: '#10b981' }}>{fmt(data.taxSimulation.lossCarryForward)}</Text>
                  <Text style={{ fontSize: 7, color: '#059669', marginTop: 4, textAlign: 'center' }}>Reportable sur les gains futurs ou les 3 annees precedentes</Text>
                </View>
              )}
            </View>
          )}

          {/* Phases breakdown */}
          {data.phases && data.phases.length > 0 && (
            <View style={{ ...styles.card, marginBottom: 12 }}>
              <SubsectionTitle>Approche par phases</SubsectionTitle>
              {data.phases.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: i < data.phases!.length - 1 ? 0.5 : 0, borderBottomColor: '#f0f0f0' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#10b981', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                    <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: C.white }}>{p.phase}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{p.label}</Text>
                    <Text style={{ fontSize: 7, color: C.textSec }}>{p.transactions} transactions</Text>
                  </View>
                  <Text style={{ fontSize: 9, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(p.totalValue)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Projected returns table */}
          {data.projectedReturns && data.projectedReturns.length > 0 && (
            <View style={styles.card}>
              <SubsectionTitle>Rendement projete sur 5 ans</SubsectionTitle>
              <View style={styles.tablePremium}>
                <View style={styles.thPremium}>
                  <Text style={{ ...styles.thCellPremium, width: 60 }}>Annee</Text>
                  <Text style={{ ...styles.thCellPremium, flex: 1, textAlign: 'right' as const }}>Actuel (avec frais)</Text>
                  <Text style={{ ...styles.thCellPremium, flex: 1, textAlign: 'right' as const }}>Modele (sans RFG)</Text>
                  <Text style={{ ...styles.thCellPremium, width: 80, textAlign: 'right' as const }}>Ecart</Text>
                </View>
                {data.projectedReturns.map((r, i) => (
                  <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                    <Text style={{ ...styles.td, width: 60 }}>{r.year === 0 ? 'Depart' : `An ${r.year}`}</Text>
                    <Text style={{ ...styles.td, flex: 1, textAlign: 'right' as const }}>{fmt(r.actuel)}</Text>
                    <Text style={{ ...styles.tdBold, flex: 1, textAlign: 'right' as const, color: C.cyan }}>{fmt(r.modele)}</Text>
                    <Text style={{ ...styles.tdBold, width: 80, textAlign: 'right' as const, color: r.modele - r.actuel > 0 ? '#10b981' : C.navy }}>
                      {r.year === 0 ? '—' : `+${fmt(r.modele - r.actuel)}`}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 6.5, color: C.textTer, marginTop: 6, fontStyle: 'italic' }}>
                * Estimation basee sur les rendements historiques moyens (actions 6%, obligations 2.5%) et les frais de gestion actuels. Rendements passes non garants du futur.
              </Text>
            </View>
          )}
        </Page>
      )}

      {/* ═══════════ PAGE — AI ANALYSIS (optional) ═══════════ */}
      {data.aiAnalysis && (
        <Page size="LETTER" style={styles.page}>
          <AccentBar />
          <PageFooter num={++pageNum} total={totalPages} />

          <SectionTitle>Analyse de la transition</SectionTitle>

          <View style={{ ...styles.aiBlock, borderLeftColor: C.blue }}>
            <Text style={{ ...styles.aiLabel, color: C.blue }}>ANALYSE DU PROFIL</Text>
            <Text style={styles.aiText}>{data.aiAnalysis.profileAnalysis}</Text>
          </View>

          <View style={{ ...styles.aiBlock, borderLeftColor: '#f59e0b' }}>
            <Text style={{ ...styles.aiLabel, color: '#f59e0b' }}>RISQUES DE TRANSITION</Text>
            <Text style={styles.aiText}>{data.aiAnalysis.transitionRisks}</Text>
          </View>

          <View style={{ ...styles.aiBlock, borderLeftColor: '#10b981' }}>
            <Text style={{ ...styles.aiLabel, color: '#10b981' }}>APPROCHE RECOMMANDEE</Text>
            <Text style={styles.aiText}>{data.aiAnalysis.recommendations}</Text>
          </View>

          <View style={{ ...styles.aiBlock, borderLeftColor: '#8b5cf6' }}>
            <Text style={{ ...styles.aiLabel, color: '#8b5cf6' }}>CONSIDERATIONS FISCALES</Text>
            <Text style={styles.aiText}>{data.aiAnalysis.taxConsiderations}</Text>
          </View>
        </Page>
      )}

      {/* ═══════════ LAST PAGE — DISCLAIMERS ═══════════ */}
      <Page size="LETTER" style={styles.page}>
        <AccentBar />
        <PageFooter num={++pageNum} total={totalPages} />

        <SectionTitle>Avis importants</SectionTitle>

        {/* Advisor notes */}
        {data.advisorNotes && (
          <View style={{ ...styles.card, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#6366f1' }}>
            <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>NOTES DU CONSEILLER</Text>
            <Text style={{ fontSize: 8.5, color: C.text, lineHeight: 1.6 }}>{data.advisorNotes}</Text>
          </View>
        )}

        {/* Concentration alerts */}
        {data.concentrationAlerts && data.concentrationAlerts.length > 0 && (
          <View style={{ ...styles.card, marginBottom: 12, backgroundColor: '#fffbeb' }}>
            <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>POINTS D&apos;ATTENTION</Text>
            {data.concentrationAlerts.map((alert, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                <Text style={{ fontSize: 7, color: '#f59e0b', marginRight: 4 }}>&#9679;</Text>
                <Text style={{ fontSize: 7.5, color: '#92400e', flex: 1 }}>{alert}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.disclaimer}>
            Ce document est fourni a titre informatif seulement et ne constitue pas une recommandation d&apos;achat ou de vente
            de titres. Les informations presentees sont basees sur les donnees disponibles au moment de la generation du rapport
            et peuvent etre sujettes a changement sans preavis.
          </Text>
          <Text style={{ ...styles.disclaimer, marginTop: 8 }}>
            Les projections, analyses et transactions suggerees dans ce rapport sont indicatives et doivent etre validees
            par le conseiller avant toute execution. Les rendements passes ne sont pas garants des rendements futurs.
          </Text>
          <Text style={{ ...styles.disclaimer, marginTop: 8 }}>
            La transition vers la gestion discretionnaire implique des frais de transaction qui peuvent avoir un impact
            sur la valeur du portefeuille. Les considerations fiscales mentionnees sont generales et ne remplacent pas
            les conseils d&apos;un fiscaliste qualifie.
          </Text>
          <Text style={{ ...styles.disclaimer, marginTop: 8 }}>
            Les valeurs de marche, prix et rendements sont approximatifs et bases sur les dernieres cotations disponibles.
            Les quantites d&apos;achat et de vente suggerees sont arrondies et doivent etre ajustees selon les conditions
            du marche au moment de l&apos;execution.
          </Text>
        </View>

        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <Image src={LOGO_PATH} style={{ width: 100, height: 33, objectFit: 'contain' as const, marginBottom: 8 }} />
          <Text style={{ fontSize: 8, color: C.textTer }}>Groupe Financier Ste-Foy</Text>
          <Text style={{ fontSize: 7, color: C.textMuted, marginTop: 2 }}>
            Rapport genere le {data.date}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

import React from 'react';
import path from 'path';
import {
  Document, Page, Text, View, Image, Font,
  Svg, Path, G, Circle, Rect, Defs,
  LinearGradient, RadialGradient, Stop,
} from '@react-pdf/renderer';

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

import { styles, C } from './styles';
import type {
  FullReportData,
  ReportHolding,
  HoldingProfile,
  AnnualReturn,
  SectorBreakdownItem,
  ValuationDataItem,
} from './report-data';

// ─── Backward compat: keep old interface exported ───────────────
export interface ReportData {
  client: { name: string; type: string; riskProfile: string; objectives: string; horizon: string };
  advisor: { name: string; title: string };
  portfolio: {
    name: string; accountType: string; currency: string; totalValue: number;
    holdings: { symbol: string; name: string; quantity: number; avgCost: number; currentPrice: number; marketValue: number; weight: number; gainLoss: number }[];
  };
  performance: { periods: Record<string, number>; benchmarks: Record<string, Record<string, number>> };
  riskMetrics: { volatility: number; sharpe: number; maxDrawdown: number; beta: number };
  scenarios: { name: string; projectedValue: number; annualizedReturn: number }[];
  generatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function fmt(value: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function fmtFull(value: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

function fmtPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} %`;
}

function fmtNum(value: number): string {
  return new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(value);
}

function fmtCap(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)} T$`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} G$`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)} M$`;
  return fmt(value);
}

const RISK_LABELS: Record<string, string> = {
  CONSERVATEUR: 'Conservateur',
  MODERE: 'Modere',
  EQUILIBRE: 'Equilibre',
  CROISSANCE: 'Croissance',
  DYNAMIQUE: 'Dynamique',
};

const ASSET_LABELS: Record<string, string> = {
  EQUITY: 'Actions',
  FIXED_INCOME: 'Revenu fixe',
  CASH: 'Liquidites',
  ALTERNATIVE: 'Alternatifs',
  REAL_ESTATE: 'Immobilier',
  COMMODITY: 'Matieres premieres',
};

const REGION_LABELS: Record<string, string> = {
  CA: 'Canada',
  US: 'Etats-Unis',
  INTL: 'International',
  EM: 'Marches emergents',
};

const SECTOR_COLORS = ['#00b4d8', '#03045e', '#0077b6', '#48cae4', '#90e0ef', '#023e8a', '#0096c7', '#2a9d8f', '#264653', '#e76f51'];

const SECTOR_DONUT_COLORS = [
  '#00b4d8', '#03045e', '#e76f51', '#2a9d8f', '#7c3aed',
  '#f59e0b', '#0077b6', '#ec4899', '#059669', '#8b5cf6',
  '#d97706', '#6366f1',
];

/** Fixed color per sector name — consistent across all pages */
const SECTOR_COLOR_MAP: Record<string, string> = {
  'Technologie': '#00b4d8',
  'Services financiers': '#03045e',
  'Énergie': '#e76f51',
  'Santé': '#2a9d8f',
  'Industriels': '#7c3aed',
  'Matériaux de base': '#f59e0b',
  'Communications': '#0077b6',
  'Consommation cyclique': '#ec4899',
  'Consommation défensive': '#059669',
  'Biens de consommation': '#059669',
  'Services publics': '#8b5cf6',
  'Immobilier': '#d97706',
  'Militaire': '#6366f1',
  'Défense': '#6366f1',
  'Aérospatiale & Défense': '#6366f1',
};

// ─── Sub-Components ─────────────────────────────────────────────

/** Thin gradient accent bar — top of every page */
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

/** Page footer with page number */
function PageFooter({ num, total }: { num: number; total: number }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Confidentiel</Text>
      <Text style={styles.footerText}>{num} / {total}</Text>
    </View>
  );
}

/** KPI Card */
function KPICard({ label, value, sub, accent = C.cyan }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 18,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
    }}>
      <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: accent, marginBottom: 10 }} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={{ ...styles.kpiValue, color: accent === C.gold ? C.gold : C.navy }}>{value}</Text>
      {sub && <Text style={{ fontSize: 9, color: C.textSec, marginTop: 4 }}>{sub}</Text>}
    </View>
  );
}

/** Modern Donut Chart (SVG) — with optional center label */
interface PieSlice { label: string; percentage: number; color: string; value?: number; }

function DonutChart({ slices, size = 90, title, labelMap, centerLabel, centerValue }: {
  slices: PieSlice[]; size?: number; title?: string;
  labelMap?: Record<string, string>;
  centerLabel?: string; centerValue?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const innerR = r * 0.58;
  const filtered = slices.filter((s) => s.percentage > 0);
  if (filtered.length === 0) return null;

  let cumulative = 0;
  const arcs = filtered.map((slice) => {
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
      {title && <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, marginBottom: 6 }}>{title}</Text>}
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
              <Text style={{ fontSize: size > 100 ? 11 : 8, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{centerValue}</Text>
              {centerLabel && <Text style={{ fontSize: size > 100 ? 6 : 5, color: C.textTer, marginTop: 1 }}>{centerLabel}</Text>}
            </View>
          )}
        </View>
        <View style={{ maxWidth: 140, minWidth: 90 }}>
          {filtered.slice(0, 6).map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: s.color, marginRight: 5, flexShrink: 0 }} />
              <View style={{ flex: 1, marginRight: 4 }}>
                <Text style={{ fontSize: 7, color: C.text }}>
                  {(labelMap ? labelMap[s.label] || s.label : s.label).substring(0, 18)}
                </Text>
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

/** Horizontal weight bar for top positions */
function WeightBar({ weight, color, maxWeight }: { weight: number; color: string; maxWeight: number }) {
  const pct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
  return (
    <View style={{ flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' as const }}>
      <View style={{ height: '100%', width: `${Math.max(pct, 2)}%`, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

/** Allocation Bar (stacked horizontal) */
function AllocationBar({ slices }: { slices: { percentage: number; color: string }[] }) {
  return (
    <View style={styles.allocBar}>
      {slices.map((s, i) => (
        <View key={i} style={{ height: '100%', width: `${Math.max(s.percentage, 1)}%`, backgroundColor: s.color }} />
      ))}
    </View>
  );
}

/** Legend */
function Legend({ slices }: { slices: { label: string; percentage: number; color: string }[] }) {
  return (
    <View style={styles.legendWrap}>
      {slices.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color, marginRight: 5 }} />
          <Text style={{ fontSize: 7.5, color: C.textSec }}>
            {ASSET_LABELS[s.label] || REGION_LABELS[s.label] || s.label || 'Autre'} ({s.percentage.toFixed(1)}%)
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Sector Horizontal Bars */
function SectorBars({ items }: { items: SectorBreakdownItem[] }) {
  return (
    <View style={{ marginBottom: 8 }}>
      {items.slice(0, 8).map((s, i) => (
        <View key={i} style={styles.sectorRow}>
          <Text style={styles.sectorLabel}>{s.sectorLabel}</Text>
          <View style={styles.sectorBarOuter}>
            <View style={{ ...styles.sectorBarInner, width: `${Math.max(s.weight, 1)}%`, backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
          </View>
          <Text style={styles.sectorPct}>{s.weight.toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}

/** Performance Bar Chart */
function PerformanceBarChart({ returns }: { returns: AnnualReturn[] }) {
  if (returns.length === 0) return null;
  const maxVal = Math.max(...returns.map((r) => Math.max(Math.abs(r.portfolioReturn), Math.abs(r.benchmarkReturn))), 1);
  const maxH = 90;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'flex-end', height: maxH, gap: 8,
        paddingLeft: 4, borderBottomWidth: 1, borderBottomColor: C.cardBorder, borderBottomStyle: 'solid' as const,
      }}>
        {returns.map((r, i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
              <View style={{
                width: 14, borderTopLeftRadius: 4, borderTopRightRadius: 4,
                height: Math.max((Math.abs(r.portfolioReturn) / maxVal) * maxH, 4),
                backgroundColor: r.portfolioReturn >= 0 ? C.cyan : C.down,
              }} />
              <View style={{
                width: 14, borderTopLeftRadius: 4, borderTopRightRadius: 4,
                height: Math.max((Math.abs(r.benchmarkReturn) / maxVal) * maxH, 4),
                backgroundColor: '#cbd5e1',
              }} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {returns.map((r, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 7, color: C.textTer }}>{r.year}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 6, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 4, backgroundColor: C.cyan, borderRadius: 2, marginRight: 4 }} />
          <Text style={{ fontSize: 7, color: C.textSec }}>Portefeuille</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 4, backgroundColor: '#cbd5e1', borderRadius: 2, marginRight: 4 }} />
          <Text style={{ fontSize: 7, color: C.textSec }}>Indice de reference</Text>
        </View>
      </View>
    </View>
  );
}

/** Projection Area Chart (fintech-style with gradient fills + value labels) */
function ProjectionChart({ projections, totalValue, ccy }: {
  projections: { year: number; bull: number; base: number; bear: number }[];
  totalValue: number; ccy: string;
}) {
  if (projections.length === 0) return null;

  const chartW = 580;
  const chartH = 150;
  const padL = 0;
  const padT = 12;
  const padB = 8;
  const drawH = chartH - padT - padB;
  const allVals = [totalValue, ...projections.flatMap((p) => [p.bull, p.base, p.bear])];
  const maxVal = Math.max(...allVals) * 1.03;
  const minVal = Math.min(...allVals) * 0.97;
  const range = maxVal - minVal || 1;
  const xStep = chartW / projections.length;

  function yPos(val: number): number {
    return padT + drawH * (1 - (val - minVal) / range);
  }
  function xPos(i: number): number {
    return padL + (i + 1) * xStep;
  }

  const startX = padL;
  const startY = yPos(totalValue);

  function buildLine(key: 'bull' | 'base' | 'bear'): string {
    let d = `M ${startX} ${startY}`;
    projections.forEach((p, i) => { d += ` L ${xPos(i)} ${yPos(p[key])}`; });
    return d;
  }
  function buildFill(key: 'bull' | 'base' | 'bear'): string {
    return buildLine(key) + ` L ${xPos(projections.length - 1)} ${padT + drawH} L ${startX} ${padT + drawH} Z`;
  }

  const last = projections[projections.length - 1];

  // Y-axis label values (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => ({
    val: minVal + range * pct,
    y: padT + drawH * (1 - pct),
  }));

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis labels */}
        <View style={{ width: 58, justifyContent: 'space-between', paddingTop: padT, paddingBottom: padB }}>
          {[...yTicks].reverse().map((t, i) => (
            <Text key={i} style={{ fontSize: 6.5, color: C.textTer, textAlign: 'right', paddingRight: 6 }}>
              {fmt(t.val, ccy)}
            </Text>
          ))}
        </View>

        {/* Chart SVG */}
        <Svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
          {/* Grid lines */}
          {yTicks.map((t, i) => (
            <Rect key={i} x={0} y={t.y} width={chartW} height={0.5} fill="#e2e8f0" />
          ))}

          {/* Gradient fills */}
          <Defs>
            <LinearGradient id="bullFill" x1="0" y1="0" x2="0" y2={String(chartH)}>
              <Stop offset="0%" stopColor={C.up} stopOpacity={0.08} />
              <Stop offset="100%" stopColor={C.up} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="baseFill" x1="0" y1="0" x2="0" y2={String(chartH)}>
              <Stop offset="0%" stopColor={C.cyan} stopOpacity={0.10} />
              <Stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="bearFill" x1="0" y1="0" x2="0" y2={String(chartH)}>
              <Stop offset="0%" stopColor={C.down} stopOpacity={0.06} />
              <Stop offset="100%" stopColor={C.down} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={buildFill('bull')} fill="url(#bullFill)" />
          <Path d={buildFill('base')} fill="url(#baseFill)" />
          <Path d={buildFill('bear')} fill="url(#bearFill)" />

          {/* Lines */}
          <Path d={buildLine('bull')} stroke={C.up} strokeWidth={2} fill="none" />
          <Path d={buildLine('base')} stroke={C.cyan} strokeWidth={2.5} fill="none" />
          <Path d={buildLine('bear')} stroke={C.down} strokeWidth={2} fill="none" />

          {/* Start point */}
          <Circle cx={startX} cy={startY} r={3} fill={C.navy} />

          {/* Endpoint dots */}
          <Circle cx={xPos(projections.length - 1)} cy={yPos(last.bull)} r={4} fill={C.up} />
          <Circle cx={xPos(projections.length - 1)} cy={yPos(last.base)} r={4} fill={C.cyan} />
          <Circle cx={xPos(projections.length - 1)} cy={yPos(last.bear)} r={4} fill={C.down} />
        </Svg>

        {/* End value labels (right side) */}
        <View style={{ width: 75, justifyContent: 'space-between', paddingTop: padT, paddingBottom: padB }}>
          <View style={{ alignItems: 'flex-start', paddingLeft: 6 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.up }}>{fmt(last.bull, ccy)}</Text>
          </View>
          <View style={{ alignItems: 'flex-start', paddingLeft: 6 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.cyan }}>{fmt(last.base, ccy)}</Text>
          </View>
          <View style={{ alignItems: 'flex-start', paddingLeft: 6 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.down }}>{fmt(last.bear, ccy)}</Text>
          </View>
        </View>
      </View>

      {/* X axis labels */}
      <View style={{ flexDirection: 'row', marginTop: 3, paddingLeft: 58 }}>
        <View style={{ width: 30, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: C.textTer }}>Depart</Text>
        </View>
        {projections.map((p, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 7, color: C.textTer }}>An {p.year}</Text>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center', marginTop: 8 }}>
        {[
          { color: C.up, label: 'Optimiste' },
          { color: C.cyan, label: 'Scenario de base' },
          { color: C.down, label: 'Pessimiste' },
        ].map((l, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: l.color, marginRight: 5 }} />
            <Text style={{ fontSize: 7.5, color: C.textSec }}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Scenario Card (Bear / Base / Bull) */
function ScenarioCard({ name, value, returnPct, totalValue, ccy, variant }: {
  name: string; value: number; returnPct: number; totalValue: number; ccy: string;
  variant: 'bear' | 'base' | 'bull';
}) {
  const gainLoss = value - totalValue;
  const cfg = {
    bear: { bg: C.downBg, accent: C.down, border: C.downBorder },
    base: { bg: '#f0f9ff', accent: C.cyan, border: '#bae6fd' },
    bull: { bg: C.upBg, accent: C.up, border: C.upBorder },
  }[variant];

  return (
    <View style={{
      flex: 1, backgroundColor: cfg.bg, borderRadius: 14,
      borderWidth: 1, borderColor: cfg.border, borderStyle: 'solid' as const, padding: 18,
    }}>
      <View style={{ width: 28, height: 3, borderRadius: 2, backgroundColor: cfg.accent, marginBottom: 10 }} />
      <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: cfg.accent, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>
        {name}
      </Text>
      <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.text, marginBottom: 4 }}>
        {fmt(value, ccy)}
      </Text>
      <Text style={{ fontSize: 10, color: cfg.accent, fontFamily: 'Open Sans', fontWeight: 600 }}>
        {fmtPct(returnPct)} / an
      </Text>
      <View style={{ borderTopWidth: 1, borderTopColor: cfg.border, borderTopStyle: 'solid' as const, marginTop: 10, paddingTop: 8 }}>
        <Text style={{ fontSize: 8, color: C.textSec }}>
          {gainLoss >= 0 ? 'Gain projete' : 'Perte projetee'}: {fmt(Math.abs(gainLoss), ccy)}
        </Text>
      </View>
    </View>
  );
}

/** Risk Indicator Card with description */
function RiskCard({ label, value, desc, color }: {
  label: string; value: string; desc?: string; color?: string;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.card, borderRadius: 12,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
      padding: 14,
    }}>
      <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6, textAlign: 'center' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: color || C.navy, textAlign: 'center', marginBottom: desc ? 6 : 0 }}>
        {value}
      </Text>
      {desc && (
        <View style={{ borderTopWidth: 1, borderTopColor: C.cardBorder, borderTopStyle: 'solid' as const, paddingTop: 6 }}>
          <Text style={{ fontSize: 7, color: C.textSec, lineHeight: 1.4 }}>{desc}</Text>
        </View>
      )}
    </View>
  );
}

/** Holding Profile Cards */
function HoldingCards({ profiles, currency }: { profiles: HoldingProfile[]; currency: string }) {
  return (
    <>
      {profiles.map((hp, i) => (
        <View key={i} style={styles.holdingCard} wrap={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View>
              <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{hp.companyName}</Text>
              <Text style={{ fontSize: 8, color: C.textSec }}>{hp.symbol} — {hp.exchange}</Text>
            </View>
            {hp.targetPrice > 0 && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 7, color: C.textTer }}>Cours cible consensus</Text>
                <Text style={{
                  fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700,
                  color: hp.estimatedGainPercent >= 0 ? C.up : C.down,
                }}>
                  {fmtFull(hp.targetPrice, currency)} ({fmtPct(hp.estimatedGainPercent)})
                </Text>
                <Text style={{ fontSize: 7, color: C.textTer }}>{hp.numberOfAnalysts} analystes</Text>
              </View>
            )}
          </View>
          {hp.description ? (
            <Text style={{ fontSize: 8, color: C.textSec, lineHeight: 1.4, marginBottom: 8 }}>{hp.description}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Secteur', value: hp.sector || 'N/D' },
              { label: 'Industrie', value: hp.industry || 'N/D' },
              { label: 'Pays', value: hp.country || 'N/D' },
              { label: 'Beta', value: hp.beta > 0 ? hp.beta.toFixed(2) : 'N/D' },
              { label: 'Dividende', value: hp.lastDiv > 0 ? fmtFull(hp.lastDiv, currency) : 'N/D' },
              { label: 'Cap. boursiere', value: hp.marketCap > 0 ? fmtCap(hp.marketCap) : 'N/D' },
            ].map((m, mi) => (
              <View key={mi} style={{ width: '30%' }}>
                <Text style={{ fontSize: 7, color: C.textTer, marginBottom: 1 }}>{m.label}</Text>
                <Text style={{ fontSize: 9, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

/** AI Narrative Block */
function AINarrativeBlock({ label, content }: { label: string; content?: string }) {
  if (!content) return null;
  return (
    <View style={styles.aiBlock}>
      <Text style={styles.aiLabel}>{label}</Text>
      <Text style={styles.aiText}>{content}</Text>
    </View>
  );
}

/** Valuation Badge */
function ValuationBadge({ upside }: { upside: number }) {
  if (upside > 10) return <Text style={styles.badgeUp}>Sous-eval. ({fmtPct(upside)})</Text>;
  if (upside < -10) return <Text style={styles.badgeDown}>Sur-eval. ({fmtPct(upside)})</Text>;
  return <Text style={styles.badgeNeutral}>Juste val. ({fmtPct(upside)})</Text>;
}

/** Score Bar */
function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.min(100, Math.max(0, score * 10));
  const color = score >= 7 ? C.up : score >= 4 ? C.warn : C.down;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
      <Text style={{ fontSize: 7, color: C.textSec, width: 55 }}>{label}</Text>
      <View style={styles.scoreBarOuter}>
        <View style={{ ...styles.scoreBarInner, width: `${pct}%`, backgroundColor: color }} />
      </View>
      <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, width: 25, textAlign: 'right' }}>
        {score.toFixed(1)}
      </Text>
    </View>
  );
}

/** Sensitivity Matrix */
function SensitivityMatrix({ matrix, symbol, currentPrice }: {
  matrix: { rows: string[]; cols: string[]; data: number[][] };
  symbol: string; currentPrice: number;
}) {
  return (
    <View wrap={false} style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, marginBottom: 4 }}>
        Matrice de sensibilite — {symbol} (prix actuel: {fmtFull(currentPrice)})
      </Text>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ ...styles.sensitivityHeader, backgroundColor: C.navy }}>
          <Text style={{ fontSize: 7, color: C.white, fontFamily: 'Open Sans', fontWeight: 600 }}>WACC \ Cr.</Text>
        </View>
        {matrix.cols.map((col, ci) => (
          <View key={ci} style={styles.sensitivityHeader}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{col}</Text>
          </View>
        ))}
      </View>
      {matrix.rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', backgroundColor: ri % 2 === 0 ? C.white : C.card }}>
          <View style={{ ...styles.sensitivityHeader, backgroundColor: ri % 2 === 0 ? C.panel : '#e8edf4' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{row}</Text>
          </View>
          {matrix.data[ri].map((val, ci) => {
            const isCenter = ri === 2 && ci === 2;
            const color = val > currentPrice * 1.1 ? C.up : val < currentPrice * 0.9 ? C.down : C.text;
            return (
              <View key={ci} style={{
                ...styles.sensitivityCell,
                backgroundColor: isCenter ? C.cyanPale : undefined,
              }}>
                <Text style={{ fontSize: 7, color, fontFamily: isCenter ? 'Open Sans' : 'Open Sans', fontWeight: isCenter ? 600 : 400 }}>
                  {fmtFull(val)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}


// ═══════════════════════════════════════════════════════════════════
// ██ FULL REPORT DOCUMENT — Modern Fintech Dashboard Style        ██
// ═══════════════════════════════════════════════════════════════════

export function FullReportDocument({ data }: { data: FullReportData }) {
  const ccy = data.portfolio.currency;
  const ai = data.aiContent;
  const valData = data.valuationData;
  const hasValuation = valData && valData.length > 0;
  const hasNegativeValuations = hasValuation && valData.some((v) => v.avgIntrinsic < 0 || (v.priceDcf < 0));
  const hasAI = !!ai;
  const profilePageCount = Math.max(1, Math.ceil(data.holdingProfiles.length / 4));
  const totalPages = 6 + profilePageCount + (hasValuation ? 3 : 0);
  const hasTargets = data.holdingProfiles.some((hp) => hp.targetPrice > 0);
  const hasReturns = data.annualReturns.length > 0;
  const estimatedDividend = data.holdingProfiles.reduce((sum, hp) => sum + (hp.lastDiv * hp.quantity), 0);
  const coveredCount = data.holdingProfiles.filter((hp) => hp.targetPrice > 0).length;
  const totalAnalysts = data.holdingProfiles.reduce((sum, hp) => sum + hp.numberOfAnalysts, 0);
  const weightedBeta = data.holdingProfiles.reduce((sum, hp) => {
    const w = data.portfolio.totalValue > 0 ? (hp.currentPrice * hp.quantity) / data.portfolio.totalValue : 0;
    return sum + w * hp.beta;
  }, 0);
  const valOffset = hasValuation ? 3 : 0;
  const gainLoss = data.portfolio.totalGainLoss;
  const gainLossPct = data.portfolio.totalGainLossPercent;

  return (
    <Document>

      {/* ═══ PAGE 1: COVER PAGE — Canva layout, white background ════ */}
      <Page size="LETTER" orientation="landscape" style={{ fontFamily: 'Open Sans', padding: 0, backgroundColor: C.white }}>

        {/* ── Background: white with geometric SVG artwork ── */}
        <Svg width={792} height={612} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="topBar" x1="0" y1="0" x2="792" y2="0">
              <Stop offset="0%" stopColor={C.blue} />
              <Stop offset="50%" stopColor={C.cyan} />
              <Stop offset="100%" stopColor={C.blue} />
            </LinearGradient>
          </Defs>

          {/* Large decorative circles — soft on white */}
          <Circle cx={680} cy={100} r={120} fill={C.blue} opacity={0.04} />
          <Circle cx={720} cy={160} r={80} fill={C.cyan} opacity={0.05} />
          <Circle cx={100} cy={500} r={100} fill={C.blue} opacity={0.03} />
          <Circle cx={50} cy={450} r={60} fill={C.cyan} opacity={0.04} />
          <Circle cx={400} cy={580} r={140} fill={C.blue} opacity={0.02} />

          {/* Abstract rising bar chart silhouette (bottom-right) */}
          <Rect x={580} y={440} width={22} height={120} rx={4} fill={C.cyan} opacity={0.05} />
          <Rect x={610} y={400} width={22} height={160} rx={4} fill={C.cyan} opacity={0.06} />
          <Rect x={640} y={360} width={22} height={200} rx={4} fill={C.cyan} opacity={0.07} />
          <Rect x={670} y={310} width={22} height={250} rx={4} fill={C.cyan} opacity={0.08} />
          <Rect x={700} y={260} width={22} height={300} rx={4} fill={C.blue} opacity={0.07} />
          <Rect x={730} y={220} width={22} height={340} rx={4} fill={C.blue} opacity={0.06} />
          <Rect x={760} y={180} width={22} height={380} rx={4} fill={C.blue} opacity={0.05} />

          {/* Subtle horizontal line accents */}
          <Rect x={60} y={195} width={110} height={0.5} fill={C.cyan} opacity={0.25} />
          <Rect x={60} y={350} width={80} height={0.5} fill={C.blue} opacity={0.15} />

          {/* Top gradient accent bar */}
          <Rect x={0} y={0} width={792} height={3} fill="url(#topBar)" />

          {/* Bottom thin line */}
          <Rect x={60} y={570} width={672} height={0.5} fill={C.cardBorder} />
        </Svg>

        {/* ── Logo — top left ── */}
        <View style={{ paddingLeft: 60, paddingTop: 36 }}>
          <Image src={LOGO_PATH} style={{ width: 190, height: 40 }} />
        </View>

        {/* ── Main title block — left aligned, editorial ── */}
        <View style={{ paddingLeft: 60, paddingTop: 40 }}>
          <Text style={{ fontSize: 13, fontFamily: 'Open Sans', fontWeight: 600, color: C.cyan, letterSpacing: 4, textTransform: 'uppercase' as const, marginBottom: 10 }}>
            Rapport confidentiel
          </Text>
          <Text style={{ fontSize: 42, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, letterSpacing: -1, lineHeight: 1.05, marginBottom: 4 }}>
            Portefeuille
          </Text>
          <Text style={{ fontSize: 42, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan, letterSpacing: -1, lineHeight: 1.05 }}>
            d&apos;investissement
          </Text>
          <View style={{ width: 60, height: 3, borderRadius: 2, backgroundColor: C.cyan, marginTop: 16, marginBottom: 14 }} />
          <Text style={{ fontSize: 14, color: C.textSec, fontFamily: 'Open Sans', fontWeight: 600 }}>
            {data.portfolio.name} — {data.portfolio.accountType}
          </Text>
          {data.portfolio.modelSource && (
            <Text style={{ fontSize: 9, color: C.textTer, marginTop: 4 }}>
              Modele: {data.portfolio.modelSource}
            </Text>
          )}
        </View>

        {/* ── Three KPI cards — light glass style ── */}
        <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 60, marginTop: 32 }}>
          {/* Total Value */}
          <View style={{
            flex: 1, backgroundColor: '#f3f6fa', borderRadius: 14, padding: 18,
            borderWidth: 1, borderColor: '#e0e8f0', borderStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 8 }}>
              Valeur totale
            </Text>
            <Text style={{ fontSize: 28, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>
              {fmt(data.portfolio.totalValue, ccy)}
            </Text>
          </View>

          {/* Potential Gain — cyan accent, never red */}
          <View style={{
            flex: 1, backgroundColor: '#f3f6fa', borderRadius: 14, padding: 18,
            borderWidth: 1, borderColor: '#e0e8f0', borderStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 8 }}>
              Gain potentiel (12 mois)
            </Text>
            <Text style={{ fontSize: 28, fontFamily: 'Montserrat', fontWeight: 800, color: C.blue, lineHeight: 1.1 }}>
              {fmt(data.priceTargetSummary.totalEstimatedGainDollar, ccy)}
            </Text>
            <Text style={{ fontSize: 10, color: C.cyan, fontFamily: 'Open Sans', fontWeight: 600, marginTop: 5 }}>
              soit {fmtPct(data.priceTargetSummary.totalEstimatedGainPercent)}
            </Text>
          </View>

          {/* Number of Positions */}
          <View style={{
            flex: 1, backgroundColor: '#f3f6fa', borderRadius: 14, padding: 18,
            borderWidth: 1, borderColor: '#e0e8f0', borderStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 8 }}>
              Positions
            </Text>
            <Text style={{ fontSize: 28, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>
              {data.portfolio.holdings.length}
            </Text>
            <Text style={{ fontSize: 10, color: C.textSec, marginTop: 5 }}>
              titres en portefeuille
            </Text>
          </View>
        </View>

        {/* ── Prepared For / Prepared By ── */}
        <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 60, marginTop: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.cyan, textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 6 }}>
              Prepare pour
            </Text>
            <Text style={{ fontSize: 15, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
              {data.client.name}
            </Text>
            {data.client.riskProfile && (
              <Text style={{ fontSize: 8, color: C.textSec, marginTop: 3 }}>
                Profil {RISK_LABELS[data.client.riskProfile] || data.client.riskProfile} — Horizon {data.client.horizon || 'N/D'}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.blue, textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 6 }}>
              Prepare par
            </Text>
            <Text style={{ fontSize: 15, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
              {data.advisor.name}
            </Text>
            {data.advisor.title && (
              <Text style={{ fontSize: 8, color: C.textSec, marginTop: 3 }}>{data.advisor.title}</Text>
            )}
          </View>
        </View>

        {/* ── Bottom branding ── */}
        <View style={{
          position: 'absolute', bottom: 18, left: 60, right: 60,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 7.5, color: C.textMuted }}>
            Groupe Financier Ste-Foy — Confidentiel
          </Text>
          <Text style={{ fontSize: 7.5, color: C.textMuted }}>
            {data.generatedAt}
          </Text>
        </View>

      </Page>


      {/* ═══ PAGE 2: ALLOCATION DASHBOARD ═══════════════════════════ */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />

        {/* ── Header row: Title + 5 KPI stats ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Allocation du portefeuille</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'Valeur totale', value: fmt(data.portfolio.totalValue, ccy), color: C.navy },
              { label: 'Positions', value: String(data.portfolio.holdings.length), color: C.cyan },
            ].map((kpi, i) => (
              <View key={i} style={{
                backgroundColor: '#f3f6fa', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
                borderWidth: 1, borderColor: '#e0e8f0', borderStyle: 'solid' as const,
                alignItems: 'center', minWidth: 85,
              }}>
                <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 2 }}>
                  {kpi.label}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 800, color: kpi.color }}>
                  {kpi.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Main dashboard: 3 columns ── */}
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 12 }}>

          {/* ▌ COL 1: Large donut (asset class) + allocation bar ▌ */}
          <View style={{
            width: '32%', backgroundColor: '#f3f6fa', borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: '#e0e8f0', borderStyle: 'solid' as const,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: C.cyan, marginRight: 8 }} />
              <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>
                Classes d&apos;actif
              </Text>
            </View>
            <DonutChart
              slices={data.allocations.byAssetClass.map((a) => ({
                label: a.label,
                percentage: a.percentage,
                color: a.color,
                value: a.value,
              }))}
              size={120}
              centerValue={fmt(data.portfolio.totalValue, ccy)}
              centerLabel="Total"
              labelMap={ASSET_LABELS}
            />
            {/* Stacked allocation bar */}
            <View style={{ marginTop: 12 }}>
              <AllocationBar slices={data.allocations.byAssetClass} />
              {/* Asset class detail rows */}
              {data.allocations.byAssetClass.map((a, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.color, marginRight: 5, flexShrink: 0 }} />
                    <Text style={{ fontSize: 7.5, color: C.text }}>{ASSET_LABELS[a.label] || a.label}</Text>
                  </View>
                  <Text style={{ fontSize: 7.5, color: C.textSec, marginRight: 6 }}>{a.percentage.toFixed(1)}%</Text>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(a.value, ccy)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ▌ COL 2: Sector Donut + Geographic ▌ */}
          <View style={{ width: '36%', gap: 10 }}>
            {/* Sector donut chart */}
            <View style={{
              backgroundColor: '#f3f6fa', borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: '#e0e8f0', borderStyle: 'solid' as const,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: C.gold, marginRight: 8 }} />
                <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>
                  Exposition sectorielle
                </Text>
              </View>
              <DonutChart
                slices={data.sectorBreakdown.map((s) => ({
                  label: s.sectorLabel,
                  percentage: s.weight,
                  color: SECTOR_COLOR_MAP[s.sectorLabel] || '#94a3b8',
                }))}
                size={110}
                centerValue={`${data.sectorBreakdown.length}`}
                centerLabel="Secteurs"
              />
              <View style={{ marginTop: 10 }}>
                {data.sectorBreakdown.slice(0, 10).map((s, i) => {
                  const sColor = SECTOR_COLOR_MAP[s.sectorLabel] || '#94a3b8';
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, paddingVertical: 2 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sColor, marginRight: 7, flexShrink: 0 }} />
                      <Text style={{ fontSize: 7.5, color: C.text, flex: 1 }}>{s.sectorLabel}</Text>
                      <Text style={{ fontSize: 7, color: C.textSec, marginRight: 6 }}>{s.holdings.length} titre{s.holdings.length > 1 ? 's' : ''}</Text>
                      <View style={{
                        backgroundColor: sColor,
                        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                      }}>
                        <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.white }}>
                          {s.weight.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Region progress bars */}
            <View style={{
              backgroundColor: '#f3f6fa', borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: '#e0e8f0', borderStyle: 'solid' as const,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: C.blue, marginRight: 8 }} />
                <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>
                  Exposition geographique
                </Text>
              </View>
              {data.allocations.byRegion.map((r, i) => (
                <View key={i} style={{ marginBottom: i < data.allocations.byRegion.length - 1 ? 6 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>
                      {REGION_LABELS[r.label] || r.label}
                    </Text>
                    <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>
                      {r.percentage.toFixed(1)}% — {fmt(r.value, ccy)}
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' as const }}>
                    <View style={{ height: '100%', width: `${Math.max(r.percentage, 2)}%`, backgroundColor: r.color, borderRadius: 4 }} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ▌ COL 3: Top 5 positions ranking ▌ */}
          <View style={{
            width: '32%', backgroundColor: '#f3f6fa', borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: '#e0e8f0', borderStyle: 'solid' as const,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: C.navy, marginRight: 8 }} />
              <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>
                Top {Math.min(data.topPositions.length, 5)} positions
              </Text>
            </View>
            {(() => {
              const maxW = data.topPositions.length > 0 ? data.topPositions[0].weight : 1;
              return data.topPositions.slice(0, 5).map((pos, i) => (
                <View key={i} style={{
                  backgroundColor: C.white, borderRadius: 10, padding: 10, marginBottom: 6,
                  borderWidth: 1, borderColor: '#edf0f4', borderStyle: 'solid' as const,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 20, height: 20, borderRadius: 10,
                        backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length],
                        justifyContent: 'center', alignItems: 'center', marginRight: 7,
                      }}>
                        <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 700, color: C.white }}>
                          {i + 1}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>{pos.symbol}</Text>
                        <Text style={{ fontSize: 6.5, color: C.textTer }}>{pos.name}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{pos.weight.toFixed(1)}%</Text>
                      <Text style={{ fontSize: 6.5, color: C.textTer }}>{fmt(pos.market_value, ccy)}</Text>
                    </View>
                  </View>
                  <WeightBar weight={pos.weight} color={SECTOR_COLORS[i % SECTOR_COLORS.length]} maxWeight={maxW} />
                </View>
              ));
            })()}

            {/* Concentration indicator */}
            {data.topPositions.length > 0 && (() => {
              const top5Weight = data.topPositions.slice(0, 5).reduce((s, p) => s + p.weight, 0);
              return (
                <View style={{
                  marginTop: 4, backgroundColor: top5Weight > 50 ? '#fff7ed' : '#f0fdf4',
                  borderRadius: 8, padding: 8, alignItems: 'center',
                  borderWidth: 1, borderColor: top5Weight > 50 ? '#fed7aa' : '#bbf7d0', borderStyle: 'solid' as const,
                }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: top5Weight > 50 ? '#9a3412' : '#166534' }}>
                    Concentration top 5: {top5Weight.toFixed(1)}%
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>

        {/* AI Executive Summary — enhanced dashboard integration */}
        {ai?.executiveSummary && (
          <View style={{
            backgroundColor: '#f0f9ff', borderRadius: 12, padding: 14, marginTop: 2,
            borderWidth: 1, borderColor: '#bae6fd', borderStyle: 'solid' as const,
            borderLeftWidth: 4, borderLeftColor: C.cyan, borderLeftStyle: 'solid' as const,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: C.cyan, marginRight: 6 }} />
              <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.cyan, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                Sommaire executif — Analyse IA
              </Text>
            </View>
            <Text style={{ fontSize: 8.5, color: C.text, lineHeight: 1.5 }}>{ai.executiveSummary}</Text>
          </View>
        )}

        <PageFooter num={2} total={totalPages} />
      </Page>


      {/* ═══ PAGE 3: PERFORMANCE & HOLDINGS ═══════════════════════ */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Composition du portefeuille</Text>

        {hasReturns && (
          <View style={{ marginBottom: 14 }}>
            <PerformanceBarChart returns={data.annualReturns} />
            {/* Compact returns summary */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {data.annualReturns.map((r, i) => (
                <View key={i} style={{
                  flex: 1, backgroundColor: C.card, borderRadius: 8, padding: 8, alignItems: 'center',
                  borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
                }}>
                  <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600 }}>{r.year}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: r.portfolioReturn >= 0 ? C.up : C.down }}>
                    {fmtPct(r.portfolioReturn)}
                  </Text>
                  <Text style={{ fontSize: 7, color: r.difference >= 0 ? C.up : C.down }}>
                    vs indice: {fmtPct(r.difference)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Holdings table */}
        <Text style={styles.subsectionTitle}>Composition detaillee</Text>
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={{ ...styles.thCell, width: '7%' }}>Symb.</Text>
            <Text style={{ ...styles.thCell, width: '15%' }}>Nom</Text>
            <Text style={{ ...styles.thCell, width: '5%', textAlign: 'right' }}>Qte</Text>
            <Text style={{ ...styles.thCell, width: '9%', textAlign: 'right' }}>Prix</Text>
            <Text style={{ ...styles.thCell, width: '11%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.thCell, width: '6%', textAlign: 'right' }}>Poids</Text>
            <Text style={{ ...styles.thCell, width: '7%' }}>Classe</Text>
            <Text style={{ ...styles.thCell, width: '22%' }}>Secteur</Text>
            <Text style={{ ...styles.thCell, width: '9%', textAlign: 'right' }}>Div. $</Text>
            <Text style={{ ...styles.thCell, width: '9%', textAlign: 'right' }}>Div. %</Text>
          </View>
          {data.portfolio.holdings.map((h: ReportHolding, i: number) => (
            <View key={i} style={i % 2 === 1 ? styles.trAlt : styles.tr}>
              <Text style={{ ...styles.tdBold, width: '7%' }}>{h.symbol}</Text>
              <Text style={{ ...styles.td, width: '15%' }}>{h.name.substring(0, 20)}</Text>
              <Text style={{ ...styles.td, width: '5%', textAlign: 'right' }}>{fmtNum(h.quantity)}</Text>
              <Text style={{ ...styles.td, width: '9%', textAlign: 'right' }}>{fmtFull(h.currentPrice, ccy)}</Text>
              <Text style={{ ...styles.tdBold, width: '11%', textAlign: 'right' }}>{fmtFull(h.marketValue, ccy)}</Text>
              <Text style={{ ...styles.td, width: '6%', textAlign: 'right' }}>{h.weight.toFixed(1)}%</Text>
              <Text style={{ ...styles.td, width: '7%', fontSize: 7 }}>
                {ASSET_LABELS[h.assetClass]?.substring(0, 8) || h.assetClass}
              </Text>
              <View style={{ width: '22%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
                {(() => {
                  if (!h.sectorDisplay) return <Text style={{ fontSize: 7.5, color: C.textTer }}>—</Text>;
                  const sectors = h.sectorDisplay.split(', ');
                  return (
                    <>
                      <View style={{ flexDirection: 'row', marginRight: 4, flexShrink: 0 }}>
                        {sectors.map((s: string, j: number) => (
                          <View key={j} style={{
                            width: 6, height: 6, borderRadius: 3,
                            backgroundColor: SECTOR_COLOR_MAP[s.trim()] || '#94a3b8',
                            marginRight: 2,
                          }} />
                        ))}
                      </View>
                      <Text style={{ fontSize: 7, color: C.text, flex: 1 }}>{h.sectorDisplay}</Text>
                    </>
                  );
                })()}
              </View>
              <Text style={{ ...styles.td, width: '9%', textAlign: 'right', color: h.dividendAnnual > 0 ? C.up : C.textTer }}>
                {h.dividendAnnual > 0 ? fmt(h.dividendAnnual, ccy) : '—'}
              </Text>
              <Text style={{ ...styles.td, width: '9%', textAlign: 'right', color: h.dividendAnnual > 0 ? C.up : C.textTer }}>
                {h.marketValue > 0 && h.dividendAnnual > 0 ? `${(h.dividendAnnual / h.marketValue * 100).toFixed(2)}%` : '—'}
              </Text>
            </View>
          ))}
          {/* Total row */}
          <View style={{ flexDirection: 'row', backgroundColor: C.panel, paddingVertical: 7, paddingHorizontal: 6, borderTopWidth: 1.5, borderTopColor: C.navy, borderTopStyle: 'solid' as const }}>
            <Text style={{ ...styles.tdBold, width: '22%' }}>Total ({data.portfolio.holdings.length} positions)</Text>
            <Text style={{ ...styles.td, width: '5%' }}></Text>
            <Text style={{ ...styles.td, width: '9%' }}></Text>
            <Text style={{ ...styles.tdBold, width: '11%', textAlign: 'right' }}>{fmtFull(data.portfolio.totalValue, ccy)}</Text>
            <Text style={{ ...styles.td, width: '6%', textAlign: 'right' }}>100%</Text>
            <Text style={{ ...styles.td, width: '7%' }}></Text>
            <Text style={{ ...styles.td, width: '22%' }}></Text>
            {(() => {
              const totalDiv = data.portfolio.holdings.reduce((s, h) => s + h.dividendAnnual, 0);
              const totalYield = data.portfolio.totalValue > 0 ? (totalDiv / data.portfolio.totalValue) * 100 : 0;
              return (
                <>
                  <Text style={{ ...styles.tdBold, width: '9%', textAlign: 'right', color: C.up }}>
                    {totalDiv > 0 ? fmt(totalDiv, ccy) : '—'}
                  </Text>
                  <Text style={{ ...styles.tdBold, width: '9%', textAlign: 'right', color: C.up }}>
                    {totalYield > 0 ? `${totalYield.toFixed(2)}%` : '—'}
                  </Text>
                </>
              );
            })()}
          </View>
        </View>

        {/* Summary indicators */}
        {(() => {
          const totalDiv = data.portfolio.holdings.reduce((s, h) => s + h.dividendAnnual, 0);
          const divYield = data.portfolio.totalValue > 0 ? (totalDiv / data.portfolio.totalValue) * 100 : 0;
          const uniqueSectors = new Set(data.portfolio.holdings.map(h => h.sectorDisplay).filter(Boolean)).size;
          const etfCount = data.portfolio.holdings.filter(h => h.assetClass === 'FIXED_INCOME' || h.symbol.includes('.')).length;
          return (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              {totalDiv > 0 && (
                <View style={{ ...styles.statCard }}>
                  <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600 }}>Revenu de dividendes</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.up }}>
                    {fmt(totalDiv, ccy)} / an
                  </Text>
                  {divYield > 0 && <Text style={{ fontSize: 7, color: C.textTer }}>Rendement: {divYield.toFixed(2)}%</Text>}
                </View>
              )}
              <View style={{ ...styles.statCard }}>
                <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600 }}>Diversification</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
                  {uniqueSectors} secteurs
                </Text>
                <Text style={{ fontSize: 7, color: C.textTer }}>{data.portfolio.holdings.length} positions</Text>
              </View>
              <View style={{ ...styles.statCard }}>
                <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600 }}>Beta pondere</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
                  {data.riskMetrics.beta.toFixed(2)}
                </Text>
                <Text style={{ fontSize: 7, color: C.textTer }}>Sensibilite au marche</Text>
              </View>
            </View>
          );
        })()}

        <PageFooter num={3} total={totalPages} />
      </Page>


      {/* ═══ PAGE 4: ANALYST PRICE TARGETS ════════════════════════ */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Cours cibles des analystes</Text>
        <Text style={{ fontSize: 8, color: C.textSec, marginBottom: 10 }}>
          Estimations consensus — Source: Yahoo Finance / Financial Modeling Prep
        </Text>

        {hasTargets ? (
          <>
            {/* Summary row */}
            <View style={{
              flexDirection: 'row', backgroundColor: C.panel, paddingVertical: 8, paddingHorizontal: 6,
              borderRadius: 6, marginBottom: 8,
            }}>
              <Text style={{ ...styles.tdBold, width: '7%' }}></Text>
              <Text style={{ ...styles.tdBold, width: '15%', fontSize: 9 }}>TOTAL</Text>
              <Text style={{ ...styles.td, width: '8%' }}></Text>
              <Text style={{ ...styles.td, width: '10%' }}></Text>
              <Text style={{ ...styles.td, width: '10%' }}></Text>
              <Text style={{ ...styles.tdBold, width: '14%', textAlign: 'right', fontSize: 9 }}>{fmt(data.priceTargetSummary.totalCurrentValue, ccy)}</Text>
              <Text style={{ ...styles.tdBold, width: '14%', textAlign: 'right', fontSize: 9 }}>{fmt(data.priceTargetSummary.totalTargetValue, ccy)}</Text>
              <Text style={{
                ...styles.tdBold, width: '12%', textAlign: 'right', fontSize: 9,
                color: data.priceTargetSummary.totalEstimatedGainDollar >= 0 ? C.up : C.down,
              }}>
                {fmt(data.priceTargetSummary.totalEstimatedGainDollar, ccy)}
              </Text>
              <Text style={{
                ...styles.tdBold, width: '10%', textAlign: 'right', fontSize: 9,
                color: data.priceTargetSummary.totalEstimatedGainPercent >= 0 ? C.up : C.down,
              }}>
                {fmtPct(data.priceTargetSummary.totalEstimatedGainPercent)}
              </Text>
            </View>

            {/* Table */}
            <View style={styles.table}>
              <View style={styles.th}>
                <Text style={{ ...styles.thCell, width: '7%' }}>Qte</Text>
                <Text style={{ ...styles.thCell, width: '15%' }}>Description</Text>
                <Text style={{ ...styles.thCell, width: '8%' }}>Symb.</Text>
                <Text style={{ ...styles.thCell, width: '10%', textAlign: 'right' }}>Prix</Text>
                <Text style={{ ...styles.thCell, width: '10%', textAlign: 'right' }}>Cible</Text>
                <Text style={{ ...styles.thCell, width: '14%', textAlign: 'right' }}>Valeur act.</Text>
                <Text style={{ ...styles.thCell, width: '14%', textAlign: 'right' }}>Val. cible 12m</Text>
                <Text style={{ ...styles.thCell, width: '12%', textAlign: 'right' }}>Gain esp. $</Text>
                <Text style={{ ...styles.thCell, width: '10%', textAlign: 'right' }}>Var. %</Text>
              </View>
              {data.holdingProfiles.map((hp: HoldingProfile, i: number) => (
                <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                  <Text style={{ ...styles.td, width: '7%' }}>{fmtNum(hp.quantity)}</Text>
                  <Text style={{ ...styles.td, width: '15%' }}>{hp.companyName.substring(0, 24)}</Text>
                  <Text style={{ ...styles.tdBold, width: '8%' }}>{hp.symbol}</Text>
                  <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>{fmtFull(hp.currentPrice, ccy)}</Text>
                  <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>
                    {hp.targetPrice > 0 ? fmtFull(hp.targetPrice, ccy) : 'N/D'}
                  </Text>
                  <Text style={{ ...styles.td, width: '14%', textAlign: 'right' }}>{fmt(hp.currentPrice * hp.quantity, ccy)}</Text>
                  <Text style={{ ...styles.td, width: '14%', textAlign: 'right' }}>
                    {hp.targetPrice > 0 ? fmt(hp.quantity * hp.targetPrice, ccy) : 'N/D'}
                  </Text>
                  <Text style={{
                    ...styles.td, width: '12%', textAlign: 'right', fontFamily: 'Open Sans', fontWeight: 600,
                    color: hp.estimatedGainDollar >= 0 ? C.up : C.down,
                  }}>
                    {hp.targetPrice > 0 ? fmt(hp.estimatedGainDollar, ccy) : '—'}
                  </Text>
                  <Text style={{
                    ...styles.td, width: '10%', textAlign: 'right', fontFamily: 'Open Sans', fontWeight: 600,
                    color: hp.estimatedGainPercent >= 0 ? C.up : C.down,
                  }}>
                    {hp.targetPrice > 0 ? fmtPct(hp.estimatedGainPercent) : '—'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Summary indicators */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <View style={{ ...styles.statCard }}>
                <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600 }}>Couverture analystes</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
                  {coveredCount}/{data.holdingProfiles.length} titres
                </Text>
                {totalAnalysts > 0 && <Text style={{ fontSize: 7, color: C.textTer }}>{totalAnalysts} analystes</Text>}
              </View>
              {estimatedDividend > 0 && (
                <View style={{ ...styles.statCard }}>
                  <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600 }}>Revenu de dividende</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.up }}>
                    {fmt(estimatedDividend, ccy)} / an
                  </Text>
                </View>
              )}
              {weightedBeta > 0 && (
                <View style={{ ...styles.statCard }}>
                  <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600 }}>Beta pondere</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
                    {weightedBeta.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={{ fontSize: 10, color: C.textSec }}>
              Les cours cibles des analystes ne sont pas disponibles pour les titres de ce portefeuille.
            </Text>
          </View>
        )}

        <Text style={styles.noteText}>
          Les cours cibles sont des estimations consensus et ne constituent pas une garantie de rendement futur.
        </Text>
        <AINarrativeBlock label="Analyse des cours cibles — IA" content={ai?.targetAnalysis} />

        <PageFooter num={4} total={totalPages} />
      </Page>


      {/* ═══ PAGE 5 (conditional): VALUATION ══════════════════════ */}
      {hasValuation && valData && (() => {
        const holdingMap = new Map(data.portfolio.holdings.map((h) => [h.symbol, h]));
        const totalPortfolioValue = data.portfolio.totalValue;
        const totalAllocated = valData.reduce((sum, v) => {
          const h = holdingMap.get(v.symbol);
          return sum + (h ? h.marketValue : 0);
        }, 0);
        // Totals only for stocks with valid DCF (exclude negative DCF + N/D)
        const totalAllocatedValid = valData.reduce((sum, v) => {
          const h = holdingMap.get(v.symbol);
          if (!h || v.priceDcf < 0 || (v.priceDcf === 0 && v.priceSales === 0 && v.priceEarnings === 0)) return sum;
          return sum + h.marketValue;
        }, 0);
        const totalIntrinsic = valData.reduce((sum, v) => {
          const h = holdingMap.get(v.symbol);
          if (!h || v.avgIntrinsic === 0 || v.priceDcf < 0) return sum;
          return sum + h.quantity * v.avgIntrinsic;
        }, 0);

        return (
          <Page size="LETTER" orientation="landscape" style={styles.page}>
            <AccentBar />
            <Text style={styles.sectionTitle}>Valorisation intrinseque — Valuation Master Pro</Text>
            <Text style={{ fontSize: 8, color: C.textSec, marginBottom: 8 }}>
              Analyse multi-methodes: DCF, P/S et P/E — Valeurs ponderees par l&apos;allocation du portefeuille
            </Text>

            {/* Main valuation table */}
            <View style={styles.table}>
              <View style={styles.th}>
                <Text style={{ ...styles.thCell, width: '8%' }}>Symb.</Text>
                <Text style={{ ...styles.thCell, width: '7%', textAlign: 'right' }}>Poids</Text>
                <Text style={{ ...styles.thCell, width: '10%', textAlign: 'right' }}>Alloc. $</Text>
                <Text style={{ ...styles.thCell, width: '9%', textAlign: 'right' }}>Prix</Text>
                <Text style={{ ...styles.thCell, width: '9%', textAlign: 'right' }}>DCF</Text>
                <Text style={{ ...styles.thCell, width: '9%', textAlign: 'right' }}>P/S</Text>
                <Text style={{ ...styles.thCell, width: '9%', textAlign: 'right' }}>P/E</Text>
                <Text style={{ ...styles.thCell, width: '9%', textAlign: 'right' }}>Moy.</Text>
                <Text style={{ ...styles.thCell, width: '10%', textAlign: 'right' }}>Val. intr. $</Text>
                <Text style={{ ...styles.thCell, width: '8%', textAlign: 'right' }}>Ecart</Text>
                <Text style={{ ...styles.thCell, width: '12%', textAlign: 'center' }}>Signal</Text>
              </View>
              {valData.map((v: ValuationDataItem, i: number) => {
                const h = holdingMap.get(v.symbol);
                const weight = h?.weight || 0;
                const allocatedValue = h?.marketValue || 0;
                const qty = h?.quantity || 0;
                const noData = v.priceDcf === 0 && v.priceSales === 0 && v.priceEarnings === 0;
                const negDcf = v.priceDcf < 0;
                const intrinsicTotal = (!negDcf && v.avgIntrinsic !== 0) ? qty * v.avgIntrinsic : 0;
                return (
                  <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                    <Text style={{ ...styles.tdBold, width: '8%' }}>{v.symbol}</Text>
                    <Text style={{ ...styles.td, width: '7%', textAlign: 'right' }}>{weight.toFixed(1)}%</Text>
                    <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>{fmt(allocatedValue, ccy)}</Text>
                    <Text style={{ ...styles.td, width: '9%', textAlign: 'right' }}>{fmtFull(v.currentPrice, ccy)}</Text>
                    <Text style={{ ...styles.td, width: '9%', textAlign: 'right', color: negDcf ? C.down : C.text }}>
                      {negDcf ? 'Neg. *' : v.priceDcf !== 0 ? fmtFull(v.priceDcf, ccy) : 'N/D'}
                    </Text>
                    <Text style={{ ...styles.td, width: '9%', textAlign: 'right' }}>{v.priceSales > 0 ? fmtFull(v.priceSales, ccy) : 'N/D'}</Text>
                    <Text style={{ ...styles.td, width: '9%', textAlign: 'right' }}>{v.priceEarnings > 0 ? fmtFull(v.priceEarnings, ccy) : 'N/D'}</Text>
                    {negDcf ? (
                      <>
                        <Text style={{ ...styles.tdBold, width: '9%', textAlign: 'right', color: '#b45309', fontSize: 7 }}>—</Text>
                        <Text style={{ ...styles.tdBold, width: '10%', textAlign: 'right', color: '#b45309', fontSize: 7 }}>DCF negatif *</Text>
                        <Text style={{ ...styles.td, width: '8%', textAlign: 'right' }}>—</Text>
                        <View style={{ width: '12%', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 6.5, color: '#b45309' }}>Voir note *</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={{ ...styles.tdBold, width: '9%', textAlign: 'right', color: noData ? C.textTer : C.text }}>
                          {noData ? 'N/D' : fmtFull(v.avgIntrinsic, ccy)}
                        </Text>
                        <Text style={{
                          ...styles.tdBold, width: '10%', textAlign: 'right',
                          color: noData ? C.textTer : intrinsicTotal > allocatedValue * 1.05 ? C.up : intrinsicTotal < allocatedValue * 0.95 ? C.down : C.text,
                        }}>
                          {noData ? 'N/D' : fmt(intrinsicTotal, ccy)}
                        </Text>
                        <Text style={{
                          ...styles.td, width: '8%', textAlign: 'right', fontFamily: 'Open Sans', fontWeight: 600, fontSize: 7,
                          color: noData ? C.textTer : v.upsidePercent > 10 ? C.up : v.upsidePercent < -10 ? C.down : '#854d0e',
                        }}>
                          {noData ? '—' : fmtPct(v.upsidePercent)}
                        </Text>
                        <View style={{ width: '12%', alignItems: 'center', justifyContent: 'center' }}>
                          {noData ? (
                            <Text style={{ fontSize: 6.5, color: C.textTer }}>N/D</Text>
                          ) : (
                            <ValuationBadge upside={v.upsidePercent} />
                          )}
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
              {/* Total — only stocks with valid DCF (excludes negative DCF + N/D) */}
              <View style={{ flexDirection: 'row', backgroundColor: C.panel, paddingVertical: 6, paddingHorizontal: 6, borderTopWidth: 1.5, borderTopColor: C.navy, borderTopStyle: 'solid' as const }}>
                <Text style={{ ...styles.tdBold, width: '8%', fontSize: 8 }}>TOTAL</Text>
                <Text style={{ ...styles.tdBold, width: '7%', textAlign: 'right', fontSize: 8 }}>
                  {totalPortfolioValue > 0 ? `${((totalAllocated / totalPortfolioValue) * 100).toFixed(0)}%` : ''}
                </Text>
                <Text style={{ ...styles.tdBold, width: '10%', textAlign: 'right', fontSize: 8 }}>{fmt(totalAllocated, ccy)}</Text>
                <Text style={{ ...styles.td, width: '45%' }}></Text>
                <Text style={{
                  ...styles.tdBold, width: '10%', textAlign: 'right', fontSize: 8,
                  color: totalIntrinsic > totalAllocatedValid * 1.05 ? C.up : totalIntrinsic < totalAllocatedValid * 0.95 ? C.down : C.text,
                }}>
                  {totalIntrinsic !== 0 ? fmt(totalIntrinsic, ccy) : ''}
                </Text>
                <Text style={{
                  ...styles.tdBold, width: '20%', textAlign: 'right', fontSize: 8,
                  color: totalIntrinsic > totalAllocatedValid * 1.05 ? C.up : totalIntrinsic < totalAllocatedValid * 0.95 ? C.down : C.text,
                }}>
                  {totalAllocatedValid > 0 && totalIntrinsic !== 0 ? fmtPct(((totalIntrinsic - totalAllocatedValid) / totalAllocatedValid) * 100) : ''}
                </Text>
              </View>
            </View>

            {/* Note for negative DCF — prominently placed under main table */}
            {hasNegativeValuations && (
              <View style={{
                backgroundColor: '#fffbeb', borderRadius: 8, padding: 12, marginTop: 8, marginBottom: 4,
                borderWidth: 1.5, borderColor: '#f59e0b', borderStyle: 'solid' as const,
              }}>
                <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                  * Note — Valeurs intrinseques negatives
                </Text>
                <Text style={{ fontSize: 7.5, color: '#78350f', lineHeight: 1.6 }}>
                  Une valeur intrinseque negative (DCF) indique que l&apos;entreprise genere actuellement des flux de tresorerie
                  negatifs (free cash flow negatif), ce qui est frequemment le cas pour les entreprises en forte croissance
                  qui ne sont pas encore rentables. Le modele DCF evalue la rentabilite actuelle et ne prend pas en
                  compte le potentiel de croissance future. Pour ces titres, d&apos;autres methodes de valorisation
                  (P/S, comparables) peuvent etre plus appropriees.
                </Text>
              </View>
            )}

            {/* Note for N/D entries (ETFs, etc.) */}
            {valData.some((v) => v.priceDcf === 0 && v.priceSales === 0 && v.priceEarnings === 0) && (
              <View style={{
                backgroundColor: '#f0f9ff', borderRadius: 8, padding: 10, marginBottom: 4,
                borderWidth: 1, borderColor: '#bae6fd', borderStyle: 'solid' as const,
                borderLeftWidth: 3, borderLeftColor: C.cyan, borderLeftStyle: 'solid' as const,
              }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, marginBottom: 3 }}>
                  Note — Titres sans valorisation (N/D)
                </Text>
                <Text style={{ fontSize: 7, color: C.text, lineHeight: 1.5 }}>
                  Les FNB (fonds negocies en bourse) et certains titres ne disposent pas de donnees financieres
                  individuelles (revenus, benefices, flux de tresorerie) necessaires aux modeles de valorisation.
                  Leur valeur est determinee par les actifs sous-jacents qu&apos;ils detiennent.
                </Text>
              </View>
            )}

            <Text style={styles.noteText}>
              Les valorisations sont des estimations basees sur des modeles financiers. Elles ne constituent pas des recommandations d&apos;investissement.
            </Text>

            <PageFooter num={5} total={totalPages} />
          </Page>
        );
      })()}

      {/* ═══ PAGE 6: DCF INVERSE (seul) ══════════════════════════════ */}
      {hasValuation && valData && (
        <Page size="LETTER" orientation="landscape" style={styles.page}>
          <AccentBar />
          <Text style={styles.sectionTitle}>DCF inverse — Croissance implicite du marche</Text>
          <Text style={{ fontSize: 8, color: C.textSec, marginBottom: 8 }}>
            Taux de croissance du FCF que le marche anticipe implicitement au prix actuel
          </Text>

          <View style={styles.table}>
            <View style={styles.th}>
              <Text style={{ ...styles.thCell, width: '20%' }}>Symbole</Text>
              <Text style={{ ...styles.thCell, width: '30%' }}>Nom</Text>
              <Text style={{ ...styles.thCell, width: '25%', textAlign: 'right' }}>Croissance impl.</Text>
              <Text style={{ ...styles.thCell, width: '25%', textAlign: 'right' }}>Interpretation</Text>
            </View>
            {valData.map((v: ValuationDataItem, i: number) => {
              const noData = v.priceDcf === 0 && v.priceSales === 0 && v.priceEarnings === 0;
              return (
                <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                  <Text style={{ ...styles.tdBold, width: '20%' }}>{v.symbol}</Text>
                  <Text style={{ ...styles.td, width: '30%' }}>{v.name.substring(0, 28)}</Text>
                  <Text style={{ ...styles.tdBold, width: '25%', textAlign: 'right' }}>
                    {noData ? 'N/D' : v.reverseDcfGrowth !== 0 ? `${(v.reverseDcfGrowth * 100).toFixed(1)}%` : 'N/D'}
                  </Text>
                  <Text style={{ ...styles.td, width: '25%', textAlign: 'right', fontSize: 8, color: noData ? C.textTer : v.priceDcf < 0 ? C.down : C.text }}>
                    {noData ? 'FNB / N/D' : v.reverseDcfGrowth > 0.15 ? 'Optimiste' : v.reverseDcfGrowth > 0.05 ? 'Raisonnable' : v.reverseDcfGrowth > 0 ? 'Conservateur' : v.priceDcf < 0 ? 'FCF negatif' : 'N/D'}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.noteText}>
            Le DCF inverse calcule le taux de croissance du FCF implicitement anticipe par le marche au prix actuel du titre.
          </Text>

          <PageFooter num={6} total={totalPages} />
        </Page>
      )}

      {/* ═══ PAGE 7: SCORES + SENSIBILITE + IA ═══════════════════════ */}
      {hasValuation && valData && (
        <Page size="LETTER" orientation="landscape" style={styles.page}>
          <AccentBar />
          <Text style={styles.sectionTitle}>Tableau de bord — Scores (0-10)</Text>
          <Text style={{ fontSize: 8, color: C.textSec, marginBottom: 8 }}>
            Evaluation multi-criteres: sante financiere, croissance et valorisation
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {valData.slice(0, 6).map((v: ValuationDataItem, i: number) => (
              <View key={i} style={{
                width: '31%', backgroundColor: C.card, borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
              }}>
                <Text style={{ fontSize: 9, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, marginBottom: 4 }}>
                  {v.symbol} — {v.scores.overall.toFixed(1)}/10
                </Text>
                <ScoreBar label="Sante" score={v.scores.health} />
                <ScoreBar label="Croissance" score={v.scores.growth} />
                <ScoreBar label="Valorisation" score={v.scores.valuation} />
              </View>
            ))}
          </View>

          {/* Sensitivity matrices */}
          {(() => {
            const validMatrices = valData.filter((v: ValuationDataItem) =>
              v.sensitivityMatrix && v.priceDcf > 0
            );
            if (validMatrices.length === 0) return null;
            return (
              <>
                <Text style={styles.subsectionTitle}>Matrices de sensibilite (top positions)</Text>
                {validMatrices.map((v: ValuationDataItem, i: number) => (
                  <SensitivityMatrix key={i} matrix={v.sensitivityMatrix!} symbol={v.symbol} currentPrice={v.currentPrice} />
                ))}
              </>
            );
          })()}

          <AINarrativeBlock label="Commentaire de valorisation — IA" content={ai?.valuationComment} />

          <PageFooter num={7} total={totalPages} />
        </Page>
      )}


      {/* ═══ COMPANY PROFILES — 4 per page, dynamic pagination ═══ */}
      {Array.from({ length: profilePageCount }, (_, pi) => {
        const chunk = data.holdingProfiles.slice(pi * 4, pi * 4 + 4).map((hp) => ({
          ...hp,
          description: ai?.holdingDescriptions?.[hp.symbol] || hp.description,
        }));
        return (
          <Page key={`profiles-${pi}`} size="LETTER" orientation="landscape" style={styles.page}>
            <AccentBar />
            <Text style={styles.sectionTitle}>
              {pi === 0 ? 'Fiches descriptives des titres' : 'Fiches descriptives (suite)'}
            </Text>
            {pi === 0 && (
              <Text style={{ fontSize: 8, color: C.textSec, marginBottom: 12 }}>
                {hasAI ? 'Descriptions en francais — Analyse IA + Financial Modeling Prep' : 'Profils detailles — Source: Yahoo Finance'}
              </Text>
            )}
            <HoldingCards profiles={chunk} currency={ccy} />
            <PageFooter num={5 + valOffset + pi} total={totalPages} />
          </Page>
        );
      })}


      {/* ═══ PAGE 7+offset: SCENARIOS & RISK DASHBOARD ════════════ */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Scenarios & Risque</Text>

        {/* Risk metric cards with explanations */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <RiskCard
            label="Volatilite"
            value={`${data.riskMetrics.volatility.toFixed(1)}%`}
            desc="Mesure l'amplitude des variations du portefeuille. Plus elle est elevee, plus les rendements fluctuent."
          />
          <RiskCard
            label="Ratio Sharpe"
            value={data.riskMetrics.sharpe.toFixed(2)}
            desc={`Rendement obtenu par unite de risque. Au-dessus de 1.0 = excellent, sous 0.5 = faible compensation du risque pris.`}
          />
          <RiskCard
            label="Drawdown max"
            value={`-${data.riskMetrics.maxDrawdown.toFixed(1)}%`}
            color={C.down}
            desc="Perte maximale estimee entre un sommet et un creux. Represente le pire scenario historique probable."
          />
          <RiskCard
            label="Beta"
            value={data.riskMetrics.beta.toFixed(2)}
            desc={`Sensibilite au marche. Beta de 1.0 = suit le marche. Sous 1.0 = moins volatile, au-dessus = plus reactif.`}
          />
        </View>

        {/* Scenario cards — mapped by name for correct colors */}
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
          {data.scenarios.map((s) => {
            const variant: 'bear' | 'base' | 'bull' =
              ('type' in s && (s as { type: string }).type) ? (s as { type: 'bear' | 'base' | 'bull' }).type :
              s.name.toLowerCase().includes('pessim') ? 'bear' :
              s.name.toLowerCase().includes('optim') ? 'bull' : 'base';
            return (
              <ScenarioCard
                key={s.name}
                name={s.name}
                value={s.projectedValue}
                returnPct={s.annualizedReturn}
                totalValue={data.portfolio.totalValue}
                ccy={ccy}
                variant={variant}
              />
            );
          })}
        </View>

        {/* Projection Area Chart */}
        <Text style={styles.subsectionTitle}>Projection — {data.config.projectionYears} ans</Text>
        <ProjectionChart projections={data.projectionYears} totalValue={data.portfolio.totalValue} ccy={ccy} />

        {/* Stress Tests */}
        <Text style={styles.subsectionTitle}>Tests de resistance</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {data.stressTests.map((st, i) => (
            <View key={i} style={{
              width: '31%', backgroundColor: C.downBg, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: C.downBorder, borderStyle: 'solid' as const,
            }}>
              <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, marginBottom: 4 }}>{st.name}</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: C.down }}>{fmt(st.impactedValue, ccy)}</Text>
              <Text style={{ fontSize: 8, color: C.down, marginTop: 2 }}>-{fmt(Math.abs(st.loss), ccy)} ({st.lossPercent.toFixed(1)}%)</Text>
            </View>
          ))}
        </View>

        {data.riskMetrics.estimated && (
          <Text style={styles.noteText}>
            Les metriques de risque sont estimees a partir des caracteristiques de classe d&apos;actif.
          </Text>
        )}
        <AINarrativeBlock label="Interpretation des risques — IA" content={ai?.riskInterpretation} />

        <PageFooter num={5 + valOffset + profilePageCount} total={totalPages} />
      </Page>


      {/* ═══ PAGE 8+offset: DISCLAIMERS ═══════════════════════════ */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Avertissements importants</Text>

        <View style={{ flexDirection: 'row', gap: 20 }}>
          {/* Column 1 */}
          <View style={{ flex: 1 }}>
            <Text style={styles.disclaimer}>
              1. NATURE DU DOCUMENT{'\n'}
              Ce rapport est fourni a titre informatif seulement et ne constitue pas un conseil financier personnalise,
              une recommandation d&apos;investissement, ou une offre de vente ou de sollicitation d&apos;achat de titres.{'\n'}
              {'\n'}
              2. RENDEMENTS ET PROJECTIONS{'\n'}
              Les rendements passes ne sont pas garants des rendements futurs. Les projections, scenarios et estimations
              presentes sont bases sur des hypotheses qui pourraient ne pas se realiser.{'\n'}
              {'\n'}
              3. DONNEES DE MARCHE{'\n'}
              Les prix et donnees de marche proviennent de Financial Modeling Prep (FMP)
              et sont consideres fiables mais leur exactitude ne peut etre garantie.{'\n'}
              {'\n'}
              4. COURS CIBLES DES ANALYSTES{'\n'}
              Les cours cibles sont des estimations consensus des analystes financiers
              compilees par Yahoo Finance et FMP. Ils ne constituent pas une garantie de rendement futur.{'\n'}
              {'\n'}
              5. METRIQUES DE RISQUE{'\n'}
              Les metriques de risque (volatilite, Sharpe, beta, drawdown) sont des estimations basees sur les
              caracteristiques historiques des classes d&apos;actif.
            </Text>
          </View>

          {/* Column 2 */}
          <View style={{ flex: 1 }}>
            <Text style={styles.disclaimer}>
              6. TESTS DE RESISTANCE{'\n'}
              Les stress tests simulent l&apos;impact de crises historiques passees et ne prevoient pas les crises futures.{'\n'}
              {'\n'}
              7. DECISIONS D&apos;INVESTISSEMENT{'\n'}
              Toute decision d&apos;investissement doit etre prise en consultation avec votre conseiller financier,
              en tenant compte de votre situation personnelle.{'\n'}
              {'\n'}
              8. CONFIDENTIALITE{'\n'}
              Ce rapport est confidentiel et destine uniquement au client nomme en page de couverture.{'\n'}
              {'\n'}
              9. SOURCES DES DONNEES{'\n'}
              Prix de marche: Financial Modeling Prep (FMP){'\n'}
              Cours cibles: Yahoo Finance / FMP{'\n'}
              Profils d&apos;entreprise: FMP Company Profile{'\n'}
              {hasValuation ? 'Valorisation: Valuation Master Pro (DCF, P/S, P/E)\n' : ''}
              {'\n'}
              10. REGLEMENTATION{'\n'}
              Groupe Financier Ste-Foy est reglemente par l&apos;AMF du Quebec.
              {hasAI ? `${'\n'}${'\n'}11. CONTENU IA${'\n'}Certaines sections (« Analyse IA ») ont ete generees par un modele de langage (Groq / Llama). Ce contenu est fourni a titre informatif et ne constitue pas un avis professionnel.` : ''}
            </Text>
          </View>
        </View>

        {data.portfolio.modelSource && (
          <View style={{ ...styles.card, marginTop: 12 }}>
            <Text style={{ fontSize: 8, color: C.textSec }}>
              Ce portefeuille a ete cree a partir du modele «{data.portfolio.modelSource}».
            </Text>
          </View>
        )}

        <View style={{ marginTop: 'auto', paddingTop: 16 }}>
          <Text style={{ fontSize: 8, color: C.textTer, textAlign: 'center' }}>
            Rapport genere le {data.generatedAt} par le systeme Planificateur de Rencontre
          </Text>
          <Text style={{ fontSize: 8, color: C.textTer, textAlign: 'center', marginTop: 3 }}>
            Groupe Financier Ste-Foy — Tous droits reserves
          </Text>
        </View>

        <PageFooter num={6 + valOffset + profilePageCount} total={totalPages} />
      </Page>

    </Document>
  );
}


// ═══════════════════════════════════════════════════════════════════
// ██ LEGACY REPORT (backward compat — simplified)                 ██
// ═══════════════════════════════════════════════════════════════════

export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      {/* Cover */}
      <Page size="LETTER" orientation="landscape" style={{ fontFamily: 'Open Sans', padding: 0, backgroundColor: C.white }}>
        <AccentBar />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, paddingTop: 24 }}>
          <Image src={LOGO_PATH} style={{ width: 200, height: 42 }} />
          <Text style={{ fontSize: 8, color: C.textTer }}>{data.generatedAt}</Text>
        </View>
        <View style={{ alignItems: 'center', paddingTop: 30, paddingBottom: 20 }}>
          <Text style={{ fontSize: 32, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, letterSpacing: -1, marginBottom: 12 }}>
            Rapport de portefeuille
          </Text>
          <View style={{
            borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8,
            backgroundColor: C.goldPale, borderWidth: 1, borderColor: C.gold, borderStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{data.portfolio.name}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 40, marginBottom: 16 }}>
          <View style={{
            flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
            borderBottomWidth: 3, borderBottomColor: C.navy, borderBottomStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 6, fontFamily: 'Open Sans', fontWeight: 600 }}>Prepare pour</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{data.client.name}</Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
            borderBottomWidth: 3, borderBottomColor: C.gold, borderBottomStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 6, fontFamily: 'Open Sans', fontWeight: 600 }}>Conseiller</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{data.advisor.name}</Text>
            {data.advisor.title && <Text style={{ fontSize: 8, color: C.textTer, marginTop: 2 }}>{data.advisor.title}</Text>}
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Groupe Financier Ste-Foy — Confidentiel</Text>
          <Text style={styles.footerText}>1 / 5</Text>
        </View>
      </Page>

      {/* Summary */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Resume executif</Text>
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
          <KPICard label="Valeur totale" value={fmtFull(data.portfolio.totalValue, data.portfolio.currency)} accent={C.navy} />
          <KPICard label="Positions" value={String(data.portfolio.holdings.length)} accent={C.cyan} />
          <KPICard label="Type de compte" value={data.portfolio.accountType} accent={C.gold} />
        </View>
        <Text style={styles.sectionTitle}>Profil du client</Text>
        <View style={styles.statsRow}>
          {[
            { label: 'Type', value: data.client.type },
            { label: 'Risque', value: data.client.riskProfile },
            { label: 'Horizon', value: data.client.horizon || 'N/D' },
          ].map((item, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600, marginBottom: 3 }}>{item.label}</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{item.value}</Text>
            </View>
          ))}
        </View>
        {data.client.objectives && (
          <View style={styles.card}>
            <Text style={{ fontSize: 7, color: C.textTer, fontFamily: 'Open Sans', fontWeight: 600, marginBottom: 3 }}>Objectifs</Text>
            <Text style={{ fontSize: 9, color: C.text }}>{data.client.objectives}</Text>
          </View>
        )}
        <PageFooter num={2} total={5} />
      </Page>

      {/* Holdings */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Composition du portefeuille</Text>
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={{ ...styles.thCell, width: '10%' }}>Symbole</Text>
            <Text style={{ ...styles.thCell, width: '25%' }}>Nom</Text>
            <Text style={{ ...styles.thCell, width: '10%', textAlign: 'right' }}>Qte</Text>
            <Text style={{ ...styles.thCell, width: '15%', textAlign: 'right' }}>Cout moy.</Text>
            <Text style={{ ...styles.thCell, width: '15%', textAlign: 'right' }}>Prix actuel</Text>
            <Text style={{ ...styles.thCell, width: '15%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.thCell, width: '10%', textAlign: 'right' }}>Poids</Text>
          </View>
          {data.portfolio.holdings.map((h, i) => (
            <View key={i} style={i % 2 === 1 ? styles.trAlt : styles.tr}>
              <Text style={{ ...styles.tdBold, width: '10%' }}>{h.symbol}</Text>
              <Text style={{ ...styles.td, width: '25%' }}>{h.name.substring(0, 28)}</Text>
              <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>{h.quantity}</Text>
              <Text style={{ ...styles.td, width: '15%', textAlign: 'right' }}>{fmtFull(h.avgCost, data.portfolio.currency)}</Text>
              <Text style={{ ...styles.td, width: '15%', textAlign: 'right' }}>{fmtFull(h.currentPrice, data.portfolio.currency)}</Text>
              <Text style={{ ...styles.tdBold, width: '15%', textAlign: 'right' }}>{fmtFull(h.marketValue, data.portfolio.currency)}</Text>
              <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>{h.weight.toFixed(1)}%</Text>
            </View>
          ))}
        </View>
        <PageFooter num={3} total={5} />
      </Page>

      {/* Risk & Scenarios */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Risque & Scenarios</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <RiskCard label="Volatilite" value={`${data.riskMetrics.volatility.toFixed(1)}%`} desc="Amplitude des variations du portefeuille." />
          <RiskCard label="Sharpe" value={data.riskMetrics.sharpe.toFixed(2)} desc="Rendement par unite de risque." />
          <RiskCard label="Drawdown max" value={`-${data.riskMetrics.maxDrawdown.toFixed(1)}%`} color={C.down} desc="Perte maximale estimee sommet-a-creux." />
          <RiskCard label="Beta" value={data.riskMetrics.beta.toFixed(2)} desc="Sensibilite aux mouvements du marche." />
        </View>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {data.scenarios.map((s) => {
            const variant: 'bear' | 'base' | 'bull' =
              ('type' in s && (s as { type: string }).type) ? (s as { type: 'bear' | 'base' | 'bull' }).type :
              s.name.toLowerCase().includes('pessim') ? 'bear' :
              s.name.toLowerCase().includes('optim') ? 'bull' : 'base';
            return (
              <ScenarioCard
                key={s.name}
                name={s.name}
                value={s.projectedValue}
                returnPct={s.annualizedReturn}
                totalValue={data.portfolio.totalValue}
                ccy={data.portfolio.currency}
                variant={variant}
              />
            );
          })}
        </View>
        <PageFooter num={4} total={5} />
      </Page>

      {/* Disclaimers */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <AccentBar />
        <Text style={styles.sectionTitle}>Avertissements</Text>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.disclaimer}>
              Ce rapport est fourni a titre informatif seulement et ne constitue pas un conseil financier.
              Les rendements passes ne sont pas garants des rendements futurs. Toute decision d&apos;investissement
              doit etre prise en consultation avec votre conseiller financier. Ce rapport est confidentiel.
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 'auto', paddingTop: 16 }}>
          <Text style={{ fontSize: 8, color: C.textTer, textAlign: 'center' }}>
            Rapport genere le {data.generatedAt} — Groupe Financier Ste-Foy
          </Text>
        </View>
        <PageFooter num={5} total={5} />
      </Page>
    </Document>
  );
}

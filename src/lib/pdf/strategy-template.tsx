import React from 'react';
import path from 'path';
import {
  Document, Page, Text, View, Image, Font,
  Svg, Defs, LinearGradient, Stop, Rect, Line,
  Circle, Polyline, G, Path,
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
type D = any;

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

const CUR_COLORS: Record<string, string> = {
  'CAD': '#FF4B4B', 'USD': '#1CB0F6', 'EUR': '#CE82FF', 'GBP': '#58CC02',
};

const STYLE_LABELS: Record<string, string> = {
  'large-value': 'GV', 'large-blend': 'GM', 'large-growth': 'GC',
  'mid-value': 'MV', 'mid-blend': 'MM', 'mid-growth': 'MC',
  'small-value': 'PV', 'small-blend': 'PM', 'small-growth': 'PC',
};

const RISK_COLORS: Record<string, string> = {
  'Conservateur': '#58CC02', 'Modéré': '#1CB0F6', 'Croissance': '#FF9600', 'Audacieux': '#FF4B4B',
};

// ── Shared Components ───────────────────────────────────────────────────────

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Portefeuille Modèle</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionNumber({ num, title }: { num: number; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.cyan, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontFamily: 'Montserrat', fontWeight: 800, color: '#fff' }}>{num}</Text>
      </View>
      <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{title}</Text>
    </View>
  );
}

function AIBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.aiBlock}>
      <Text style={styles.aiLabel}>{label}</Text>
      <Text style={styles.aiText}>{text}</Text>
    </View>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, ...styles.card, alignItems: 'center', paddingVertical: 12 }}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color }}>{value}</Text>
    </View>
  );
}

// ── SVG Charts ──────────────────────────────────────────────────────────────

function GrowthChart({ data, width = 500, height = 160 }: { data: D; width?: number; height?: number }) {
  const gs = data.growthSeries ?? [];
  if (gs.length < 3) return null;

  const padding = { top: 10, right: 15, bottom: 25, left: 50 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  const allValues = gs.flatMap((p: { portfolio: number; benchmark: number }) => [p.portfolio, p.benchmark]).filter((v: number) => isFinite(v));
  if (allValues.length === 0) return null;
  const minVal = Math.min(...allValues) * 0.95;
  const maxVal = Math.max(...allValues) * 1.05;
  const range = maxVal - minVal || 1;

  const xScale = (i: number) => padding.left + (i / Math.max(gs.length - 1, 1)) * w;
  const yScale = (v: number) => padding.top + h - ((v - minVal) / range) * h;

  const portfolioPoints = gs.map((p: { portfolio: number }, i: number) => `${xScale(i)},${yScale(p.portfolio)}`).join(' ');
  const benchmarkPoints = gs.map((p: { benchmark: number }, i: number) => `${xScale(i)},${yScale(p.benchmark)}`).join(' ');

  // Y axis labels
  const yLabels = [minVal, (minVal + maxVal) / 2, maxVal].map(v => ({
    y: yScale(v),
    label: v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0),
  }));

  // X axis labels (first, middle, last dates)
  const xLabelIndices = [0, Math.floor(gs.length / 2), gs.length - 1];

  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
      {/* Grid lines */}
      {yLabels.map((yl, i) => (
        <G key={i}>
          <Line x1={padding.left} y1={yl.y} x2={width - padding.right} y2={yl.y} stroke="#e2e8f0" strokeWidth={0.5} />
          <Text x={padding.left - 4} y={yl.y + 3} style={{ fontSize: 7, textAnchor: 'end' as const, fill: '#94a3b8' }}>{yl.label}</Text>
        </G>
      ))}

      {/* X labels */}
      {xLabelIndices.map(idx => (
        <Text key={idx} x={xScale(idx)} y={height - 5} style={{ fontSize: 6, textAnchor: 'middle' as const, fill: '#94a3b8' }}>
          {(gs[idx]?.date ?? '').slice(0, 7)}
        </Text>
      ))}

      {/* Benchmark line */}
      <Polyline points={benchmarkPoints} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3,3" />

      {/* Portfolio line */}
      <Polyline points={portfolioPoints} fill="none" stroke={C.cyan} strokeWidth={2} />

      {/* End dots */}
      <Circle cx={xScale(gs.length - 1)} cy={yScale(gs[gs.length - 1].portfolio)} r={3} fill={C.cyan} />
      <Circle cx={xScale(gs.length - 1)} cy={yScale(gs[gs.length - 1].benchmark)} r={3} fill="#94a3b8" />
    </Svg>
  );
}

function AnnualReturnsChart({ data, width = 500, height = 140 }: { data: D; width?: number; height?: number }) {
  const returns = data.annualReturns ?? [];
  if (returns.length < 1) return null;

  const padding = { top: 10, right: 10, bottom: 25, left: 40 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  const allVals = returns.flatMap((r: { portfolio: number; benchmark: number }) => [r.portfolio, r.benchmark]);
  const maxAbs = Math.max(...allVals.map(Math.abs), 0.01);
  const range = maxAbs * 1.1;

  const barWidth = w / returns.length / 3;
  const zeroY = padding.top + h / 2;

  const yScale = (v: number) => zeroY - (v / range) * (h / 2);

  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
      {/* Zero line */}
      <Line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#94a3b8" strokeWidth={0.5} />

      {returns.map((r: { year: number; portfolio: number; benchmark: number }, i: number) => {
        const x = padding.left + (i / returns.length) * w + barWidth / 2;
        const pH = Math.abs(r.portfolio / range) * (h / 2);
        const bH = Math.abs(r.benchmark / range) * (h / 2);
        const pY = r.portfolio >= 0 ? zeroY - pH : zeroY;
        const bY = r.benchmark >= 0 ? zeroY - bH : zeroY;

        return (
          <G key={i}>
            <Rect x={x} y={pY} width={barWidth} height={Math.max(pH, 1)} fill={r.portfolio >= 0 ? C.cyan : '#FF4B4B'} rx={2} />
            <Rect x={x + barWidth + 2} y={bY} width={barWidth} height={Math.max(bH, 1)} fill="#94a3b8" rx={2} />
            <Text x={x + barWidth} y={height - 6} style={{ fontSize: 6, textAnchor: 'middle' as const, fill: '#64748b' }}>
              {r.year}
            </Text>
          </G>
        );
      })}
    </Svg>
  );
}

function SectorPieChart({ sectors, size = 120 }: { sectors: Array<{ sector: string; weight: number }>; size?: number }) {
  const r = size / 2 - 5;
  const cx = size / 2;
  const cy = size / 2;
  let cumAngle = -Math.PI / 2;

  const slices = sectors.filter(s => s.weight > 0);

  return (
    <Svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {slices.map((s, i) => {
        const angle = (s.weight / 100) * 2 * Math.PI;
        const startAngle = cumAngle;
        cumAngle += angle;
        const endAngle = cumAngle;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angle > Math.PI ? 1 : 0;

        const color = SECTOR_COLORS[s.sector] ?? '#94a3b8';

        // Full circle: SVG arc can't draw from a point back to itself, use two semicircles
        if (angle >= 2 * Math.PI - 0.01) {
          const midAngle = startAngle + Math.PI;
          const xm = cx + r * Math.cos(midAngle);
          const ym = cy + r * Math.sin(midAngle);
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${xm} ${ym} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
          return <Path key={i} d={d} fill={color} />;
        }

        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        return <Path key={i} d={d} fill={color} />;
      })}
      {/* Center hole */}
      <Circle cx={cx} cy={cy} r={r * 0.45} fill="white" />
    </Svg>
  );
}

function RiskGauge({ profile, width = 200, height = 80 }: { profile: { level: string; score: number }; width?: number; height?: number }) {
  const cx = width / 2;
  const cy = height - 10;
  const r = width / 2 - 15;
  const levels = ['Conservateur', 'Modéré', 'Croissance', 'Audacieux'];
  const colors = ['#58CC02', '#1CB0F6', '#FF9600', '#FF4B4B'];

  // Draw arc segments
  const segments = levels.map((_, i) => {
    const startAngle = Math.PI + (i / 4) * Math.PI;
    const endAngle = Math.PI + ((i + 1) / 4) * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    return { x1, y1, x2, y2, color: colors[i], startAngle, endAngle };
  });

  // Needle position (clamp score to 0-100)
  const safeScore = Math.max(0, Math.min(100, Number(profile.score) || 50));
  const needleAngle = Math.PI + (safeScore / 100) * Math.PI;
  const needleX = cx + (r - 10) * Math.cos(needleAngle);
  const needleY = cy + (r - 10) * Math.sin(needleAngle);

  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      {segments.map((seg, i) => (
        <Path
          key={i}
          d={`M ${seg.x1} ${seg.y1} A ${r} ${r} 0 0 1 ${seg.x2} ${seg.y2}`}
          fill="none"
          stroke={seg.color}
          strokeWidth={8}
          strokeLinecap="round"
        />
      ))}
      {/* Needle */}
      <Line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={C.navy} strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={4} fill={C.navy} />
      {/* Label */}
      <Text x={cx} y={cy + 14} style={{ fontSize: 8, fontWeight: 700, textAnchor: 'middle' as const, fill: RISK_COLORS[profile.level] ?? C.navy }}>
        {profile.level}
      </Text>
    </Svg>
  );
}

function MonteCarloChart({ mc, width = 500, height = 140 }: { mc: D; width?: number; height?: number }) {
  if (!mc?.percentile50?.length || mc.percentile50.length < 2) return null;
  if (!mc.percentile5?.length || !mc.percentile95?.length) return null;

  const padding = { top: 10, right: 15, bottom: 20, left: 50 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  const allValues = [...mc.percentile5, ...mc.percentile95].filter((v: number) => isFinite(v));
  if (allValues.length === 0) return null;
  const minVal = Math.min(...allValues) * 0.95;
  const maxVal = Math.max(...allValues) * 1.05;
  const range = maxVal - minVal || 1;
  const n = mc.percentile50.length;

  const xScale = (i: number) => padding.left + (i / Math.max(n - 1, 1)) * w;
  const yScale = (v: number) => padding.top + h - ((v - minVal) / range) * h;

  // Fan area (5th to 95th percentile)
  const fanTop = mc.percentile95.map((v: number, i: number) => `${xScale(i)},${yScale(v)}`).join(' ');
  const fanBot = [...mc.percentile5].reverse().map((v: number, i: number) => `${xScale(n - 1 - i)},${yScale(v)}`).join(' ');

  const medianLine = mc.percentile50.map((v: number, i: number) => `${xScale(i)},${yScale(v)}`).join(' ');
  const p25Line = mc.percentile25.map((v: number, i: number) => `${xScale(i)},${yScale(v)}`).join(' ');
  const p75Line = mc.percentile75.map((v: number, i: number) => `${xScale(i)},${yScale(v)}`).join(' ');

  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
      {/* Fan area */}
      <Polyline points={`${fanTop} ${fanBot}`} fill="rgba(0,180,216,0.1)" stroke="none" />

      {/* Percentile bands */}
      <Polyline points={p25Line} fill="none" stroke="rgba(0,180,216,0.3)" strokeWidth={0.5} />
      <Polyline points={p75Line} fill="none" stroke="rgba(0,180,216,0.3)" strokeWidth={0.5} />

      {/* Median line */}
      <Polyline points={medianLine} fill="none" stroke={C.cyan} strokeWidth={2} />

      {/* Start line */}
      <Line x1={xScale(0)} y1={yScale(10000)} x2={width - padding.right} y2={yScale(10000)} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3" />

      {/* Year labels */}
      {[0, 1, 2, 3, 4, 5].filter(y => y * 12 < n).map(y => (
        <Text key={y} x={xScale(y * 12)} y={height - 4} style={{ fontSize: 6, textAnchor: 'middle' as const, fill: '#94a3b8' }}>
          An {y}
        </Text>
      ))}
    </Svg>
  );
}

function MultiIndexChart({ data, width = 500, height = 160 }: { data: D; width?: number; height?: number }) {
  const multiIndex = data.multiIndex ?? [];
  if (multiIndex.length < 2) return null;

  const padding = { top: 10, right: 15, bottom: 25, left: 50 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  const colors = [C.cyan, '#94a3b8', '#FF4B4B', '#58CC02', '#CE82FF'];

  // Find common date range and all values
  const allValues: number[] = [];
  for (const idx of multiIndex) {
    for (const p of idx.growthSeries) {
      allValues.push(p.value);
    }
  }
  if (allValues.length === 0) return null;

  const minVal = Math.min(...allValues) * 0.95;
  const maxVal = Math.max(...allValues) * 1.05;

  const refSeries = multiIndex[0]?.growthSeries ?? [];
  if (refSeries.length < 2) return null;
  const range = maxVal - minVal || 1;
  const xScale = (i: number) => padding.left + (i / Math.max(refSeries.length - 1, 1)) * w;
  const yScale = (v: number) => padding.top + h - ((v - minVal) / range) * h;

  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
      {/* Grid */}
      <Line x1={padding.left} y1={yScale(10000)} x2={width - padding.right} y2={yScale(10000)} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="2,2" />

      {multiIndex.map((idx: D, k: number) => {
        const series = idx.growthSeries;
        if (series.length < 2) return null;
        const points = series.map((p: { value: number }, i: number) => `${xScale(i)},${yScale(p.value)}`).join(' ');
        return (
          <Polyline
            key={k}
            points={points}
            fill="none"
            stroke={colors[k % colors.length]}
            strokeWidth={k === 0 ? 2 : 1.2}
            strokeDasharray={k > 1 ? '4,2' : undefined}
          />
        );
      })}

      {/* X labels */}
      {[0, Math.floor(refSeries.length / 2), refSeries.length - 1].map(idx => (
        <Text key={idx} x={xScale(idx)} y={height - 5} style={{ fontSize: 6, textAnchor: 'middle' as const, fill: '#94a3b8' }}>
          {(refSeries[idx]?.date ?? '').slice(0, 7)}
        </Text>
      ))}
    </Svg>
  );
}

// ── Page 1: Cover ───────────────────────────────────────────────────────────

function CoverPage({ data }: { data: D }) {
  const now = new Date(data.sources?.generatedAt ?? Date.now());
  const dateStr = now.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Page size="LETTER" style={{ ...styles.page, padding: 0 }}>
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

      <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 5, backgroundColor: C.cyan }} />

      <View style={{ position: 'absolute', top: 40, left: 50 }}>
        <Image src={LOGO_PATH} style={{ width: 40, height: 40 }} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 60 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
          ANALYSE DE PORTEFEUILLE
        </Text>
        <Text style={{ fontSize: 32, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff', lineHeight: 1.2, marginBottom: 20 }}>
          {data.name}
        </Text>
        <View style={{ width: 60, height: 3, backgroundColor: C.cyan, borderRadius: 2, marginBottom: 24 }} />
        <Text style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Open Sans', marginBottom: 6 }}>
          {data.holdingsCount} positions · Benchmark: {data.benchmark}
        </Text>
        <Text style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Open Sans', marginBottom: 6 }}>
          {data.dataMonths} mois de données historiques
        </Text>
        <Text style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Open Sans' }}>
          {dateStr}
        </Text>

        {/* Risk profile badge */}
        {data.riskProfile && (
          <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{
              paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
              backgroundColor: RISK_COLORS[data.riskProfile.level] ?? C.cyan,
            }}>
              <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: '#fff' }}>
                {data.riskProfile.level.toUpperCase()}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Table of Contents */}
      <View style={{ position: 'absolute', bottom: 80, left: 60, right: 60 }}>
        <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan, letterSpacing: 2, marginBottom: 10 }}>TABLE DES MATIÈRES</Text>
        {[
          '1. Sommaire exécutif',
          '2. Profil de risque',
          '3. Allocation du portefeuille',
          '4. Performance historique',
          '5. Statistiques de risque',
          '6. Simulation Monte Carlo',
          '7. Tests de résistance',
          '8. Analyse de contribution',
          '9. Revenu et dividendes',
          '10. Liste des avoirs',
          '11. Notes et avertissements',
        ].map((item, i) => (
          <Text key={i} style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'Open Sans', marginBottom: 3 }}>{item}</Text>
        ))}
      </View>

      <View style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 50, backgroundColor: 'rgba(0,180,216,0.1)', paddingHorizontal: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 8, color: '#64748b' }}>Groupe Financier Ste-Foy</Text>
        <Text style={{ fontSize: 8, color: '#64748b' }}>Sources: EODHD · Yahoo Finance · IA Groq</Text>
      </View>
    </Page>
  );
}

// ── Page 2: Sommaire exécutif ───────────────────────────────────────────────

function SummaryPage({ data }: { data: D }) {
  const rs = data.riskStats ?? {};
  const wf = data.weightedFundamentals ?? {};
  const ai = data.aiNarrative;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={1} title="Sommaire exécutif" />

      {/* AI Executive Summary */}
      {ai?.executiveSummary && <AIBlock label="Analyse IA" text={ai.executiveSummary} />}

      {/* KPI cards */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <KPICard label="RENDEMENT 1 AN" value={fmtPct(rs.return1Y)} color={rs.return1Y >= 0 ? C.up : C.down} />
        <KPICard label="RENDEMENT 3 ANS" value={fmtPct(rs.return3Y)} color={rs.return3Y >= 0 ? C.up : C.down} />
        <KPICard label="SHARPE 3 ANS" value={fmtNum(rs.sharpe3Y)} color={C.cyan} />
        <KPICard label="MAX DRAWDOWN" value={fmtPct(rs.maxDrawdown)} color={C.down} />
      </View>

      {/* Fundamentals + Returns side by side */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
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
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
              <Text style={{ fontSize: 8, color: C.textSec }}>{item.label}</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>{item.value}</Text>
            </View>
          ))}
        </View>

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
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
              <Text style={{ fontSize: 8, color: C.textSec }}>{item.label}</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: item.value !== null && item.value >= 0 ? C.up : C.down }}>{fmtPct(item.value)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* AI Strengths & Weaknesses */}
      {ai?.strengths && ai?.weaknesses && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, ...styles.card }}>
            <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.up, marginBottom: 6 }}>Points forts</Text>
            {ai.strengths.map((s: string, i: number) => (
              <Text key={i} style={{ fontSize: 7.5, color: C.text, marginBottom: 3 }}>+ {s}</Text>
            ))}
          </View>
          <View style={{ flex: 1, ...styles.card }}>
            <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.down, marginBottom: 6 }}>Points de vigilance</Text>
            {ai.weaknesses.map((w: string, i: number) => (
              <Text key={i} style={{ fontSize: 7.5, color: C.text, marginBottom: 3 }}>- {w}</Text>
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}

// ── Page 3: Risk Profile ────────────────────────────────────────────────────

function RiskProfilePage({ data }: { data: D }) {
  const profile = data.riskProfile;
  const concentration = data.concentration;
  const currency = data.currencyExposure ?? [];
  const ai = data.aiNarrative;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={2} title="Profil de risque" />

      {/* Risk gauge + description */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center', paddingVertical: 16 }}>
          {profile && <RiskGauge profile={profile} />}
          {profile && (
            <Text style={{ fontSize: 7.5, color: C.textSec, textAlign: 'center', marginTop: 8, paddingHorizontal: 10 }}>
              {profile.description}
            </Text>
          )}
        </View>

        {/* Concentration stats */}
        <View style={{ flex: 1, ...styles.card }}>
          <Text style={styles.subsectionTitle}>Concentration</Text>
          {concentration && (
            <>
              {[
                { label: 'Indice Herfindahl (HHI)', value: concentration.herfindahl.toString(), desc: concentration.level },
                { label: 'Positions effectives', value: concentration.effectivePositions.toFixed(1) },
                { label: 'Poids Top 5', value: `${(concentration.top5Weight * 100).toFixed(0)}%` },
                { label: 'Poids Top 10', value: `${(concentration.top10Weight * 100).toFixed(0)}%` },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
                  <Text style={{ fontSize: 8, color: C.textSec }}>{item.label}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>{item.value}</Text>
                    {'desc' in item && <Text style={{ fontSize: 6, color: C.textTer }}>{item.desc}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </View>

      {/* Currency Exposure */}
      {currency.length > 0 && (
        <View style={{ ...styles.card, marginBottom: 14 }}>
          <Text style={styles.subsectionTitle}>Exposition aux devises</Text>
          <View style={styles.allocBar}>
            {currency.map((c: { currency: string; weight: number }, i: number) => (
              <View key={i} style={{ width: `${c.weight * 100}%`, backgroundColor: CUR_COLORS[c.currency] ?? '#94a3b8' }} />
            ))}
          </View>
          <View style={styles.legendWrap}>
            {currency.map((c: { currency: string; weight: number; label: string }, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: CUR_COLORS[c.currency] ?? '#94a3b8' }} />
                <Text style={{ fontSize: 8, color: C.text }}>{c.label}: {(c.weight * 100).toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Style Matrix */}
      <View style={styles.card}>
        <Text style={styles.subsectionTitle}>Matrice de style (Morningstar)</Text>
        <View style={{ flexDirection: 'row', gap: 3, justifyContent: 'center', marginBottom: 6 }}>
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 6, color: C.textTer }}>Valeur</Text>
          <Text style={{ fontSize: 6, color: C.textTer }}>Mixte</Text>
          <Text style={{ fontSize: 6, color: C.textTer }}>Croissance</Text>
        </View>
      </View>

      {ai?.riskComment && <AIBlock label="Commentaire risque — IA" text={ai.riskComment} />}
    </Page>
  );
}

// ── Page 4: Allocation ──────────────────────────────────────────────────────

function AllocationPage({ data }: { data: D }) {
  const sectors = data.sectors ?? [];
  const geography = data.geography ?? [];
  const maxSectorWeight = Math.max(...sectors.map((s: { weight: number }) => s.weight), 1);
  const ai = data.aiNarrative;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={3} title="Allocation du portefeuille" />

      {ai?.allocationComment && <AIBlock label="Commentaire allocation — IA" text={ai.allocationComment} />}

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        {/* Sector bars */}
        <View style={{ flex: 2, ...styles.card }}>
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

        {/* Sector pie chart */}
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <SectorPieChart sectors={sectors} />
        </View>
      </View>

      {/* Geography */}
      <View style={styles.card}>
        <Text style={styles.subsectionTitle}>Répartition géographique</Text>
        <View style={styles.allocBar}>
          {geography.map((g: { region: string; weight: number }, i: number) => (
            <View key={i} style={{ width: `${g.weight}%`, backgroundColor: GEO_COLORS[g.region] ?? '#94a3b8' }} />
          ))}
        </View>
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

// ── Page 5: Performance ─────────────────────────────────────────────────────

function PerformancePage({ data }: { data: D }) {
  const annualReturns = data.annualReturns ?? [];
  const gs = data.growthSeries ?? [];
  const lastGrowth = gs[gs.length - 1];
  const ai = data.aiNarrative;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={4} title="Performance historique" />

      {ai?.performanceComment && <AIBlock label="Commentaire performance — IA" text={ai.performanceComment} />}

      {/* Growth of $10K with SVG chart */}
      {lastGrowth && (
        <View style={{ ...styles.card, marginBottom: 12 }}>
          <Text style={styles.subsectionTitle}>Croissance de 10 000 $</Text>
          <View style={{ flexDirection: 'row', gap: 20, marginBottom: 8 }}>
            <View>
              <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase', letterSpacing: 1 }}>PORTEFEUILLE</Text>
              <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan }}>{fmt(lastGrowth.portfolio)}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase', letterSpacing: 1 }}>BENCHMARK</Text>
              <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.textSec }}>{fmt(lastGrowth.benchmark)}</Text>
            </View>
          </View>
          <GrowthChart data={data} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 12, height: 2, backgroundColor: C.cyan }} />
              <Text style={{ fontSize: 7, color: C.textSec }}>Portefeuille</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 12, height: 2, backgroundColor: '#94a3b8' }} />
              <Text style={{ fontSize: 7, color: C.textSec }}>Benchmark ({data.benchmark})</Text>
            </View>
          </View>
        </View>
      )}

      {/* Annual returns bar chart */}
      {annualReturns.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.subsectionTitle}>Rendements annuels comparés</Text>
          <AnnualReturnsChart data={data} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 8, backgroundColor: C.cyan, borderRadius: 2 }} />
              <Text style={{ fontSize: 7, color: C.textSec }}>Portefeuille</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 8, backgroundColor: '#94a3b8', borderRadius: 2 }} />
              <Text style={{ fontSize: 7, color: C.textSec }}>Benchmark</Text>
            </View>
          </View>
        </View>
      )}
    </Page>
  );
}

// ── Page 6: Multi-Index Comparison ──────────────────────────────────────────

function MultiIndexPage({ data }: { data: D }) {
  const multiIndex = data.multiIndex ?? [];
  const annualReturns = data.annualReturns ?? [];
  if (multiIndex.length < 2) return null;

  const colors = [C.cyan, '#94a3b8', '#FF4B4B', '#58CC02', '#CE82FF'];

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
          Comparaison multi-indices
        </Text>
      </View>

      <View style={{ ...styles.card, marginBottom: 14 }}>
        <Text style={styles.subsectionTitle}>Croissance de 10 000 $ — Multi-indices</Text>
        <MultiIndexChart data={data} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
          {multiIndex.map((idx: D, k: number) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 12, height: 2, backgroundColor: colors[k % colors.length] }} />
              <Text style={{ fontSize: 7, color: C.textSec }}>{idx.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Annual returns table */}
      {annualReturns.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.subsectionTitle}>Rendements annuels détaillés</Text>
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

// ── Page 7: Risk Stats ──────────────────────────────────────────────────────

function RiskPage({ data }: { data: D }) {
  const rs = data.riskStats ?? {};

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={5} title="Statistiques de risque" />

      {/* Volatility row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'ÉCART-TYPE 1 AN', value: rs.stdDev1Y ? `${(rs.stdDev1Y * 100).toFixed(1)}%` : '—' },
          { label: 'ÉCART-TYPE 3 ANS', value: rs.stdDev3Y ? `${(rs.stdDev3Y * 100).toFixed(1)}%` : '—' },
          { label: 'ÉCART-TYPE 5 ANS', value: rs.stdDev5Y ? `${(rs.stdDev5Y * 100).toFixed(1)}%` : '—' },
        ].map((item, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.kpiLabel}>{item.label}</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Sharpe row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'SHARPE 1 AN', value: fmtNum(rs.sharpe1Y), desc: rs.sharpe1Y > 1 ? 'Excellent' : rs.sharpe1Y > 0.5 ? 'Bon' : 'Faible' },
          { label: 'SHARPE 3 ANS', value: fmtNum(rs.sharpe3Y), desc: rs.sharpe3Y > 1 ? 'Excellent' : rs.sharpe3Y > 0.5 ? 'Bon' : 'Faible' },
          { label: 'SHARPE 5 ANS', value: fmtNum(rs.sharpe5Y), desc: rs.sharpe5Y > 1 ? 'Excellent' : rs.sharpe5Y > 0.5 ? 'Bon' : 'Faible' },
          { label: 'SORTINO 3 ANS', value: fmtNum(rs.sortino3Y), desc: rs.sortino3Y > 1.5 ? 'Excellent' : rs.sortino3Y > 0.5 ? 'Bon' : 'Faible' },
        ].map((item, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.kpiLabel}>{item.label}</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan }}>{item.value}</Text>
            <Text style={{ fontSize: 6, color: C.textTer, marginTop: 2 }}>{item.desc}</Text>
          </View>
        ))}
      </View>

      {/* Relative stats table */}
      <View style={{ ...styles.card, marginBottom: 12 }}>
        <Text style={styles.subsectionTitle}>Statistiques relatives (3 ans) vs {data.benchmark}</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, width: '30%' }}>Mesure</Text>
            <Text style={{ ...styles.thCellPremium, width: '20%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.thCellPremium, width: '50%' }}>Interprétation</Text>
          </View>
          {[
            { label: 'Alpha', value: rs.alpha3Y !== null ? fmtPct(rs.alpha3Y) : '—', desc: rs.alpha3Y > 0 ? 'Surperformance ajustée au risque — le gérant ajoute de la valeur' : 'Sous-performance ajustée au risque vs le marché' },
            { label: 'Beta', value: fmtNum(rs.beta3Y), desc: rs.beta3Y > 1 ? 'Plus volatile que le marché — amplifie les mouvements' : rs.beta3Y < 0.8 ? 'Moins volatile — protection en baisse, mais moins de participation en hausse' : 'Volatilité en ligne avec le marché' },
            { label: 'R²', value: rs.rSquared3Y !== null ? `${(rs.rSquared3Y * 100).toFixed(0)}%` : '—', desc: rs.rSquared3Y > 0.8 ? 'Forte corrélation — le portefeuille suit de près son benchmark' : 'Faible corrélation — portefeuille différencié du benchmark' },
            { label: 'Tracking Error', value: rs.trackingError3Y !== null ? `${(rs.trackingError3Y * 100).toFixed(1)}%` : '—', desc: 'Écart annualisé de rendement vs le benchmark' },
            { label: 'Info. Ratio', value: fmtNum(rs.informationRatio3Y), desc: rs.informationRatio3Y > 0.5 ? 'Bon rendement excédentaire par unité de risque actif' : 'Rendement excédentaire par unité de risque pris' },
            { label: 'Capture hausse', value: rs.captureUpside3Y !== null ? `${rs.captureUpside3Y.toFixed(0)}%` : '—', desc: 'Participation aux hausses du marché (>100% = surperformance en hausse)' },
            { label: 'Capture baisse', value: rs.captureDownside3Y !== null ? `${rs.captureDownside3Y.toFixed(0)}%` : '—', desc: 'Participation aux baisses (<100% = meilleure protection en baisse)' },
          ].map((item, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
              <Text style={{ ...styles.tdBold, width: '30%' }}>{item.label}</Text>
              <Text style={{ ...styles.tdBold, width: '20%', textAlign: 'right', color: C.navy }}>{item.value}</Text>
              <Text style={{ ...styles.td, width: '50%', color: C.textSec, fontSize: 7 }}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Drawdown + Best/Worst */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>MAX DRAWDOWN</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: C.down }}>{fmtPct(rs.maxDrawdown)}</Text>
          <Text style={{ fontSize: 7, color: C.textTer, marginTop: 3 }}>{rs.maxDrawdownDate}</Text>
          <Text style={{ fontSize: 6, color: C.textSec, marginTop: 2, textAlign: 'center' }}>Perte maximale pic à creux</Text>
        </View>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>MEILLEUR MOIS</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: C.up }}>{fmtPct(rs.bestMonth)}</Text>
          <Text style={{ fontSize: 7, color: C.textTer, marginTop: 3 }}>{rs.bestMonthDate}</Text>
        </View>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>PIRE MOIS</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: C.down }}>{fmtPct(rs.worstMonth)}</Text>
          <Text style={{ fontSize: 7, color: C.textTer, marginTop: 3 }}>{rs.worstMonthDate}</Text>
        </View>
      </View>
    </Page>
  );
}

// ── Page 8: Monte Carlo ─────────────────────────────────────────────────────

function MonteCarloPage({ data }: { data: D }) {
  const mc = data.monteCarlo;
  if (!mc) return null;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={6} title="Simulation Monte Carlo" />

      <View style={styles.aiBlock}>
        <Text style={styles.aiLabel}>Méthodologie</Text>
        <Text style={styles.aiText}>
          Simulation de 1 000 scénarios sur 5 ans basée sur la distribution historique des rendements mensuels du portefeuille.
          Les bandes représentent les percentiles 5e, 25e, 50e (médiane), 75e et 95e des trajectoires simulées.
        </Text>
      </View>

      {/* Monte Carlo chart */}
      <View style={{ ...styles.card, marginBottom: 14 }}>
        <Text style={styles.subsectionTitle}>Projection de 10 000 $ — 5 ans</Text>
        <MonteCarloChart mc={mc} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 12, height: 2, backgroundColor: C.cyan }} />
            <Text style={{ fontSize: 7, color: C.textSec }}>Médiane</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 12, height: 8, backgroundColor: 'rgba(0,180,216,0.15)', borderRadius: 2 }} />
            <Text style={{ fontSize: 7, color: C.textSec }}>Plage 5e-95e percentile</Text>
          </View>
        </View>
      </View>

      {/* Results cards */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <KPICard label="SCÉNARIO MÉDIAN" value={fmt(mc.medianFinal)} color={C.cyan} />
        <KPICard label="PIRE SCÉNARIO (5e)" value={fmt(mc.worstCase)} color={C.down} />
        <KPICard label="MEILLEUR (95e)" value={fmt(mc.bestCase)} color={C.up} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>PROBABILITÉ DE GAIN</Text>
          <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.up }}>{(mc.probPositive * 100).toFixed(0)}%</Text>
          <Text style={{ fontSize: 6.5, color: C.textSec, marginTop: 2 }}>Chance que le portefeuille soit en hausse après 5 ans</Text>
        </View>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>PROBABILITÉ DE DOUBLER</Text>
          <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan }}>{(mc.probDoubling * 100).toFixed(0)}%</Text>
          <Text style={{ fontSize: 6.5, color: C.textSec, marginTop: 2 }}>Chance que le capital initial double en 5 ans</Text>
        </View>
      </View>

      <View style={styles.aiBlock}>
        <Text style={styles.aiLabel}>Interprétation</Text>
        <Text style={styles.aiText}>
          {mc.probPositive >= 0.8
            ? `Le portefeuille présente une probabilité élevée (${(mc.probPositive * 100).toFixed(0)}%) de rendement positif sur 5 ans. Le scénario médian projette une valeur de ${fmt(mc.medianFinal)} pour un investissement initial de 10 000$. Dans le pire scénario (5e percentile), le portefeuille pourrait se retrouver à ${fmt(mc.worstCase)}.`
            : `La probabilité de rendement positif sur 5 ans est de ${(mc.probPositive * 100).toFixed(0)}%. La dispersion des résultats suggère une volatilité significative. Le scénario médian projette ${fmt(mc.medianFinal)}, mais le pire scénario (5e percentile) montre un risque de baisse à ${fmt(mc.worstCase)}.`
          }
        </Text>
      </View>
    </Page>
  );
}

// ── Page 9: Stress Tests ────────────────────────────────────────────────────

function StressTestPage({ data }: { data: D }) {
  const stressTests = data.stressTests ?? [];
  if (stressTests.length === 0) return null;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={7} title="Tests de résistance" />

      <View style={styles.aiBlock}>
        <Text style={styles.aiLabel}>Méthodologie</Text>
        <Text style={styles.aiText}>
          Les tests de résistance montrent comment le portefeuille aurait performé lors de périodes de crise historiques.
          Les rendements sont calculés à partir des données mensuelles réelles du portefeuille pendant chaque événement.
        </Text>
      </View>

      <View style={{ ...styles.card, marginBottom: 14 }}>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, width: '30%' }}>Événement</Text>
            <Text style={{ ...styles.thCellPremium, width: '20%' }}>Période</Text>
            <Text style={{ ...styles.thCellPremium, width: '18%', textAlign: 'right' }}>Portefeuille</Text>
            <Text style={{ ...styles.thCellPremium, width: '18%', textAlign: 'right' }}>Benchmark</Text>
            <Text style={{ ...styles.thCellPremium, width: '14%', textAlign: 'right' }}>Drawdown</Text>
          </View>
          {stressTests.map((st: D, i: number) => (
            <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
              <Text style={{ ...styles.tdBold, width: '30%' }}>{st.name}</Text>
              <Text style={{ ...styles.td, width: '20%', fontSize: 7 }}>{st.period}</Text>
              <Text style={{ ...styles.tdBold, width: '18%', textAlign: 'right', color: st.portfolioReturn >= 0 ? C.up : C.down }}>{fmtPct(st.portfolioReturn)}</Text>
              <Text style={{ ...styles.tdBold, width: '18%', textAlign: 'right', color: st.benchmarkReturn >= 0 ? C.up : C.down }}>{fmtPct(st.benchmarkReturn)}</Text>
              <Text style={{ ...styles.tdBold, width: '14%', textAlign: 'right', color: C.down }}>{fmtPct(st.maxDrawdown)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Interpretation for each stress event */}
      {stressTests.map((st: D, i: number) => {
        const outperformed = st.portfolioReturn > st.benchmarkReturn;
        return (
          <View key={i} style={{ ...styles.card, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{st.name}</Text>
              <Text style={outperformed ? styles.badgeUp : styles.badgeDown}>
                {outperformed ? 'Surperformance' : 'Sous-performance'}
              </Text>
            </View>
            <Text style={{ fontSize: 7.5, color: C.textSec }}>
              {outperformed
                ? `Le portefeuille a mieux résisté que le benchmark (${fmtPct(st.portfolioReturn)} vs ${fmtPct(st.benchmarkReturn)}), ce qui suggère une bonne résilience en période de crise.`
                : `Le portefeuille a sous-performé le benchmark (${fmtPct(st.portfolioReturn)} vs ${fmtPct(st.benchmarkReturn)}), indiquant une plus grande sensibilité à ce type de choc.`
              }
            </Text>
          </View>
        );
      })}
    </Page>
  );
}

// ── Page 10: Contribution Analysis ──────────────────────────────────────────

function ContributionPage({ data }: { data: D }) {
  const contributions = data.riskContributions ?? [];
  if (contributions.length === 0) return null;

  const sorted = [...contributions].sort((a: D, b: D) => Math.abs(b.riskContribution) - Math.abs(a.riskContribution));
  const topContribs = sorted.slice(0, 15);

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={8} title="Analyse de contribution" />

      <View style={styles.aiBlock}>
        <Text style={styles.aiLabel}>Explication</Text>
        <Text style={styles.aiText}>
          La contribution au risque mesure l&apos;impact de chaque position sur la volatilité totale du portefeuille.
          Un titre avec une forte contribution au risque signifie qu&apos;il est un moteur important de la volatilité globale.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subsectionTitle}>Contribution au risque et au rendement</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, width: '18%' }}>Titre</Text>
            <Text style={{ ...styles.thCellPremium, width: '12%', textAlign: 'right' }}>Poids</Text>
            <Text style={{ ...styles.thCellPremium, width: '15%', textAlign: 'right' }}>Volatilité</Text>
            <Text style={{ ...styles.thCellPremium, width: '20%', textAlign: 'right' }}>Contrib. risque</Text>
            <Text style={{ ...styles.thCellPremium, width: '20%', textAlign: 'right' }}>Contrib. rend.</Text>
            <Text style={{ ...styles.thCellPremium, width: '15%', textAlign: 'right' }}>Ratio</Text>
          </View>
          {topContribs.map((c: D, i: number) => {
            const ratio = c.volatility > 0 ? (c.returnContribution / c.volatility).toFixed(2) : '—';
            return (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.tdBold, width: '18%', color: C.navy }}>{c.symbol}</Text>
                <Text style={{ ...styles.td, width: '12%', textAlign: 'right' }}>{(c.weight * 100).toFixed(1)}%</Text>
                <Text style={{ ...styles.td, width: '15%', textAlign: 'right' }}>{(c.volatility * 100).toFixed(1)}%</Text>
                <Text style={{ ...styles.tdBold, width: '20%', textAlign: 'right', color: c.riskContribution > 0 ? C.down : C.up }}>
                  {c.riskContribution.toFixed(1)}%
                </Text>
                <Text style={{ ...styles.tdBold, width: '20%', textAlign: 'right', color: c.returnContribution >= 0 ? C.up : C.down }}>
                  {fmtPct(c.returnContribution)}
                </Text>
                <Text style={{ ...styles.td, width: '15%', textAlign: 'right' }}>{ratio}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Correlation matrix (if available) */}
      {data.correlationMatrix && (
        <View style={{ ...styles.card, marginTop: 12 }}>
          <Text style={styles.subsectionTitle}>Matrice de corrélation (Top 10)</Text>
          <Text style={{ fontSize: 7, color: C.textSec, marginBottom: 8 }}>
            Plus la corrélation est faible entre les titres, meilleure est la diversification du portefeuille.
          </Text>
          <View>
            {/* Header row */}
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 50 }} />
              {data.correlationMatrix.symbols.map((s: string, i: number) => (
                <Text key={i} style={{ width: 38, fontSize: 5.5, textAlign: 'center', color: C.navy, fontFamily: 'Open Sans', fontWeight: 600 }}>
                  {s.replace('.TO', '')}
                </Text>
              ))}
            </View>
            {/* Matrix rows */}
            {data.correlationMatrix.matrix.map((row: number[], i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ width: 50, fontSize: 5.5, color: C.navy, fontFamily: 'Open Sans', fontWeight: 600 }}>
                  {data.correlationMatrix.symbols[i].replace('.TO', '')}
                </Text>
                {row.map((val: number, j: number) => {
                  const intensity = Math.abs(val);
                  const bg = i === j ? C.cyan
                    : val > 0.7 ? `rgba(239, 68, 68, ${intensity * 0.4})`
                    : val < 0.3 ? `rgba(16, 185, 129, ${0.1 + intensity * 0.2})`
                    : `rgba(0, 180, 216, ${intensity * 0.2})`;
                  return (
                    <View key={j} style={{ width: 38, height: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
                      <Text style={{ fontSize: 6, color: i === j ? '#fff' : C.text }}>{val.toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}

// ── Page 11: Dividends & Income ─────────────────────────────────────────────

function DividendPage({ data }: { data: D }) {
  const projection = data.dividendProjection ?? [];
  const totalDivYield = data.totalDivYield ?? 0;

  if (totalDivYield <= 0 && projection.length === 0) return null;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={9} title="Revenu et dividendes" />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>RENDEMENT EN DIVIDENDES</Text>
          <Text style={{ fontSize: 26, fontFamily: 'Montserrat', fontWeight: 800, color: C.up }}>
            {totalDivYield > 0 ? `${(totalDivYield * 100).toFixed(2)}%` : '—'}
          </Text>
          <Text style={{ fontSize: 7, color: C.textSec, marginTop: 4 }}>Rendement pondéré du portefeuille</Text>
        </View>
        <View style={{ flex: 1, ...styles.card, alignItems: 'center' }}>
          <Text style={styles.kpiLabel}>REVENU ANNUEL EST.</Text>
          <Text style={{ fontSize: 26, fontFamily: 'Montserrat', fontWeight: 800, color: C.cyan }}>
            {totalDivYield > 0 ? fmt(100000 * totalDivYield) : '—'}
          </Text>
          <Text style={{ fontSize: 7, color: C.textSec, marginTop: 4 }}>Sur un investissement de 100 000 $</Text>
        </View>
      </View>

      {/* Dividend projection table */}
      {projection.length > 0 && (
        <View style={{ ...styles.card, marginBottom: 14 }}>
          <Text style={styles.subsectionTitle}>Projection des revenus de dividendes (5 ans)</Text>
          <Text style={{ fontSize: 7, color: C.textSec, marginBottom: 8 }}>
            Basée sur un investissement de 100 000 $ et une croissance annuelle estimée des dividendes de 5%.
          </Text>
          <View style={styles.tablePremium}>
            <View style={styles.thPremium}>
              <Text style={{ ...styles.thCellPremium, width: '30%' }}>Année</Text>
              <Text style={{ ...styles.thCellPremium, width: '35%', textAlign: 'right' }}>Revenu estimé</Text>
              <Text style={{ ...styles.thCellPremium, width: '35%', textAlign: 'right' }}>Rend. sur coût</Text>
            </View>
            {projection.map((p: D, i: number) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.tdBold, width: '30%' }}>{p.year}</Text>
                <Text style={{ ...styles.tdBold, width: '35%', textAlign: 'right', color: C.up }}>{fmt(p.income)}</Text>
                <Text style={{ ...styles.td, width: '35%', textAlign: 'right' }}>{(p.yieldOnCost * 100).toFixed(2)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Top dividend payers */}
      <View style={styles.card}>
        <Text style={styles.subsectionTitle}>Meilleurs payeurs de dividendes</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, width: '15%' }}>Titre</Text>
            <Text style={{ ...styles.thCellPremium, width: '30%' }}>Nom</Text>
            <Text style={{ ...styles.thCellPremium, width: '15%', textAlign: 'right' }}>Poids</Text>
            <Text style={{ ...styles.thCellPremium, width: '20%', textAlign: 'right' }}>Dividende</Text>
            <Text style={{ ...styles.thCellPremium, width: '20%', textAlign: 'right' }}>Contrib.</Text>
          </View>
          {[...(data.holdings ?? [])]
            .filter((h: D) => h.dividendYield && h.dividendYield > 0)
            .sort((a: D, b: D) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0))
            .slice(0, 10)
            .map((h: D, i: number) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.tdBold, width: '15%', color: C.navy }}>{h.symbol}</Text>
                <Text style={{ ...styles.td, width: '30%', fontSize: 7 }}>{h.name}</Text>
                <Text style={{ ...styles.td, width: '15%', textAlign: 'right' }}>{h.weight.toFixed(1)}%</Text>
                <Text style={{ ...styles.tdBold, width: '20%', textAlign: 'right', color: C.up }}>{(h.dividendYield * 100).toFixed(2)}%</Text>
                <Text style={{ ...styles.td, width: '20%', textAlign: 'right' }}>{((h.dividendYield * h.weight / 100) * 100).toFixed(2)}%</Text>
              </View>
            ))}
        </View>
      </View>
    </Page>
  );
}

// ── Holdings Pages ──────────────────────────────────────────────────────────

function HoldingsPages({ data }: { data: D }) {
  const holdings = [...(data.holdings ?? [])].sort((a: { weight: number }, b: { weight: number }) => b.weight - a.weight);

  const pages: typeof holdings[] = [];
  for (let i = 0; i < holdings.length; i += 18) {
    pages.push(holdings.slice(i, i + 18));
  }

  return (
    <>
      {pages.map((pageHoldings, pageIdx) => (
        <Page key={pageIdx} size="LETTER" style={styles.page}>
          <PageFooter />
          {pageIdx === 0 && <SectionNumber num={10} title="Liste des avoirs" />}

          <View style={styles.tablePremium}>
            <View style={styles.thPremium}>
              <Text style={{ ...styles.thCellPremium, width: '10%' }}>Symbole</Text>
              <Text style={{ ...styles.thCellPremium, width: '20%' }}>Nom</Text>
              <Text style={{ ...styles.thCellPremium, width: '8%', textAlign: 'right' }}>Poids</Text>
              <Text style={{ ...styles.thCellPremium, width: '10%', textAlign: 'right' }}>Prix</Text>
              <Text style={{ ...styles.thCellPremium, width: '10%', textAlign: 'right' }}>Cible</Text>
              <Text style={{ ...styles.thCellPremium, width: '10%', textAlign: 'right' }}>Potentiel</Text>
              <Text style={{ ...styles.thCellPremium, width: '8%', textAlign: 'right' }}>P/E</Text>
              <Text style={{ ...styles.thCellPremium, width: '8%', textAlign: 'right' }}>Div %</Text>
              <Text style={{ ...styles.thCellPremium, width: '6%', textAlign: 'right' }}>Beta</Text>
              <Text style={{ ...styles.thCellPremium, width: '10%' }}>Secteur</Text>
            </View>
            {pageHoldings.map((h: D, i: number) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.tdBold, width: '10%', color: C.navy }}>{h.symbol}</Text>
                <Text style={{ ...styles.td, width: '20%', fontSize: 7 }}>{h.name}</Text>
                <Text style={{ ...styles.tdBold, width: '8%', textAlign: 'right' }}>{h.weight.toFixed(1)}%</Text>
                <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>{h.price > 0 ? `$${h.price.toFixed(2)}` : '—'}</Text>
                <Text style={{ ...styles.td, width: '10%', textAlign: 'right' }}>{h.targetPrice ? `$${h.targetPrice.toFixed(2)}` : '—'}</Text>
                <Text style={{ ...styles.tdBold, width: '10%', textAlign: 'right', color: h.upside !== null ? (h.upside >= 0 ? C.up : C.down) : C.textTer }}>
                  {h.upside !== null ? `${h.upside >= 0 ? '+' : ''}${h.upside.toFixed(1)}%` : '—'}
                </Text>
                <Text style={{ ...styles.td, width: '8%', textAlign: 'right' }}>{h.pe ? h.pe.toFixed(1) : '—'}</Text>
                <Text style={{ ...styles.td, width: '8%', textAlign: 'right' }}>{h.dividendYield ? `${(h.dividendYield * 100).toFixed(1)}` : '—'}</Text>
                <Text style={{ ...styles.td, width: '6%', textAlign: 'right' }}>{h.beta ? h.beta.toFixed(1) : '—'}</Text>
                <Text style={{ ...styles.td, width: '10%', fontSize: 6 }}>{h.gicSector || '—'}</Text>
              </View>
            ))}
          </View>
        </Page>
      ))}
    </>
  );
}

// ── Top Holdings Detail Cards ───────────────────────────────────────────────

function TopHoldingsPage({ data }: { data: D }) {
  const top = [...(data.holdings ?? [])]
    .sort((a: D, b: D) => b.weight - a.weight)
    .slice(0, 6);

  if (top.length === 0) return null;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
          Fiches des principales positions
        </Text>
      </View>

      {top.map((h: D, i: number) => (
        <View key={i} style={styles.holdingCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <View>
              <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{h.symbol}</Text>
              <Text style={{ fontSize: 7.5, color: C.textSec }}>{h.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 6, color: C.textTer }}>Poids</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan }}>{h.weight.toFixed(1)}%</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 6, color: C.textTer }}>Prix</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: C.text }}>${h.price.toFixed(2)}</Text>
              </View>
              {h.targetPrice && (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 6, color: C.textTer }}>Cible</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: h.upside >= 0 ? C.up : C.down }}>${h.targetPrice.toFixed(2)}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
            {[
              { l: 'P/E', v: h.pe ? h.pe.toFixed(1) : '—' },
              { l: 'P/B', v: h.pb ? h.pb.toFixed(2) : '—' },
              { l: 'Div', v: h.dividendYield ? `${(h.dividendYield * 100).toFixed(1)}%` : '—' },
              { l: 'Beta', v: h.beta ? h.beta.toFixed(2) : '—' },
              { l: 'Secteur', v: h.gicSector || '—' },
              { l: 'Pays', v: h.country || '—' },
            ].map((item, j) => (
              <View key={j}>
                <Text style={{ fontSize: 5.5, color: C.textTer }}>{item.l}</Text>
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>{item.v}</Text>
              </View>
            ))}
          </View>
          {h.description && (
            <Text style={{ fontSize: 6.5, color: C.textSec, lineHeight: 1.4 }}>
              {h.description.slice(0, 200)}{h.description.length > 200 ? '...' : ''}
            </Text>
          )}
        </View>
      ))}
    </Page>
  );
}

// ── Disclaimer Page ─────────────────────────────────────────────────────────

function DisclaimerPage({ data }: { data: D }) {
  const ai = data.aiNarrative;

  return (
    <Page size="LETTER" style={styles.page}>
      <PageFooter />
      <SectionNumber num={11} title="Notes et avertissements" />

      {/* AI Outlook */}
      {ai?.outlook && <AIBlock label="Perspectives — IA" text={ai.outlook} />}

      <View style={styles.card}>
        <Text style={styles.disclaimer}>
          Ce rapport a été généré automatiquement à partir de données de marché publiques. Les rendements
          passés ne garantissent pas les rendements futurs. Les statistiques de risque et de rendement sont
          calculées à partir de données historiques et peuvent ne pas refléter les conditions futures du marché.
        </Text>
        <Text style={{ ...styles.disclaimer, marginTop: 8 }}>
          La simulation Monte Carlo est basée sur des hypothèses simplifiées (distribution normale des rendements)
          et ne tient pas compte des événements extrêmes ou des changements structurels de marché.
          Les résultats des tests de résistance sont historiques et ne préjugent pas des réactions futures.
        </Text>
        <Text style={{ ...styles.disclaimer, marginTop: 8 }}>
          Les cours cibles proviennent du consensus des analystes via Yahoo Finance et représentent une
          estimation sur 12 mois. Ils ne constituent pas une recommandation d&apos;achat ou de vente.
          Les commentaires générés par intelligence artificielle sont fournis à titre informatif seulement.
        </Text>
      </View>

      <View style={{ ...styles.card, marginTop: 10 }}>
        <Text style={styles.subsectionTitle}>Sources de données</Text>
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 8, color: C.textSec }}>Fondamentaux : EODHD (eodhd.com) — Fundamentals Data Feed</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>Prix historiques : Yahoo Finance — Données mensuelles ajustées (10 ans)</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>Cours cibles : Yahoo Finance — Consensus des analystes</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>Narratif IA : Groq (llama-3.3-70b-versatile)</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>Benchmark : {data.benchmark}</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>Taux sans risque : 4,0 % (obligations du gouvernement du Canada)</Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>Date de génération : {new Date(data.sources?.generatedAt).toLocaleDateString('fr-CA')}</Text>
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

export function StrategyReport({ data }: { data: D }) {
  return (
    <Document>
      <CoverPage data={data} />
      <SummaryPage data={data} />
      <RiskProfilePage data={data} />
      <AllocationPage data={data} />
      <PerformancePage data={data} />
      <MultiIndexPage data={data} />
      <RiskPage data={data} />
      <MonteCarloPage data={data} />
      <StressTestPage data={data} />
      <ContributionPage data={data} />
      <DividendPage data={data} />
      <HoldingsPages data={data} />
      <TopHoldingsPage data={data} />
      <DisclaimerPage data={data} />
    </Document>
  );
}

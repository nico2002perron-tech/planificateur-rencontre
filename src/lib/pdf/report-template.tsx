import React from 'react';
import { Document, Page, Text, View, Svg, Path, G, Circle } from '@react-pdf/renderer';
import { styles } from './styles';
import type {
  FullReportData,
  ReportHolding,
  HoldingProfile,
  AnnualReturn,
  SectorBreakdownItem,
  ValuationDataItem,
} from './report-data';

// ─── Backward compat: keep old interface exported for any existing consumers ──
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
  MODERE: 'Modéré',
  EQUILIBRE: 'Équilibré',
  CROISSANCE: 'Croissance',
  DYNAMIQUE: 'Dynamique',
};

const ASSET_LABELS: Record<string, string> = {
  EQUITY: 'Actions',
  FIXED_INCOME: 'Revenu fixe',
  CASH: 'Liquidités',
  ALTERNATIVE: 'Alternatifs',
  REAL_ESTATE: 'Immobilier',
  COMMODITY: 'Matières premières',
};

const REGION_LABELS: Record<string, string> = {
  CA: 'Canada',
  US: 'États-Unis',
  INTL: 'International',
  EM: 'Marchés émergents',
};

// ─── Pie Chart (SVG) ────────────────────────────────────────────

interface PieSlice {
  label: string;
  percentage: number;
  color: string;
  value?: number;
}

function PieChart({ slices, size = 100, title, labelMap }: {
  slices: PieSlice[];
  size?: number;
  title: string;
  labelMap?: Record<string, string>;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
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

    // Full circle case
    if (slice.percentage >= 99.9) {
      return { d: '', color: slice.color, label: slice.label, pct: slice.percentage, full: true };
    }

    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, color: slice.color, label: slice.label, pct: slice.percentage, full: false };
  });

  return (
    <View style={{ alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#03045e', marginBottom: 6 }}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((arc, i) =>
            arc.full ? (
              <Circle key={i} cx={cx} cy={cy} r={r} fill={arc.color} />
            ) : (
              <Path key={i} d={arc.d} fill={arc.color} />
            )
          )}
          {/* White center for donut effect */}
          <Circle cx={cx} cy={cy} r={r * 0.45} fill="#ffffff" />
        </Svg>
        <View style={{ flex: 1, maxWidth: 150 }}>
          {filtered.slice(0, 6).map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, marginRight: 5 }} />
              <Text style={{ fontSize: 7, color: '#1a2a3a', flex: 1 }}>
                {(labelMap ? labelMap[s.label] || s.label : s.label).substring(0, 18)}
              </Text>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#03045e' }}>
                {s.percentage.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function PageFooter({ pageNumber, total }: { pageNumber: number; total: number }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Rapport confidentiel</Text>
      <Text style={styles.footerText}>Page {pageNumber}/{total}</Text>
    </View>
  );
}

function AllocationBar({ slices }: { slices: { percentage: number; color: string }[] }) {
  return (
    <View style={styles.allocationBar}>
      {slices.map((s, i) => (
        <View key={i} style={{ ...styles.allocationBarSegment, width: `${Math.max(s.percentage, 1)}%`, backgroundColor: s.color }} />
      ))}
    </View>
  );
}

function Legend({ slices }: { slices: { label: string; percentage: number; color: string }[] }) {
  return (
    <View style={styles.legendContainer}>
      {slices.map((s, i) => (
        <View key={i} style={styles.legendRow}>
          <View style={{ ...styles.colorSwatch, backgroundColor: s.color }} />
          <Text style={styles.legendText}>
            {ASSET_LABELS[s.label] || REGION_LABELS[s.label] || s.label || 'Autre'} ({s.percentage.toFixed(1)}%)
          </Text>
        </View>
      ))}
    </View>
  );
}

function SectorBars({ items }: { items: SectorBreakdownItem[] }) {
  const COLORS = ['#00b4d8', '#03045e', '#0077b6', '#48cae4', '#90e0ef', '#023e8a', '#0096c7', '#2a9d8f', '#264653', '#e76f51'];
  return (
    <View style={styles.sectorBarContainer}>
      {items.slice(0, 8).map((s, i) => (
        <View key={i} style={styles.sectorBarRow}>
          <Text style={styles.sectorLabel}>{s.sectorLabel}</Text>
          <View style={styles.sectorBarOuter}>
            <View style={{ ...styles.sectorBarInner, width: `${Math.max(s.weight, 1)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
          </View>
          <Text style={styles.sectorPercent}>{s.weight.toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}

function PerformanceBarChart({ returns }: { returns: AnnualReturn[] }) {
  if (returns.length === 0) return null;
  const maxVal = Math.max(...returns.map((r) => Math.max(Math.abs(r.portfolioReturn), Math.abs(r.benchmarkReturn))), 1);
  const maxHeight = 100;
  return (
    <View>
      <View style={styles.chartContainer}>
        {returns.map((r, i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            <View style={styles.chartBarGroup}>
              <View style={{
                ...styles.chartBar,
                height: Math.max((Math.abs(r.portfolioReturn) / maxVal) * maxHeight, 4),
                backgroundColor: r.portfolioReturn >= 0 ? '#00b4d8' : '#ef4444',
              }} />
              <View style={{
                ...styles.chartBar,
                height: Math.max((Math.abs(r.benchmarkReturn) / maxVal) * maxHeight, 4),
                backgroundColor: '#c4c4c4',
              }} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {returns.map((r, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.chartLabel}>{r.year}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 10, backgroundColor: '#00b4d8', borderRadius: 2, marginRight: 4 }} />
          <Text style={{ fontSize: 8, color: '#586e82' }}>Portefeuille</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 10, backgroundColor: '#c4c4c4', borderRadius: 2, marginRight: 4 }} />
          <Text style={{ fontSize: 8, color: '#586e82' }}>Indice de référence</Text>
        </View>
      </View>
    </View>
  );
}

function HoldingCards({ profiles, currency }: { profiles: HoldingProfile[]; currency: string }) {
  return (
    <>
      {profiles.map((hp, i) => (
        <View key={i} style={styles.holdingCard} wrap={false}>
          <View style={styles.holdingCardHeader}>
            <View>
              <Text style={styles.holdingCardTitle}>{hp.companyName}</Text>
              <Text style={styles.holdingCardSymbol}>{hp.symbol} — {hp.exchange}</Text>
            </View>
            {hp.targetPrice > 0 && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 8, color: '#586e82' }}>Cours cible consensus</Text>
                <Text style={{
                  fontSize: 11, fontFamily: 'Helvetica-Bold',
                  color: hp.estimatedGainPercent >= 0 ? '#10b981' : '#ef4444',
                }}>
                  {fmtFull(hp.targetPrice, currency)} ({fmtPct(hp.estimatedGainPercent)})
                </Text>
                <Text style={{ fontSize: 7, color: '#8a9bb0' }}>{hp.numberOfAnalysts} analystes</Text>
              </View>
            )}
          </View>
          {hp.description ? (
            <Text style={styles.holdingDescription}>{hp.description}</Text>
          ) : null}
          <View style={styles.holdingMetaGrid}>
            <View style={styles.holdingMeta}>
              <Text style={styles.holdingMetaLabel}>Secteur</Text>
              <Text style={styles.holdingMetaValue}>{hp.sector || 'N/D'}</Text>
            </View>
            <View style={styles.holdingMeta}>
              <Text style={styles.holdingMetaLabel}>Industrie</Text>
              <Text style={styles.holdingMetaValue}>{hp.industry || 'N/D'}</Text>
            </View>
            <View style={styles.holdingMeta}>
              <Text style={styles.holdingMetaLabel}>Pays</Text>
              <Text style={styles.holdingMetaValue}>{hp.country || 'N/D'}</Text>
            </View>
            <View style={styles.holdingMeta}>
              <Text style={styles.holdingMetaLabel}>Bêta</Text>
              <Text style={styles.holdingMetaValue}>{hp.beta > 0 ? hp.beta.toFixed(2) : 'N/D'}</Text>
            </View>
            <View style={styles.holdingMeta}>
              <Text style={styles.holdingMetaLabel}>Dividende</Text>
              <Text style={styles.holdingMetaValue}>{hp.lastDiv > 0 ? fmtFull(hp.lastDiv, currency) : 'N/D'}</Text>
            </View>
            <View style={styles.holdingMeta}>
              <Text style={styles.holdingMetaLabel}>Cap. boursière</Text>
              <Text style={styles.holdingMetaValue}>{hp.marketCap > 0 ? fmtCap(hp.marketCap) : 'N/D'}</Text>
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

// ─── AI Narrative Block ─────────────────────────────────────────

function AINarrativeBlock({ label, content }: { label: string; content?: string }) {
  if (!content) return null;
  return (
    <View style={styles.aiNarrativeBlock}>
      <Text style={styles.aiNarrativeLabel}>{label}</Text>
      <Text style={styles.aiNarrative}>{content}</Text>
    </View>
  );
}

// ─── Valuation Badge ────────────────────────────────────────────

function ValuationBadge({ upside }: { upside: number }) {
  if (upside > 10) {
    return <Text style={styles.badgeUndervalued}>Sous-eval. ({fmtPct(upside)})</Text>;
  }
  if (upside < -10) {
    return <Text style={styles.badgeOvervalued}>Sur-eval. ({fmtPct(upside)})</Text>;
  }
  return <Text style={styles.badgeFairValue}>Juste val. ({fmtPct(upside)})</Text>;
}

// ─── Score Bar ──────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.min(100, Math.max(0, score * 10));
  const color = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#ef4444';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
      <Text style={{ fontSize: 7, color: '#586e82', width: 55 }}>{label}</Text>
      <View style={styles.scoreBarOuter}>
        <View style={{ ...styles.scoreBarInner, width: `${pct}%`, backgroundColor: color }} />
      </View>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1a2a3a', width: 25, textAlign: 'right' }}>
        {score.toFixed(1)}
      </Text>
    </View>
  );
}

// ─── Sensitivity Matrix ─────────────────────────────────────────

function SensitivityMatrix({ matrix, symbol, currentPrice }: {
  matrix: { rows: string[]; cols: string[]; data: number[][] };
  symbol: string;
  currentPrice: number;
}) {
  return (
    <View wrap={false} style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#03045e', marginBottom: 4 }}>
        Matrice de sensibilite — {symbol} (prix actuel: {fmtFull(currentPrice)})
      </Text>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ ...styles.sensitivityHeader, backgroundColor: '#03045e' }}>
          <Text style={{ fontSize: 7, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>WACC \ Cr.</Text>
        </View>
        {matrix.cols.map((col, ci) => (
          <View key={ci} style={styles.sensitivityHeader}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#03045e' }}>{col}</Text>
          </View>
        ))}
      </View>
      {matrix.rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', backgroundColor: ri % 2 === 0 ? '#ffffff' : '#f8f9fb' }}>
          <View style={{ ...styles.sensitivityHeader, backgroundColor: ri % 2 === 0 ? '#f3f6fa' : '#edf0f4' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#03045e' }}>{row}</Text>
          </View>
          {matrix.data[ri].map((val, ci) => {
            const isCenter = ri === 2 && ci === 2;
            const color = val > currentPrice * 1.1 ? '#10b981' : val < currentPrice * 0.9 ? '#ef4444' : '#1a2a3a';
            return (
              <View key={ci} style={{
                ...styles.sensitivityCell,
                backgroundColor: isCenter ? '#e0f7fa' : undefined,
              }}>
                <Text style={{ fontSize: 7, color, fontFamily: isCenter ? 'Helvetica-Bold' : 'Helvetica' }}>
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

// ─── Full 8-Page Morningstar-style Report ───────────────────────

export function FullReportDocument({ data }: { data: FullReportData }) {
  const ccy = data.portfolio.currency;
  const ai = data.aiContent;
  const valData = data.valuationData;
  const hasValuation = valData && valData.length > 0;
  const hasAI = !!ai;
  const totalPages = 8 + (hasValuation ? 1 : 0);
  const hasTargets = data.holdingProfiles.some((hp) => hp.targetPrice > 0);
  const hasReturns = data.annualReturns.length > 0;
  const estimatedDividend = data.holdingProfiles.reduce((sum, hp) => sum + (hp.lastDiv * hp.quantity), 0);
  const coveredCount = data.holdingProfiles.filter((hp) => hp.targetPrice > 0).length;
  const totalAnalysts = data.holdingProfiles.reduce((sum, hp) => sum + hp.numberOfAnalysts, 0);
  const weightedBeta = data.holdingProfiles.reduce((sum, hp) => {
    const w = data.portfolio.totalValue > 0 ? (hp.currentPrice * hp.quantity) / data.portfolio.totalValue : 0;
    return sum + w * hp.beta;
  }, 0);
  // Dynamic page offset: if valuation page present, pages after page 4 shift by 1
  const valOffset = hasValuation ? 1 : 0;

  return (
    <Document>
      {/* ── PAGE 1: Cover ──────────────────────────────────────── */}
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverBand} />
        <View style={{ alignItems: 'center', marginTop: 80 }}>
          <View style={{
            width: 70, height: 70, borderRadius: 12,
            backgroundColor: '#03045e', justifyContent: 'center', alignItems: 'center', marginBottom: 30,
          }}>
            <Text style={{ color: 'white', fontSize: 24, fontFamily: 'Helvetica-Bold' }}>GF</Text>
          </View>
          <Text style={styles.coverTitle}>Sommaire du portefeuille</Text>
          <Text style={styles.coverSubtitle}>{data.portfolio.name}</Text>
          <Text style={styles.coverInfo}>Préparé pour: {data.client.name}</Text>
          <Text style={styles.coverInfo}>Conseiller: {data.advisor.name}</Text>
          {data.advisor.title && <Text style={styles.coverInfo}>{data.advisor.title}</Text>}

          {/* Key metrics on cover */}
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 30 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: '#8a9bb0' }}>Valeur totale</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#03045e' }}>
                {fmt(data.portfolio.totalValue, ccy)}
              </Text>
            </View>
            {estimatedDividend > 0 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 8, color: '#8a9bb0' }}>Revenu estimé (div.)</Text>
                <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#10b981' }}>
                  {fmt(estimatedDividend, ccy)}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 9, color: '#8a9bb0', marginTop: 8 }}>
            Indice de référence: S&P/TSX Composite
          </Text>

          {data.portfolio.modelSource && (
            <Text style={{ ...styles.coverInfo, marginTop: 10, fontSize: 9, color: '#8a9bb0' }}>
              Basé sur le modèle: {data.portfolio.modelSource}
            </Text>
          )}
          <Text style={{ ...styles.coverInfo, marginTop: 20 }}>{data.generatedAt}</Text>
        </View>
      </Page>

      {/* ── PAGE 2: Sommaire Morningstar ──────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Sommaire du portefeuille</Text>

        {/* Répartition de l'actif */}
        <Text style={styles.subsectionTitle}>Répartition de l&apos;actif</Text>
        <AllocationBar slices={data.allocations.byAssetClass} />
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '50%' }}>Classe d&apos;actif</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Poids</Text>
          </View>
          {data.allocations.byAssetClass.map((a, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <View style={{ width: '50%', flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ ...styles.colorSwatch, backgroundColor: a.color, marginRight: 6 }} />
                <Text style={styles.tableCell}>{ASSET_LABELS[a.label] || a.label}</Text>
              </View>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>{fmt(a.value, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{a.percentage.toFixed(1)}%</Text>
            </View>
          ))}
        </View>

        {/* Pie Charts: Sector + Geographic side by side */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          {data.sectorBreakdown.length > 0 ? (
            <View style={{ width: '49%' }}>
              <PieChart
                title="Exposition sectorielle"
                slices={data.sectorBreakdown.map((s, i) => ({
                  label: s.sectorLabel,
                  percentage: s.weight,
                  color: ['#00b4d8', '#03045e', '#0077b6', '#48cae4', '#90e0ef', '#023e8a', '#0096c7', '#2a9d8f', '#264653', '#e76f51'][i % 10],
                  value: s.totalValue,
                }))}
                size={110}
              />
            </View>
          ) : (
            <View style={{ width: '49%' }}>
              <Text style={styles.noteText}>Données sectorielles non disponibles</Text>
            </View>
          )}
          {data.allocations.byRegion.length > 0 && (
            <View style={{ width: '49%' }}>
              <PieChart
                title="Exposition mondiale"
                slices={data.allocations.byRegion.map((r) => ({
                  label: r.label,
                  percentage: r.percentage,
                  color: r.color,
                  value: r.value,
                }))}
                size={110}
                labelMap={REGION_LABELS}
              />
            </View>
          )}
        </View>

        {/* Sector bars (detailed, below pie charts) */}
        <Text style={styles.subsectionTitle}>Principaux secteurs</Text>
        {data.sectorBreakdown.length > 0 ? (
          <SectorBars items={data.sectorBreakdown} />
        ) : (
          <Text style={styles.noteText}>Données sectorielles non disponibles</Text>
        )}

        {/* Rendements annualisés */}
        {hasReturns && (
          <>
            <Text style={styles.subsectionTitle}>Rendements historiques</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableCellHeader, width: '25%' }}>Année</Text>
                <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Portefeuille</Text>
                <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Indice</Text>
                <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>+/- Indice</Text>
              </View>
              {data.annualReturns.map((r, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={{ ...styles.tableCell, width: '25%', fontFamily: 'Helvetica-Bold' }}>{r.year}</Text>
                  <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', color: r.portfolioReturn >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmtPct(r.portfolioReturn)}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', color: r.benchmarkReturn >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmtPct(r.benchmarkReturn)}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold', color: r.difference >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmtPct(r.difference)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* AI Narrative Blocks */}
        <AINarrativeBlock label="Sommaire executif — Analyse IA" content={ai?.executiveSummary} />
        <AINarrativeBlock label="Commentaire d'allocation — Analyse IA" content={ai?.allocationComment} />

        <PageFooter pageNumber={2} total={totalPages} />
      </Page>

      {/* ── PAGE 3: Performance Chart + Detailed Table ─────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Rendement du portefeuille</Text>

        {hasReturns ? (
          <>
            <PerformanceBarChart returns={data.annualReturns} />

            {/* Detailed performance table */}
            <Text style={styles.subsectionTitle}>Détail du rendement annuel</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableCellHeader, width: '15%' }}>Année</Text>
                <Text style={{ ...styles.tableCellHeader, width: '22%', textAlign: 'right' }}>Rend. total %</Text>
                <Text style={{ ...styles.tableCellHeader, width: '22%', textAlign: 'right' }}>Indice réf. %</Text>
                <Text style={{ ...styles.tableCellHeader, width: '22%', textAlign: 'right' }}>+/- Indice %</Text>
                <Text style={{ ...styles.tableCellHeader, width: '19%', textAlign: 'right' }}>Résultat</Text>
              </View>
              {data.annualReturns.map((r, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={{ ...styles.tableCell, width: '15%', fontFamily: 'Helvetica-Bold' }}>{r.year}</Text>
                  <Text style={{ ...styles.tableCell, width: '22%', textAlign: 'right', color: r.portfolioReturn >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmtPct(r.portfolioReturn)}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '22%', textAlign: 'right' }}>
                    {fmtPct(r.benchmarkReturn)}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '22%', textAlign: 'right', fontFamily: 'Helvetica-Bold', color: r.difference >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmtPct(r.difference)}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '19%', textAlign: 'right', fontSize: 8 }}>
                    {r.difference >= 0 ? 'Surperformance' : 'Sous-performance'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={{ fontSize: 10, color: '#586e82' }}>
              Les données historiques ne sont pas encore disponibles. Le graphique de rendement sera généré
              lorsque des données historiques FMP seront accessibles pour les titres du portefeuille.
            </Text>
          </View>
        )}

        {/* Composition summary */}
        <Text style={{ ...styles.sectionTitle, marginTop: 16 }}>Composition détaillée</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '10%' }}>Symb.</Text>
            <Text style={{ ...styles.tableCellHeader, width: '18%' }}>Nom</Text>
            <Text style={{ ...styles.tableCellHeader, width: '8%', textAlign: 'right' }}>Qté</Text>
            <Text style={{ ...styles.tableCellHeader, width: '12%', textAlign: 'right' }}>Coût</Text>
            <Text style={{ ...styles.tableCellHeader, width: '12%', textAlign: 'right' }}>Prix</Text>
            <Text style={{ ...styles.tableCellHeader, width: '14%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.tableCellHeader, width: '8%', textAlign: 'right' }}>Poids</Text>
            <Text style={{ ...styles.tableCellHeader, width: '10%', textAlign: 'right' }}>G/P %</Text>
            <Text style={{ ...styles.tableCellHeader, width: '8%' }}>Classe</Text>
          </View>
          {data.portfolio.holdings.map((h: ReportHolding, i: number) => (
            <View key={i} style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
              <Text style={{ ...styles.tableCell, width: '10%', fontFamily: 'Helvetica-Bold' }}>{h.symbol}</Text>
              <Text style={{ ...styles.tableCell, width: '18%' }}>{h.name.substring(0, 22)}</Text>
              <Text style={{ ...styles.tableCell, width: '8%', textAlign: 'right' }}>{fmtNum(h.quantity)}</Text>
              <Text style={{ ...styles.tableCell, width: '12%', textAlign: 'right' }}>{fmtFull(h.avgCost, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '12%', textAlign: 'right' }}>{fmtFull(h.currentPrice, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '14%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                {fmtFull(h.marketValue, ccy)}
              </Text>
              <Text style={{ ...styles.tableCell, width: '8%', textAlign: 'right' }}>{h.weight.toFixed(1)}%</Text>
              <Text style={{
                ...styles.tableCell, width: '10%', textAlign: 'right',
                color: h.gainLossPercent >= 0 ? '#10b981' : '#ef4444',
              }}>
                {fmtPct(h.gainLossPercent)}
              </Text>
              <Text style={{ ...styles.tableCell, width: '8%', fontSize: 7 }}>
                {ASSET_LABELS[h.assetClass]?.substring(0, 8) || h.assetClass}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ ...styles.card, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.bold}>Total ({data.portfolio.holdings.length} positions)</Text>
          <Text style={styles.bold}>{fmtFull(data.portfolio.totalValue, ccy)}</Text>
        </View>

        <PageFooter pageNumber={3} total={totalPages} />
      </Page>

      {/* ── PAGE 4: Tableau Cours Cibles (style Thomson One) ──── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Cours cibles des analystes</Text>
        <Text style={{ fontSize: 9, color: '#586e82', marginBottom: 6 }}>
          Toutes les données financières et les estimations sont données par les analystes financiers sur Yahoo Finance
        </Text>

        {hasTargets ? (
          <>
            {/* Summary row at top */}
            <View style={styles.targetTotalRow}>
              <Text style={{ ...styles.targetCell, width: '7%', fontFamily: 'Helvetica-Bold' }}></Text>
              <Text style={{ ...styles.targetCell, width: '17%', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>TOTAL</Text>
              <Text style={{ ...styles.targetCell, width: '8%' }}></Text>
              <Text style={{ ...styles.targetCell, width: '10%' }}></Text>
              <Text style={{ ...styles.targetCell, width: '10%' }}></Text>
              <Text style={{ ...styles.targetCell, width: '14%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
                {fmt(data.priceTargetSummary.totalCurrentValue, ccy)}
              </Text>
              <Text style={{ ...styles.targetCell, width: '14%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
                {fmt(data.priceTargetSummary.totalTargetValue, ccy)}
              </Text>
              <Text style={{
                ...styles.targetCell, width: '12%', textAlign: 'right', fontSize: 8,
                ...(data.priceTargetSummary.totalEstimatedGainDollar >= 0 ? styles.targetPositive : styles.targetNegative),
              }}>
                {fmt(data.priceTargetSummary.totalEstimatedGainDollar, ccy)}
              </Text>
              <Text style={{
                ...styles.targetCell, width: '8%', textAlign: 'right', fontSize: 8,
                ...(data.priceTargetSummary.totalEstimatedGainPercent >= 0 ? styles.targetPositive : styles.targetNegative),
              }}>
                {fmtPct(data.priceTargetSummary.totalEstimatedGainPercent)}
              </Text>
            </View>

            {/* Column headers */}
            <View style={styles.targetTableHeader}>
              <Text style={{ ...styles.targetHeaderCell, width: '7%' }}>Qté</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '17%' }}>Description</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '8%' }}>Symb.</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '10%', textAlign: 'right' }}>Coût</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '10%', textAlign: 'right' }}>Crs cible</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '14%', textAlign: 'right' }}>Coût total</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '14%', textAlign: 'right' }}>Crs cible 12m</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '12%', textAlign: 'right' }}>Gain esp. $</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '8%', textAlign: 'right' }}>Var. %</Text>
            </View>

            {/* Data rows */}
            {data.holdingProfiles.map((hp: HoldingProfile, i: number) => (
              <View key={i} style={i % 2 === 0 ? styles.targetRow : styles.targetRowAlt}>
                <Text style={{ ...styles.targetCell, width: '7%' }}>{fmtNum(hp.quantity)}</Text>
                <Text style={{ ...styles.targetCell, width: '17%' }}>{hp.companyName.substring(0, 22)}</Text>
                <Text style={{ ...styles.targetCell, width: '8%', fontFamily: 'Helvetica-Bold' }}>{hp.symbol}</Text>
                <Text style={{ ...styles.targetCell, width: '10%', textAlign: 'right' }}>{fmtFull(hp.currentPrice, ccy)}</Text>
                <Text style={{ ...styles.targetCell, width: '10%', textAlign: 'right' }}>
                  {hp.targetPrice > 0 ? fmtFull(hp.targetPrice, ccy) : 'N/D'}
                </Text>
                <Text style={{ ...styles.targetCell, width: '14%', textAlign: 'right' }}>{fmt(hp.currentPrice * hp.quantity, ccy)}</Text>
                <Text style={{ ...styles.targetCell, width: '14%', textAlign: 'right' }}>
                  {hp.targetPrice > 0 ? fmt(hp.quantity * hp.targetPrice, ccy) : 'N/D'}
                </Text>
                <Text style={{
                  ...styles.targetCell, width: '12%', textAlign: 'right',
                  ...(hp.estimatedGainDollar >= 0 ? styles.targetPositive : styles.targetNegative),
                }}>
                  {hp.targetPrice > 0 ? fmt(hp.estimatedGainDollar, ccy) : '—'}
                </Text>
                <Text style={{
                  ...styles.targetCell, width: '8%', textAlign: 'right',
                  ...(hp.estimatedGainPercent >= 0 ? styles.targetPositive : styles.targetNegative),
                }}>
                  {hp.targetPrice > 0 ? fmtPct(hp.estimatedGainPercent) : '—'}
                </Text>
              </View>
            ))}

            {/* ── Sommaire des indicateurs sous le tableau ── */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 4 }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 7, color: '#8a9bb0' }}>Couverture analystes</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#03045e' }}>
                  {coveredCount}/{data.holdingProfiles.length} titres
                </Text>
                {totalAnalysts > 0 && (
                  <Text style={{ fontSize: 7, color: '#8a9bb0' }}>{totalAnalysts} analystes au total</Text>
                )}
              </View>
              {estimatedDividend > 0 && (
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 7, color: '#8a9bb0' }}>Revenu de dividende estimé</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#10b981' }}>
                    {fmt(estimatedDividend, ccy)} / an
                  </Text>
                </View>
              )}
              {weightedBeta > 0 && (
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 7, color: '#8a9bb0' }}>Bêta pondéré du portefeuille</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#03045e' }}>
                    {weightedBeta.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={{ fontSize: 10, color: '#586e82' }}>
              Les cours cibles des analystes ne sont pas disponibles pour les titres de ce portefeuille.
              Cette section sera remplie lorsque les données Yahoo Finance seront accessibles.
            </Text>
          </View>
        )}

        <Text style={styles.noteText}>
          Les cours cibles sont des estimations consensus des analystes et ne constituent pas une garantie de rendement futur.
          Source: Yahoo Finance / Financial Modeling Prep (FMP).
        </Text>

        {/* AI Target Analysis */}
        <AINarrativeBlock label="Analyse des cours cibles — IA" content={ai?.targetAnalysis} />

        <PageFooter pageNumber={4} total={totalPages} />
      </Page>

      {/* ── PAGE 5 (conditional): Valorisation intrinsèque ────── */}
      {hasValuation && valData && (() => {
        // Build lookup: symbol → holding for portfolio-weighted values
        const holdingMap = new Map(data.portfolio.holdings.map((h) => [h.symbol, h]));
        const totalPortfolioValue = data.portfolio.totalValue;

        // Compute portfolio-level totals
        const totalAllocated = valData.reduce((sum, v) => {
          const h = holdingMap.get(v.symbol);
          return sum + (h ? h.marketValue : 0);
        }, 0);
        const totalIntrinsic = valData.reduce((sum, v) => {
          const h = holdingMap.get(v.symbol);
          if (!h || v.avgIntrinsic <= 0) return sum;
          return sum + h.quantity * v.avgIntrinsic;
        }, 0);

        return (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.sectionTitle}>Valorisation intrinseque — Valuation Master Pro</Text>
          <Text style={{ fontSize: 9, color: '#586e82', marginBottom: 8 }}>
            Analyse multi-methodes: DCF, P/S et P/E — Valeurs ponderees par l&apos;allocation du portefeuille
          </Text>

          {/* Main valuation table — now with portfolio-weighted columns */}
          <View style={styles.table}>
            <View style={styles.valuationTableHeader}>
              <Text style={{ ...styles.valuationHeaderCell, width: '8%' }}>Symb.</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '8%', textAlign: 'right' }}>Poids</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '11%', textAlign: 'right' }}>Alloc. $</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '9%', textAlign: 'right' }}>Prix</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '9%', textAlign: 'right' }}>DCF</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '9%', textAlign: 'right' }}>P/S</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '9%', textAlign: 'right' }}>P/E</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '9%', textAlign: 'right' }}>Moy.</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '11%', textAlign: 'right' }}>Val. intr. $</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '7%', textAlign: 'right' }}>Ecart</Text>
              <Text style={{ ...styles.valuationHeaderCell, width: '10%', textAlign: 'center' }}>Signal</Text>
            </View>
            {valData.map((v: ValuationDataItem, i: number) => {
              const h = holdingMap.get(v.symbol);
              const qty = h?.quantity || 0;
              const weight = h?.weight || 0;
              const allocatedValue = h?.marketValue || 0;
              const intrinsicTotal = v.avgIntrinsic > 0 ? qty * v.avgIntrinsic : 0;
              return (
                <View key={i} style={i % 2 === 0 ? styles.valuationRow : styles.valuationRowAlt}>
                  <Text style={{ ...styles.valuationCell, width: '8%', fontFamily: 'Helvetica-Bold' }}>{v.symbol}</Text>
                  <Text style={{ ...styles.valuationCell, width: '8%', textAlign: 'right' }}>{weight.toFixed(1)}%</Text>
                  <Text style={{ ...styles.valuationCell, width: '11%', textAlign: 'right' }}>{fmt(allocatedValue, ccy)}</Text>
                  <Text style={{ ...styles.valuationCell, width: '9%', textAlign: 'right' }}>{fmtFull(v.currentPrice, ccy)}</Text>
                  <Text style={{ ...styles.valuationCell, width: '9%', textAlign: 'right' }}>
                    {v.priceDcf > 0 ? fmtFull(v.priceDcf, ccy) : 'N/D'}
                  </Text>
                  <Text style={{ ...styles.valuationCell, width: '9%', textAlign: 'right' }}>
                    {v.priceSales > 0 ? fmtFull(v.priceSales, ccy) : 'N/D'}
                  </Text>
                  <Text style={{ ...styles.valuationCell, width: '9%', textAlign: 'right' }}>
                    {v.priceEarnings > 0 ? fmtFull(v.priceEarnings, ccy) : 'N/D'}
                  </Text>
                  <Text style={{ ...styles.valuationCell, width: '9%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                    {fmtFull(v.avgIntrinsic, ccy)}
                  </Text>
                  <Text style={{ ...styles.valuationCell, width: '11%', textAlign: 'right', fontFamily: 'Helvetica-Bold',
                    color: intrinsicTotal > allocatedValue * 1.05 ? '#10b981' : intrinsicTotal < allocatedValue * 0.95 ? '#ef4444' : '#1a2a3a',
                  }}>
                    {intrinsicTotal > 0 ? fmt(intrinsicTotal, ccy) : 'N/D'}
                  </Text>
                  <Text style={{
                    ...styles.valuationCell, width: '7%', textAlign: 'right',
                    color: v.upsidePercent > 10 ? '#10b981' : v.upsidePercent < -10 ? '#ef4444' : '#854d0e',
                    fontFamily: 'Helvetica-Bold', fontSize: 7,
                  }}>
                    {fmtPct(v.upsidePercent)}
                  </Text>
                  <View style={{ width: '10%', alignItems: 'center', justifyContent: 'center' }}>
                    <ValuationBadge upside={v.upsidePercent} />
                  </View>
                </View>
              );
            })}
            {/* Total row */}
            <View style={{ flexDirection: 'row', backgroundColor: '#f3f6fa', paddingVertical: 5, borderTopWidth: 1.5, borderTopColor: '#03045e', borderTopStyle: 'solid' as const }}>
              <Text style={{ ...styles.valuationCell, width: '8%', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>TOTAL</Text>
              <Text style={{ ...styles.valuationCell, width: '8%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
                {totalPortfolioValue > 0 ? `${((totalAllocated / totalPortfolioValue) * 100).toFixed(0)}%` : ''}
              </Text>
              <Text style={{ ...styles.valuationCell, width: '11%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
                {fmt(totalAllocated, ccy)}
              </Text>
              <Text style={{ ...styles.valuationCell, width: '45%' }}></Text>
              <Text style={{ ...styles.valuationCell, width: '11%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8,
                color: totalIntrinsic > totalAllocated * 1.05 ? '#10b981' : totalIntrinsic < totalAllocated * 0.95 ? '#ef4444' : '#1a2a3a',
              }}>
                {totalIntrinsic > 0 ? fmt(totalIntrinsic, ccy) : ''}
              </Text>
              <Text style={{ ...styles.valuationCell, width: '17%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8,
                color: totalIntrinsic > totalAllocated * 1.05 ? '#10b981' : totalIntrinsic < totalAllocated * 0.95 ? '#ef4444' : '#1a2a3a',
              }}>
                {totalAllocated > 0 && totalIntrinsic > 0 ? fmtPct(((totalIntrinsic - totalAllocated) / totalAllocated) * 100) : ''}
              </Text>
            </View>
          </View>

          {/* Reverse DCF */}
          <Text style={styles.subsectionTitle}>DCF inverse — Croissance implicite du marche</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.tableCellHeader, width: '20%' }}>Symbole</Text>
              <Text style={{ ...styles.tableCellHeader, width: '30%' }}>Nom</Text>
              <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Croissance impl.</Text>
              <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Interpretation</Text>
            </View>
            {valData.map((v: ValuationDataItem, i: number) => (
              <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={{ ...styles.tableCell, width: '20%', fontFamily: 'Helvetica-Bold' }}>{v.symbol}</Text>
                <Text style={{ ...styles.tableCell, width: '30%' }}>{v.name.substring(0, 25)}</Text>
                <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                  {v.reverseDcfGrowth !== 0 ? `${(v.reverseDcfGrowth * 100).toFixed(1)}%` : 'N/D'}
                </Text>
                <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', fontSize: 8 }}>
                  {v.reverseDcfGrowth > 0.15 ? 'Optimiste' : v.reverseDcfGrowth > 0.05 ? 'Raisonnable' : v.reverseDcfGrowth > 0 ? 'Conservateur' : 'N/D'}
                </Text>
              </View>
            ))}
          </View>

          {/* Sensitivity matrices for top 3 */}
          {valData.filter((v: ValuationDataItem) => v.sensitivityMatrix).length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Matrices de sensibilite (top positions)</Text>
              {valData
                .filter((v: ValuationDataItem) => v.sensitivityMatrix)
                .map((v: ValuationDataItem, i: number) => (
                  <SensitivityMatrix
                    key={i}
                    matrix={v.sensitivityMatrix!}
                    symbol={v.symbol}
                    currentPrice={v.currentPrice}
                  />
                ))}
            </>
          )}

          {/* Scorecard */}
          <Text style={styles.subsectionTitle}>Tableau de bord — Scores (0-10)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {valData.slice(0, 6).map((v: ValuationDataItem, i: number) => (
              <View key={i} style={{ width: '48%', backgroundColor: '#f8f9fb', borderRadius: 6, padding: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#03045e', marginBottom: 4 }}>
                  {v.symbol} — {v.scores.overall.toFixed(1)}/10
                </Text>
                <ScoreBar label="Sante" score={v.scores.health} />
                <ScoreBar label="Croissance" score={v.scores.growth} />
                <ScoreBar label="Valorisation" score={v.scores.valuation} />
              </View>
            ))}
          </View>

          {/* AI Valuation Comment */}
          <AINarrativeBlock label="Commentaire de valorisation — IA" content={ai?.valuationComment} />

          <Text style={styles.noteText}>
            Les valorisations sont des estimations basees sur des modeles financiers. Elles ne constituent pas des recommandations d&apos;investissement.
          </Text>

          <PageFooter pageNumber={5} total={totalPages} />
        </Page>
        );
      })()}

      {/* ── PAGE 5+offset: Fiches Descriptives des Titres ─────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Fiches descriptives des titres</Text>
        <Text style={{ fontSize: 9, color: '#586e82', marginBottom: 12 }}>
          {hasAI ? 'Descriptions en francais — Analyse IA + Financial Modeling Prep' : 'Profil detaille des positions du portefeuille — Source: Financial Modeling Prep'}
        </Text>

        {/* If AI descriptions are available, override the HoldingCards descriptions */}
        <HoldingCards
          profiles={data.holdingProfiles.slice(0, 5).map((hp) => ({
            ...hp,
            description: ai?.holdingDescriptions?.[hp.symbol] || hp.description,
          }))}
          currency={ccy}
        />

        <PageFooter pageNumber={5 + valOffset} total={totalPages} />
      </Page>

      {/* ── PAGE 6+offset: Fiches suite + Top positions ──────────────── */}
      <Page size="LETTER" style={styles.page}>
        {data.holdingProfiles.length > 5 ? (
          <>
            <Text style={styles.sectionTitle}>Fiches descriptives (suite)</Text>
            <HoldingCards
              profiles={data.holdingProfiles.slice(5, 10).map((hp) => ({
                ...hp,
                description: ai?.holdingDescriptions?.[hp.symbol] || hp.description,
              }))}
              currency={ccy}
            />
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Top 5 positions &amp; Profil client</Text>

            <Text style={styles.subsectionTitle}>Top 5 avoirs</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableCellHeader, width: '5%' }}>#</Text>
                <Text style={{ ...styles.tableCellHeader, width: '15%' }}>Symbole</Text>
                <Text style={{ ...styles.tableCellHeader, width: '30%' }}>Nom</Text>
                <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Valeur</Text>
                <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Poids</Text>
              </View>
              {data.topPositions.map((t, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, width: '5%', fontFamily: 'Helvetica-Bold' }}>{i + 1}</Text>
                  <Text style={{ ...styles.tableCell, width: '15%', fontFamily: 'Helvetica-Bold' }}>{t.symbol}</Text>
                  <Text style={{ ...styles.tableCell, width: '30%' }}>{t.name}</Text>
                  <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>{fmtFull(t.market_value, ccy)}</Text>
                  <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                    {t.weight.toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.subsectionTitle}>Profil du client</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.cardLabel}>Type</Text>
                <Text style={styles.cardValue}>{data.client.type === 'client' ? 'Client' : 'Prospect'}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.cardLabel}>Profil de risque</Text>
                <Text style={styles.cardValue}>{RISK_LABELS[data.client.riskProfile] || data.client.riskProfile}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.cardLabel}>Horizon</Text>
                <Text style={styles.cardValue}>{data.client.horizon || 'N/D'}</Text>
              </View>
            </View>
            {data.client.objectives && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Objectifs d&apos;investissement</Text>
                <Text style={{ fontSize: 10 }}>{data.client.objectives}</Text>
              </View>
            )}
          </>
        )}

        <PageFooter pageNumber={6 + valOffset} total={totalPages} />
      </Page>

      {/* ── PAGE 7+offset: Risk Metrics + Scenarios + Stress Tests ────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Métriques de risque &amp; Scénarios</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Volatilité</Text>
            <Text style={styles.cardValue}>{data.riskMetrics.volatility.toFixed(1)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Sharpe</Text>
            <Text style={styles.cardValue}>{data.riskMetrics.sharpe.toFixed(2)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Drawdown max</Text>
            <Text style={{ ...styles.cardValue, color: '#ef4444' }}>-{data.riskMetrics.maxDrawdown.toFixed(1)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Bêta</Text>
            <Text style={styles.cardValue}>{data.riskMetrics.beta.toFixed(2)}</Text>
          </View>
        </View>

        {/* Scenarios */}
        <Text style={styles.subsectionTitle}>Scénarios de projection — {data.config.projectionYears} ans</Text>
        <View style={styles.statsRow}>
          {data.scenarios.map((s) => (
            <View key={s.name} style={styles.statBox}>
              <Text style={styles.cardLabel}>{s.name}</Text>
              <Text style={styles.cardValue}>{fmt(s.projectedValue, ccy)}</Text>
              <Text style={{
                fontSize: 9, marginTop: 2,
                color: s.annualizedReturn >= 0 ? '#10b981' : '#ef4444',
              }}>
                {fmtPct(s.annualizedReturn)} / an
              </Text>
            </View>
          ))}
        </View>

        {/* Projection table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '25%' }}>Année</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Optimiste</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Base</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Pessimiste</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={{ ...styles.tableCell, width: '25%', fontFamily: 'Helvetica-Bold' }}>Départ</Text>
            <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>{fmt(data.portfolio.totalValue, ccy)}</Text>
            <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>{fmt(data.portfolio.totalValue, ccy)}</Text>
            <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>{fmt(data.portfolio.totalValue, ccy)}</Text>
          </View>
          {data.projectionYears.map((py) => (
            <View key={py.year} style={py.year % 2 === 0 ? styles.tableRowAlt : styles.tableRow}>
              <Text style={{ ...styles.tableCell, width: '25%', fontFamily: 'Helvetica-Bold' }}>An {py.year}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', color: '#10b981' }}>{fmt(py.bull, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>{fmt(py.base, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', color: py.bear < data.portfolio.totalValue ? '#ef4444' : '#1a2a3a' }}>
                {fmt(py.bear, ccy)}
              </Text>
            </View>
          ))}
        </View>

        {/* Stress Tests */}
        <Text style={styles.subsectionTitle}>Tests de résistance</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '30%' }}>Scénario</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Valeur après</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Perte ($)</Text>
            <Text style={{ ...styles.tableCellHeader, width: '20%', textAlign: 'right' }}>Impact (%)</Text>
          </View>
          {data.stressTests.map((st, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, width: '30%', fontFamily: 'Helvetica-Bold' }}>{st.name}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>{fmt(st.impactedValue, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', color: '#ef4444' }}>-{fmt(Math.abs(st.loss), ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '20%', textAlign: 'right', color: '#ef4444', fontFamily: 'Helvetica-Bold' }}>{st.lossPercent.toFixed(1)}%</Text>
            </View>
          ))}
        </View>

        {data.riskMetrics.estimated && (
          <Text style={styles.noteText}>
            Les métriques de risque sont estimées à partir des caractéristiques de classe d&apos;actif.
          </Text>
        )}

        {/* AI Risk Interpretation */}
        <AINarrativeBlock label="Interpretation des risques — IA" content={ai?.riskInterpretation} />

        <PageFooter pageNumber={7 + valOffset} total={totalPages} />
      </Page>

      {/* ── PAGE 8+offset: Disclaimers ───────────────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Avertissements importants</Text>

        <View style={styles.mb16}>
          <Text style={styles.disclaimer}>
            1. NATURE DU DOCUMENT{'\n'}
            Ce rapport est fourni à titre informatif seulement et ne constitue pas un conseil financier personnalisé,
            une recommandation d&apos;investissement, ou une offre de vente ou de sollicitation d&apos;achat de titres.{'\n'}
            {'\n'}
            2. RENDEMENTS ET PROJECTIONS{'\n'}
            Les rendements passés ne sont pas garants des rendements futurs. Les projections, scénarios et estimations
            présentés sont basés sur des hypothèses qui pourraient ne pas se réaliser. Les résultats réels peuvent
            différer significativement des projections.{'\n'}
            {'\n'}
            3. DONNÉES DE MARCHÉ{'\n'}
            Les prix et données de marché utilisés dans ce rapport proviennent de Financial Modeling Prep (FMP)
            et sont considérés fiables mais leur exactitude ne peut être garantie. Les prix peuvent présenter un délai
            par rapport au marché en temps réel.{'\n'}
            {'\n'}
            4. COURS CIBLES DES ANALYSTES{'\n'}
            Les cours cibles présentés dans ce rapport sont des estimations consensus des analystes financiers
            compilées par Yahoo Finance et Financial Modeling Prep. Ils ne constituent pas une garantie de rendement futur.
            Les estimations des analystes sont sujettes à révision et les résultats réels peuvent différer
            significativement des prévisions.{'\n'}
            {'\n'}
            5. MÉTRIQUES DE RISQUE{'\n'}
            Les métriques de risque (volatilité, Sharpe, bêta, drawdown) sont des estimations basées sur les
            caractéristiques historiques des classes d&apos;actif et ne prédisent pas le risque futur avec certitude.{'\n'}
            {'\n'}
            6. TESTS DE RÉSISTANCE{'\n'}
            Les stress tests simulent l&apos;impact de crises historiques passées. Ils ne prévoient pas les crises futures
            qui pourraient avoir des impacts différents.{'\n'}
            {'\n'}
            7. DÉCISIONS D&apos;INVESTISSEMENT{'\n'}
            Toute décision d&apos;investissement doit être prise en consultation avec votre conseiller financier,
            en tenant compte de votre situation personnelle, de vos objectifs et de votre tolérance au risque.{'\n'}
            {'\n'}
            8. CONFIDENTIALITÉ{'\n'}
            Ce rapport est confidentiel et destiné uniquement au client nommé en page de couverture.
            Toute reproduction ou distribution non autorisée est interdite.{'\n'}
            {'\n'}
            9. SOURCES DES DONNÉES{'\n'}
            Prix de marché: Financial Modeling Prep (FMP){'\n'}
            Cours cibles analystes: Yahoo Finance (principal) / FMP (fallback){'\n'}
            Profils d&apos;entreprise: FMP Company Profile{'\n'}
            Données historiques: FMP Historical Prices{'\n'}
            {hasValuation ? `Valorisation intrinsèque: Valuation Master Pro (DCF, P/S, P/E)\n` : ''}
            {'\n'}
            10. RÉGLEMENTATION{'\n'}
            Groupe Financier Ste-Foy est réglementé par l&apos;Autorité des marchés financiers (AMF) du Québec.
            Les services de planification financière sont offerts conformément aux lois et règlements applicables.
            {hasAI ? `${'\n'}${'\n'}11. CONTENU GÉNÉRÉ PAR INTELLIGENCE ARTIFICIELLE${'\n'}Certaines sections de ce rapport (identifiées par « Analyse IA ») ont été générées par un modèle de langage (Groq / Llama). Ce contenu est fourni à titre informatif uniquement et ne constitue pas un avis professionnel. Le contenu IA est basé sur les données du portefeuille au moment de la génération et peut contenir des inexactitudes. Toute décision doit être validée par votre conseiller financier.` : ''}
          </Text>
        </View>

        {data.portfolio.modelSource && (
          <View style={styles.card}>
            <Text style={{ fontSize: 8, color: '#586e82' }}>
              Ce portefeuille a été créé à partir du modèle «{data.portfolio.modelSource}».
              La composition reflète la répartition cible du modèle au moment de l&apos;application.
            </Text>
          </View>
        )}

        <View style={{ marginTop: 'auto', paddingTop: 20 }}>
          <Text style={{ fontSize: 8, color: '#8a9bb0', textAlign: 'center' }}>
            Rapport généré le {data.generatedAt} par le système Planificateur de Rencontre
          </Text>
          <Text style={{ fontSize: 8, color: '#8a9bb0', textAlign: 'center', marginTop: 4 }}>
            Groupe Financier Ste-Foy — Tous droits réservés
          </Text>
        </View>

        <PageFooter pageNumber={8 + valOffset} total={totalPages} />
      </Page>
    </Document>
  );
}

// ─── Legacy 5-page export (backward compat) ─────────────────────

export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverBand} />
        <View style={{ alignItems: 'center', marginTop: 100 }}>
          <View style={{
            width: 70, height: 70, borderRadius: 12,
            backgroundColor: '#03045e', justifyContent: 'center', alignItems: 'center', marginBottom: 30,
          }}>
            <Text style={{ color: 'white', fontSize: 24, fontFamily: 'Helvetica-Bold' }}>GF</Text>
          </View>
          <Text style={styles.coverTitle}>Rapport de portefeuille</Text>
          <Text style={styles.coverSubtitle}>{data.portfolio.name}</Text>
          <Text style={styles.coverInfo}>Préparé pour: {data.client.name}</Text>
          <Text style={styles.coverInfo}>Conseiller: {data.advisor.name}</Text>
          {data.advisor.title && <Text style={styles.coverInfo}>{data.advisor.title}</Text>}
          <Text style={{ ...styles.coverInfo, marginTop: 20 }}>{data.generatedAt}</Text>
        </View>
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Résumé exécutif</Text>
        <View style={styles.mb16}>
          <View style={styles.bullet}><View style={styles.bulletDot} /><Text style={styles.bulletText}>Valeur totale: {fmtFull(data.portfolio.totalValue, data.portfolio.currency)}</Text></View>
          <View style={styles.bullet}><View style={styles.bulletDot} /><Text style={styles.bulletText}>Positions: {data.portfolio.holdings.length}</Text></View>
          <View style={styles.bullet}><View style={styles.bulletDot} /><Text style={styles.bulletText}>Type de compte: {data.portfolio.accountType}</Text></View>
          <View style={styles.bullet}><View style={styles.bulletDot} /><Text style={styles.bulletText}>Profil: {data.client.riskProfile}</Text></View>
        </View>
        <Text style={styles.sectionTitle}>Profil du client</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.cardLabel}>Type</Text><Text style={styles.cardValue}>{data.client.type}</Text></View>
          <View style={styles.statBox}><Text style={styles.cardLabel}>Risque</Text><Text style={styles.cardValue}>{data.client.riskProfile}</Text></View>
          <View style={styles.statBox}><Text style={styles.cardLabel}>Horizon</Text><Text style={styles.cardValue}>{data.client.horizon || 'N/D'}</Text></View>
        </View>
        {data.client.objectives && <View style={styles.card}><Text style={styles.cardLabel}>Objectifs</Text><Text style={{ fontSize: 10 }}>{data.client.objectives}</Text></View>}
        <PageFooter pageNumber={2} total={5} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Composition du portefeuille</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '12%' }}>Symbole</Text>
            <Text style={{ ...styles.tableCellHeader, width: '23%' }}>Nom</Text>
            <Text style={{ ...styles.tableCellHeader, width: '10%', textAlign: 'right' }}>Qté</Text>
            <Text style={{ ...styles.tableCellHeader, width: '13%', textAlign: 'right' }}>Coût moy.</Text>
            <Text style={{ ...styles.tableCellHeader, width: '13%', textAlign: 'right' }}>Prix</Text>
            <Text style={{ ...styles.tableCellHeader, width: '15%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.tableCellHeader, width: '7%', textAlign: 'right' }}>Poids</Text>
            <Text style={{ ...styles.tableCellHeader, width: '7%', textAlign: 'right' }}>G/P</Text>
          </View>
          {data.portfolio.holdings.map((h, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, width: '12%', fontFamily: 'Helvetica-Bold' }}>{h.symbol}</Text>
              <Text style={{ ...styles.tableCell, width: '23%' }}>{h.name}</Text>
              <Text style={{ ...styles.tableCell, width: '10%', textAlign: 'right' }}>{h.quantity}</Text>
              <Text style={{ ...styles.tableCell, width: '13%', textAlign: 'right' }}>{fmtFull(h.avgCost)}</Text>
              <Text style={{ ...styles.tableCell, width: '13%', textAlign: 'right' }}>{fmtFull(h.currentPrice)}</Text>
              <Text style={{ ...styles.tableCell, width: '15%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmtFull(h.marketValue)}</Text>
              <Text style={{ ...styles.tableCell, width: '7%', textAlign: 'right' }}>{h.weight.toFixed(1)}%</Text>
              <Text style={{ ...styles.tableCell, width: '7%', textAlign: 'right', color: h.gainLoss >= 0 ? '#10b981' : '#ef4444' }}>{fmtPct(h.gainLoss)}</Text>
            </View>
          ))}
        </View>
        <View style={{ ...styles.card, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.bold}>Total</Text>
          <Text style={styles.bold}>{fmtFull(data.portfolio.totalValue, data.portfolio.currency)}</Text>
        </View>
        <PageFooter pageNumber={3} total={5} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Performance historique</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '25%' }}>Période</Text>
            {Object.keys(data.performance.periods).map((p) => (
              <Text key={p} style={{ ...styles.tableCellHeader, width: `${75 / Object.keys(data.performance.periods).length}%`, textAlign: 'right' }}>{p}</Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            <Text style={{ ...styles.tableCell, width: '25%', fontFamily: 'Helvetica-Bold' }}>Portefeuille</Text>
            {Object.entries(data.performance.periods).map(([p, v]) => (
              <Text key={p} style={{ ...styles.tableCell, width: `${75 / Object.keys(data.performance.periods).length}%`, textAlign: 'right', color: v >= 0 ? '#10b981' : '#ef4444', fontFamily: 'Helvetica-Bold' }}>{fmtPct(v)}</Text>
            ))}
          </View>
          {Object.entries(data.performance.benchmarks).map(([name, periods]) => (
            <View key={name} style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, width: '25%' }}>{name}</Text>
              {Object.entries(periods).map(([p, v]) => (
                <Text key={p} style={{ ...styles.tableCell, width: `${75 / Object.keys(periods).length}%`, textAlign: 'right', color: v >= 0 ? '#10b981' : '#ef4444' }}>{fmtPct(v)}</Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.sectionTitle}>Métriques de risque</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.cardLabel}>Volatilité</Text><Text style={styles.cardValue}>{data.riskMetrics.volatility.toFixed(1)}%</Text></View>
          <View style={styles.statBox}><Text style={styles.cardLabel}>Sharpe</Text><Text style={styles.cardValue}>{data.riskMetrics.sharpe.toFixed(2)}</Text></View>
          <View style={styles.statBox}><Text style={styles.cardLabel}>Drawdown max</Text><Text style={{ ...styles.cardValue, color: '#ef4444' }}>-{data.riskMetrics.maxDrawdown.toFixed(1)}%</Text></View>
          <View style={styles.statBox}><Text style={styles.cardLabel}>Bêta</Text><Text style={styles.cardValue}>{data.riskMetrics.beta.toFixed(2)}</Text></View>
        </View>
        <PageFooter pageNumber={4} total={5} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Perspectives et scénarios</Text>
        <Text style={{ ...styles.mb16, fontSize: 9, color: '#586e82' }}>Projections sur 5 ans, ajustées pour l&apos;inflation</Text>
        <View style={styles.statsRow}>
          {data.scenarios.map((s) => (
            <View key={s.name} style={styles.statBox}>
              <Text style={styles.cardLabel}>{s.name}</Text>
              <Text style={styles.cardValue}>{fmtFull(s.projectedValue)}</Text>
              <Text style={{ fontSize: 9, marginTop: 2, color: s.annualizedReturn >= 0 ? '#10b981' : '#ef4444' }}>{fmtPct(s.annualizedReturn)} / an</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 40 }}>
          <Text style={styles.sectionTitle}>Avertissements importants</Text>
          <Text style={styles.disclaimer}>
            {'\u2022'} Les données sont fournies à titre indicatif et ne constituent pas un conseil financier.{'\n'}
            {'\u2022'} Les rendements passés ne sont pas garants des rendements futurs.{'\n'}
            {'\u2022'} Les projections sont basées sur des hypothèses qui pourraient ne pas se réaliser.{'\n'}
            {'\u2022'} Ce rapport est confidentiel et destiné uniquement au client nommé ci-dessus.{'\n'}
            {'\u2022'} Groupe Financier Ste-Foy est réglementé par l&apos;AMF du Québec.
          </Text>
        </View>
        <PageFooter pageNumber={5} total={5} />
      </Page>
    </Document>
  );
}

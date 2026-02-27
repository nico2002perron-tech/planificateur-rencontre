import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import type {
  FullReportData,
  ReportHolding,
  HoldingProfile,
  AnnualReturn,
  SectorBreakdownItem,
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

// ─── Full 8-Page Morningstar-style Report ───────────────────────

export function FullReportDocument({ data }: { data: FullReportData }) {
  const ccy = data.portfolio.currency;
  const totalPages = 8;
  const hasTargets = data.holdingProfiles.some((hp) => hp.targetPrice > 0);
  const hasReturns = data.annualReturns.length > 0;
  const estimatedDividend = data.holdingProfiles.reduce((sum, hp) => sum + (hp.lastDiv * hp.quantity), 0);

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

        {/* Top 5 Sectors */}
        <Text style={styles.subsectionTitle}>Principaux secteurs</Text>
        {data.sectorBreakdown.length > 0 ? (
          <SectorBars items={data.sectorBreakdown} />
        ) : (
          <Text style={styles.noteText}>Données sectorielles non disponibles</Text>
        )}

        {/* Regions */}
        <Text style={styles.subsectionTitle}>Répartition géographique</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '50%' }}>Région</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Poids</Text>
          </View>
          {data.allocations.byRegion.map((r, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, width: '50%' }}>{REGION_LABELS[r.label] || r.label}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>{fmt(r.value, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{r.percentage.toFixed(1)}%</Text>
            </View>
          ))}
        </View>

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
        <Text style={{ fontSize: 9, color: '#586e82', marginBottom: 12 }}>
          Consensus des analystes financiers — Estimation de la variation sur 12 mois
        </Text>

        {hasTargets ? (
          <>
            {/* Summary row at top */}
            <View style={styles.targetTotalRow}>
              <Text style={{ ...styles.targetCell, width: '5%', fontFamily: 'Helvetica-Bold' }}></Text>
              <Text style={{ ...styles.targetCell, width: '13%', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>TOTAL</Text>
              <Text style={{ ...styles.targetCell, width: '8%' }}></Text>
              <Text style={{ ...styles.targetCell, width: '10%' }}></Text>
              <Text style={{ ...styles.targetCell, width: '10%' }}></Text>
              <Text style={{ ...styles.targetCell, width: '10%' }}></Text>
              <Text style={{ ...styles.targetCell, width: '12%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
                {fmt(data.portfolio.totalCost, ccy)}
              </Text>
              <Text style={{ ...styles.targetCell, width: '12%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
                {fmt(data.priceTargetSummary.totalCurrentValue, ccy)}
              </Text>
              <Text style={{ ...styles.targetCell, width: '12%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
                {fmt(data.priceTargetSummary.totalTargetValue, ccy)}
              </Text>
              <Text style={{
                ...styles.targetCell, width: '10%', textAlign: 'right', fontSize: 8,
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
              <Text style={{ ...styles.targetHeaderCell, width: '5%' }}>Qté</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '13%' }}>Description</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '8%' }}>Symb.</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '10%', textAlign: 'right' }}>Coût</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '10%', textAlign: 'right' }}>Prix march.</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '10%', textAlign: 'right' }}>Crs cible</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '12%', textAlign: 'right' }}>Coût total</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '12%', textAlign: 'right' }}>Val. marché</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '12%', textAlign: 'right' }}>Crs cible 12m</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '10%', textAlign: 'right' }}>Gain esp. $</Text>
              <Text style={{ ...styles.targetHeaderCell, width: '8%', textAlign: 'right' }}>Var. %</Text>
            </View>

            {/* Data rows */}
            {data.holdingProfiles.map((hp: HoldingProfile, i: number) => (
              <View key={i} style={i % 2 === 0 ? styles.targetRow : styles.targetRowAlt}>
                <Text style={{ ...styles.targetCell, width: '5%' }}>{fmtNum(hp.quantity)}</Text>
                <Text style={{ ...styles.targetCell, width: '13%' }}>{hp.companyName.substring(0, 18)}</Text>
                <Text style={{ ...styles.targetCell, width: '8%', fontFamily: 'Helvetica-Bold' }}>{hp.symbol}</Text>
                <Text style={{ ...styles.targetCell, width: '10%', textAlign: 'right' }}>{fmtFull(hp.costBasis / hp.quantity, ccy)}</Text>
                <Text style={{ ...styles.targetCell, width: '10%', textAlign: 'right' }}>{fmtFull(hp.currentPrice, ccy)}</Text>
                <Text style={{ ...styles.targetCell, width: '10%', textAlign: 'right' }}>
                  {hp.targetPrice > 0 ? fmtFull(hp.targetPrice, ccy) : 'N/D'}
                </Text>
                <Text style={{ ...styles.targetCell, width: '12%', textAlign: 'right' }}>{fmt(hp.costBasis, ccy)}</Text>
                <Text style={{ ...styles.targetCell, width: '12%', textAlign: 'right' }}>{fmt(hp.quantity * hp.currentPrice, ccy)}</Text>
                <Text style={{ ...styles.targetCell, width: '12%', textAlign: 'right' }}>
                  {hp.targetPrice > 0 ? fmt(hp.quantity * hp.targetPrice, ccy) : 'N/D'}
                </Text>
                <Text style={{
                  ...styles.targetCell, width: '10%', textAlign: 'right',
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
          </>
        ) : (
          <View style={styles.card}>
            <Text style={{ fontSize: 10, color: '#586e82' }}>
              Les cours cibles des analystes ne sont pas disponibles pour les titres de ce portefeuille.
              Cette section sera remplie lorsque les données FMP seront accessibles.
            </Text>
          </View>
        )}

        <Text style={styles.noteText}>
          Les cours cibles sont des estimations consensus des analystes et ne constituent pas une garantie de rendement futur.
          Source: Financial Modeling Prep (FMP).
        </Text>

        <PageFooter pageNumber={4} total={totalPages} />
      </Page>

      {/* ── PAGE 5: Fiches Descriptives des Titres ─────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Fiches descriptives des titres</Text>
        <Text style={{ fontSize: 9, color: '#586e82', marginBottom: 12 }}>
          Profil détaillé des positions du portefeuille — Source: Financial Modeling Prep
        </Text>

        <HoldingCards
          profiles={data.holdingProfiles.slice(0, 5)}
          currency={ccy}
        />

        <PageFooter pageNumber={5} total={totalPages} />
      </Page>

      {/* ── PAGE 6: Fiches suite + Top positions ──────────────── */}
      <Page size="LETTER" style={styles.page}>
        {data.holdingProfiles.length > 5 ? (
          <>
            <Text style={styles.sectionTitle}>Fiches descriptives (suite)</Text>
            <HoldingCards
              profiles={data.holdingProfiles.slice(5, 10)}
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

        <PageFooter pageNumber={6} total={totalPages} />
      </Page>

      {/* ── PAGE 7: Risk Metrics + Scenarios + Stress Tests ────── */}
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

        <PageFooter pageNumber={7} total={totalPages} />
      </Page>

      {/* ── PAGE 8: Disclaimers ───────────────────────────────── */}
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
            compilées par Financial Modeling Prep. Ils ne constituent pas une garantie de rendement futur.
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
            Cours cibles analystes: FMP Price Target Consensus{'\n'}
            Profils d&apos;entreprise: FMP Company Profile{'\n'}
            Données historiques: FMP Historical Prices{'\n'}
            {'\n'}
            10. RÉGLEMENTATION{'\n'}
            Groupe Financier Ste-Foy est réglementé par l&apos;Autorité des marchés financiers (AMF) du Québec.
            Les services de planification financière sont offerts conformément aux lois et règlements applicables.
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

        <PageFooter pageNumber={8} total={totalPages} />
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

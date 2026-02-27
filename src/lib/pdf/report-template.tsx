import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import type { FullReportData, ReportHolding } from './report-data';

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

// ─── Full 8-Page Report ─────────────────────────────────────────

export function FullReportDocument({ data }: { data: FullReportData }) {
  const ccy = data.portfolio.currency;
  const totalPages = 8;

  return (
    <Document>
      {/* ── PAGE 1: Cover ──────────────────────────────────────── */}
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
          {data.portfolio.modelSource && (
            <Text style={{ ...styles.coverInfo, marginTop: 10, fontSize: 9, color: '#8a9bb0' }}>
              Basé sur le modèle: {data.portfolio.modelSource}
            </Text>
          )}
          <Text style={{ ...styles.coverInfo, marginTop: 20 }}>{data.generatedAt}</Text>
        </View>
      </Page>

      {/* ── PAGE 2: Executive Summary + Client Profile ─────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Résumé exécutif</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Valeur totale</Text>
            <Text style={styles.cardValue}>{fmt(data.portfolio.totalValue, ccy)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Coût total</Text>
            <Text style={styles.cardValue}>{fmt(data.portfolio.totalCost, ccy)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Gain/Perte</Text>
            <Text style={{
              ...styles.cardValue,
              color: data.portfolio.totalGainLoss >= 0 ? '#10b981' : '#ef4444',
            }}>
              {fmt(data.portfolio.totalGainLoss, ccy)} ({fmtPct(data.portfolio.totalGainLossPercent)})
            </Text>
          </View>
        </View>
        <View style={styles.mb16}>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Nombre de positions: {data.portfolio.holdings.length}</Text>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Type de compte: {data.portfolio.accountType}</Text>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Devise: {ccy}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Profil du client</Text>
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
        <PageFooter pageNumber={2} total={totalPages} />
      </Page>

      {/* ── PAGE 3: Detailed Composition ─────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Composition détaillée du portefeuille</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '10%' }}>Symbole</Text>
            <Text style={{ ...styles.tableCellHeader, width: '18%' }}>Nom</Text>
            <Text style={{ ...styles.tableCellHeader, width: '8%', textAlign: 'right' }}>Qté</Text>
            <Text style={{ ...styles.tableCellHeader, width: '12%', textAlign: 'right' }}>Coût moy.</Text>
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
              <Text style={{ ...styles.tableCell, width: '8%', textAlign: 'right' }}>{h.quantity.toFixed(2)}</Text>
              <Text style={{ ...styles.tableCell, width: '12%', textAlign: 'right' }}>{fmtFull(h.avgCost, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '12%', textAlign: 'right' }}>{fmtFull(h.currentPrice, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '14%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                {fmtFull(h.marketValue, ccy)}
              </Text>
              <Text style={{ ...styles.tableCell, width: '8%', textAlign: 'right' }}>
                {h.weight.toFixed(1)}%
              </Text>
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

        {/* Asset class allocation bar */}
        <Text style={styles.subsectionTitle}>Répartition par classe d&apos;actif</Text>
        <AllocationBar slices={data.allocations.byAssetClass} />
        <Legend slices={data.allocations.byAssetClass} />

        <PageFooter pageNumber={3} total={totalPages} />
      </Page>

      {/* ── PAGE 4: Allocations + Top 5 ──────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Analyse de la répartition</Text>

        {/* Sector Allocation */}
        <Text style={styles.subsectionTitle}>Par secteur</Text>
        {data.allocations.bySector.length > 0 ? (
          <>
            <AllocationBar slices={data.allocations.bySector} />
            <Legend slices={data.allocations.bySector} />
          </>
        ) : (
          <Text style={styles.noteText}>Données sectorielles non disponibles</Text>
        )}

        {/* Region Allocation */}
        <Text style={styles.subsectionTitle}>Par région géographique</Text>
        <AllocationBar slices={data.allocations.byRegion} />
        <Legend slices={data.allocations.byRegion} />

        {/* Top 5 */}
        <Text style={{ ...styles.sectionTitle, marginTop: 16 }}>Top 5 positions</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '5%' }}>#</Text>
            <Text style={{ ...styles.tableCellHeader, width: '20%' }}>Symbole</Text>
            <Text style={{ ...styles.tableCellHeader, width: '35%' }}>Nom</Text>
            <Text style={{ ...styles.tableCellHeader, width: '20%', textAlign: 'right' }}>Valeur</Text>
            <Text style={{ ...styles.tableCellHeader, width: '20%', textAlign: 'right' }}>Poids</Text>
          </View>
          {data.topPositions.map((t, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, width: '5%', fontFamily: 'Helvetica-Bold' }}>{i + 1}</Text>
              <Text style={{ ...styles.tableCell, width: '20%', fontFamily: 'Helvetica-Bold' }}>{t.symbol}</Text>
              <Text style={{ ...styles.tableCell, width: '35%' }}>{t.name}</Text>
              <Text style={{ ...styles.tableCell, width: '20%', textAlign: 'right' }}>{fmtFull(t.market_value, ccy)}</Text>
              <Text style={{ ...styles.tableCell, width: '20%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                {t.weight.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>

        <PageFooter pageNumber={4} total={totalPages} />
      </Page>

      {/* ── PAGE 5: Risk Metrics ──────────────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Métriques de risque</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Volatilité annualisée</Text>
            <Text style={styles.cardValue}>{data.riskMetrics.volatility.toFixed(1)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Ratio de Sharpe</Text>
            <Text style={styles.cardValue}>{data.riskMetrics.sharpe.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Drawdown max estimé</Text>
            <Text style={{ ...styles.cardValue, color: '#ef4444' }}>-{data.riskMetrics.maxDrawdown.toFixed(1)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Bêta du portefeuille</Text>
            <Text style={styles.cardValue}>{data.riskMetrics.beta.toFixed(2)}</Text>
          </View>
        </View>

        {data.riskMetrics.estimated && (
          <View style={styles.card}>
            <Text style={styles.noteText}>
              Note: Ces métriques sont estimées à partir des caractéristiques de classe d&apos;actif de chaque position.
              En l&apos;absence de données historiques réelles, les calculs utilisent des volatilités moyennes
              par catégorie (Actions: ~16%, Rev. fixe: ~5%, Liquidités: ~0.5%, etc.).
              Ces valeurs sont indicatives et ne représentent pas un calcul historique précis.
            </Text>
          </View>
        )}

        <Text style={{ ...styles.sectionTitle, marginTop: 20 }}>Interprétation</Text>
        <View style={styles.mb16}>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Volatilité: </Text>
              Mesure l&apos;amplitude des fluctuations du portefeuille. Plus elle est élevée, plus le risque est grand.
            </Text>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Sharpe: </Text>
              Rendement excédentaire par unité de risque. Au-dessus de 0.5 est acceptable, au-dessus de 1.0 est excellent.
            </Text>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Drawdown max: </Text>
              Perte maximale théorique du sommet au creux. Indique le pire scénario historique estimé.
            </Text>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Bêta: </Text>
              Sensibilité au marché. Un bêta de 1.0 signifie que le portefeuille suit le marché. Inférieur à 1.0 = moins volatile.
            </Text>
          </View>
        </View>

        <PageFooter pageNumber={5} total={totalPages} />
      </Page>

      {/* ── PAGE 6: Scenarios + Projections ───────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Scénarios de projection — {data.config.projectionYears} ans</Text>
        <Text style={{ fontSize: 9, color: '#586e82', marginBottom: 12 }}>
          Projections ajustées pour l&apos;inflation, basées sur la répartition actuelle du portefeuille.
        </Text>

        {/* Summary cards */}
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

        {/* Year-by-year table */}
        <Text style={styles.subsectionTitle}>Projection année par année</Text>
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

        <Text style={styles.noteText}>
          Les scénarios utilisent des hypothèses de rendement par classe d&apos;actif: Actions (2-12%), Rev. fixe (2-5%), ajustées pour l&apos;inflation (2-3%).
        </Text>

        <PageFooter pageNumber={6} total={totalPages} />
      </Page>

      {/* ── PAGE 7: Stress Tests ──────────────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Tests de résistance (Stress Tests)</Text>
        <Text style={{ fontSize: 9, color: '#586e82', marginBottom: 16 }}>
          Simulation de l&apos;impact de crises historiques sur la valeur actuelle du portefeuille.
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '30%' }}>Scénario</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Valeur après impact</Text>
            <Text style={{ ...styles.tableCellHeader, width: '25%', textAlign: 'right' }}>Perte ($)</Text>
            <Text style={{ ...styles.tableCellHeader, width: '20%', textAlign: 'right' }}>Impact (%)</Text>
          </View>
          {data.stressTests.map((st, i) => (
            <View key={i} style={styles.stressTestRow}>
              <Text style={{ ...styles.tableCell, width: '30%', fontFamily: 'Helvetica-Bold' }}>{st.name}</Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right' }}>
                {fmt(st.impactedValue, ccy)}
              </Text>
              <Text style={{ ...styles.tableCell, width: '25%', textAlign: 'right', color: '#ef4444' }}>
                -{fmt(Math.abs(st.loss), ccy)}
              </Text>
              <Text style={{ ...styles.tableCell, width: '20%', textAlign: 'right', color: '#ef4444', fontFamily: 'Helvetica-Bold' }}>
                {st.lossPercent.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>

        <View style={{ ...styles.card, marginTop: 20 }}>
          <Text style={styles.subsectionTitle}>Méthodologie</Text>
          <Text style={{ fontSize: 8, color: '#586e82', lineHeight: 1.5 }}>
            Les stress tests appliquent les baisses historiques observées lors de chaque crise aux classes d&apos;actif du portefeuille.{'\n'}
            {'\n'}
            • Crise financière 2008: Actions -38%, Obligations +5% (18 mois de baisse){'\n'}
            • COVID-19 (2020): Actions -34%, Obligations +2% (1 mois de baisse rapide){'\n'}
            • Hausse des taux 2022: Actions -19%, Obligations -13% (10 mois de baisse simultanée){'\n'}
            {'\n'}
            L&apos;impact est pondéré selon la répartition actuelle du portefeuille entre actions et revenu fixe.
          </Text>
        </View>

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
            Les prix et données de marché utilisés dans ce rapport proviennent de sources considérées fiables mais
            dont l&apos;exactitude ne peut être garantie. Les prix peuvent présenter un délai par rapport au marché en temps réel.
            Certaines valeurs utilisent le coût moyen comme approximation du prix actuel.{'\n'}
            {'\n'}
            4. MÉTRIQUES DE RISQUE{'\n'}
            Les métriques de risque (volatilité, Sharpe, bêta, drawdown) sont des estimations basées sur les
            caractéristiques historiques des classes d&apos;actif et ne prédisent pas le risque futur avec certitude.{'\n'}
            {'\n'}
            5. TESTS DE RÉSISTANCE{'\n'}
            Les stress tests simulent l&apos;impact de crises historiques passées. Ils ne prévoient pas les crises futures
            qui pourraient avoir des impacts différents. Les pertes réelles lors d&apos;une crise pourraient être supérieures
            ou inférieures aux estimations présentées.{'\n'}
            {'\n'}
            6. DÉCISIONS D&apos;INVESTISSEMENT{'\n'}
            Toute décision d&apos;investissement doit être prise en consultation avec votre conseiller financier,
            en tenant compte de votre situation personnelle, de vos objectifs et de votre tolérance au risque.{'\n'}
            {'\n'}
            7. CONFIDENTIALITÉ{'\n'}
            Ce rapport est confidentiel et destiné uniquement au client nommé en page de couverture.
            Toute reproduction ou distribution non autorisée est interdite.{'\n'}
            {'\n'}
            8. RÉGLEMENTATION{'\n'}
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
            • Les données sont fournies à titre indicatif et ne constituent pas un conseil financier.{'\n'}
            • Les rendements passés ne sont pas garants des rendements futurs.{'\n'}
            • Les projections sont basées sur des hypothèses qui pourraient ne pas se réaliser.{'\n'}
            • Ce rapport est confidentiel et destiné uniquement au client nommé ci-dessus.{'\n'}
            • Groupe Financier Ste-Foy est réglementé par l&apos;AMF du Québec.
          </Text>
        </View>
        <PageFooter pageNumber={5} total={5} />
      </Page>
    </Document>
  );
}

import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';

interface ReportData {
  client: {
    name: string;
    type: string;
    riskProfile: string;
    objectives: string;
    horizon: string;
  };
  advisor: {
    name: string;
    title: string;
  };
  portfolio: {
    name: string;
    accountType: string;
    currency: string;
    totalValue: number;
    holdings: {
      symbol: string;
      name: string;
      quantity: number;
      avgCost: number;
      currentPrice: number;
      marketValue: number;
      weight: number;
      gainLoss: number;
    }[];
  };
  performance: {
    periods: Record<string, number>;
    benchmarks: Record<string, Record<string, number>>;
  };
  riskMetrics: {
    volatility: number;
    sharpe: number;
    maxDrawdown: number;
    beta: number;
  };
  scenarios: {
    name: string;
    projectedValue: number;
    annualizedReturn: number;
  }[];
  generatedAt: string;
}

function formatCurrency(value: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} %`;
}

function PageFooter({ pageNumber }: { pageNumber: number }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        Groupe Financier Ste-Foy — Rapport confidentiel
      </Text>
      <Text style={styles.footerText}>Page {pageNumber}</Text>
    </View>
  );
}

export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      {/* Page 1: Cover */}
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverBand} />
        <View style={{ alignItems: 'center', marginTop: 100 }}>
          <View style={{
            width: 70,
            height: 70,
            borderRadius: 12,
            backgroundColor: '#03045e',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 30,
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

      {/* Page 2: Executive Summary + Client Profile */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Résumé exécutif</Text>
        <View style={styles.mb16}>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Valeur totale du portefeuille: {formatCurrency(data.portfolio.totalValue, data.portfolio.currency)}
            </Text>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Nombre de positions: {data.portfolio.holdings.length}
            </Text>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Type de compte: {data.portfolio.accountType}
            </Text>
          </View>
          <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Profil de risque: {data.client.riskProfile}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Profil du client</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Type</Text>
            <Text style={styles.cardValue}>{data.client.type}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Risque</Text>
            <Text style={styles.cardValue}>{data.client.riskProfile}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Horizon</Text>
            <Text style={styles.cardValue}>{data.client.horizon || 'N/D'}</Text>
          </View>
        </View>
        {data.client.objectives && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Objectifs</Text>
            <Text style={{ fontSize: 10 }}>{data.client.objectives}</Text>
          </View>
        )}

        <PageFooter pageNumber={2} />
      </Page>

      {/* Page 3: Composition */}
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
              <Text style={{ ...styles.tableCell, width: '13%', textAlign: 'right' }}>{formatCurrency(h.avgCost)}</Text>
              <Text style={{ ...styles.tableCell, width: '13%', textAlign: 'right' }}>{formatCurrency(h.currentPrice)}</Text>
              <Text style={{ ...styles.tableCell, width: '15%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                {formatCurrency(h.marketValue)}
              </Text>
              <Text style={{ ...styles.tableCell, width: '7%', textAlign: 'right' }}>
                {h.weight.toFixed(1)}%
              </Text>
              <Text style={{
                ...styles.tableCell,
                width: '7%',
                textAlign: 'right',
                color: h.gainLoss >= 0 ? '#10b981' : '#ef4444',
              }}>
                {formatPercent(h.gainLoss)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ ...styles.card, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.bold}>Total</Text>
          <Text style={styles.bold}>{formatCurrency(data.portfolio.totalValue, data.portfolio.currency)}</Text>
        </View>

        <PageFooter pageNumber={3} />
      </Page>

      {/* Page 4: Performance */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Performance historique</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableCellHeader, width: '25%' }}>Période</Text>
            {Object.keys(data.performance.periods).map((p) => (
              <Text key={p} style={{ ...styles.tableCellHeader, width: `${75 / Object.keys(data.performance.periods).length}%`, textAlign: 'right' }}>
                {p}
              </Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            <Text style={{ ...styles.tableCell, width: '25%', fontFamily: 'Helvetica-Bold' }}>Portefeuille</Text>
            {Object.entries(data.performance.periods).map(([p, v]) => (
              <Text key={p} style={{
                ...styles.tableCell,
                width: `${75 / Object.keys(data.performance.periods).length}%`,
                textAlign: 'right',
                color: v >= 0 ? '#10b981' : '#ef4444',
                fontFamily: 'Helvetica-Bold',
              }}>
                {formatPercent(v)}
              </Text>
            ))}
          </View>
          {Object.entries(data.performance.benchmarks).map(([name, periods]) => (
            <View key={name} style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, width: '25%' }}>{name}</Text>
              {Object.entries(periods).map(([p, v]) => (
                <Text key={p} style={{
                  ...styles.tableCell,
                  width: `${75 / Object.keys(periods).length}%`,
                  textAlign: 'right',
                  color: v >= 0 ? '#10b981' : '#ef4444',
                }}>
                  {formatPercent(v)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Métriques de risque</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Volatilité</Text>
            <Text style={styles.cardValue}>{data.riskMetrics.volatility.toFixed(1)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.cardLabel}>Ratio de Sharpe</Text>
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

        <PageFooter pageNumber={4} />
      </Page>

      {/* Page 5: Scenarios + Disclaimers */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Perspectives et scénarios</Text>
        <Text style={{ ...styles.mb16, fontSize: 9, color: '#586e82' }}>
          Projections sur 5 ans, ajustées pour l&apos;inflation
        </Text>

        <View style={styles.statsRow}>
          {data.scenarios.map((s) => (
            <View key={s.name} style={styles.statBox}>
              <Text style={styles.cardLabel}>{s.name}</Text>
              <Text style={styles.cardValue}>{formatCurrency(s.projectedValue)}</Text>
              <Text style={{
                fontSize: 9,
                marginTop: 2,
                color: s.annualizedReturn >= 0 ? '#10b981' : '#ef4444',
              }}>
                {formatPercent(s.annualizedReturn)} / an
              </Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 40 }}>
          <Text style={styles.sectionTitle}>Avertissements importants</Text>
          <Text style={styles.disclaimer}>
            • Les données présentées dans ce rapport sont fournies à titre indicatif seulement et ne constituent pas un conseil financier personnalisé.{'\n'}
            • Les rendements passés ne sont pas garants des rendements futurs.{'\n'}
            • Les projections et scénarios sont basés sur des hypothèses qui pourraient ne pas se réaliser.{'\n'}
            • Les prix et données de marché proviennent de Financial Modeling Prep (FMP) et peuvent présenter un délai.{'\n'}
            • Les métriques de risque sont calculées sur la base de données historiques et ne prédisent pas le risque futur.{'\n'}
            • Ce rapport est confidentiel et destiné uniquement au client nommé ci-dessus.{'\n'}
            • Pour toute décision d&apos;investissement, veuillez consulter votre conseiller financier.{'\n'}
            • Groupe Financier Ste-Foy est réglementé par l&apos;Autorité des marchés financiers (AMF) du Québec.
          </Text>
        </View>

        <PageFooter pageNumber={5} />
      </Page>
    </Document>
  );
}

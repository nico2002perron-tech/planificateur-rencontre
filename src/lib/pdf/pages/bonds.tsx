import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, StatCard, DonutChart, Legend, fmt } from './shared';
import type { BondAnalytics } from '../../analytics/bond-analytics';

interface BondsPageProps {
  pageNum: number;
  totalPages: number;
  analytics: BondAnalytics;
  bondAllocationPct: number;
  portfolioValue: number;
  currency: string;
  aiComment?: string;
}

export function BondsPage({
  pageNum, totalPages, analytics, bondAllocationPct, portfolioValue, currency, aiComment,
}: BondsPageProps) {
  const bondValue = portfolioValue * bondAllocationPct;

  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Analyse du revenu fixe" subtitle="Duration, credit, echeancier et tests de stress" />

      {/* Key bond metrics */}
      <View style={{ flexDirection: 'row' as const, gap: 10, marginBottom: 16 }}>
        <StatCard label="Duration modifiee" value={`${analytics.modifiedDuration.toFixed(2)} ans`} color={C.navy} />
        <StatCard label="Rendement moyen" value={`${analytics.weightedAvgYield.toFixed(2)}%`} color={C.gold} />
        <StatCard label="Coupon moyen" value={`${analytics.weightedAvgCoupon.toFixed(2)}%`} color={C.cyan} />
        <StatCard label="Qualite credit" value={analytics.avgCreditQuality} color={getCreditColor(analytics.avgCreditQuality)} />
      </View>

      {/* Secondary metrics + credit donut */}
      <View style={{ flexDirection: 'row' as const, gap: 20, marginBottom: 16 }}>
        {/* Credit quality donut */}
        <View style={{ alignItems: 'center' as const }}>
          <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
            Qualite du credit
          </Text>
          <DonutChart
            slices={analytics.creditDistribution.map(c => ({
              label: c.rating,
              percentage: c.weight * 100,
              color: c.color,
            }))}
            size={90}
          />
          <Legend items={analytics.creditDistribution.map(c => ({
            label: c.rating,
            color: c.color,
            value: `${(c.weight * 100).toFixed(0)}%`,
          }))} />
        </View>

        {/* Maturity ladder */}
        <View style={{ flex: 1 }}>
          <Text style={styles.subsectionTitle}>Echeancier (Maturity ladder)</Text>
          {analytics.maturityLadder.map((bucket, i) => (
            <View key={i} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 5 }}>
              <Text style={{ fontSize: 8, color: C.text, width: 55 }}>{bucket.bucket}</Text>
              <View style={{ flex: 1, height: 10, backgroundColor: C.panel, borderRadius: 5, overflow: 'hidden' as const, marginHorizontal: 8 }}>
                <View style={{
                  height: '100%', backgroundColor: getMaturityColor(i), borderRadius: 5,
                  width: `${Math.max(2, bucket.weight * 100)}%`,
                }} />
              </View>
              <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, width: 35, textAlign: 'right' as const }}>
                {(bucket.weight * 100).toFixed(0)}%
              </Text>
              <Text style={{ fontSize: 7, color: C.textTer, width: 40, textAlign: 'right' as const }}>
                ({bucket.count})
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Additional metrics row */}
      <View style={{ flexDirection: 'row' as const, gap: 10, marginBottom: 16 }}>
        <MiniStat label="Echeance moy." value={`${analytics.weightedAvgMaturityYears.toFixed(1)} ans`} />
        <MiniStat label="Convexite" value={`${analytics.convexity.toFixed(2)}`} />
        <MiniStat label="Revenu annuel" value={fmt(analytics.totalAnnualIncome, currency)} />
        <MiniStat label="Rendement reel" value={`${analytics.realYield.toFixed(2)}%`} sub={`Inflation: ${(analytics.inflationAssumption * 100).toFixed(1)}%`} />
        <MiniStat label="Allocation" value={`${(bondAllocationPct * 100).toFixed(0)}%`} sub={fmt(bondValue, currency)} />
      </View>

      {/* Interest rate stress tests */}
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.subsectionTitle}>Sensibilite aux taux d'interet</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, flex: 1.5 }}>Scenario</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>Variation taux</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>Impact prix</Text>
            <Text style={{ ...styles.thCellPremium, flex: 1, textAlign: 'right' as const }}>Impact $</Text>
            <Text style={{ ...styles.thCellPremium, flex: 1.2 }}>Visualisation</Text>
          </View>
          {analytics.stressTests.map((test, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
              <Text style={{ ...styles.td, flex: 1.5 }}>{test.scenario}</Text>
              <Text style={{ ...styles.tdBold, flex: 0.8, textAlign: 'right' as const }}>
                {test.rateChange >= 0 ? '+' : ''}{(test.rateChange * 100).toFixed(1)}%
              </Text>
              <Text style={{
                ...styles.tdBold, flex: 0.8, textAlign: 'right' as const,
                color: test.color,
              }}>
                {test.estimatedPriceImpact >= 0 ? '+' : ''}{(test.estimatedPriceImpact * 100).toFixed(2)}%
              </Text>
              <Text style={{
                ...styles.tdBold, flex: 1, textAlign: 'right' as const,
                color: test.color,
              }}>
                {test.estimatedDollarImpact >= 0 ? '+' : ''}{fmt(test.estimatedDollarImpact, currency)}
              </Text>
              <View style={{ flex: 1.2, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 4 }}>
                <View style={{ flex: 1, height: 6, backgroundColor: C.panel, borderRadius: 3, overflow: 'hidden' as const }}>
                  <View style={{
                    height: '100%', borderRadius: 3,
                    backgroundColor: test.color,
                    width: `${Math.min(100, Math.abs(test.estimatedPriceImpact) * 500)}%`,
                  }} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.noteText}>
        Impact estime par la formule : {'\u0394'}P {'\u2248'} -D{'\u00D7'}{'\u0394'}y + 0.5{'\u00D7'}C{'\u00D7'}({'\u0394'}y){'\u00B2'}.
        Les resultats reels peuvent varier selon la forme de la courbe des taux.
      </Text>

      {aiComment && <AIBlock label="Revenu fixe" text={aiComment} />}
    </ReportPage>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.card, borderRadius: 8, padding: 8,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
      alignItems: 'center' as const,
    }}>
      <Text style={{ fontSize: 5.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{value}</Text>
      {sub && <Text style={{ fontSize: 5.5, color: C.textTer, marginTop: 1 }}>{sub}</Text>}
    </View>
  );
}

function getCreditColor(rating: string): string {
  if (rating.startsWith('AAA') || rating.startsWith('AA')) return '#22c55e';
  if (rating.startsWith('A')) return '#4ade80';
  if (rating.startsWith('BBB')) return '#fbbf24';
  if (rating.startsWith('BB')) return '#f97316';
  return '#ef4444';
}

const MATURITY_COLORS = ['#00b4d8', '#0077b6', '#03045e', '#6366f1', '#8b5cf6', '#a78bfa'];

function getMaturityColor(index: number): string {
  return MATURITY_COLORS[index] || '#94a3b8';
}

import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, StatCard, fmt, fmtPct } from './shared';
import { ConeProjection } from '../charts/cone-projection';
import type { MonteCarloResult } from '../../analytics/monte-carlo';

interface ScenarioRow {
  label: string;
  percentile: string;
  finalValue: number;
  gain: number;
  annualizedReturn: number;
  color: string;
}

interface ProjectionPageProps {
  pageNum: number;
  totalPages: number;
  monteCarlo: MonteCarloResult;
  initialValue: number;
  horizonYears: number;
  monthlyContribution: number;
  targetValue?: number;
  currency: string;
  aiComment?: string;
  scenarioRows?: ScenarioRow[];
}

export function ProjectionPage({
  pageNum, totalPages, monteCarlo, initialValue,
  horizonYears, monthlyContribution, targetValue, currency, aiComment, scenarioRows,
}: ProjectionPageProps) {
  const horizonMonths = horizonYears * 12;

  // Build month labels for X axis
  const monthLabels: string[] = [];
  for (let m = 0; m <= horizonMonths; m++) {
    if (m === 0) monthLabels.push('Auj.');
    else if (m % 12 === 0) monthLabels.push(`An ${m / 12}`);
    else monthLabels.push('');
  }

  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Projections Monte Carlo" subtitle={`${horizonYears} ans — 1 000 simulations avec correlations`} />

      {/* Cone projection chart */}
      <View style={{
        backgroundColor: C.card, borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
        marginBottom: 16,
      }}>
        <ConeProjection
          paths={{
            p10: monteCarlo.percentiles.p10,
            p25: monteCarlo.percentiles.p25,
            p50: monteCarlo.percentiles.p50,
            p75: monteCarlo.percentiles.p75,
            p90: monteCarlo.percentiles.p90,
          }}
          months={monthLabels}
          initialValue={initialValue}
          width={500}
          height={180}
        />
        {/* Legend */}
        <View style={{ flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 16, marginTop: 8 }}>
          <LegendDot color={`${C.cyan}18`} label="10e-90e percentile" />
          <LegendDot color={`${C.cyan}40`} label="25e-75e percentile" />
          <LegendDot color={C.cyan} label="Mediane (50e)" />
        </View>
      </View>

      {/* Key stats row */}
      <View style={{ flexDirection: 'row' as const, gap: 10, marginBottom: 16 }}>
        <StatCard label="Valeur mediane" value={fmt(monteCarlo.finalValues.p50, currency)} color={C.cyan} />
        <StatCard label="Rendement median" value={fmtPct(monteCarlo.medianReturn * 100)} color={C.cyan} />
        <StatCard label="Prob. de perte" value={`${(monteCarlo.probabilityOfLoss * 100).toFixed(0)}%`} color={monteCarlo.probabilityOfLoss > 0.3 ? C.down : C.up} />
        {targetValue && (
          <StatCard label="Prob. d'atteindre cible" value={`${(monteCarlo.probabilityOfTarget * 100).toFixed(0)}%`} color={monteCarlo.probabilityOfTarget > 0.5 ? C.up : C.warn} />
        )}
      </View>

      {/* Percentile table */}
      <View style={{ marginBottom: 14 }}>
        <Text style={styles.subsectionTitle}>Distribution des resultats</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, flex: 1 }}>Scenario</Text>
            <Text style={{ ...styles.thCellPremium, flex: 1, textAlign: 'right' as const }}>Valeur finale</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>Gain/Perte</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>Rend. annuel</Text>
          </View>
          {(scenarioRows ?? [
            { label: 'Optimiste (90e)', percentile: 'p90', finalValue: monteCarlo.finalValues.p90, gain: monteCarlo.finalValues.p90 - initialValue, annualizedReturn: horizonYears > 0 ? Math.pow(monteCarlo.finalValues.p90 / initialValue, 1 / horizonYears) - 1 : 0, color: '#10b981' },
            { label: 'Favorable (75e)', percentile: 'p75', finalValue: monteCarlo.finalValues.p75, gain: monteCarlo.finalValues.p75 - initialValue, annualizedReturn: horizonYears > 0 ? Math.pow(monteCarlo.finalValues.p75 / initialValue, 1 / horizonYears) - 1 : 0, color: '#22c55e' },
            { label: 'Mediane (50e)', percentile: 'p50', finalValue: monteCarlo.finalValues.p50, gain: monteCarlo.finalValues.p50 - initialValue, annualizedReturn: horizonYears > 0 ? Math.pow(monteCarlo.finalValues.p50 / initialValue, 1 / horizonYears) - 1 : 0, color: C.cyan },
            { label: 'Prudent (25e)', percentile: 'p25', finalValue: monteCarlo.finalValues.p25, gain: monteCarlo.finalValues.p25 - initialValue, annualizedReturn: horizonYears > 0 ? Math.pow(monteCarlo.finalValues.p25 / initialValue, 1 / horizonYears) - 1 : 0, color: '#f59e0b' },
            { label: 'Pessimiste (10e)', percentile: 'p10', finalValue: monteCarlo.finalValues.p10, gain: monteCarlo.finalValues.p10 - initialValue, annualizedReturn: horizonYears > 0 ? Math.pow(monteCarlo.finalValues.p10 / initialValue, 1 / horizonYears) - 1 : 0, color: '#ef4444' },
          ]).map((row, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <View style={{ flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.color }} />
                  <Text style={{ fontSize: 8.5, color: C.text }}>{row.label}</Text>
                </View>
                <Text style={{ ...styles.tdBold, flex: 1, textAlign: 'right' as const }}>{fmt(row.finalValue, currency)}</Text>
                <Text style={{ ...styles.td, flex: 0.8, textAlign: 'right' as const, color: row.gain >= 0 ? C.up : C.down }}>
                  {row.gain >= 0 ? '+' : ''}{fmt(row.gain, currency)}
                </Text>
                <Text style={{ ...styles.tdBold, flex: 0.8, textAlign: 'right' as const, color: row.annualizedReturn >= 0 ? C.up : C.down }}>
                  {row.annualizedReturn >= 0 ? '+' : ''}{(row.annualizedReturn * 100).toFixed(1)}%
                </Text>
              </View>
          ))}
        </View>
      </View>

      {/* Assumptions */}
      <View style={{ flexDirection: 'row' as const, gap: 12, marginBottom: 10 }}>
        <AssumptionPill label="Valeur initiale" value={fmt(initialValue, currency)} />
        <AssumptionPill label="Horizon" value={`${horizonYears} ans`} />
        {monthlyContribution > 0 && (
          <AssumptionPill label="Cotisation mensuelle" value={fmt(monthlyContribution, currency)} />
        )}
        <AssumptionPill label="Simulations" value="1 000" />
      </View>

      <Text style={styles.noteText}>
        Projections basees sur la distribution historique des rendements mensuels avec correlations entre actifs (Cholesky).
        Les rendements passes ne garantissent pas les resultats futurs.
      </Text>

      {aiComment && <AIBlock label="Perspectives" text={aiComment} />}
    </ReportPage>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
      <View style={{ width: 10, height: 6, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 6.5, color: C.textSec }}>{label}</Text>
    </View>
  );
}

function AssumptionPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={{
      backgroundColor: C.panel, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    }}>
      <Text style={{ fontSize: 5.5, color: C.textTer, textTransform: 'uppercase' as const }}>{label}</Text>
      <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{value}</Text>
    </View>
  );
}

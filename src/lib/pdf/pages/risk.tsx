import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, StatCard, ScoreBar, fmtPct } from './shared';
import { DrawdownChart } from '../charts/drawdown-chart';
import type { RiskMetrics, DrawdownPeriod } from '../../analytics/risk-metrics';

interface RiskPageProps {
  pageNum: number;
  totalPages: number;
  metrics: RiskMetrics;
  drawdownValues?: number[];
  drawdownDates?: string[];
  drawdownPeriods: DrawdownPeriod[];
  aiComment?: string;
}

export function RiskPage({
  pageNum, totalPages, metrics, drawdownValues, drawdownDates, drawdownPeriods, aiComment,
}: RiskPageProps) {
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Analyse du risque" subtitle="Mesures quantitatives de risque et performance ajustee" />

      {/* Key risk metrics */}
      <View style={{ flexDirection: 'row' as const, gap: 10, marginBottom: 16 }}>
        <StatCard
          label="Rendement ann."
          value={`${(metrics.annualizedReturn * 100).toFixed(1)}%`}
          color={metrics.annualizedReturn >= 0 ? C.up : C.down}
        />
        <StatCard
          label="Volatilite ann."
          value={`${(metrics.annualizedVolatility * 100).toFixed(1)}%`}
          color={metrics.annualizedVolatility > 0.20 ? C.down : C.cyan}
        />
        <StatCard
          label="Sharpe"
          value={metrics.sharpeRatio.toFixed(2)}
          color={metrics.sharpeRatio >= 1 ? C.up : metrics.sharpeRatio >= 0.5 ? C.cyan : C.warn}
        />
        <StatCard
          label="Drawdown max"
          value={`${(metrics.maxDrawdown * 100).toFixed(1)}%`}
          color={C.down}
        />
      </View>

      {/* Drawdown chart */}
      {drawdownValues && drawdownDates && drawdownValues.length > 0 && (
        <View style={{
          backgroundColor: C.card, borderRadius: 12, padding: 14,
          borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.textSec, marginBottom: 8 }}>
            Courbe de drawdown
          </Text>
          <DrawdownChart
            values={drawdownValues}
            dates={drawdownDates}
            width={500}
            height={100}
          />
        </View>
      )}

      {/* Detailed metrics table */}
      <View style={{ flexDirection: 'row' as const, gap: 16, marginBottom: 14 }}>
        {/* Risk-adjusted metrics */}
        <View style={{ flex: 1 }}>
          <Text style={styles.subsectionTitle}>Ratios ajustes au risque</Text>
          <MetricRow label="Ratio de Sharpe" value={metrics.sharpeRatio.toFixed(2)} good={metrics.sharpeRatio >= 1} />
          <MetricRow label="Ratio de Sortino" value={metrics.sortinoRatio.toFixed(2)} good={metrics.sortinoRatio >= 1.5} />
          <MetricRow label="Ratio de Calmar" value={metrics.calmarRatio.toFixed(2)} good={metrics.calmarRatio >= 1} />
          <MetricRow label="Ratio d'information" value={metrics.informationRatio.toFixed(2)} good={metrics.informationRatio > 0} />
          <MetricRow label="Alpha (Jensen)" value={`${metrics.alpha >= 0 ? '+' : ''}${(metrics.alpha * 100).toFixed(2)}%`} good={metrics.alpha > 0} />
          <MetricRow label="Beta" value={metrics.beta.toFixed(2)} good={metrics.beta <= 1} />
          <MetricRow label="Tracking Error" value={`${(metrics.trackingError * 100).toFixed(1)}%`} />
        </View>

        {/* Risk measures */}
        <View style={{ flex: 1 }}>
          <Text style={styles.subsectionTitle}>Mesures de risque</Text>
          <MetricRow label="VaR 95% (ann.)" value={`${(metrics.var95 * 100).toFixed(1)}%`} />
          <MetricRow label="VaR 99% (ann.)" value={`${(metrics.var99 * 100).toFixed(1)}%`} />
          <MetricRow label="CVaR 95% (ann.)" value={`${(metrics.cvar95 * 100).toFixed(1)}%`} />
          <MetricRow label="Capture haussiere" value={`${metrics.upsideCapture.toFixed(0)}%`} good={metrics.upsideCapture > 100} />
          <MetricRow label="Capture baissiere" value={`${metrics.downsideCapture.toFixed(0)}%`} good={metrics.downsideCapture < 100} />
          <MetricRow label="Meilleur mois" value={`+${(metrics.bestMonth * 100).toFixed(1)}%`} />
          <MetricRow label="Pire mois" value={`${(metrics.worstMonth * 100).toFixed(1)}%`} />
        </View>
      </View>

      {/* Monthly return distribution */}
      <View style={{ flexDirection: 'row' as const, gap: 12, marginBottom: 14 }}>
        <View style={{
          flex: 1, backgroundColor: C.upBg, borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: C.upBorder, borderStyle: 'solid' as const,
        }}>
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#065f46', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
            Mois positifs
          </Text>
          <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 700, color: C.up }}>
            {metrics.positiveMonths}
          </Text>
          <Text style={{ fontSize: 7, color: '#065f46' }}>
            Moy. +{(metrics.avgPositiveMonth * 100).toFixed(1)}%
          </Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: C.downBg, borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: C.downBorder, borderStyle: 'solid' as const,
        }}>
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#991b1b', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
            Mois negatifs
          </Text>
          <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 700, color: C.down }}>
            {metrics.negativeMonths}
          </Text>
          <Text style={{ fontSize: 7, color: '#991b1b' }}>
            Moy. {(metrics.avgNegativeMonth * 100).toFixed(1)}%
          </Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: C.card, borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
        }}>
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textSec, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
            Ratio positif
          </Text>
          <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
            {((metrics.positiveMonths / Math.max(1, metrics.positiveMonths + metrics.negativeMonths)) * 100).toFixed(0)}%
          </Text>
          <Text style={{ fontSize: 7, color: C.textSec }}>
            des mois en hausse
          </Text>
        </View>
      </View>

      {/* Top drawdown periods */}
      {drawdownPeriods.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.subsectionTitle}>Periodes de drawdown significatives</Text>
          {drawdownPeriods.slice(0, 3).map((dd, i) => (
            <View key={i} style={{
              flexDirection: 'row' as const, alignItems: 'center' as const,
              paddingVertical: 5, paddingHorizontal: 8,
              backgroundColor: i % 2 === 0 ? C.white : C.card,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 8, color: C.text, flex: 1 }}>{dd.start} — {dd.end}</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.down, width: 50, textAlign: 'right' as const }}>
                {(dd.depth * 100).toFixed(1)}%
              </Text>
              <Text style={{ fontSize: 7, color: C.textSec, width: 70, textAlign: 'right' as const }}>
                {dd.durationDays} jours
              </Text>
              <Text style={{ fontSize: 7, color: dd.recoveryDate ? C.up : C.warn, width: 60, textAlign: 'right' as const }}>
                {dd.recoveryDate ? 'Recupere' : 'En cours'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {aiComment && <AIBlock label="Risque" text={aiComment} />}
    </ReportPage>
  );
}

function MetricRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row' as const, justifyContent: 'space-between' as const,
      paddingVertical: 4, paddingHorizontal: 6,
      borderBottomWidth: 0.5, borderBottomColor: C.panel, borderBottomStyle: 'solid' as const,
    }}>
      <Text style={{ fontSize: 8, color: C.text }}>{label}</Text>
      <Text style={{
        fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600,
        color: good === undefined ? C.navy : good ? C.up : C.warn,
      }}>
        {value}
      </Text>
    </View>
  );
}

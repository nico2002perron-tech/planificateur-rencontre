import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, ScoreBar } from './shared';
import { CorrelationHeatmap } from '../charts/heatmap';
import type { DiversificationAnalysis } from '../../analytics/correlation';

interface CorrelationBarValues {
  hhiBarValue: number;
  correlationBarValue: number;
  top5BarValue: number;
  sectorBarValue: number;
}

interface CorrelationPageProps {
  pageNum: number;
  totalPages: number;
  analysis: DiversificationAnalysis;
  holdingLabels: string[];
  aiComment?: string;
  barValues?: CorrelationBarValues;
}

export function CorrelationPage({
  pageNum, totalPages, analysis, holdingLabels, aiComment, barValues,
}: CorrelationPageProps) {
  // Fallback: compute bar values inline if not pre-computed (backwards compat)
  const bv = barValues ?? {
    hhiBarValue: Math.max(0, 100 - analysis.hhi / 50),
    correlationBarValue: Math.max(0, 100 - analysis.correlationMatrix.avgCorrelation * 100),
    top5BarValue: Math.max(0, 100 - analysis.top5Concentration * 100),
    sectorBarValue: Math.max(0, 100 - analysis.sectorConcentration / 50),
  };
  const scoreColor = analysis.diversificationScore >= 70 ? C.up :
    analysis.diversificationScore >= 50 ? C.cyan :
    analysis.diversificationScore >= 35 ? C.warn : C.down;

  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Correlation et diversification" subtitle="Dependances entre actifs et concentration du portefeuille" />

      {/* Diversification score banner */}
      <View style={{
        backgroundColor: C.card, borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
        marginBottom: 16, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
      }}>
        <View style={{
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: scoreColor,
          alignItems: 'center' as const, justifyContent: 'center' as const,
        }}>
          <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: C.white }}>
            {analysis.diversificationScore}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
            Diversification : {analysis.diversificationLabel}
          </Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>
            Score composite base sur la concentration, les correlations et la repartition sectorielle
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' as const }}>
          <Text style={{ fontSize: 7, color: C.textTer }}>Positions eff.</Text>
          <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
            {analysis.effectivePositions.toFixed(1)}
          </Text>
        </View>
      </View>

      {/* Main content: heatmap + metrics */}
      <View style={{ flexDirection: 'row' as const, gap: 20, marginBottom: 16 }}>
        {/* Correlation heatmap */}
        <View style={{ alignItems: 'center' as const }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.textSec, marginBottom: 6 }}>
            Matrice de correlation
          </Text>
          <CorrelationHeatmap
            matrix={analysis.correlationMatrix.matrix}
            labels={holdingLabels}
            size={220}
          />
          <View style={{ flexDirection: 'row' as const, gap: 8, marginTop: 6 }}>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 }}>
              <View style={{ width: 12, height: 6, backgroundColor: '#2563eb', borderRadius: 2 }} />
              <Text style={{ fontSize: 5.5, color: C.textTer }}>-1.0</Text>
            </View>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 }}>
              <View style={{ width: 12, height: 6, backgroundColor: '#f8fafc', borderRadius: 2, borderWidth: 0.5, borderColor: C.cardBorder, borderStyle: 'solid' as const }} />
              <Text style={{ fontSize: 5.5, color: C.textTer }}>0</Text>
            </View>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 }}>
              <View style={{ width: 12, height: 6, backgroundColor: '#dc2626', borderRadius: 2 }} />
              <Text style={{ fontSize: 5.5, color: C.textTer }}>+1.0</Text>
            </View>
          </View>
        </View>

        {/* Diversification metrics */}
        <View style={{ flex: 1 }}>
          <Text style={styles.subsectionTitle}>Metriques de concentration</Text>

          <ScoreBar label="Position HHI" value={bv.hhiBarValue} max={100} color={C.cyan} />
          <ScoreBar label="Correlation moy." value={bv.correlationBarValue} max={100} color={C.blue} />
          <ScoreBar label="Top 5 conc." value={bv.top5BarValue} max={100} color={C.gold} />
          <ScoreBar label="Sector conc." value={bv.sectorBarValue} max={100} color="#8b5cf6" />

          {/* Key numbers */}
          <View style={{ marginTop: 12, gap: 6 }}>
            <KeyMetric label="HHI (positions)" value={analysis.hhi.toFixed(0)} desc="< 1500 = bien diversifie" />
            <KeyMetric label="Correlation moyenne" value={analysis.correlationMatrix.avgCorrelation.toFixed(2)} desc="< 0.4 = faible interdependance" />
            <KeyMetric label="Top 5 positions" value={`${(analysis.top5Concentration * 100).toFixed(0)}%`} desc="< 40% = bonne repartition" />
            <KeyMetric label="HHI sectoriel" value={analysis.sectorConcentration.toFixed(0)} desc="< 2000 = bien reparti" />
          </View>
        </View>
      </View>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <View style={{
          backgroundColor: C.warnBg, borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: C.warnBorder, borderStyle: 'solid' as const,
          marginBottom: 10,
        }}>
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#854d0e', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
            Points d'attention
          </Text>
          {analysis.warnings.map((w, i) => (
            <Text key={i} style={{ fontSize: 8, color: '#854d0e', marginBottom: 2 }}>{'\u26A0'} {w}</Text>
          ))}
        </View>
      )}

      {aiComment && <AIBlock label="Diversification" text={aiComment} />}
    </ReportPage>
  );
}

function KeyMetric({ label, value, desc }: { label: string; value: string; desc: string }) {
  return (
    <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
      <Text style={{ fontSize: 8, color: C.text, width: 100 }}>{label}</Text>
      <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy, width: 50 }}>{value}</Text>
      <Text style={{ fontSize: 6.5, color: C.textTer, flex: 1 }}>{desc}</Text>
    </View>
  );
}

import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, KPICard, AIBlock, fmt, fmtPct } from './shared';

interface ExecutiveSummaryProps {
  pageNum: number;
  totalPages: number;
  portfolioValue: number;
  expectedReturn: number;
  annualIncome: number;
  intelligenceScore: number;
  holdingCount: number;
  sectorCount: number;
  top3Holdings: Array<{ name: string; weight: number }>;
  equityWeight: number;
  fixedIncomeWeight: number;
  aiSummary: string;
  currency: string;
}

export function ExecutiveSummaryPage({
  pageNum, totalPages, portfolioValue, expectedReturn, annualIncome,
  intelligenceScore, holdingCount, sectorCount, top3Holdings,
  equityWeight, fixedIncomeWeight, aiSummary, currency,
}: ExecutiveSummaryProps) {
  const healthLabel = intelligenceScore >= 75 ? 'Excellente posture' :
    intelligenceScore >= 55 ? 'Bonne posture' :
    intelligenceScore >= 40 ? 'Posture adequate' : 'A surveiller';

  const healthColor = intelligenceScore >= 75 ? C.up :
    intelligenceScore >= 55 ? C.cyan :
    intelligenceScore >= 40 ? C.warn : C.down;

  return (
    <ReportPage num={pageNum} total={totalPages}>
      {/* Section title */}
      <Text style={styles.sectionTitle}>Resume executif</Text>

      {/* KPI Row */}
      <View style={{ flexDirection: 'row' as const, gap: 10, marginBottom: 16 }}>
        <KPICard label="Valeur totale" value={fmt(portfolioValue, currency)} accent={C.navy} />
        <KPICard label="Rendement espere" value={fmtPct(expectedReturn)} accent={C.cyan} />
        <KPICard label="Revenu annuel" value={fmt(annualIncome, currency)} accent={C.gold} />
        <KPICard label="Score global" value={`${intelligenceScore}/100`} accent={intelligenceScore >= 70 ? C.up : C.cyan} />
      </View>

      {/* Health indicator */}
      <View style={{
        backgroundColor: `${healthColor}10`, borderRadius: 10, padding: 12,
        borderWidth: 1, borderColor: `${healthColor}30`, borderStyle: 'solid' as const,
        marginBottom: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
      }}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: healthColor, alignItems: 'center' as const, justifyContent: 'center' as const,
        }}>
          <Text style={{ fontSize: 14, color: C.white }}>
            {intelligenceScore >= 55 ? '\u2713' : '!'}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: healthColor }}>
            {healthLabel}
          </Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>
            Votre portefeuille obtient un score de {intelligenceScore}/100
          </Text>
        </View>
      </View>

      {/* AI Summary */}
      {aiSummary && (
        <AIBlock label="Analyse IA — Resume" text={aiSummary} />
      )}

      {/* Quick stats */}
      <View style={{ marginTop: 12 }}>
        <Text style={styles.subsectionTitle}>Apercu rapide</Text>
        <View style={{ ...styles.table, borderRadius: 10 }}>
          <QuickStatRow label="Nombre de positions" value={`${holdingCount}`} />
          <QuickStatRow label="Secteurs representes" value={`${sectorCount}`} alt />
          <QuickStatRow label="Allocation actions" value={`${(equityWeight * 100).toFixed(0)}%`} />
          <QuickStatRow label="Allocation revenu fixe" value={`${(fixedIncomeWeight * 100).toFixed(0)}%`} alt />
          <QuickStatRow label="Top 3 positions" value={top3Holdings.map(h => `${h.name} (${(h.weight * 100).toFixed(1)}%)`).join(', ')} />
        </View>
      </View>
    </ReportPage>
  );
}

function QuickStatRow({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  return (
    <View style={alt ? styles.trAlt : styles.tr}>
      <Text style={{ ...styles.td, flex: 1 }}>{label}</Text>
      <Text style={{ ...styles.tdBold, flex: 1, textAlign: 'right' as const }}>{value}</Text>
    </View>
  );
}

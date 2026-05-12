import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, ScoreBar, fmtCap, fmtNum } from './shared';
import { ScatterPlot } from '../charts/scatter-plot';
import type { ScatterPoint } from '../charts/scatter-plot';

export interface FundamentalRow {
  symbol: string;
  name: string;
  weight: number;
  pe?: number;
  pb?: number;
  roe?: number;
  debtToEquity?: number;
  profitMargin?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  dividendYield?: number;
  marketCap?: number;
  beta?: number;
}

interface QualityBarData {
  label: string;
  value: number;
  max: number;
  color: string;
}

interface FundamentalsPageProps {
  pageNum: number;
  totalPages: number;
  holdings: FundamentalRow[];
  portfolioAvgPE: number;
  portfolioAvgROE: number;
  portfolioAvgDebtEquity: number;
  portfolioAvgMargin: number;
  portfolioAvgBeta: number;
  scatterPoints: ScatterPoint[];
  aiComment?: string;
  qualityBars?: QualityBarData[];
}

export function FundamentalsPage({
  pageNum, totalPages, holdings,
  portfolioAvgPE, portfolioAvgROE, portfolioAvgDebtEquity,
  portfolioAvgMargin, portfolioAvgBeta, scatterPoints, aiComment, qualityBars,
}: FundamentalsPageProps) {
  // Fallback: compute quality bars inline if not pre-computed (backwards compat)
  const bars = qualityBars ?? [
    { label: 'Rentabilite', value: Math.min(100, portfolioAvgROE * 4), max: 100, color: C.cyan },
    { label: 'Solidite', value: Math.min(100, Math.max(0, 100 - portfolioAvgDebtEquity * 30)), max: 100, color: C.up },
    { label: 'Valorisation', value: Math.min(100, Math.max(0, 100 - (portfolioAvgPE - 10) * 3)), max: 100, color: C.gold },
    { label: 'Croissance', value: Math.min(100, portfolioAvgMargin * 400), max: 100, color: C.blue },
    { label: 'Stabilite', value: Math.min(100, Math.max(0, (1.5 - portfolioAvgBeta) * 80)), max: 100, color: '#8b5cf6' },
  ];
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Analyse fondamentale" subtitle="Metriques financieres cles des positions" />

      {/* Portfolio-level summary metrics */}
      <View style={{ flexDirection: 'row' as const, gap: 10, marginBottom: 16 }}>
        <FundamentalKPI label="P/E moyen" value={portfolioAvgPE > 0 ? `${portfolioAvgPE.toFixed(1)}x` : 'N/A'} benchmark="S&P 500: ~21x" />
        <FundamentalKPI label="ROE moyen" value={`${portfolioAvgROE.toFixed(0)}%`} benchmark="Median: 15%" />
        <FundamentalKPI label="Marge nette" value={`${(portfolioAvgMargin * 100).toFixed(0)}%`} benchmark="Median: 12%" />
        <FundamentalKPI label="Dette/Equity" value={`${portfolioAvgDebtEquity.toFixed(1)}x`} benchmark="Sain: < 1.5x" />
        <FundamentalKPI label="Beta moyen" value={`${portfolioAvgBeta.toFixed(2)}`} benchmark="Marche: 1.00" />
      </View>

      {/* Risk-Return scatter plot */}
      {scatterPoints.length > 0 && (
        <View style={{ flexDirection: 'row' as const, gap: 16, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subsectionTitle}>Risque vs Rendement</Text>
            <ScatterPlot
              points={scatterPoints}
              xLabel="Volatilite annualisee"
              yLabel="Rendement annualise"
              width={260}
              height={160}
            />
          </View>

          {/* Quality scores */}
          <View style={{ flex: 1 }}>
            <Text style={styles.subsectionTitle}>Indicateurs de qualite</Text>
            {bars.map((bar, idx) => (
              <ScoreBar key={idx} label={bar.label} value={bar.value} max={bar.max} color={bar.color} />
            ))}
          </View>
        </View>
      )}

      {/* Fundamentals table */}
      <View>
        <Text style={styles.subsectionTitle}>Detail par position</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, flex: 1 }}>Actif</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.5, textAlign: 'right' as const }}>Poids</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.5, textAlign: 'right' as const }}>P/E</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.5, textAlign: 'right' as const }}>ROE</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.6, textAlign: 'right' as const }}>Marge</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.5, textAlign: 'right' as const }}>D/E</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.5, textAlign: 'right' as const }}>Beta</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.6, textAlign: 'right' as const }}>Cap.</Text>
          </View>
          {holdings
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 15)
            .map((h, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.tdBold, flex: 1 }}>{h.symbol}</Text>
                <Text style={{ ...styles.td, flex: 0.5, textAlign: 'right' as const }}>{(h.weight * 100).toFixed(1)}%</Text>
                <Text style={{ ...styles.td, flex: 0.5, textAlign: 'right' as const }}>{h.pe ? `${h.pe.toFixed(1)}` : '-'}</Text>
                <Text style={{ ...styles.td, flex: 0.5, textAlign: 'right' as const }}>{h.roe ? `${h.roe.toFixed(0)}%` : '-'}</Text>
                <Text style={{ ...styles.td, flex: 0.6, textAlign: 'right' as const }}>{h.profitMargin !== undefined ? `${(h.profitMargin * 100).toFixed(0)}%` : '-'}</Text>
                <Text style={{ ...styles.td, flex: 0.5, textAlign: 'right' as const }}>{h.debtToEquity !== undefined ? `${h.debtToEquity.toFixed(1)}` : '-'}</Text>
                <Text style={{ ...styles.td, flex: 0.5, textAlign: 'right' as const }}>{h.beta !== undefined ? `${h.beta.toFixed(2)}` : '-'}</Text>
                <Text style={{ ...styles.td, flex: 0.6, textAlign: 'right' as const, fontSize: 7 }}>{h.marketCap ? fmtCap(h.marketCap) : '-'}</Text>
              </View>
            ))}
          {/* Portfolio average row */}
          <View style={{ flexDirection: 'row' as const, paddingVertical: 7, paddingHorizontal: 8, backgroundColor: '#eef2ff', borderTopWidth: 1, borderTopColor: C.cardBorder, borderTopStyle: 'solid' as const }}>
            <Text style={{ ...styles.tdBold, flex: 1, color: C.navy }}>Moyenne pond.</Text>
            <Text style={{ ...styles.td, flex: 0.5, textAlign: 'right' as const }}>100%</Text>
            <Text style={{ ...styles.tdBold, flex: 0.5, textAlign: 'right' as const, color: C.navy }}>{portfolioAvgPE > 0 ? portfolioAvgPE.toFixed(1) : '-'}</Text>
            <Text style={{ ...styles.tdBold, flex: 0.5, textAlign: 'right' as const, color: C.navy }}>{portfolioAvgROE.toFixed(0)}%</Text>
            <Text style={{ ...styles.tdBold, flex: 0.6, textAlign: 'right' as const, color: C.navy }}>{(portfolioAvgMargin * 100).toFixed(0)}%</Text>
            <Text style={{ ...styles.tdBold, flex: 0.5, textAlign: 'right' as const, color: C.navy }}>{portfolioAvgDebtEquity.toFixed(1)}</Text>
            <Text style={{ ...styles.tdBold, flex: 0.5, textAlign: 'right' as const, color: C.navy }}>{portfolioAvgBeta.toFixed(2)}</Text>
            <Text style={{ ...styles.td, flex: 0.6 }}></Text>
          </View>
        </View>
      </View>

      {aiComment && <AIBlock label="Fondamentaux" text={aiComment} />}
    </ReportPage>
  );
}

function FundamentalKPI({ label, value, benchmark }: { label: string; value: string; benchmark: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.card, borderRadius: 10, padding: 10,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
      alignItems: 'center' as const,
    }}>
      <Text style={{ fontSize: 5.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{value}</Text>
      <Text style={{ fontSize: 5.5, color: C.textTer, marginTop: 2 }}>{benchmark}</Text>
    </View>
  );
}

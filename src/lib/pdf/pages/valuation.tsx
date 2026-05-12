import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, fmt, fmtPct } from './shared';

export interface ValuationRow {
  symbol: string;
  name: string;
  weight: number;
  currentPrice: number;
  fairValueDCF?: number;
  fairValuePS?: number;
  fairValuePE?: number;
  consensusFairValue?: number;
  upsidePct: number; // % upside to consensus
  verdict: 'Sous-evalue' | 'Juste valeur' | 'Surevalue' | 'N/A';
  verdictColor: string;
}

export interface SensitivityCell {
  growthRate: string;
  discountRate: string;
  value: number;
}

interface ValuationPageProps {
  pageNum: number;
  totalPages: number;
  holdings: ValuationRow[];
  portfolioUpside: number;
  undervaluedCount: number;
  overvaluedCount: number;
  fairValueCount: number;
  sensitivityMatrix?: {
    symbol: string;
    growthRates: string[];
    discountRates: string[];
    values: number[][];
    currentPrice: number;
  };
  currency: string;
  aiComment?: string;
}

export function ValuationPage({
  pageNum, totalPages, holdings,
  portfolioUpside, undervaluedCount, overvaluedCount, fairValueCount,
  sensitivityMatrix, currency, aiComment,
}: ValuationPageProps) {
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Analyse de valorisation" subtitle="Juste valeur estimee par modeles DCF, P/E et P/S" />

      {/* Portfolio-level valuation summary */}
      <View style={{ flexDirection: 'row' as const, gap: 10, marginBottom: 16 }}>
        <View style={{
          flex: 1, backgroundColor: portfolioUpside >= 0 ? C.upBg : C.downBg,
          borderRadius: 12, padding: 14, alignItems: 'center' as const,
          borderWidth: 1, borderColor: portfolioUpside >= 0 ? C.upBorder : C.downBorder, borderStyle: 'solid' as const,
        }}>
          <Text style={{ fontSize: 6.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
            Potentiel moyen
          </Text>
          <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: portfolioUpside >= 0 ? C.up : C.down }}>
            {portfolioUpside >= 0 ? '+' : ''}{(portfolioUpside * 100).toFixed(1)}%
          </Text>
        </View>
        <ValuationStat label="Sous-evalues" value={`${undervaluedCount}`} sub="positions" color={C.up} />
        <ValuationStat label="Juste valeur" value={`${fairValueCount}`} sub="positions" color={C.cyan} />
        <ValuationStat label="Surevalues" value={`${overvaluedCount}`} sub="positions" color={C.down} />
      </View>

      {/* Valuation table */}
      <View style={{ marginBottom: 14 }}>
        <Text style={styles.subsectionTitle}>Valorisation par position</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, flex: 1 }}>Actif</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.6, textAlign: 'right' as const }}>Prix actuel</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.6, textAlign: 'right' as const }}>JV DCF</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.6, textAlign: 'right' as const }}>JV P/E</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.6, textAlign: 'right' as const }}>Consensus</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.6, textAlign: 'right' as const }}>Potentiel</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.7, textAlign: 'center' as const }}>Verdict</Text>
          </View>
          {holdings
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 12)
            .map((h, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.tdBold, flex: 1 }}>{h.symbol}</Text>
                <Text style={{ ...styles.td, flex: 0.6, textAlign: 'right' as const }}>{h.currentPrice.toFixed(2)}$</Text>
                <Text style={{ ...styles.td, flex: 0.6, textAlign: 'right' as const }}>{h.fairValueDCF ? `${h.fairValueDCF.toFixed(2)}$` : '-'}</Text>
                <Text style={{ ...styles.td, flex: 0.6, textAlign: 'right' as const }}>{h.fairValuePE ? `${h.fairValuePE.toFixed(2)}$` : '-'}</Text>
                <Text style={{ ...styles.tdBold, flex: 0.6, textAlign: 'right' as const }}>{h.consensusFairValue ? `${h.consensusFairValue.toFixed(2)}$` : '-'}</Text>
                <Text style={{
                  ...styles.tdBold, flex: 0.6, textAlign: 'right' as const,
                  color: h.upsidePct >= 0 ? C.up : C.down,
                }}>
                  {h.verdict !== 'N/A' ? `${h.upsidePct >= 0 ? '+' : ''}${(h.upsidePct * 100).toFixed(0)}%` : '-'}
                </Text>
                <View style={{ flex: 0.7, alignItems: 'center' as const, justifyContent: 'center' as const }}>
                  <Text style={{
                    fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600,
                    color: h.verdictColor,
                    backgroundColor: `${h.verdictColor}18`,
                    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3,
                  }}>
                    {h.verdict}
                  </Text>
                </View>
              </View>
            ))}
        </View>
      </View>

      {/* Sensitivity matrix (optional, for largest holding) */}
      {sensitivityMatrix && (
        <View style={{ marginBottom: 10 }}>
          <Text style={styles.subsectionTitle}>
            Sensibilite DCF — {sensitivityMatrix.symbol}
          </Text>
          <View style={{
            backgroundColor: C.card, borderRadius: 10, padding: 10,
            borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
          }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row' as const, marginBottom: 4 }}>
              <Text style={{ width: 60, fontSize: 6, color: C.textTer }}>Croiss. \ Taux</Text>
              {sensitivityMatrix.discountRates.map((dr, i) => (
                <Text key={i} style={{ flex: 1, fontSize: 6.5, color: C.textSec, textAlign: 'center' as const, fontFamily: 'Open Sans', fontWeight: 600 }}>
                  {dr}
                </Text>
              ))}
            </View>
            {/* Data rows */}
            {sensitivityMatrix.growthRates.map((gr, ri) => (
              <View key={ri} style={{ flexDirection: 'row' as const, paddingVertical: 3 }}>
                <Text style={{ width: 60, fontSize: 6.5, color: C.textSec, fontFamily: 'Open Sans', fontWeight: 600 }}>{gr}</Text>
                {sensitivityMatrix.values[ri].map((val, ci) => {
                  const isAbove = val > sensitivityMatrix.currentPrice;
                  return (
                    <Text key={ci} style={{
                      flex: 1, fontSize: 7, textAlign: 'center' as const,
                      fontFamily: 'Open Sans', fontWeight: 600,
                      color: isAbove ? C.up : C.down,
                      backgroundColor: isAbove ? '#ecfdf518' : '#fef2f218',
                      borderRadius: 3, paddingVertical: 1,
                    }}>
                      {val.toFixed(0)}$
                    </Text>
                  );
                })}
              </View>
            ))}
            <Text style={{ fontSize: 6, color: C.textTer, marginTop: 4 }}>
              Prix actuel: {sensitivityMatrix.currentPrice.toFixed(2)}$ — Les cases vertes indiquent une sous-evaluation.
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.noteText}>
        Les justes valeurs sont estimees par modeles quantitatifs (DCF, P/E relatif, P/S sectoriel).
        Elles servent de reference et ne constituent pas des recommandations d'achat ou vente.
      </Text>

      {aiComment && <AIBlock label="Valorisation" text={aiComment} />}
    </ReportPage>
  );
}

function ValuationStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, alignItems: 'center' as const,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
    }}>
      <Text style={{ fontSize: 6.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 700, color }}>
        {value}
      </Text>
      <Text style={{ fontSize: 7, color: C.textSec }}>{sub}</Text>
    </View>
  );
}

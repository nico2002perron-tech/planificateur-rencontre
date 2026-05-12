import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, StatCard, fmt, fmtPctShort } from './shared';
import { StackedBarChart } from '../charts/stacked-bar';
import type { StackedBarItem } from '../charts/stacked-bar';

export interface IncomeHolding {
  symbol: string;
  name: string;
  weight: number;
  dividendYield: number;
  annualDividend: number; // $ total for the position
  payoutRatio?: number;
  exDivDate?: string;
  frequency: string; // 'Mensuel', 'Trimestriel', 'Semestriel', 'Annuel'
  growthRate5Y?: number;
}

interface IncomePageProps {
  pageNum: number;
  totalPages: number;
  holdings: IncomeHolding[];
  totalAnnualIncome: number;
  portfolioYield: number;
  monthlyIncome: number;
  incomeByMonth?: StackedBarItem[];
  yieldOnCost?: number;
  currency: string;
  aiComment?: string;
}

export function IncomePage({
  pageNum, totalPages, holdings, totalAnnualIncome,
  portfolioYield, monthlyIncome, incomeByMonth, yieldOnCost, currency, aiComment,
}: IncomePageProps) {
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Revenus et dividendes" subtitle="Portrait des flux de tresorerie du portefeuille" />

      {/* Income KPI cards */}
      <View style={{ flexDirection: 'row' as const, gap: 10, marginBottom: 16 }}>
        <StatCard label="Revenu annuel" value={fmt(totalAnnualIncome, currency)} color={C.gold} />
        <StatCard label="Revenu mensuel" value={fmt(monthlyIncome, currency)} color={C.gold} />
        <StatCard label="Rendement" value={`${(portfolioYield * 100).toFixed(2)}%`} color={C.cyan} />
        {yieldOnCost !== undefined && (
          <StatCard label="Yield on cost" value={`${(yieldOnCost * 100).toFixed(2)}%`} color={C.up} />
        )}
      </View>

      {/* Monthly income chart */}
      {incomeByMonth && incomeByMonth.length > 0 && (
        <View style={{
          backgroundColor: C.card, borderRadius: 12, padding: 14,
          borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.textSec, marginBottom: 8 }}>
            Revenus mensuels estimes
          </Text>
          <StackedBarChart items={incomeByMonth} height={100} />
        </View>
      )}

      {/* Income holdings table */}
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.subsectionTitle}>Detail des positions generatrices de revenus</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, flex: 1 }}>Actif</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.6, textAlign: 'right' as const }}>Poids</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.7, textAlign: 'right' as const }}>Rendement</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>Revenu/an</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.7, textAlign: 'center' as const }}>Frequence</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.7, textAlign: 'right' as const }}>Payout</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.7, textAlign: 'right' as const }}>Crois. 5A</Text>
          </View>
          {holdings
            .filter(h => h.dividendYield > 0)
            .sort((a, b) => b.annualDividend - a.annualDividend)
            .slice(0, 15)
            .map((h, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.tdBold, flex: 1 }}>{h.symbol}</Text>
                <Text style={{ ...styles.td, flex: 0.6, textAlign: 'right' as const }}>{(h.weight * 100).toFixed(1)}%</Text>
                <Text style={{ ...styles.tdBold, flex: 0.7, textAlign: 'right' as const, color: C.gold }}>
                  {(h.dividendYield * 100).toFixed(2)}%
                </Text>
                <Text style={{ ...styles.tdBold, flex: 0.8, textAlign: 'right' as const }}>
                  {fmt(h.annualDividend, currency)}
                </Text>
                <Text style={{ ...styles.td, flex: 0.7, textAlign: 'center' as const, fontSize: 7 }}>
                  {h.frequency}
                </Text>
                <Text style={{
                  ...styles.td, flex: 0.7, textAlign: 'right' as const,
                  color: h.payoutRatio !== undefined ? (h.payoutRatio > 0.8 ? C.down : h.payoutRatio > 0.6 ? C.warn : C.up) : C.textSec,
                }}>
                  {h.payoutRatio !== undefined ? `${(h.payoutRatio * 100).toFixed(0)}%` : '-'}
                </Text>
                <Text style={{
                  ...styles.td, flex: 0.7, textAlign: 'right' as const,
                  color: h.growthRate5Y !== undefined ? (h.growthRate5Y >= 0 ? C.up : C.down) : C.textSec,
                }}>
                  {h.growthRate5Y !== undefined ? `${h.growthRate5Y >= 0 ? '+' : ''}${(h.growthRate5Y * 100).toFixed(0)}%` : '-'}
                </Text>
              </View>
            ))}
          {/* Total row */}
          <View style={{ flexDirection: 'row' as const, paddingVertical: 7, paddingHorizontal: 8, backgroundColor: '#fdf8f0', borderTopWidth: 1, borderTopColor: C.cardBorder, borderTopStyle: 'solid' as const }}>
            <Text style={{ ...styles.tdBold, flex: 1, color: C.gold }}>Total</Text>
            <Text style={{ ...styles.td, flex: 0.6 }}></Text>
            <Text style={{ ...styles.tdBold, flex: 0.7, textAlign: 'right' as const, color: C.gold }}>
              {(portfolioYield * 100).toFixed(2)}%
            </Text>
            <Text style={{ ...styles.tdBold, flex: 0.8, textAlign: 'right' as const, color: C.gold }}>
              {fmt(totalAnnualIncome, currency)}
            </Text>
            <Text style={{ ...styles.td, flex: 0.7 }}></Text>
            <Text style={{ ...styles.td, flex: 0.7 }}></Text>
            <Text style={{ ...styles.td, flex: 0.7 }}></Text>
          </View>
        </View>
      </View>

      {/* Income sustainability note */}
      <View style={{
        backgroundColor: '#fefce8', borderRadius: 8, padding: 10,
        borderWidth: 1, borderColor: '#fde68a', borderStyle: 'solid' as const,
        marginBottom: 8,
      }}>
        <Text style={{ fontSize: 7, color: '#854d0e', lineHeight: 1.4 }}>
          Le revenu estime est base sur les derniers dividendes declares. Un ratio de distribution (payout) eleve
          peut indiquer un risque de coupure. Les dividendes ne sont pas garantis.
        </Text>
      </View>

      {aiComment && <AIBlock label="Revenus" text={aiComment} />}
    </ReportPage>
  );
}

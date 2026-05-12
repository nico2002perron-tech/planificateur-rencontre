import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, fmtDollarShort } from './shared';
import type { BehavioralAnalysis, CrisisScenario } from '../../analytics/behavioral';

interface BehavioralPageProps {
  pageNum: number;
  totalPages: number;
  analysis: BehavioralAnalysis;
  portfolioValue: number;
  aiComment?: string;
}

export function BehavioralPage({ pageNum, totalPages, analysis, portfolioValue, aiComment }: BehavioralPageProps) {
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Analyse comportementale" subtitle="Performance estimee durant les crises historiques" />

      {/* Emotional context banner */}
      <View style={{
        backgroundColor: '#fefce8', borderRadius: 10, padding: 12,
        borderWidth: 1, borderColor: '#fde68a', borderStyle: 'solid' as const,
        marginBottom: 16,
      }}>
        <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#854d0e', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
          Ce que vous devez savoir
        </Text>
        <Text style={{ fontSize: 8.5, color: '#713f12', lineHeight: 1.5 }}>
          {analysis.emotionalContext}
        </Text>
      </View>

      {/* Crisis scenario cards */}
      <View style={{ gap: 10, marginBottom: 16 }}>
        {analysis.scenarios.map((scenario, i) => (
          <CrisisCard key={i} scenario={scenario} portfolioValue={portfolioValue} />
        ))}
      </View>

      {/* Summary stats */}
      <View style={{ flexDirection: 'row' as const, gap: 12, marginBottom: 14 }}>
        <View style={styles.statCard}>
          <Text style={{ fontSize: 6.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
            Pire scenario
          </Text>
          <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 700, color: C.down }}>
            {(analysis.worstEstimatedDrawdown * 100).toFixed(0)}%
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={{ fontSize: 6.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
            Baisse moyenne
          </Text>
          <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 700, color: C.warn }}>
            {(analysis.avgEstimatedDrawdown * 100).toFixed(0)}%
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={{ fontSize: 6.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
            Perte max estimee
          </Text>
          <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 700, color: C.down }}>
            {fmtDollarShort(portfolioValue * Math.abs(analysis.worstEstimatedDrawdown))}
          </Text>
        </View>
      </View>

      {/* Disclaimer */}
      <Text style={styles.noteText}>
        Ces estimations sont basees sur les drawdowns sectoriels historiques et les betas des positions.
        Elles ne garantissent pas les resultats futurs et servent uniquement a illustrer les risques potentiels.
      </Text>

      {aiComment && <AIBlock label="Contexte" text={aiComment} />}
    </ReportPage>
  );
}

function CrisisCard({ scenario, portfolioValue }: { scenario: CrisisScenario; portfolioValue: number }) {
  return (
    <View style={{
      backgroundColor: C.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
      borderLeftWidth: 4, borderLeftColor: scenario.color, borderLeftStyle: 'solid' as const,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 8 }}>
        <View>
          <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
            {scenario.name}
          </Text>
          <Text style={{ fontSize: 7, color: C.textSec }}>{scenario.period}</Text>
        </View>
        <View style={{
          backgroundColor: `${scenario.color}18`,
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
        }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: scenario.color }}>
            {scenario.impactLevel}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={{ fontSize: 7.5, color: C.textSec, marginBottom: 10 }}>
        {scenario.description}
      </Text>

      {/* Metrics row */}
      <View style={{ flexDirection: 'row' as const, gap: 12 }}>
        <MetricBox
          label="Marche"
          value={`${(scenario.marketDrawdown * 100).toFixed(0)}%`}
          color={C.textSec}
        />
        <MetricBox
          label="Votre portefeuille"
          value={`${(scenario.estimatedPortfolioDrawdown * 100).toFixed(0)}%`}
          color={scenario.estimatedPortfolioDrawdown <= scenario.marketDrawdown ? C.up : C.down}
        />
        <MetricBox
          label="Perte estimee"
          value={fmtDollarShort(scenario.estimatedLossDollar)}
          color={C.down}
        />
        <MetricBox
          label="Recuperation"
          value={`~${scenario.estimatedRecoveryMonths} mois`}
          color={C.textSec}
        />
      </View>

      {/* Comparison bar */}
      <View style={{ marginTop: 8, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
        <Text style={{ fontSize: 6.5, color: C.textTer, width: 45 }}>Marche</Text>
        <View style={{ flex: 1, height: 6, backgroundColor: C.panel, borderRadius: 3, overflow: 'hidden' as const }}>
          <View style={{
            height: '100%', backgroundColor: C.textTer, borderRadius: 3,
            width: `${Math.abs(scenario.marketDrawdown) * 100}%`,
          }} />
        </View>
      </View>
      <View style={{ marginTop: 3, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
        <Text style={{ fontSize: 6.5, color: C.textTer, width: 45 }}>Portfolio</Text>
        <View style={{ flex: 1, height: 6, backgroundColor: C.panel, borderRadius: 3, overflow: 'hidden' as const }}>
          <View style={{
            height: '100%', borderRadius: 3,
            backgroundColor: Math.abs(scenario.estimatedPortfolioDrawdown) <= Math.abs(scenario.marketDrawdown) ? C.up : C.down,
            width: `${Math.min(100, Math.abs(scenario.estimatedPortfolioDrawdown) * 100)}%`,
          }} />
        </View>
      </View>
    </View>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' as const }}>
      <Text style={{ fontSize: 6, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color }}>{value}</Text>
    </View>
  );
}

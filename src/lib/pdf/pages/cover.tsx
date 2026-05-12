import React from 'react';
import { Page, Text, View, Image, Svg, Rect, Defs, LinearGradient, Stop, Path, Circle } from '@react-pdf/renderer';
import path from 'path';
import { styles, C } from '../styles';
import { GaugeChart } from '../charts/gauge-chart';
import type { PortfolioIntelligenceScore } from '../../analytics/portfolio-intelligence';

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo.png');

interface CoverPageProps {
  clientName: string;
  portfolioName: string;
  riskProfile: string;
  targetReturn: string;
  estimatedIncome: string;
  portfolioValue: string;
  intelligenceScore: PortfolioIntelligenceScore;
  advisorName: string;
  advisorTitle: string;
  generatedAt: string;
  horizon: string;
}

const RISK_LABELS: Record<string, string> = {
  CONSERVATEUR: 'Conservateur', MODERE: 'Modere', EQUILIBRE: 'Equilibre',
  CROISSANCE: 'Croissance', DYNAMIQUE: 'Dynamique',
};

export function CoverPage({
  clientName, portfolioName, riskProfile, targetReturn,
  estimatedIncome, portfolioValue, intelligenceScore,
  advisorName, advisorTitle, generatedAt, horizon,
}: CoverPageProps) {
  return (
    <Page size="LETTER" style={{ fontFamily: 'Open Sans', fontSize: 9, color: C.text, backgroundColor: C.white }}>
      {/* Top gradient bar */}
      <Svg width={612} height={6} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="coverBar" x1="0" y1="0" x2="612" y2="0">
            <Stop offset="0%" stopColor={C.navy} />
            <Stop offset="35%" stopColor={C.blue} />
            <Stop offset="55%" stopColor={C.cyan} />
            <Stop offset="75%" stopColor={C.gold} />
            <Stop offset="100%" stopColor={C.navy} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={612} height={6} fill="url(#coverBar)" />
      </Svg>

      {/* Logo */}
      <View style={{ paddingTop: 40, paddingHorizontal: 50, flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const }}>
        <Image src={LOGO_PATH} style={{ width: 140, height: 50, objectFit: 'contain' as const }} />
        <Text style={{ fontSize: 8, color: C.textTer }}>{generatedAt}</Text>
      </View>

      {/* Main title area */}
      <View style={{ paddingHorizontal: 50, paddingTop: 50 }}>
        <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.cyan, textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 10 }}>
          Rapport de portefeuille
        </Text>
        <Text style={{ fontSize: 28, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, lineHeight: 1.2, marginBottom: 6 }}>
          {portfolioName || 'Strategie d\'investissement'}
        </Text>
        <Text style={{ fontSize: 14, color: C.textSec, marginBottom: 30 }}>
          Prepare pour {clientName}
        </Text>

        {/* Divider */}
        <View style={{ width: 60, height: 3, backgroundColor: C.cyan, borderRadius: 2, marginBottom: 30 }} />
      </View>

      {/* Score + KPIs Section */}
      <View style={{ paddingHorizontal: 50, flexDirection: 'row' as const, gap: 20 }}>
        {/* Intelligence Score */}
        <View style={{
          width: 160, backgroundColor: C.card, borderRadius: 16,
          borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
          padding: 20, alignItems: 'center' as const,
        }}>
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 8 }}>
            Score Intelligence
          </Text>
          <GaugeChart
            value={intelligenceScore.overall}
            grade={intelligenceScore.grade}
            label={intelligenceScore.label}
            size={120}
            color={intelligenceScore.color}
          />
          <View style={{ flexDirection: 'row' as const, marginTop: 8, gap: 4 }}>
            {intelligenceScore.subScores.slice(0, 4).map((sub, i) => (
              <View key={i} style={{ alignItems: 'center' as const }}>
                <Text style={{ fontSize: 5, color: C.textTer }}>{sub.name.substring(0, 5)}</Text>
                <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{sub.score}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* KPI Grid */}
        <View style={{ flex: 1, gap: 10 }}>
          <View style={{ flexDirection: 'row' as const, gap: 10 }}>
            <CoverKPI label="Valeur du portefeuille" value={portfolioValue} accent={C.navy} />
            <CoverKPI label="Rendement cible" value={targetReturn} accent={C.cyan} />
          </View>
          <View style={{ flexDirection: 'row' as const, gap: 10 }}>
            <CoverKPI label="Revenu estime annuel" value={estimatedIncome} accent={C.gold} />
            <CoverKPI label="Profil de risque" value={RISK_LABELS[riskProfile] || riskProfile} accent={C.blue} />
          </View>
          <View style={{ flexDirection: 'row' as const, gap: 10 }}>
            <CoverKPI label="Horizon" value={horizon || 'Long terme'} accent={C.textSec} />
            <CoverKPI label="Score global" value={`${intelligenceScore.overall}/100`} accent={intelligenceScore.color} />
          </View>
        </View>
      </View>

      {/* Bottom info */}
      <View style={{ position: 'absolute' as const, bottom: 50, left: 50, right: 50 }}>
        <View style={{ width: '100%', height: 1, backgroundColor: C.cardBorder, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
          <View>
            <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{advisorName}</Text>
            <Text style={{ fontSize: 7, color: C.textSec }}>{advisorTitle}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' as const }}>
            <Text style={{ fontSize: 7, color: C.textTer }}>Document confidentiel</Text>
            <Text style={{ fontSize: 7, color: C.textTer }}>Groupe Financier Ste-Foy</Text>
          </View>
        </View>
      </View>

      {/* Bottom gradient bar */}
      <Svg width={612} height={4} style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <Rect x={0} y={0} width={612} height={4} fill={C.navy} />
      </Svg>
    </Page>
  );
}

function CoverKPI({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.card, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
    }}>
      <View style={{ width: 24, height: 2.5, borderRadius: 1.5, backgroundColor: accent, marginBottom: 6 }} />
      <Text style={{ fontSize: 6, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{value}</Text>
    </View>
  );
}

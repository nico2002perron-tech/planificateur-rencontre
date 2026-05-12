import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock } from './shared';
import { RadarChart } from '../charts/radar-chart';
import type { StressRadarResult } from '../../analytics/stress-radar';

interface StressRadarPageProps {
  pageNum: number;
  totalPages: number;
  radar: StressRadarResult;
  aiComment?: string;
}

export function StressRadarPage({ pageNum, totalPages, radar, aiComment }: StressRadarPageProps) {
  const radarData = radar.factors.map(f => ({
    label: f.name,
    value: f.sensitivity * 10, // Convert 0-10 to 0-100 for radar display
    color: f.color,
  }));

  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Stress Radar" subtitle="Sensibilite du portefeuille aux chocs macroeconomiques" />

      {/* Resilience banner */}
      <View style={{
        backgroundColor: C.card, borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
        marginBottom: 16, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
      }}>
        <View style={{
          width: 50, height: 50, borderRadius: 25,
          backgroundColor: getResilienceColor(radar.overallResilience),
          alignItems: 'center' as const, justifyContent: 'center' as const,
        }}>
          <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: C.white }}>
            {radar.overallResilience}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
            Resilience : {radar.resilienceLabel}
          </Text>
          <Text style={{ fontSize: 8, color: C.textSec }}>
            Score de resilience globale du portefeuille (0-100)
          </Text>
        </View>
      </View>

      {/* Main content: Radar + Detail table */}
      <View style={{ flexDirection: 'row' as const, gap: 20, marginBottom: 16 }}>
        {/* Radar Chart */}
        <View style={{ alignItems: 'center' as const, width: 220 }}>
          <RadarChart
            data={radarData}
            size={200}
            fillColor="rgba(0, 180, 216, 0.12)"
            strokeColor={C.cyan}
          />
        </View>

        {/* Factor detail table */}
        <View style={{ flex: 1 }}>
          <Text style={styles.subsectionTitle}>Detail par facteur</Text>
          {radar.factors.map((factor, i) => (
            <View key={i} style={{
              flexDirection: 'row' as const, alignItems: 'center' as const,
              paddingVertical: 7, paddingHorizontal: 8,
              borderBottomWidth: i < radar.factors.length - 1 ? 0.5 : 0,
              borderBottomColor: C.cardBorder, borderBottomStyle: 'solid' as const,
              backgroundColor: i % 2 === 0 ? C.white : C.card,
              borderRadius: i === 0 ? 8 : i === radar.factors.length - 1 ? 8 : 0,
            }}>
              {/* Factor name */}
              <Text style={{ fontSize: 8.5, color: C.text, width: 110 }}>{factor.name}</Text>

              {/* Sensitivity bar */}
              <View style={{ flex: 1, height: 8, backgroundColor: C.panel, borderRadius: 4, overflow: 'hidden' as const, marginHorizontal: 8 }}>
                <View style={{
                  height: '100%', borderRadius: 4,
                  backgroundColor: factor.color,
                  width: `${Math.max(3, factor.sensitivity * 10)}%`,
                }} />
              </View>

              {/* Score */}
              <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: factor.color, width: 30, textAlign: 'right' as const }}>
                {factor.sensitivity.toFixed(1)}
              </Text>

              {/* Label badge */}
              <View style={{
                backgroundColor: `${factor.color}18`,
                paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6, width: 55,
              }}>
                <Text style={{ fontSize: 6.5, color: factor.color, fontFamily: 'Open Sans', fontWeight: 600, textAlign: 'center' as const }}>
                  {factor.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Vulnerabilities and Strengths */}
      <View style={{ flexDirection: 'row' as const, gap: 12, marginBottom: 14 }}>
        {/* Vulnerabilities */}
        {radar.vulnerabilities.length > 0 && (
          <View style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#fecaca', borderStyle: 'solid' as const }}>
            <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#991b1b', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
              Vulnerabilites
            </Text>
            {radar.vulnerabilities.map((v, i) => (
              <Text key={i} style={{ fontSize: 8, color: '#991b1b', marginBottom: 3 }}>{'\u2022'} {v}</Text>
            ))}
          </View>
        )}

        {/* Strengths */}
        {radar.strengths.length > 0 && (
          <View style={{ flex: 1, backgroundColor: '#ecfdf5', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#a7f3d0', borderStyle: 'solid' as const }}>
            <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#065f46', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
              Forces
            </Text>
            {radar.strengths.map((s, i) => (
              <Text key={i} style={{ fontSize: 8, color: '#065f46', marginBottom: 3 }}>{'\u2022'} {s}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Factor explanations */}
      <View style={{ marginBottom: 10 }}>
        {radar.factors.map((factor, i) => (
          <Text key={i} style={{ fontSize: 7, color: C.textSec, marginBottom: 2 }}>
            {factor.name} : {factor.explanation}
          </Text>
        ))}
      </View>

      {aiComment && <AIBlock label="Interpretation" text={aiComment} />}
    </ReportPage>
  );
}

function getResilienceColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 55) return C.cyan;
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

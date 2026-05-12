import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock } from './shared';

export interface MarketFactor {
  name: string;
  status: 'Favorable' | 'Neutre' | 'Defavorable';
  description: string;
  impact: string; // e.g. "Positif pour obligations"
  color: string;
}

export interface SectorOutlook {
  sector: string;
  signal: 'Surponderer' | 'Neutre' | 'Sous-ponderer';
  weight: number; // Portfolio weight
  color: string;
}

interface MarketIntelPageProps {
  pageNum: number;
  totalPages: number;
  factors: MarketFactor[];
  sectorOutlooks: SectorOutlook[];
  marketSummary: string;
  date: string;
  aiComment?: string;
}

export function MarketIntelPage({
  pageNum, totalPages, factors, sectorOutlooks, marketSummary, date, aiComment,
}: MarketIntelPageProps) {
  const statusColors: Record<string, string> = {
    'Favorable': C.up,
    'Neutre': C.warn,
    'Defavorable': C.down,
  };

  const signalColors: Record<string, string> = {
    'Surponderer': C.up,
    'Neutre': C.textSec,
    'Sous-ponderer': C.down,
  };

  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Contexte de marche" subtitle={`Conditions macroeconomiques — ${date}`} />

      {/* Market summary banner */}
      <View style={{
        backgroundColor: C.card, borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
        marginBottom: 16,
      }}>
        <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.5 }}>
          {marketSummary}
        </Text>
      </View>

      {/* Macro factors */}
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.subsectionTitle}>Facteurs macroeconomiques</Text>
        <View style={{ gap: 8 }}>
          {factors.map((factor, i) => (
            <View key={i} style={{
              backgroundColor: C.card, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
              borderLeftWidth: 3, borderLeftColor: factor.color, borderLeftStyle: 'solid' as const,
              flexDirection: 'row' as const, gap: 10, alignItems: 'flex-start' as const,
            }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 3 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>
                    {factor.name}
                  </Text>
                  <View style={{
                    backgroundColor: `${statusColors[factor.status] || C.textSec}18`,
                    paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4,
                  }}>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: statusColors[factor.status] || C.textSec }}>
                      {factor.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 7.5, color: C.textSec, lineHeight: 1.4 }}>
                  {factor.description}
                </Text>
              </View>
              <View style={{
                backgroundColor: C.panel, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                maxWidth: 120,
              }}>
                <Text style={{ fontSize: 6, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Impact</Text>
                <Text style={{ fontSize: 7, color: C.text, fontFamily: 'Open Sans', fontWeight: 600 }}>{factor.impact}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Sector outlook table */}
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.subsectionTitle}>Positionnement sectoriel</Text>
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={{ ...styles.thCell, flex: 1.5 }}>Secteur</Text>
            <Text style={{ ...styles.thCell, flex: 0.8, textAlign: 'right' as const }}>Poids actuel</Text>
            <Text style={{ ...styles.thCell, flex: 1, textAlign: 'center' as const }}>Signal</Text>
            <Text style={{ ...styles.thCell, flex: 1.5 }}>Visualisation</Text>
          </View>
          {sectorOutlooks.map((s, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
              <View style={{ flex: 1.5, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.color }} />
                <Text style={{ fontSize: 8.5, color: C.text }}>{s.sector}</Text>
              </View>
              <Text style={{ ...styles.tdBold, flex: 0.8, textAlign: 'right' as const }}>
                {(s.weight * 100).toFixed(1)}%
              </Text>
              <View style={{ flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const }}>
                <Text style={{
                  fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600,
                  color: signalColors[s.signal],
                  backgroundColor: `${signalColors[s.signal]}18`,
                  paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 3,
                }}>
                  {s.signal}
                </Text>
              </View>
              <View style={{ flex: 1.5, paddingHorizontal: 4, justifyContent: 'center' as const }}>
                <View style={{ height: 6, backgroundColor: C.panel, borderRadius: 3, overflow: 'hidden' as const }}>
                  <View style={{
                    height: '100%', borderRadius: 3,
                    backgroundColor: s.color,
                    width: `${Math.max(3, s.weight * 100 * 3)}%`,
                  }} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.noteText}>
        Les signaux sectoriels sont bases sur les conditions macroeconomiques actuelles et les tendances historiques.
        Ils ne constituent pas des recommandations d'investissement.
      </Text>

      {aiComment && <AIBlock label="Marche" text={aiComment} />}
    </ReportPage>
  );
}

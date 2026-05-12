import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, ScoreBar } from './shared';
import type { PortfolioIntelligenceScore } from '../../analytics/portfolio-intelligence';

export interface Recommendation {
  priority: 'Haute' | 'Moyenne' | 'Basse';
  category: string;
  title: string;
  description: string;
  impact: string;
  color: string;
}

interface RecommendationsPageProps {
  pageNum: number;
  totalPages: number;
  intelligenceScore: PortfolioIntelligenceScore;
  recommendations: Recommendation[];
  strengthSummary: string[];
  weaknessSummary: string[];
  aiComment?: string;
}

export function RecommendationsPage({
  pageNum, totalPages, intelligenceScore, recommendations,
  strengthSummary, weaknessSummary, aiComment,
}: RecommendationsPageProps) {
  const priorityColors: Record<string, string> = {
    'Haute': C.down,
    'Moyenne': C.warn,
    'Basse': C.cyan,
  };

  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Recommandations" subtitle="Points d'action pour optimiser votre portefeuille" />

      {/* Intelligence score breakdown */}
      <View style={{
        backgroundColor: C.card, borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
        marginBottom: 16, flexDirection: 'row' as const, gap: 16,
      }}>
        {/* Score summary */}
        <View style={{ alignItems: 'center' as const, width: 80 }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: intelligenceScore.color,
            alignItems: 'center' as const, justifyContent: 'center' as const,
          }}>
            <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.white }}>
              {intelligenceScore.grade}
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: C.textSec, marginTop: 4 }}>
            {intelligenceScore.overall}/100
          </Text>
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: intelligenceScore.color }}>
            {intelligenceScore.label}
          </Text>
        </View>

        {/* Sub-score bars */}
        <View style={{ flex: 1 }}>
          {intelligenceScore.subScores.map((sub, i) => (
            <ScoreBar
              key={i}
              label={sub.name}
              value={sub.score}
              max={100}
              color={sub.score >= 70 ? C.up : sub.score >= 50 ? C.cyan : sub.score >= 35 ? C.warn : C.down}
            />
          ))}
        </View>
      </View>

      {/* Strengths and Weaknesses */}
      <View style={{ flexDirection: 'row' as const, gap: 12, marginBottom: 16 }}>
        {strengthSummary.length > 0 && (
          <View style={{
            flex: 1, backgroundColor: C.upBg, borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: C.upBorder, borderStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#065f46', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
              Forces du portefeuille
            </Text>
            {strengthSummary.map((s, i) => (
              <Text key={i} style={{ fontSize: 7.5, color: '#065f46', marginBottom: 3 }}>{'\u2713'} {s}</Text>
            ))}
          </View>
        )}
        {weaknessSummary.length > 0 && (
          <View style={{
            flex: 1, backgroundColor: C.downBg, borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: C.downBorder, borderStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#991b1b', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
              Points a ameliorer
            </Text>
            {weaknessSummary.map((w, i) => (
              <Text key={i} style={{ fontSize: 7.5, color: '#991b1b', marginBottom: 3 }}>{'\u26A0'} {w}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Action items */}
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.subsectionTitle}>Actions recommandees</Text>
        <View style={{ gap: 8 }}>
          {recommendations.map((rec, i) => (
            <View key={i} style={{
              backgroundColor: C.card, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
              borderLeftWidth: 3, borderLeftColor: rec.color, borderLeftStyle: 'solid' as const,
            }}>
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
                  {/* Priority badge */}
                  <View style={{
                    backgroundColor: `${priorityColors[rec.priority] || C.textSec}18`,
                    paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4,
                  }}>
                    <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: priorityColors[rec.priority] || C.textSec }}>
                      {rec.priority}
                    </Text>
                  </View>
                  {/* Category */}
                  <Text style={{ fontSize: 6.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                    {rec.category}
                  </Text>
                </View>
                {/* Impact */}
                <Text style={{ fontSize: 7, color: C.textSec, fontStyle: 'italic' as const }}>
                  {rec.impact}
                </Text>
              </View>
              <Text style={{ fontSize: 9, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, marginBottom: 2 }}>
                {rec.title}
              </Text>
              <Text style={{ fontSize: 7.5, color: C.textSec, lineHeight: 1.4 }}>
                {rec.description}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.noteText}>
        Ces recommandations sont basees sur l'analyse quantitative du portefeuille actuel.
        Toute decision d'investissement doit etre discutee avec votre conseiller.
      </Text>

      {aiComment && <AIBlock label="Recommandations" text={aiComment} />}
    </ReportPage>
  );
}

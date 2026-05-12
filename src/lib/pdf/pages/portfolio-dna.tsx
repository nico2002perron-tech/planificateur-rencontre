import React from 'react';
import { Text, View, Svg, Rect, Path } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, fmtPctShort } from './shared';
import type { PortfolioDNA, HoldingDNA } from '../../analytics/portfolio-dna';

interface PortfolioDNAPageProps {
  pageNum: number;
  totalPages: number;
  dna: PortfolioDNA;
  aiComment?: string;
}

export function PortfolioDNAPage({ pageNum, totalPages, dna, aiComment }: PortfolioDNAPageProps) {
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="ADN du portefeuille" subtitle="Style d'investissement et composition" />

      {/* Summary banner */}
      <View style={{
        backgroundColor: C.card, borderRadius: 12, padding: 16,
        borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
        marginBottom: 16,
      }}>
        <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy, marginBottom: 6 }}>
          {dna.summary}
        </Text>
        <Text style={{ fontSize: 8, color: C.textSec }}>
          Style dominant : {dna.dominantStyle}
          {dna.secondaryStyle ? ` | Style secondaire : ${dna.secondaryStyle}` : ''}
        </Text>
      </View>

      {/* Style breakdown bars */}
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.subsectionTitle}>Repartition par style</Text>
        {dna.styleBreakdown.map((style, i) => (
          <View key={i} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 8, gap: 8 }}>
            {/* Color dot */}
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: style.color }} />
            {/* Label */}
            <Text style={{ fontSize: 9, color: C.text, width: 110 }}>{style.style}</Text>
            {/* Bar */}
            <View style={{ flex: 1, height: 14, backgroundColor: C.panel, borderRadius: 7, overflow: 'hidden' as const }}>
              <View style={{
                height: '100%', backgroundColor: style.color, borderRadius: 7,
                width: `${Math.max(2, style.weight * 100)}%`,
              }} />
            </View>
            {/* Percentage */}
            <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy, width: 40, textAlign: 'right' as const }}>
              {(style.weight * 100).toFixed(0)}%
            </Text>
            {/* Count */}
            <Text style={{ fontSize: 7, color: C.textTer, width: 50 }}>
              ({style.count} {style.count > 1 ? 'actifs' : 'actif'})
            </Text>
          </View>
        ))}
      </View>

      {/* DNA Donut visual */}
      <View style={{ flexDirection: 'row' as const, gap: 20, marginBottom: 16 }}>
        {/* Donut */}
        <View style={{ alignItems: 'center' as const }}>
          <DNADonut slices={dna.styleBreakdown.map(s => ({ pct: s.weight * 100, color: s.color }))} size={100} />
        </View>

        {/* Holdings list grouped by style */}
        <View style={{ flex: 1 }}>
          <Text style={styles.subsectionTitle}>Detail par actif</Text>
          <View style={styles.table}>
            <View style={styles.th}>
              <Text style={{ ...styles.thCell, flex: 2 }}>Actif</Text>
              <Text style={{ ...styles.thCell, flex: 1.5 }}>Style</Text>
              <Text style={{ ...styles.thCell, flex: 0.6, textAlign: 'right' as const }}>Poids</Text>
            </View>
            {dna.holdings
              .sort((a, b) => b.weight - a.weight)
              .slice(0, 15)
              .map((h, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                  <View style={{ flex: 2, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getStyleColor(h.style) }} />
                    <Text style={{ fontSize: 8, color: C.text }}>{h.symbol}</Text>
                  </View>
                  <Text style={{ ...styles.td, flex: 1.5, fontSize: 7 }}>{h.style}</Text>
                  <Text style={{ ...styles.td, flex: 0.6, textAlign: 'right' as const, fontFamily: 'Open Sans', fontWeight: 600 }}>
                    {(h.weight * 100).toFixed(1)}%
                  </Text>
                </View>
              ))}
          </View>
        </View>
      </View>

      {/* AI Comment */}
      {aiComment && <AIBlock label="Interpretation" text={aiComment} />}
    </ReportPage>
  );
}

function DNADonut({ slices, size }: { slices: Array<{ pct: number; color: string }>; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const innerR = r * 0.55;

  let cumulative = 0;
  const arcs = slices.filter(s => s.pct > 0).map(slice => {
    const startAngle = cumulative * 3.6 * (Math.PI / 180);
    cumulative += slice.pct;
    const endAngle = cumulative * 3.6 * (Math.PI / 180);
    const x1 = cx + r * Math.sin(startAngle);
    const y1 = cy - r * Math.cos(startAngle);
    const x2 = cx + r * Math.sin(endAngle);
    const y2 = cy - r * Math.cos(endAngle);
    const ix1 = cx + innerR * Math.sin(startAngle);
    const iy1 = cy - innerR * Math.cos(startAngle);
    const ix2 = cx + innerR * Math.sin(endAngle);
    const iy2 = cy - innerR * Math.cos(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return {
      d: `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix2.toFixed(1)},${iy2.toFixed(1)} A${innerR},${innerR} 0 ${large} 0 ${ix1.toFixed(1)},${iy1.toFixed(1)} Z`,
      color: slice.color,
    };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((a, i) => (
        <Path key={i} d={a.d} fill={a.color} />
      ))}
    </Svg>
  );
}

const STYLE_COLORS: Record<string, string> = {
  'Quality Growth': '#00b4d8',
  'Dividend Income': '#22c55e',
  'Defensive': '#6366f1',
  'Cyclical': '#f59e0b',
  'Speculative Growth': '#ef4444',
  'Value': '#8b5cf6',
  'Fixed Income': '#0ea5e9',
  'Alternative': '#64748b',
};

function getStyleColor(style: string): string {
  return STYLE_COLORS[style] || '#94a3b8';
}

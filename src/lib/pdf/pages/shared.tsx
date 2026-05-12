// =============================================================================
// SHARED PDF COMPONENTS — Used across all pages
// =============================================================================
import React from 'react';
import {
  Page, Text, View, Image,
  Svg, Rect, Defs, LinearGradient, Stop,
} from '@react-pdf/renderer';
import path from 'path';
import { styles, C } from '../styles';

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo.png');

// ─── Formatters ─────────────────────────────────────────────────

export function fmt(value: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export function fmtFull(value: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

export function fmtPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} %`;
}

export function fmtPctShort(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function fmtNum(value: number): string {
  return new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(value);
}

export function fmtCap(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)} T$`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} G$`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)} M$`;
  return fmt(value);
}

export function fmtDollarShort(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M$`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)} 000$`;
  return `${value.toFixed(0)}$`;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.substring(0, max - 1) + '\u2026' : text;
}

// ─── Gradient Accent Bar (top of every page) ────────────────────

export function AccentBar() {
  return (
    <Svg width={792} height={4} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id="ab" x1="0" y1="0" x2="792" y2="0">
          <Stop offset="0%" stopColor={C.navy} />
          <Stop offset="30%" stopColor={C.blue} />
          <Stop offset="50%" stopColor={C.cyan} />
          <Stop offset="70%" stopColor={C.gold} />
          <Stop offset="100%" stopColor={C.navy} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={792} height={4} fill="url(#ab)" />
    </Svg>
  );
}

// ─── Page Footer ────────────────────────────────────────────────

export function PageFooter({ num, total }: { num: number; total: number }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Confidentiel</Text>
      <Text style={styles.footerText}>{num} / {total}</Text>
    </View>
  );
}

// ─── Section Title ──────────────────────────────────────────────

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && (
        <Text style={{ fontSize: 9, color: C.textSec, marginTop: -8, marginBottom: 8 }}>{subtitle}</Text>
      )}
    </View>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────

export function KPICard({ label, value, sub, accent = C.cyan }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 18,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
    }}>
      <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: accent, marginBottom: 10 }} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={{ ...styles.kpiValue, color: accent === C.gold ? C.gold : C.navy }}>{value}</Text>
      {sub && <Text style={{ fontSize: 9, color: C.textSec, marginTop: 4 }}>{sub}</Text>}
    </View>
  );
}

// ─── AI Comment Block ───────────────────────────────────────────

export function AIBlock({ label, text }: { label?: string; text: string }) {
  return (
    <View style={styles.aiBlock}>
      <Text style={styles.aiLabel}>{label || 'Analyse IA'}</Text>
      <Text style={styles.aiText}>{text}</Text>
    </View>
  );
}

// ─── Stat Mini Card ─────────────────────────────────────────────

export function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={{ fontSize: 6.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: color || C.navy }}>{value}</Text>
    </View>
  );
}

// ─── Score Badge ────────────────────────────────────────────────

export function ScoreBadge({ score, label, color }: { score: number | string; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 4 }}>
      <View style={{
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: color, alignItems: 'center' as const, justifyContent: 'center' as const,
      }}>
        <Text style={{ fontSize: 9, color: C.white, fontFamily: 'Montserrat', fontWeight: 700 }}>
          {typeof score === 'number' ? score.toFixed(0) : score}
        </Text>
      </View>
      <Text style={{ fontSize: 8.5, color: C.text }}>{label}</Text>
    </View>
  );
}

// ─── Horizontal Score Bar ───────────────────────────────────────

export function ScoreBar({ value, max = 100, color, label, showValue = true }: {
  value: number; max?: number; color: string; label: string; showValue?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 5, gap: 6 }}>
      <Text style={{ fontSize: 7.5, color: C.text, width: 80 }}>{label}</Text>
      <View style={styles.scoreBarOuter}>
        <View style={{ ...styles.scoreBarInner, width: `${pct}%`, backgroundColor: color }} />
      </View>
      {showValue && (
        <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color, width: 24, textAlign: 'right' as const }}>
          {Math.round(value)}
        </Text>
      )}
    </View>
  );
}

// ─── Standard Report Page Wrapper ───────────────────────────────

export function ReportPage({ num, total, children }: {
  num: number; total: number; children: React.ReactNode;
}) {
  return (
    <Page size="LETTER" style={styles.page}>
      <AccentBar />
      {children}
      <PageFooter num={num} total={total} />
    </Page>
  );
}

// ─── Donut Chart (reusable) ─────────────────────────────────────

export interface PieSlice { label: string; percentage: number; color: string; value?: number; }

export function DonutChart({ slices, size = 90, centerLabel, centerValue }: {
  slices: PieSlice[]; size?: number;
  centerLabel?: string; centerValue?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const innerR = r * 0.58;
  const filtered = slices.filter((s) => s.percentage > 0);
  if (filtered.length === 0) return null;

  let cumulative = 0;
  const arcs = filtered.map((slice) => {
    const startAngle = cumulative * 3.6 * (Math.PI / 180);
    cumulative += slice.percentage;
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
    return { d: `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large} 0 ${ix1},${iy1} Z`, color: slice.color };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((a, i) => (
        <Rect key={i} x={0} y={0} width={0} height={0}>
          {/* Workaround: we use Path */}
        </Rect>
      ))}
      {/* Re-render using Path from @react-pdf */}
      {arcs.map((a, i) => {
        // Path is imported at the top of shared, we need to import it
        const PathComp = require('@react-pdf/renderer').Path;
        return <PathComp key={i} d={a.d} fill={a.color} />;
      })}
      {centerValue && (
        <>
          {(() => {
            const SvgText = require('@react-pdf/renderer').Text;
            return (
              <>
                <SvgText x={cx} y={cy - 2} fontSize={12} fill={C.navy} textAnchor="middle" fontFamily="Montserrat" fontWeight={800}>
                  {centerValue}
                </SvgText>
                {centerLabel && (
                  <SvgText x={cx} y={cy + 10} fontSize={6} fill={C.textSec} textAnchor="middle">
                    {centerLabel}
                  </SvgText>
                )}
              </>
            );
          })()}
        </>
      )}
    </Svg>
  );
}

// ─── Legend ──────────────────────────────────────────────────────

export function Legend({ items }: { items: Array<{ label: string; color: string; value?: string }> }) {
  return (
    <View style={styles.legendWrap}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: item.color }} />
          <Text style={{ fontSize: 7, color: C.text }}>{item.label}</Text>
          {item.value && <Text style={{ fontSize: 7, color: C.textSec }}>{item.value}</Text>}
        </View>
      ))}
    </View>
  );
}

// ─── Sector Bars ────────────────────────────────────────────────

export function SectorBars({ sectors }: { sectors: Array<{ label: string; weight: number; color: string }> }) {
  const max = Math.max(...sectors.map(s => s.weight), 0.01);
  return (
    <View>
      {sectors.slice(0, 10).map((s, i) => (
        <View key={i} style={styles.sectorRow}>
          <Text style={styles.sectorLabel}>{truncate(s.label, 22)}</Text>
          <View style={styles.sectorBarOuter}>
            <View style={{ ...styles.sectorBarInner, width: `${(s.weight / max) * 100}%`, backgroundColor: s.color }} />
          </View>
          <Text style={styles.sectorPct}>{(s.weight * 100).toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}

import React from 'react';
import { Text, View, Svg, Rect, Line, Path } from '@react-pdf/renderer';
import { SvgText } from '../charts/svg-text';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, fmtPct } from './shared';

export interface BenchmarkComparison {
  label: string;
  portfolioValue: number;
  benchmarkValue: number;
  unit: string;
  betterIsHigher: boolean;
}

export interface PerformancePeriod {
  period: string;
  portfolioReturn: number;
  benchmarkReturn: number;
}

interface PeriodRowData {
  period: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  diff: number;
  diffBarPct: number;
  diffColor: string;
}

interface ComparisonsPageProps {
  pageNum: number;
  totalPages: number;
  benchmarkName: string;
  comparisons: BenchmarkComparison[];
  performancePeriods: PerformancePeriod[];
  portfolioGrowth: number[]; // Monthly rebased to 100
  benchmarkGrowth: number[];
  months: string[];
  captureUp: number;
  captureDown: number;
  aiComment?: string;
  periodRows?: PeriodRowData[];
}

export function ComparisonsPage({
  pageNum, totalPages, benchmarkName, comparisons,
  performancePeriods, portfolioGrowth, benchmarkGrowth, months,
  captureUp, captureDown, aiComment, periodRows,
}: ComparisonsPageProps) {
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Comparaison au benchmark" subtitle={`Performance relative vs ${benchmarkName}`} />

      {/* Relative performance chart */}
      {portfolioGrowth.length > 2 && (
        <View style={{
          backgroundColor: C.card, borderRadius: 12, padding: 14,
          borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
          marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row' as const, gap: 16, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
              <View style={{ width: 16, height: 3, backgroundColor: C.cyan, borderRadius: 1.5 }} />
              <Text style={{ fontSize: 7, color: C.textSec }}>Portefeuille</Text>
            </View>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
              <View style={{ width: 16, height: 3, backgroundColor: C.textTer, borderRadius: 1.5 }} />
              <Text style={{ fontSize: 7, color: C.textSec }}>{benchmarkName}</Text>
            </View>
          </View>
          <GrowthChart
            portfolio={portfolioGrowth}
            benchmark={benchmarkGrowth}
            months={months}
            width={500}
            height={140}
          />
        </View>
      )}

      {/* Performance periods table */}
      <View style={{ marginBottom: 14 }}>
        <Text style={styles.subsectionTitle}>Performance par periode</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, flex: 1.2 }}>Periode</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>Portefeuille</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>{benchmarkName}</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>Ecart</Text>
            <Text style={{ ...styles.thCellPremium, flex: 1.2 }}>Visualisation</Text>
          </View>
          {(() => {
            // Use pre-computed rows if available, otherwise compute inline (backwards compat)
            const maxAbs = Math.max(...performancePeriods.map(pp => Math.abs(pp.portfolioReturn - pp.benchmarkReturn)), 0.01);
            const rows = periodRows ?? performancePeriods.map(p => ({
              period: p.period,
              portfolioReturn: p.portfolioReturn,
              benchmarkReturn: p.benchmarkReturn,
              diff: p.portfolioReturn - p.benchmarkReturn,
              diffBarPct: Math.abs((p.portfolioReturn - p.benchmarkReturn) / maxAbs) * 45,
              diffColor: (p.portfolioReturn - p.benchmarkReturn) >= 0 ? C.up : C.down,
            }));
            return rows.map((p, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={{ ...styles.td, flex: 1.2 }}>{p.period}</Text>
                <Text style={{
                  ...styles.tdBold, flex: 0.8, textAlign: 'right' as const,
                  color: p.portfolioReturn >= 0 ? C.up : C.down,
                }}>
                  {fmtPct(p.portfolioReturn * 100)}
                </Text>
                <Text style={{
                  ...styles.td, flex: 0.8, textAlign: 'right' as const,
                  color: p.benchmarkReturn >= 0 ? C.up : C.down,
                }}>
                  {fmtPct(p.benchmarkReturn * 100)}
                </Text>
                <Text style={{
                  ...styles.tdBold, flex: 0.8, textAlign: 'right' as const,
                  color: p.diffColor,
                }}>
                  {p.diff >= 0 ? '+' : ''}{(p.diff * 100).toFixed(2)}%
                </Text>
                {/* Difference bar */}
                <View style={{ flex: 1.2, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 4 }}>
                  <View style={{ flex: 1, height: 8, backgroundColor: C.panel, borderRadius: 4, overflow: 'hidden' as const, position: 'relative' as const }}>
                    {/* Center line */}
                    <View style={{ position: 'absolute' as const, left: '50%', top: 0, width: 1, height: '100%', backgroundColor: C.cardBorder }} />
                    {/* Bar */}
                    <View style={{
                      position: 'absolute' as const,
                      top: 0, height: '100%', borderRadius: 4,
                      backgroundColor: p.diffColor,
                      left: p.diff >= 0 ? '50%' : `${50 - p.diffBarPct}%`,
                      width: `${p.diffBarPct}%`,
                    }} />
                  </View>
                </View>
              </View>
            ));
          })()}
        </View>
      </View>

      {/* Capture ratios + key comparisons */}
      <View style={{ flexDirection: 'row' as const, gap: 16, marginBottom: 14 }}>
        {/* Capture ratios */}
        <View style={{
          flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14,
          borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
        }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.textSec, marginBottom: 8 }}>
            Ratios de capture
          </Text>
          <View style={{ flexDirection: 'row' as const, gap: 12 }}>
            <View style={{ flex: 1, alignItems: 'center' as const }}>
              <Text style={{ fontSize: 6, color: C.textTer, textTransform: 'uppercase' as const }}>Haussiere</Text>
              <Text style={{
                fontSize: 18, fontFamily: 'Montserrat', fontWeight: 700,
                color: captureUp > 100 ? C.up : C.warn,
              }}>
                {captureUp.toFixed(0)}%
              </Text>
              <Text style={{ fontSize: 6, color: C.textTer }}>{captureUp > 100 ? 'Surperformance' : 'Sous-performance'}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: C.cardBorder }} />
            <View style={{ flex: 1, alignItems: 'center' as const }}>
              <Text style={{ fontSize: 6, color: C.textTer, textTransform: 'uppercase' as const }}>Baissiere</Text>
              <Text style={{
                fontSize: 18, fontFamily: 'Montserrat', fontWeight: 700,
                color: captureDown < 100 ? C.up : C.down,
              }}>
                {captureDown.toFixed(0)}%
              </Text>
              <Text style={{ fontSize: 6, color: C.textTer }}>{captureDown < 100 ? 'Bonne protection' : 'Vulnerabilite'}</Text>
            </View>
          </View>
        </View>

        {/* Key metric comparisons */}
        <View style={{ flex: 1.5 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.textSec, marginBottom: 8 }}>
            Metriques comparatives
          </Text>
          {comparisons.slice(0, 6).map((c, i) => {
            const portBetter = c.betterIsHigher
              ? c.portfolioValue >= c.benchmarkValue
              : c.portfolioValue <= c.benchmarkValue;
            return (
              <View key={i} style={{
                flexDirection: 'row' as const, alignItems: 'center' as const,
                paddingVertical: 4, paddingHorizontal: 6,
                borderBottomWidth: i < comparisons.length - 1 ? 0.5 : 0,
                borderBottomColor: C.panel, borderBottomStyle: 'solid' as const,
              }}>
                <Text style={{ fontSize: 8, color: C.text, flex: 1 }}>{c.label}</Text>
                <Text style={{
                  fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600,
                  color: portBetter ? C.up : C.warn, width: 60, textAlign: 'right' as const,
                }}>
                  {formatMetricValue(c.portfolioValue, c.unit)}
                </Text>
                <Text style={{ fontSize: 7, color: C.textTer, width: 20, textAlign: 'center' as const }}>vs</Text>
                <Text style={{ fontSize: 8, color: C.textSec, width: 60, textAlign: 'right' as const }}>
                  {formatMetricValue(c.benchmarkValue, c.unit)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {aiComment && <AIBlock label="Benchmark" text={aiComment} />}
    </ReportPage>
  );
}

function GrowthChart({
  portfolio, benchmark, months, width, height,
}: {
  portfolio: number[]; benchmark: number[]; months: string[];
  width: number; height: number;
}) {
  const n = portfolio.length;
  if (n < 2) return null;

  const padLeft = 35;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 20;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allVals = [...portfolio, ...benchmark];
  const yMin = Math.min(...allVals) * 0.98;
  const yMax = Math.max(...allVals) * 1.02;
  const yRange = yMax - yMin || 1;
  const xStep = plotW / (n - 1);

  function toX(i: number) { return padLeft + i * xStep; }
  function toY(val: number) { return padTop + plotH - ((val - yMin) / yRange) * plotH; }

  const portfolioPath = portfolio.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const benchmarkPath = benchmark.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');

  // Y grid
  const yGridCount = 4;
  const yGrids = Array.from({ length: yGridCount + 1 }, (_, i) => yMin + (yRange * i) / yGridCount);

  // X labels
  const xLabelStep = Math.max(1, Math.floor(n / 6));

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Y grid */}
      {yGrids.map((val, i) => (
        <React.Fragment key={`yg-${i}`}>
          <Line x1={padLeft} y1={toY(val)} x2={padLeft + plotW} y2={toY(val)} stroke={C.cardBorder} strokeWidth={0.5} strokeDasharray="3,3" />
          <SvgText x={padLeft - 4} y={toY(val) + 2.5} fontSize={5.5} fill={C.textSec} textAnchor="end">
            {val.toFixed(0)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Benchmark line */}
      <Path d={benchmarkPath} fill="none" stroke={C.textTer} strokeWidth={1.5} strokeDasharray="4,3" />
      {/* Portfolio line */}
      <Path d={portfolioPath} fill="none" stroke={C.cyan} strokeWidth={2} />

      {/* X axis labels */}
      {months.filter((_, i) => i % xLabelStep === 0).map((m, idx) => (
        <SvgText key={`xl-${idx}`} x={toX(idx * xLabelStep)} y={height - 4} fontSize={5.5} fill={C.textSec} textAnchor="middle">
          {m}
        </SvgText>
      ))}

      {/* Endpoint values */}
      <SvgText x={toX(n - 1) + 3} y={toY(portfolio[n - 1]) - 4} fontSize={6} fill={C.cyan} fontWeight={700}>
        {portfolio[n - 1].toFixed(0)}
      </SvgText>
      <SvgText x={toX(n - 1) + 3} y={toY(benchmark[n - 1]) + 8} fontSize={6} fill={C.textTer}>
        {benchmark[n - 1].toFixed(0)}
      </SvgText>
    </Svg>
  );
}

function formatMetricValue(value: number, unit: string): string {
  switch (unit) {
    case '%': return `${(value * 100).toFixed(1)}%`;
    case 'x': return `${value.toFixed(2)}x`;
    case 'ratio': return value.toFixed(2);
    default: return value.toFixed(2);
  }
}

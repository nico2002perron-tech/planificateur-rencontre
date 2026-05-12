import React from 'react';
import { Svg, Path, Line, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer';
import { SvgText } from './svg-text';
import { C } from '../styles';

interface ConeProjectionProps {
  /** Percentile paths — each array is a series of values over months */
  paths: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
  /** Month labels */
  months: string[];
  /** Initial value for reference */
  initialValue: number;
  width?: number;
  height?: number;
}

/**
 * Monte Carlo cone projection chart
 * Shows percentile bands: 10-90 (light), 25-75 (medium), and median (line)
 */
export function ConeProjection({
  paths,
  months,
  initialValue,
  width = 500,
  height = 180,
}: ConeProjectionProps) {
  const n = paths.p50.length;
  if (n < 2) return null;

  const padLeft = 50;
  const padRight = 55;
  const padTop = 15;
  const padBottom = 25;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Find global min/max across all percentiles
  const allVals = [...paths.p10, ...paths.p90, ...paths.p50];
  const yMin = Math.min(...allVals) * 0.95;
  const yMax = Math.max(...allVals) * 1.05;
  const yRange = yMax - yMin || 1;

  const xStep = plotW / (n - 1);

  function toX(i: number) { return padLeft + i * xStep; }
  function toY(val: number) { return padTop + plotH - ((val - yMin) / yRange) * plotH; }

  // Build area paths for bands
  function bandPath(upper: number[], lower: number[]): string {
    const len = Math.min(upper.length, lower.length);
    let d = '';
    // Forward along upper
    for (let i = 0; i < len; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(upper[i]).toFixed(1)} `;
    }
    // Backward along lower
    for (let i = len - 1; i >= 0; i--) {
      d += `L ${toX(i).toFixed(1)} ${toY(lower[i]).toFixed(1)} `;
    }
    d += 'Z';
    return d;
  }

  // Median line
  const medianPath = paths.p50
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(' ');

  // Y-axis grid
  const yGridCount = 4;
  const yGrids = Array.from({ length: yGridCount + 1 }, (_, i) => yMin + (yRange * i) / yGridCount);

  // X-axis labels (show ~6 labels)
  const xLabelStep = Math.max(1, Math.floor(n / 6));

  // Endpoint labels
  const endpoints = [
    { label: '90e', value: paths.p90[n - 1], color: '#10b981' },
    { label: '75e', value: paths.p75[n - 1], color: '#22c55e' },
    { label: '50e', value: paths.p50[n - 1], color: C.cyan },
    { label: '25e', value: paths.p25[n - 1], color: '#f59e0b' },
    { label: '10e', value: paths.p10[n - 1], color: '#ef4444' },
  ];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="outerBand" x1="0" y1="0" x2="0" y2={height}>
          <Stop offset="0%" stopColor={C.cyan} stopOpacity={0.06} />
          <Stop offset="100%" stopColor={C.cyan} stopOpacity={0.12} />
        </LinearGradient>
        <LinearGradient id="innerBand" x1="0" y1="0" x2="0" y2={height}>
          <Stop offset="0%" stopColor={C.cyan} stopOpacity={0.12} />
          <Stop offset="100%" stopColor={C.cyan} stopOpacity={0.22} />
        </LinearGradient>
      </Defs>

      {/* Y grid lines */}
      {yGrids.map((val, i) => (
        <React.Fragment key={`yg-${i}`}>
          <Line
            x1={padLeft} y1={toY(val)} x2={padLeft + plotW} y2={toY(val)}
            stroke={C.cardBorder} strokeWidth={0.5} strokeDasharray="3,3"
          />
          <SvgText x={padLeft - 4} y={toY(val) + 2.5} fontSize={6} fill={C.textSec} textAnchor="end">
            {formatValue(val)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Outer band: 10th-90th percentile */}
      <Path d={bandPath(paths.p90, paths.p10)} fill="url(#outerBand)" />

      {/* Inner band: 25th-75th percentile */}
      <Path d={bandPath(paths.p75, paths.p25)} fill="url(#innerBand)" />

      {/* Median line */}
      <Path d={medianPath} fill="none" stroke={C.cyan} strokeWidth={2} />

      {/* Initial value reference line */}
      <Line
        x1={padLeft} y1={toY(initialValue)} x2={padLeft + plotW} y2={toY(initialValue)}
        stroke={C.textTer} strokeWidth={0.7} strokeDasharray="4,4"
      />

      {/* X-axis labels */}
      {months.filter((_, i) => i % xLabelStep === 0 || i === n - 1).map((m, idx) => {
        const originalIdx = idx * xLabelStep;
        return (
          <SvgText
            key={`xl-${idx}`}
            x={toX(Math.min(originalIdx, n - 1))}
            y={height - 5}
            fontSize={5.5}
            fill={C.textSec}
            textAnchor="middle"
          >
            {m}
          </SvgText>
        );
      })}

      {/* Endpoint value labels (right side) */}
      {endpoints.map((ep, i) => (
        <React.Fragment key={`ep-${i}`}>
          <SvgText
            x={padLeft + plotW + 4}
            y={toY(ep.value) + 2}
            fontSize={6}
            fill={ep.color}
            fontWeight={ep.label === '50e' ? 700 : 400}
          >
            {formatValue(ep.value)}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

function formatValue(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return `${value.toFixed(0)}`;
}

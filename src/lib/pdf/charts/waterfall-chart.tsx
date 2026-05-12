import React from 'react';
import { Svg, Rect, Line } from '@react-pdf/renderer';
import { SvgText } from './svg-text';
import { C } from '../styles';

export interface WaterfallItem {
  label: string;
  value: number;    // contribution in % or $ terms
  isTotal?: boolean; // final bar (renders differently)
}

interface WaterfallChartProps {
  items: WaterfallItem[];
  width?: number;
  height?: number;
  format?: 'percent' | 'dollar';
}

/**
 * Waterfall chart — shows contribution of each holding to portfolio return
 * Positive bars go up (green), negative bars go down (red)
 */
export function WaterfallChart({
  items,
  width = 500,
  height = 160,
  format = 'percent',
}: WaterfallChartProps) {
  if (items.length === 0) return null;

  const padLeft = 10;
  const padRight = 10;
  const padTop = 15;
  const padBottom = 35;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Calculate cumulative positions
  let cumulative = 0;
  const bars: Array<{
    label: string;
    x: number;
    y: number;
    barHeight: number;
    value: number;
    isPositive: boolean;
    isTotal: boolean;
  }> = [];

  const barWidth = Math.min(50, plotW / items.length - 4);
  const gap = (plotW - barWidth * items.length) / (items.length + 1);

  // Find range for scaling
  let runMin = 0, runMax = 0;
  let runVal = 0;
  for (const item of items) {
    if (item.isTotal) {
      runMin = Math.min(runMin, item.value);
      runMax = Math.max(runMax, item.value);
    } else {
      const before = runVal;
      runVal += item.value;
      runMin = Math.min(runMin, before, runVal);
      runMax = Math.max(runMax, before, runVal);
    }
  }
  // Add some padding
  const yRange = (runMax - runMin) || 1;
  const yMin = runMin - yRange * 0.1;
  const yMax = runMax + yRange * 0.15;
  const totalRange = yMax - yMin;

  function toY(val: number) { return padTop + plotH * (1 - (val - yMin) / totalRange); }

  cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const x = padLeft + gap + i * (barWidth + gap);

    if (item.isTotal) {
      const barH = Math.abs(toY(0) - toY(item.value));
      bars.push({
        label: item.label,
        x,
        y: item.value >= 0 ? toY(item.value) : toY(0),
        barHeight: barH,
        value: item.value,
        isPositive: item.value >= 0,
        isTotal: true,
      });
    } else {
      const start = cumulative;
      cumulative += item.value;
      const topVal = Math.max(start, cumulative);
      const bottomVal = Math.min(start, cumulative);
      const barH = Math.abs(toY(bottomVal) - toY(topVal));

      bars.push({
        label: item.label,
        x,
        y: toY(topVal),
        barHeight: Math.max(1, barH),
        value: item.value,
        isPositive: item.value >= 0,
        isTotal: false,
      });
    }
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Zero line */}
      <Line
        x1={padLeft} y1={toY(0)} x2={width - padRight} y2={toY(0)}
        stroke={C.textTer} strokeWidth={0.8}
      />

      {/* Bars */}
      {bars.map((bar, i) => (
        <React.Fragment key={`bar-${i}`}>
          {/* Connector line (from previous bar end to this bar start) */}
          {i > 0 && !bar.isTotal && !items[i - 1].isTotal && (
            <Line
              x1={bars[i - 1].x + barWidth}
              y1={bar.isPositive ? bar.y + bar.barHeight : bar.y}
              x2={bar.x}
              y2={bar.isPositive ? bar.y + bar.barHeight : bar.y}
              stroke={C.textTer}
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
          )}

          {/* Bar */}
          <Rect
            x={bar.x}
            y={bar.y}
            width={barWidth}
            height={bar.barHeight}
            fill={bar.isTotal ? C.navy : bar.isPositive ? C.up : C.down}
            rx={3}
            opacity={bar.isTotal ? 1 : 0.85}
          />

          {/* Value label on top */}
          <SvgText
            x={bar.x + barWidth / 2}
            y={bar.y - 3}
            fontSize={6}
            fill={bar.isPositive ? C.up : C.down}
            textAnchor="middle"
            fontWeight={600}
          >
            {formatWaterfall(bar.value, format)}
          </SvgText>

          {/* Name label on bottom */}
          <SvgText
            x={bar.x + barWidth / 2}
            y={padTop + plotH + 12}
            fontSize={5}
            fill={C.textSec}
            textAnchor="middle"
            transform={`rotate(-35, ${bar.x + barWidth / 2}, ${padTop + plotH + 12})`}
          >
            {bar.label.length > 8 ? bar.label.substring(0, 7) + '.' : bar.label}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

function formatWaterfall(value: number, format: 'percent' | 'dollar'): string {
  const sign = value >= 0 ? '+' : '';
  if (format === 'percent') {
    return `${sign}${(value * 100).toFixed(1)}%`;
  }
  if (Math.abs(value) >= 1e6) return `${sign}${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${sign}${(value / 1e3).toFixed(0)}K`;
  return `${sign}${value.toFixed(0)}`;
}

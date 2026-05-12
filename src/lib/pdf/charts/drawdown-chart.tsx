import React from 'react';
import { Svg, Path, Rect, Line, Defs, LinearGradient, Stop } from '@react-pdf/renderer';
import { SvgText } from './svg-text';
import { C } from '../styles';

interface DrawdownChartProps {
  /** Monthly portfolio values */
  values: number[];
  /** Month labels (e.g. "2024-01") */
  dates: string[];
  width?: number;
  height?: number;
}

/**
 * Drawdown chart — shows underwater curve (% below peak over time)
 * The deeper the red, the worse the drawdown.
 */
export function DrawdownChart({ values, dates, width = 500, height = 130 }: DrawdownChartProps) {
  if (values.length < 2) return null;

  // Calculate drawdown series
  const drawdowns: number[] = [];
  let peak = values[0];
  for (const v of values) {
    if (v > peak) peak = v;
    drawdowns.push(peak > 0 ? (v - peak) / peak : 0);
  }

  const minDd = Math.min(...drawdowns, -0.01); // Ensure at least -1%
  const maxDd = 0;

  const padLeft = 35;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 25;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xStep = plotW / (drawdowns.length - 1);

  // Map drawdown values to y coordinates
  const points = drawdowns.map((dd, i) => ({
    x: padLeft + i * xStep,
    y: padTop + plotH * (1 - (dd - minDd) / (maxDd - minDd)),
  }));

  // Line path
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Area path (fill below the line down to y=0 baseline which is the top of chart)
  const baselineY = padTop; // 0% drawdown line
  const areaPath = linePath +
    ` L ${points[points.length - 1].x.toFixed(1)} ${baselineY}` +
    ` L ${points[0].x.toFixed(1)} ${baselineY} Z`;

  // Y-axis grid lines
  const yGridCount = 4;
  const yGridLines = Array.from({ length: yGridCount + 1 }, (_, i) => {
    const dd = minDd + (maxDd - minDd) * (i / yGridCount);
    const y = padTop + plotH * (1 - (dd - minDd) / (maxDd - minDd));
    return { y, label: `${(dd * 100).toFixed(0)}%` };
  });

  // X-axis labels (show ~5 dates)
  const xLabelStep = Math.max(1, Math.floor(dates.length / 5));
  const xLabels = dates.filter((_, i) => i % xLabelStep === 0 || i === dates.length - 1).map((d, idx) => {
    const originalIdx = idx * xLabelStep;
    return {
      x: padLeft + Math.min(originalIdx, drawdowns.length - 1) * xStep,
      label: d.substring(0, 7), // YYYY-MM
    };
  });

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="ddGrad" x1="0" y1="0" x2="0" y2={height}>
          <Stop offset="0%" stopColor="#ef4444" stopOpacity={0.0} />
          <Stop offset="100%" stopColor="#ef4444" stopOpacity={0.25} />
        </LinearGradient>
      </Defs>

      {/* Y-axis grid lines */}
      {yGridLines.map((g, i) => (
        <React.Fragment key={`yg-${i}`}>
          <Line
            x1={padLeft}
            y1={g.y}
            x2={width - padRight}
            y2={g.y}
            stroke={C.cardBorder}
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
          <SvgText x={padLeft - 4} y={g.y + 2.5} fontSize={6} fill={C.textSec} textAnchor="end">
            {g.label}
          </SvgText>
        </React.Fragment>
      ))}

      {/* 0% baseline — solid */}
      <Line
        x1={padLeft}
        y1={baselineY}
        x2={width - padRight}
        y2={baselineY}
        stroke={C.textTer}
        strokeWidth={0.8}
      />

      {/* Filled area */}
      <Path d={areaPath} fill="url(#ddGrad)" />

      {/* Line */}
      <Path d={linePath} fill="none" stroke="#ef4444" strokeWidth={1.5} />

      {/* X-axis labels */}
      {xLabels.map((xl, i) => (
        <SvgText key={`xl-${i}`} x={xl.x} y={height - 5} fontSize={5.5} fill={C.textSec} textAnchor="middle">
          {xl.label}
        </SvgText>
      ))}
    </Svg>
  );
}

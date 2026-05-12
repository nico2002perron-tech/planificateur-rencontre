import React from 'react';
import { Svg, Circle, Line, Rect } from '@react-pdf/renderer';
import { SvgText } from './svg-text';
import { C } from '../styles';

export interface ScatterPoint {
  label: string;
  x: number;      // e.g. volatility (risk)
  y: number;      // e.g. return
  size?: number;   // bubble size (e.g. weight)
  color?: string;
}

interface ScatterPlotProps {
  points: ScatterPoint[];
  xLabel?: string;
  yLabel?: string;
  width?: number;
  height?: number;
}

/**
 * Risk/Return scatter plot — each holding is a bubble
 * X = volatility, Y = return, size = portfolio weight
 */
export function ScatterPlot({
  points,
  xLabel = 'Volatilite',
  yLabel = 'Rendement',
  width = 300,
  height = 200,
}: ScatterPlotProps) {
  if (points.length === 0) return null;

  const padLeft = 40;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Determine ranges with some padding
  const xVals = points.map(p => p.x);
  const yVals = points.map(p => p.y);
  const xMin = Math.min(...xVals) * 0.9;
  const xMax = Math.max(...xVals) * 1.1;
  const yMin = Math.min(...yVals, 0) * 1.1;
  const yMax = Math.max(...yVals) * 1.1;

  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  function toX(val: number) { return padLeft + ((val - xMin) / xRange) * plotW; }
  function toY(val: number) { return padTop + plotH - ((val - yMin) / yRange) * plotH; }

  // Grid lines
  const xGridCount = 4;
  const yGridCount = 4;
  const xGrids = Array.from({ length: xGridCount + 1 }, (_, i) => xMin + (xRange * i) / xGridCount);
  const yGrids = Array.from({ length: yGridCount + 1 }, (_, i) => yMin + (yRange * i) / yGridCount);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Background */}
      <Rect x={padLeft} y={padTop} width={plotW} height={plotH} fill="#fafbfc" rx={4} />

      {/* Y grid lines */}
      {yGrids.map((val, i) => (
        <React.Fragment key={`yg-${i}`}>
          <Line
            x1={padLeft} y1={toY(val)} x2={padLeft + plotW} y2={toY(val)}
            stroke={C.cardBorder} strokeWidth={0.5}
          />
          <SvgText x={padLeft - 4} y={toY(val) + 2.5} fontSize={5.5} fill={C.textSec} textAnchor="end">
            {`${(val * 100).toFixed(0)}%`}
          </SvgText>
        </React.Fragment>
      ))}

      {/* X grid lines */}
      {xGrids.map((val, i) => (
        <React.Fragment key={`xg-${i}`}>
          <Line
            x1={toX(val)} y1={padTop} x2={toX(val)} y2={padTop + plotH}
            stroke={C.cardBorder} strokeWidth={0.5}
          />
          <SvgText x={toX(val)} y={padTop + plotH + 12} fontSize={5.5} fill={C.textSec} textAnchor="middle">
            {`${(val * 100).toFixed(0)}%`}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Zero line for Y if applicable */}
      {yMin < 0 && yMax > 0 && (
        <Line
          x1={padLeft} y1={toY(0)} x2={padLeft + plotW} y2={toY(0)}
          stroke={C.textTer} strokeWidth={0.8}
        />
      )}

      {/* Data points (bubbles) */}
      {points.map((p, i) => {
        const bubbleR = Math.max(4, Math.min(14, (p.size || 5) * 1.5));
        const px = toX(p.x);
        const py = toY(p.y);
        return (
          <React.Fragment key={`pt-${i}`}>
            <Circle
              cx={px}
              cy={py}
              r={bubbleR}
              fill={p.color || C.cyan}
              opacity={0.6}
            />
            <Circle
              cx={px}
              cy={py}
              r={bubbleR}
              fill="none"
              stroke={p.color || C.cyan}
              strokeWidth={1}
            />
            {/* Label — only for larger bubbles */}
            {bubbleR >= 5 && (
              <SvgText
                x={px}
                y={py - bubbleR - 3}
                fontSize={5}
                fill={C.text}
                textAnchor="middle"
              >
                {p.label.length > 6 ? p.label.substring(0, 5) + '.' : p.label}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}

      {/* Axis labels */}
      <SvgText x={padLeft + plotW / 2} y={height - 3} fontSize={7} fill={C.textSec} textAnchor="middle">
        {xLabel}
      </SvgText>
      <SvgText
        x={8} y={padTop + plotH / 2} fontSize={7} fill={C.textSec} textAnchor="middle"
        transform={`rotate(-90, 8, ${padTop + plotH / 2})`}
      >
        {yLabel}
      </SvgText>
    </Svg>
  );
}

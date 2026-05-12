import React from 'react';
import { Svg, Rect, Line, G } from '@react-pdf/renderer';
import { SvgText } from './svg-text';
import { C } from '../styles';

export interface StackedBarItem {
  label: string;         // e.g. "Jan", "Fev", "Mar"
  segments: Array<{
    value: number;
    color: string;
    name: string;        // e.g. "Dividendes", "Coupons"
  }>;
}

interface StackedBarChartProps {
  items: StackedBarItem[];
  width?: number;
  height?: number;
  showValues?: boolean;
}

/**
 * Stacked bar chart — used for monthly income breakdown (dividends + coupons)
 */
export function StackedBarChart({
  items,
  width = 500,
  height = 150,
  showValues = false,
}: StackedBarChartProps) {
  if (items.length === 0) return null;

  const padLeft = 40;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 25;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Calculate max total
  const maxTotal = Math.max(...items.map(item =>
    item.segments.reduce((sum, s) => sum + s.value, 0)
  ), 1);

  const barWidth = Math.min(35, plotW / items.length - 4);
  const barGap = (plotW - barWidth * items.length) / (items.length + 1);

  // Y-axis grid
  const yGridCount = 4;
  const yGrids = Array.from({ length: yGridCount + 1 }, (_, i) =>
    (maxTotal * i) / yGridCount
  );

  function toY(val: number) { return padTop + plotH * (1 - val / maxTotal); }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Y grid lines */}
      {yGrids.map((val, i) => (
        <React.Fragment key={`yg-${i}`}>
          <Line
            x1={padLeft} y1={toY(val)} x2={width - padRight} y2={toY(val)}
            stroke={C.cardBorder} strokeWidth={0.5}
          />
          <SvgText x={padLeft - 4} y={toY(val) + 2.5} fontSize={6} fill={C.textSec} textAnchor="end">
            {formatIncome(val)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Bars */}
      {items.map((item, i) => {
        const x = padLeft + barGap + i * (barWidth + barGap);
        let yOffset = 0;

        return (
          <G key={`bar-${i}`}>
            {item.segments.map((seg, j) => {
              const barH = (seg.value / maxTotal) * plotH;
              const y = toY(yOffset + seg.value);
              yOffset += seg.value;

              return (
                <Rect
                  key={`seg-${i}-${j}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(0.5, barH)}
                  fill={seg.color}
                  rx={j === item.segments.length - 1 ? 3 : 0}
                />
              );
            })}

            {/* Total value on top */}
            {showValues && (
              <SvgText
                x={x + barWidth / 2}
                y={toY(yOffset) - 3}
                fontSize={5.5}
                fill={C.text}
                textAnchor="middle"
                fontWeight={600}
              >
                {formatIncome(yOffset)}
              </SvgText>
            )}

            {/* Label */}
            <SvgText
              x={x + barWidth / 2}
              y={padTop + plotH + 12}
              fontSize={6}
              fill={C.textSec}
              textAnchor="middle"
            >
              {item.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function formatIncome(val: number): string {
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M$`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K$`;
  return `${val.toFixed(0)}$`;
}

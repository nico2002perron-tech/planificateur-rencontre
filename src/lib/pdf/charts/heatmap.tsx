import React from 'react';
import { Svg, Rect, G } from '@react-pdf/renderer';
import { SvgText } from './svg-text';
import { C } from '../styles';

interface HeatmapProps {
  labels: string[];
  matrix: number[][]; // NxN correlation matrix (-1 to 1)
  size?: number;
}

/**
 * Correlation Heatmap — shows pairwise correlations between holdings
 * Red = high positive, Blue = low/negative, White = zero
 */
export function CorrelationHeatmap({ labels, matrix, size = 280 }: HeatmapProps) {
  const n = labels.length;
  if (n === 0) return null;

  // Limit to max 12 holdings for readability
  const maxN = Math.min(n, 12);
  const displayLabels = labels.slice(0, maxN);
  const displayMatrix = matrix.slice(0, maxN).map(row => row.slice(0, maxN));

  const labelWidth = 40;
  const gridSize = size - labelWidth;
  const cellSize = gridSize / maxN;
  const totalWidth = size;
  const totalHeight = size;

  return (
    <Svg width={totalWidth} height={totalHeight} viewBox={`0 0 ${totalWidth} ${totalHeight}`}>
      {/* Column labels (top) */}
      {displayLabels.map((label, i) => (
        <SvgText
          key={`col-${i}`}
          x={labelWidth + i * cellSize + cellSize / 2}
          y={labelWidth - 4}
          fontSize={5.5}
          fill={C.textSec}
          textAnchor="middle"
          transform={`rotate(-45, ${labelWidth + i * cellSize + cellSize / 2}, ${labelWidth - 4})`}
        >
          {truncLabel(label)}
        </SvgText>
      ))}

      {/* Row labels (left) */}
      {displayLabels.map((label, i) => (
        <SvgText
          key={`row-${i}`}
          x={labelWidth - 3}
          y={labelWidth + i * cellSize + cellSize / 2 + 2}
          fontSize={5.5}
          fill={C.textSec}
          textAnchor="end"
        >
          {truncLabel(label)}
        </SvgText>
      ))}

      {/* Cells */}
      {displayMatrix.map((row, i) =>
        row.map((value, j) => {
          const color = correlationToColor(value);
          return (
            <G key={`cell-${i}-${j}`}>
              <Rect
                x={labelWidth + j * cellSize}
                y={labelWidth + i * cellSize}
                width={cellSize - 1}
                height={cellSize - 1}
                fill={color}
                rx={2}
              />
              {cellSize >= 18 && (
                <SvgText
                  x={labelWidth + j * cellSize + cellSize / 2 - 0.5}
                  y={labelWidth + i * cellSize + cellSize / 2 + 2}
                  fontSize={5}
                  fill={Math.abs(value) > 0.5 ? C.white : C.text}
                  textAnchor="middle"
                >
                  {value.toFixed(2)}
                </SvgText>
              )}
            </G>
          );
        })
      )}
    </Svg>
  );
}

function truncLabel(label: string): string {
  return label.length > 6 ? label.substring(0, 5) + '.' : label;
}

/**
 * Map correlation value (-1 to 1) to a color
 * -1 = deep blue, 0 = white, 1 = deep red/coral
 */
function correlationToColor(value: number): string {
  const v = Math.max(-1, Math.min(1, value));

  if (v >= 0) {
    // 0 → white, 1 → deep coral
    const intensity = Math.round(v * 255);
    const r = 255;
    const g = 255 - Math.round(intensity * 0.65);
    const b = 255 - Math.round(intensity * 0.75);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // -1 → deep blue, 0 → white
    const intensity = Math.round(Math.abs(v) * 255);
    const r = 255 - Math.round(intensity * 0.75);
    const g = 255 - Math.round(intensity * 0.55);
    const b = 255;
    return `rgb(${r}, ${g}, ${b})`;
  }
}

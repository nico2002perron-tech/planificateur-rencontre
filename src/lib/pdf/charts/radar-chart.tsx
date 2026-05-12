import React from 'react';
import { Svg, Path, Circle, Line, G } from '@react-pdf/renderer';
import { SvgText } from './svg-text';
import { C } from '../styles';

export interface RadarDataPoint {
  label: string;
  value: number;   // 0-100
  color?: string;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  fillColor?: string;
  strokeColor?: string;
  showLabels?: boolean;
  showValues?: boolean;
}

export function RadarChart({
  data,
  size = 180,
  fillColor = 'rgba(0, 180, 216, 0.15)',
  strokeColor = C.cyan,
  showLabels = true,
  showValues = true,
}: RadarChartProps) {
  if (data.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 30;
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;

  // Grid levels (20, 40, 60, 80, 100)
  const levels = [20, 40, 60, 80, 100];

  // Calculate polygon points for the data
  const dataPoints = data.map((d, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (d.value / 100) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  const dataPath = dataPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ') + ' Z';

  // Grid polygons
  const gridPaths = levels.map(level => {
    const points = data.map((_, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const r = (level / 100) * maxR;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ') + ' Z';
  });

  // Label positions (slightly outside the chart)
  const labelPoints = data.map((d, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = maxR + 18;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      label: d.label,
      value: d.value,
    };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid levels */}
      {gridPaths.map((path, i) => (
        <Path
          key={`grid-${i}`}
          d={path}
          fill="none"
          stroke={C.cardBorder}
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines */}
      {data.map((_, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const endX = cx + maxR * Math.cos(angle);
        const endY = cy + maxR * Math.sin(angle);
        return (
          <Line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={endX}
            y2={endY}
            stroke={C.cardBorder}
            strokeWidth={0.5}
          />
        );
      })}

      {/* Data polygon fill */}
      <Path d={dataPath} fill={fillColor} stroke="none" />
      {/* Data polygon stroke */}
      <Path d={dataPath} fill="none" stroke={strokeColor} strokeWidth={1.5} />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <Circle
          key={`dot-${i}`}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={C.white}
          stroke={strokeColor}
          strokeWidth={1.5}
        />
      ))}

      {/* Labels */}
      {showLabels && labelPoints.map((p, i) => (
        <G key={`label-${i}`}>
          <SvgText
            x={p.x}
            y={p.y - (showValues ? 4 : 0)}
            fontSize={6.5}
            fill={C.text}
            textAnchor="middle"
          >
            {p.label}
          </SvgText>
          {showValues && (
            <SvgText
              x={p.x}
              y={p.y + 6}
              fontSize={7}
              fill={strokeColor}
              textAnchor="middle"
              fontWeight={600}
            >
              {`${Math.round(p.value)}`}
            </SvgText>
          )}
        </G>
      ))}
    </Svg>
  );
}

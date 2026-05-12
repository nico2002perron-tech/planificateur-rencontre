import React from 'react';
import { Svg, Path, Circle } from '@react-pdf/renderer';
import { SvgText } from './svg-text';
import { C } from '../styles';

interface GaugeChartProps {
  value: number;       // 0-100
  label?: string;
  grade?: string;      // e.g. "A+", "B"
  size?: number;
  color?: string;
}

/**
 * Semi-circular gauge chart for scores (0-100)
 * Used for Portfolio Intelligence Score on the cover page
 */
export function GaugeChart({ value, label, grade, size = 120, color }: GaugeChartProps) {
  const cx = size / 2;
  const cy = size / 2 + 5;
  const r = size / 2 - 12;
  const strokeWidth = 10;

  // Clamp value
  const v = Math.max(0, Math.min(100, value));

  // Auto color based on value if not provided
  const gaugeColor = color || getGaugeColor(v);

  // Arc from 180 to 0 degrees (left to right semicircle)
  const startAngle = Math.PI;
  const endAngle = 0;
  const valueAngle = startAngle - (v / 100) * Math.PI;

  // Background arc (full semicircle)
  const bgArc = describeArc(cx, cy, r, endAngle, startAngle);
  // Value arc
  const valueArc = describeArc(cx, cy, r, valueAngle, startAngle);

  // Tick marks at 0, 25, 50, 75, 100
  const ticks = [0, 25, 50, 75, 100].map(tick => {
    const angle = startAngle - (tick / 100) * Math.PI;
    const innerR = r - strokeWidth / 2 - 2;
    const outerR = r + strokeWidth / 2 + 2;
    return {
      x1: cx + innerR * Math.cos(angle),
      y1: cy - innerR * Math.sin(angle),
      x2: cx + outerR * Math.cos(angle),
      y2: cy - outerR * Math.sin(angle),
      label: `${tick}`,
      labelX: cx + (outerR + 8) * Math.cos(angle),
      labelY: cy - (outerR + 8) * Math.sin(angle),
    };
  });

  return (
    <Svg width={size} height={size / 2 + 25} viewBox={`0 0 ${size} ${size / 2 + 25}`}>
      {/* Background arc */}
      <Path
        d={bgArc}
        fill="none"
        stroke={C.panel}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Value arc */}
      {v > 0 && (
        <Path
          d={valueArc}
          fill="none"
          stroke={gaugeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}

      {/* Center value */}
      <SvgText
        x={cx}
        y={cy - 6}
        fontSize={grade ? 20 : 26}
        fill={C.navy}
        textAnchor="middle"
        fontWeight={800}
        fontFamily="Montserrat"
      >
        {grade || `${Math.round(v)}`}
      </SvgText>

      {/* Sub-label */}
      {label && (
        <SvgText
          x={cx}
          y={cy + 10}
          fontSize={7}
          fill={C.textSec}
          textAnchor="middle"
        >
          {label}
        </SvgText>
      )}

      {/* Endpoint dot */}
      {v > 0 && v < 100 && (
        <Circle
          cx={cx + r * Math.cos(valueAngle)}
          cy={cy - r * Math.sin(valueAngle)}
          r={strokeWidth / 2 + 1}
          fill={gaugeColor}
          stroke={C.white}
          strokeWidth={2}
        />
      )}
    </Svg>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const sweep = endAngle > startAngle ? 0 : 1;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

function getGaugeColor(value: number): string {
  if (value >= 80) return '#22c55e';
  if (value >= 60) return C.cyan;
  if (value >= 40) return C.gold;
  return '#ef4444';
}

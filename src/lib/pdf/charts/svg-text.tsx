/**
 * Typed SVG Text component for @react-pdf/renderer.
 * The library's Text component works with SVG attributes at runtime
 * but TypeScript types don't properly expose them.
 */
import React from 'react';
import { Text } from '@react-pdf/renderer';

interface SvgTextProps {
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  fontSize?: number;
  fill?: string;
  textAnchor?: 'start' | 'middle' | 'end';
  fontWeight?: number | string;
  fontFamily?: string;
  transform?: string;
  opacity?: number;
  children?: React.ReactNode;
}

export const SvgText = Text as unknown as React.FC<SvgTextProps & { key?: string | number }>;

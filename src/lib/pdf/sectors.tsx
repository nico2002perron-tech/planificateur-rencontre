import React from 'react';
import {
  Svg, Rect, Path, Line, Circle, Polygon, Polyline,
} from '@react-pdf/renderer';
import type { PriceTargetHolding } from './price-targets-template';

// ─────────────────────────────────────────────────────────────────────────────
// Système d'icônes/couleurs de secteurs et classes d'actifs — SOURCE UNIQUE,
// partagée entre la couverture (price-targets-template) et la page « Répartition »
// du 1.2 (year-activity-pages). Toute icône/couleur de secteur vit ici.
// ─────────────────────────────────────────────────────────────────────────────

// Highly-distinct categorical palette (max hue separation) so no two sectors
// look alike in the donut. Common sectors get the most separated colours.
export const SECTOR_META: Record<string, { label: string; color: string }> = {
  TECHNOLOGY:       { label: 'Technologie',                  color: '#4363d8' }, // royal blue
  HEALTHCARE:       { label: 'Santé',                        color: '#e6194b' }, // red
  FINANCIALS:       { label: 'Finance',                      color: '#3cb44b' }, // green
  ENERGY:           { label: 'Énergie',                      color: '#f58231' }, // orange
  CONSUMER_DISC:    { label: 'Consommation discrétionnaire', color: '#911eb4' }, // purple
  UTILITIES:        { label: 'Services publics',             color: '#42d4f4' }, // cyan
  REAL_ESTATE:      { label: 'Immobilier',                   color: '#f032e6' }, // magenta
  CONSUMER_STAPLES: { label: 'Consommation de base',         color: '#469990' }, // teal
  MATERIALS:        { label: 'Matériaux',                    color: '#9a6324' }, // brown
  INDUSTRIALS:      { label: 'Industrie',                    color: '#808000' }, // olive
  TELECOM:          { label: 'Télécommunications',           color: '#000075' }, // navy
  MILITARY:         { label: 'Défense',                      color: '#800000' }, // maroon
  ETF:              { label: 'FNB diversifiés',              color: '#d4af37' }, // gold
  OTHER:            { label: 'Autres',                       color: '#a9a9a9' }, // grey
};

export interface SectorSlice { code: string; label: string; color: string; value: number; pct: number; }

// One simple, recognizable line/fill icon per sector (24×24 viewBox, primitives only).
export function SectorIcon({ code, size = 11, color }: { code: string; size?: number; color: string }) {
  const st = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const fl = { fill: color };
  let body: React.ReactNode;
  switch (code) {
    case 'TECHNOLOGY': // microchip
      body = (<>
        <Rect x={6} y={6} width={12} height={12} rx={1.5} {...st} />
        <Rect x={9.5} y={9.5} width={5} height={5} rx={0.5} {...st} />
        <Line x1={9} y1={6} x2={9} y2={3} {...st} /><Line x1={15} y1={6} x2={15} y2={3} {...st} />
        <Line x1={9} y1={18} x2={9} y2={21} {...st} /><Line x1={15} y1={18} x2={15} y2={21} {...st} />
        <Line x1={6} y1={9} x2={3} y2={9} {...st} /><Line x1={6} y1={15} x2={3} y2={15} {...st} />
        <Line x1={18} y1={9} x2={21} y2={9} {...st} /><Line x1={18} y1={15} x2={21} y2={15} {...st} />
      </>); break;
    case 'FINANCIALS': // bank
      body = (<>
        <Polygon points="12,3 21,8 3,8" {...fl} />
        <Line x1={5} y1={9} x2={5} y2={18} {...st} /><Line x1={9.7} y1={9} x2={9.7} y2={18} {...st} />
        <Line x1={14.3} y1={9} x2={14.3} y2={18} {...st} /><Line x1={19} y1={9} x2={19} y2={18} {...st} />
        <Line x1={3} y1={21} x2={21} y2={21} {...st} />
      </>); break;
    case 'HEALTHCARE': // medical cross
      body = (<>
        <Line x1={12} y1={5} x2={12} y2={19} {...st} strokeWidth={3} />
        <Line x1={5} y1={12} x2={19} y2={12} {...st} strokeWidth={3} />
      </>); break;
    case 'ENERGY': // lightning bolt
      body = (<Polygon points="13,2 4,14 11,14 10,22 20,9 13,9" {...fl} />); break;
    case 'MATERIALS': // cube
      body = (<>
        <Polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" {...st} />
        <Line x1={4} y1={7.5} x2={12} y2={12} {...st} /><Line x1={20} y1={7.5} x2={12} y2={12} {...st} /><Line x1={12} y1={12} x2={12} y2={21} {...st} />
      </>); break;
    case 'INDUSTRIALS': // factory
      body = (<Polygon points="3,21 3,13 8,16 8,13 13,16 13,10 21,10 21,21" {...fl} />); break;
    case 'CONSUMER_DISC': // shopping cart
      body = (<>
        <Circle cx={9} cy={20} r={1.6} {...fl} /><Circle cx={17} cy={20} r={1.6} {...fl} />
        <Polyline points="2,4 5,4 7,15 18,15 20,7 6,7" {...st} />
      </>); break;
    case 'CONSUMER_STAPLES': // basket
      body = (<>
        <Polygon points="5,8 19,8 17,20 7,20" {...st} />
        <Line x1={9} y1={8} x2={10.5} y2={3} {...st} /><Line x1={15} y1={8} x2={13.5} y2={3} {...st} />
      </>); break;
    case 'UTILITIES': // light bulb
      body = (<>
        <Circle cx={12} cy={10} r={6} {...st} />
        <Line x1={9} y1={19} x2={15} y2={19} {...st} /><Line x1={10} y1={22} x2={14} y2={22} {...st} />
      </>); break;
    case 'REAL_ESTATE': // house
      body = (<>
        <Polyline points="3,11 12,3 21,11" {...st} />
        <Path d="M5 10 V20 H19 V10" {...st} />
        <Rect x={10} y={14} width={4} height={6} {...st} />
      </>); break;
    case 'TELECOM': // signal bars
      body = (<>
        <Rect x={3} y={15} width={3} height={5} rx={0.5} {...fl} />
        <Rect x={8} y={11} width={3} height={9} rx={0.5} {...fl} />
        <Rect x={13} y={7} width={3} height={13} rx={0.5} {...fl} />
        <Rect x={18} y={3} width={3} height={17} rx={0.5} {...fl} />
      </>); break;
    case 'MILITARY': // shield
      body = (<Polygon points="12,3 20,6 20,12 12,21 4,12 4,6" {...fl} />); break;
    case 'ETF': // diversified grid
      body = (<>
        <Rect x={4} y={4} width={7} height={7} rx={1} {...fl} /><Rect x={13} y={4} width={7} height={7} rx={1} {...fl} />
        <Rect x={4} y={13} width={7} height={7} rx={1} {...fl} /><Rect x={13} y={13} width={7} height={7} rx={1} {...fl} />
      </>); break;
    case 'FIXED_INCOME': // bond certificate
      body = (<>
        <Rect x={4} y={5} width={16} height={14} rx={1.5} {...st} />
        <Line x1={7} y1={9} x2={17} y2={9} {...st} /><Line x1={7} y1={12} x2={17} y2={12} {...st} /><Line x1={7} y1={15} x2={13} y2={15} {...st} />
      </>); break;
    case 'CASH': // banknote
      body = (<>
        <Rect x={3} y={7} width={18} height={10} rx={2} {...st} />
        <Circle cx={12} cy={12} r={2.4} {...st} />
      </>); break;
    case 'FUND': // stacked layers
      body = (<>
        <Polygon points="12,3 21,8 12,13 3,8" {...st} />
        <Polyline points="3,12 12,17 21,12" {...st} />
        <Polyline points="3,16 12,21 21,16" {...st} />
      </>); break;
    case 'PREFERRED': // sparkle
      body = (<Polygon points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10" {...fl} />); break;
    default: // OTHER — dot
      body = (<Circle cx={12} cy={12} r={5} {...fl} />); break;
  }
  return (<Svg width={size} height={size} viewBox="0 0 24 24">{body}</Svg>);
}

// Aggregate equity + ETF market value by sector → slices (desc, tail grouped into "Autres").
export function buildEquitySectorSlices(holdings: PriceTargetHolding[]): SectorSlice[] {
  const buckets = new Map<string, number>();
  for (const h of holdings) {
    if (h.assetType !== 'EQUITY' && h.assetType !== 'ETF') continue;
    const mv = Math.abs(h.marketValue);
    if (mv <= 0) continue;
    const code = (h.sector && SECTOR_META[h.sector]) ? h.sector : (h.assetType === 'ETF' ? 'ETF' : 'OTHER');
    buckets.set(code, (buckets.get(code) || 0) + mv);
  }
  const total = Array.from(buckets.values()).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  let slices: SectorSlice[] = Array.from(buckets.entries())
    .map(([code, value]) => ({
      code, value, pct: (value / total) * 100,
      label: SECTOR_META[code]?.label || code,
      color: SECTOR_META[code]?.color || SECTOR_META.OTHER.color,
    }))
    .sort((a, b) => b.value - a.value);
  if (slices.length > 8) {
    const head = slices.slice(0, 7);
    const tailVal = slices.slice(7).reduce((s, x) => s + x.value, 0);
    // Merge the tail into an existing "Autres" slice if one already ranks in the
    // head (unknown-sector holdings), otherwise create one. Without this guard a
    // pre-existing OTHER bucket + a tail OTHER produce TWO "Autres" slices.
    const existingOther = head.find(s => s.code === 'OTHER');
    if (existingOther) {
      existingOther.value += tailVal;
      existingOther.pct = (existingOther.value / total) * 100;
    } else {
      head.push({ code: 'OTHER', value: tailVal, pct: (tailVal / total) * 100, label: 'Autres', color: SECTOR_META.OTHER.color });
    }
    slices = head;
  }
  return slices;
}

// Asset-class buckets (computed from existing data — no API needed).
export const ASSET_CLASS_META: Record<string, { label: string; color: string }> = {
  EQUITY:       { label: 'Actions',      color: '#2563eb' },
  ETF:          { label: 'FNB',          color: '#8b5cf6' },
  FIXED_INCOME: { label: 'Revenu fixe',  color: '#c5a365' },
  PREFERRED:    { label: 'Privilégiées', color: '#ec4899' },
  FUND:         { label: 'Fonds',        color: '#14b8a6' },
  CASH:         { label: 'Liquidités',   color: '#64748b' },
  OTHER:        { label: 'Autre',        color: '#94a3b8' },
};

export function buildAssetClassSlices(holdings: PriceTargetHolding[]): SectorSlice[] {
  const buckets = new Map<string, number>();
  for (const h of holdings) {
    const mv = Math.abs(h.marketValue);
    if (mv <= 0) continue;
    const code = ASSET_CLASS_META[h.assetType] ? h.assetType : 'OTHER';
    buckets.set(code, (buckets.get(code) || 0) + mv);
  }
  const total = Array.from(buckets.values()).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return Array.from(buckets.entries())
    .map(([code, value]) => ({
      code, value, pct: (value / total) * 100,
      label: ASSET_CLASS_META[code]?.label || code,
      color: ASSET_CLASS_META[code]?.color || ASSET_CLASS_META.OTHER.color,
    }))
    .sort((a, b) => b.value - a.value);
}

// Donut ring (no center text) built from sector slices.
export function SectorDonut({ slices, size = 92 }: { slices: SectorSlice[]; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 2, innerR = r * 0.6;
  const visible = slices.filter(s => s.pct > 0);
  if (visible.length === 0) return null;
  let cum = 0;
  const arcs = visible.map(s => {
    const a0 = cum * 3.6 * (Math.PI / 180); cum += s.pct; const a1 = cum * 3.6 * (Math.PI / 180);
    const x1 = cx + r * Math.sin(a0), y1 = cy - r * Math.cos(a0);
    const x2 = cx + r * Math.sin(a1), y2 = cy - r * Math.cos(a1);
    const ix1 = cx + innerR * Math.sin(a0), iy1 = cy - innerR * Math.cos(a0);
    const ix2 = cx + innerR * Math.sin(a1), iy2 = cy - innerR * Math.cos(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return { d: `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large} 0 ${ix1},${iy1} Z`, color: s.color };
  });
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((a, i) => <Path key={i} d={a.d} fill={a.color} />)}
    </Svg>
  );
}

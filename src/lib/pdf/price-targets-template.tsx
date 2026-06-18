import React from 'react';
import path from 'path';
import fs from 'fs';
import {
  Document, Page, Text, View, Image, Font,
  Svg, Defs, LinearGradient, Stop, Rect,
  Path, Line, Circle, Polygon, Polyline,
} from '@react-pdf/renderer';
import { styles, C } from './styles';
import type { MeetingEvolution } from '@/lib/journal/compare-meetings';

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');

// Load images as base64 data URIs to avoid path issues with spaces/OneDrive
function loadImageAsDataUri(filename: string): string {
  const filePath = path.join(process.cwd(), 'public', filename);
  const buffer = fs.readFileSync(filePath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}
const LOGO_SRC = loadImageAsDataUri('logo.png');
const ICON_G_SRC = loadImageAsDataUri('icon-g.png');

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: path.join(FONTS_DIR, 'Montserrat-Bold.ttf'), fontWeight: 700 },
    { src: path.join(FONTS_DIR, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 },
  ],
});

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: path.join(FONTS_DIR, 'OpenSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONTS_DIR, 'OpenSans-SemiBold.ttf'), fontWeight: 600 },
  ],
});

// Pas de césure : react-pdf coupe sinon les mots au milieu avec un trait
// d'union (« Compt-tant ») dans les colonnes étroites. Les textes continuent
// de se replier aux espaces.
Font.registerHyphenationCallback(word => [word]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceTargetHolding {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  bookValue: number;
  assetType: string;
  accountType: string;
  accountLabel: string;
  annualIncome: number;
  /** Forward annual dividend for equity-like holdings (Yahoo forward rate × qty),
   *  falling back to Croesus trailing annualIncome when Yahoo is missing. */
  forwardDividend?: number;
  currentPrice?: number;
  targetPrice?: number;
  gainPct?: number;
  targetSource?: string;
  couponRate?: number;
  maturityDate?: string;
  modifiedDuration?: number;
  accruedInterest?: number;
  /** GICS-style sector code (TECHNOLOGY, FINANCIALS, …) for equity/ETF holdings.
   *  Enriched server-side at PDF generation; absent for bonds/cash. */
  sector?: string;
  /** Short French business description (equity/ETF), enriched server-side. */
  description?: string;
}

export interface PdfRenderOptions {
  includeCover?: boolean;
  includeEquities?: boolean;
  includeFixedIncome?: boolean;
  /** "Descriptions des titres" section (replaces the old cash/other table). */
  includeDescriptions?: boolean;
  /** Page orientation — defaults to 'portrait'. */
  orientation?: 'portrait' | 'landscape';
}

export interface PriceTargetReportData {
  holdings: PriceTargetHolding[];
  generatedAt: string;
  /** Client name displayed on the cover page. */
  clientName?: string;
  options?: PdfRenderOptions;
  /** Optional map of symbol → base64 PNG data URI for company logos. */
  logos?: Record<string, string>;
  /** USD/CAD exchange rate applied (if any). Displayed on the PDF. */
  usdCadRate?: number | null;
  /** Évolution depuis la dernière rencontre (récapitulatif). Absent = pas d'historique. */
  evolution?: MeetingEvolution;
  summary: {
    totalMarketValue: number;
    totalBookValue: number;
    totalAnnualIncome: number;
    totalCurrentValue: number;
    totalTargetValue: number;
    totalGain: number;
    totalGainPct: number;
    equityCount: number;
    fixedIncomeCount: number;
    cashCount: number;
    otherCount: number;
    pricesFound: number;
    targetsFound: number;
    equityGain?: number;
    equityGainPct?: number;
    equityDividends?: number;
    equityDividendYieldPct?: number;
    fixedIncomeAnnualIncome?: number;
    fixedIncomeMarketValue?: number;
    fixedIncomeGainPct?: number;
    totalEstimated?: number;
    totalEstimatedPct?: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function fmtFull(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(value);
}

// Espace insécable avant % pour ne jamais replier « +26.5 / % » sur deux lignes.
function fmtPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} %`;
}

// ─── Asset category colors (for row pastilles) ──────────────────────────────

function getAssetColor(assetType: string): string {
  switch (assetType) {
    case 'EQUITY':       return '#00b4d8'; // cyan — actions
    case 'ETF':          return '#8b5cf6'; // violet — FNB
    case 'FUND':         return '#14b8a6'; // teal — fonds communs
    case 'FIXED_INCOME': return '#c5a365'; // gold — revenus fixes
    case 'PREFERRED':    return '#ec4899'; // rose — actions privilégiées
    case 'CASH':         return '#64748b'; // slate — liquidités
    default:             return '#94a3b8'; // gris pâle — autre
  }
}

// Pale cyan row stripe + thicker segment divider every 5 rows.
function getRowStyle(i: number, rowCount: number) {
  const isEven = i % 2 === 1;
  const isSegmentBoundary = (i + 1) % 5 === 0 && i < rowCount - 1;
  return {
    bg: isEven ? '#f0f9ff' : '#ffffff', // pale cyan vs white
    borderBottomWidth: isSegmentBoundary ? 1.2 : 0.5,
    borderBottomColor: isSegmentBoundary ? '#bae6fd' : '#f1f5f9',
  };
}

// Pastille arrondie pour les pourcentages — fond pâle + texte foncé, façon
// badge SaaS. `tone` choisit la famille de couleur : gain (vert/rouge selon le
// signe) ou revenu (cyan, comme l'encadré « Dividendes » des projections).
function PctPill({ value, tone, align = 'flex-end', width }: {
  value: number;
  tone: 'gain' | 'income' | 'yield';
  align?: 'flex-end' | 'center';
  width?: string | number;
}) {
  const palette = tone === 'gain'
    ? value > 0
      ? { bg: '#ecfdf5', text: '#059669' }
      : value < 0
        ? { bg: '#fef2f2', text: '#dc2626' }
        : { bg: '#f1f5f9', text: '#94a3b8' }
    : value > 0
      ? tone === 'income'
        ? { bg: '#ecfeff', text: '#0891b2' }
        : { bg: '#ecfdf5', text: '#059669' }
      : { bg: '#f1f5f9', text: '#94a3b8' };
  // Espace insécable avant % : sans lui, react-pdf replie la pastille sur deux lignes.
  const label = tone === 'gain'
    ? `${value >= 0 ? '+' : ''}${value.toFixed(1)} %`
    : value > 0 ? `${value.toFixed(2)} %` : '—';
  return (
    <View style={{ width, alignItems: align, paddingHorizontal: 4 }}>
      <View style={{ backgroundColor: palette.bg, borderRadius: 7, paddingHorizontal: 4, paddingVertical: 1.5 }}>
        <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 700, color: palette.text }}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Maturity ────────────────────────────────────────────────────────────────

const MATURITY_BANDS = [
  { maxYears: 1,  label: '< 1 an',  color: '#dc2626' },
  { maxYears: 2,  label: '1–2 ans', color: '#ea580c' },
  { maxYears: 3,  label: '2–3 ans', color: '#d97706' },
  { maxYears: 5,  label: '3–5 ans', color: '#16a34a' },
  { maxYears: Infinity, label: '5+ ans', color: '#2563eb' },
] as const;

const MONTH_PARSE: Record<string, number> = {
  jan: 0, fév: 1, mar: 2, avr: 3, mai: 4, jun: 5,
  jul: 6, aoû: 7, sep: 8, oct: 9, nov: 10, déc: 11,
};

function parseMaturityDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const iso = dateStr.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const fr = dateStr.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (fr) {
    const month = MONTH_PARSE[fr[2].toLowerCase()];
    if (month !== undefined) return new Date(+fr[3], month, +fr[1]);
  }
  const yr = dateStr.match(/^(20\d{2})$/);
  if (yr) return new Date(+yr[1], 6, 1);
  return null;
}

const MONTH_NAMES_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDateFR(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function getMaturityBand(dateStr?: string) {
  const matDate = parseMaturityDate(dateStr);
  if (!matDate) return null;
  const yearsToMat = (matDate.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
  return MATURITY_BANDS.find(b => yearsToMat < b.maxYears) || MATURITY_BANDS[MATURITY_BANDS.length - 1];
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Analyse des cours cibles</Text>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        <View style={{ opacity: 0.2 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={ICON_G_SRC} style={{ width: 12, height: 12 }} />
        </View>
      </View>
    </View>
  );
}

// ─── Pale sky→emerald gradient box ──────────────────────────────────────────
// Matches the UI's `from-brand-primary/5 to-emerald-50` summary style.

function PaleGradientBox({
  gradientId,
  children,
  style,
}: {
  gradientId: string;
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
}) {
  return (
    <View style={[{
      position: 'relative' as const,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#bae6fd',
      borderStyle: 'solid' as const,
      overflow: 'hidden' as const,
    }, style]}>
      {/* Top accent bar: cyan → emerald */}
      <Svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4 }}
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={`${gradientId}Top`} x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#00b4d8" />
            <Stop offset="0.55" stopColor="#14b8a6" />
            <Stop offset="1" stopColor="#10b981" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={4} fill={`url(#${gradientId}Top)`} />
      </Svg>
      {/* Background wash: sky-50 → emerald-50 */}
      <Svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#f0f9ff" />
            <Stop offset="0.5" stopColor="#f0fdfa" />
            <Stop offset="1" stopColor="#ecfdf5" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${gradientId})`} />
      </Svg>
      {children}
    </View>
  );
}

// ─── Sector allocation (equities + ETFs) ────────────────────────────────────
// Sector codes match /api/models/stock-sector (Yahoo → internal codes).
// Full French labels (never truncated) + a distinct colour per sector.

// Highly-distinct categorical palette (max hue separation) so no two sectors
// look alike in the donut. Common sectors get the most separated colours.
const SECTOR_META: Record<string, { label: string; color: string }> = {
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

interface SectorSlice { code: string; label: string; color: string; value: number; pct: number; }

// One simple, recognizable line/fill icon per sector (24×24 viewBox, primitives only).
function SectorIcon({ code, size = 11, color }: { code: string; size?: number; color: string }) {
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
function buildEquitySectorSlices(holdings: PriceTargetHolding[]): SectorSlice[] {
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
const ASSET_CLASS_META: Record<string, { label: string; color: string }> = {
  EQUITY:       { label: 'Actions',      color: '#2563eb' },
  ETF:          { label: 'FNB',          color: '#8b5cf6' },
  FIXED_INCOME: { label: 'Revenu fixe',  color: '#c5a365' },
  PREFERRED:    { label: 'Privilégiées', color: '#ec4899' },
  FUND:         { label: 'Fonds',        color: '#14b8a6' },
  CASH:         { label: 'Liquidités',   color: '#64748b' },
  OTHER:        { label: 'Autre',        color: '#94a3b8' },
};

function buildAssetClassSlices(holdings: PriceTargetHolding[]): SectorSlice[] {
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
function SectorDonut({ slices, size = 92 }: { slices: SectorSlice[]; size?: number }) {
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

// "Répartition du portefeuille" block: a compact asset-class donut (left) +
// the sector donut with icon legend (right). Sector names are shown in full,
// one line each — never wrapped or cut.
function RepartitionBlock({ assetClassSlices, sectorSlices }: {
  assetClassSlices: SectorSlice[];
  sectorSlices: SectorSlice[];
}) {
  const hasAsset = assetClassSlices.length > 0;
  const hasSector = sectorSlices.length > 0;
  return (
    <View style={{ marginBottom: 12 }} wrap={false}>
      <View style={{ marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 3, height: 14, backgroundColor: C.cyan, borderRadius: 1.5 }} />
        <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
          Répartition du portefeuille
        </Text>
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'stretch', gap: 14,
        borderRadius: 10, padding: 12,
        backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' as const,
      }}>
        {/* Classes d'actifs — mini-donut + légende */}
        {hasAsset && (
          <View style={{ width: 140 }}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 5 }}>
              Classes d&apos;actifs
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SectorDonut slices={assetClassSlices} size={56} />
              <View style={{ flex: 1 }}>
                {assetClassSlices.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 1.5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: s.color }} />
                    <Text style={{ fontSize: 6.5, color: C.text, flex: 1 }}>{s.label}</Text>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 700, color: C.navy }}>{s.pct.toFixed(0)} %</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {hasAsset && hasSector && <View style={{ width: 1, backgroundColor: '#e2e8f0' }} />}

        {/* Secteurs (actions + FNB) — donut + légende à icônes, noms complets */}
        {hasSector && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 5 }}>
              Secteurs — actions et FNB
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <SectorDonut slices={sectorSlices} size={84} />
              <View style={{ flex: 1 }}>
                {sectorSlices.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
                    <SectorIcon code={s.code} size={10} color={s.color} />
                    <Text style={{ fontSize: 7.5, color: C.text }}>{s.label}</Text>
                    <View style={{ flex: 1, height: 1, marginHorizontal: 4, backgroundColor: '#f1f5f9' }} />
                    <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 700, color: C.navy }}>{s.pct.toFixed(1)} %</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function CoverPage({ data, orientation }: { data: PriceTargetReportData; orientation: 'portrait' | 'landscape' }) {
  const s = data.summary;
  const date = new Date(data.generatedAt);
  const dateStr = new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);

  const hasTargets = s.totalTargetValue > 0;
  const eqGain = s.equityGain ?? s.totalGain;
  const eqGainPct = s.equityGainPct ?? s.totalGainPct;
  const eqDiv = s.equityDividends ?? 0;
  const eqDivYieldPct = s.equityDividendYieldPct ?? 0;
  const fiIncome = s.fixedIncomeAnnualIncome ?? 0;
  const fiYieldPct = s.fixedIncomeGainPct ?? 0;
  const totalEst = s.totalEstimated ?? s.totalGain;
  const totalEstPct = s.totalEstimatedPct ?? s.totalGainPct;
  const upColor = '#10b981';
  const downColor = '#ef4444';

  // Breakdown bar widths (clamped ≥ 0 so a negative capital gain doesn't break layout)
  const divPart = Math.max(eqDiv, 0);
  const fiPart = Math.max(fiIncome, 0);
  const capPart = Math.max(eqGain, 0);
  const partsSum = divPart + fiPart + capPart;
  const pctDiv = partsSum > 0 ? (divPart / partsSum) * 100 : 0;
  const pctFi = partsSum > 0 ? (fiPart / partsSum) * 100 : 0;
  const pctCap = partsSum > 0 ? (capPart / partsSum) * 100 : 0;

  // Allocation donuts on the cover: asset classes (all holdings) + sectors (equities/ETFs)
  const sectorSlices = buildEquitySectorSlices(data.holdings);
  const assetClassSlices = buildAssetClassSlices(data.holdings);

  return (
    <Page size="A4" orientation={orientation} style={[styles.page, { backgroundColor: '#f8fafc' }]}>
      {/* ── Header with misty blue gradient ── */}
      <View style={{
        position: 'relative' as const, borderRadius: 10, overflow: 'hidden' as const,
        marginBottom: 10,
      }}>
        {/* Gradient background: soft blue mist → white */}
        <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 600 200" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="headerMist" x1="0" y1="0" x2="600" y2="200" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#dbeafe" />
              <Stop offset="0.3" stopColor="#e8f2fc" />
              <Stop offset="0.65" stopColor="#f4f8fd" />
              <Stop offset="1" stopColor="#ffffff" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={600} height={200} fill="url(#headerMist)" />
        </Svg>
        {/* Subtle top accent line */}
        <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3 }} viewBox="0 0 600 3" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="headerAccent" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#00b4d8" />
              <Stop offset="0.5" stopColor="#38bdf8" />
              <Stop offset="1" stopColor="#93c5fd" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={600} height={3} fill="url(#headerAccent)" />
        </Svg>

        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#8faabe', position: 'absolute' as const, top: 16, right: 24 }}>{dateStr}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_SRC} style={{ width: 76, height: 30, marginBottom: 8 }} />
          {/* Title block */}
          <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 3 }}>
            Analyse des cours cibles
          </Text>
          {data.clientName ? (
            <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              {data.clientName}
            </Text>
          ) : null}
          <View style={{ height: 1, backgroundColor: '#c7ddf0', marginBottom: 12, opacity: 0.6 }} />
          {/* Stats pills */}
          <View style={{ flexDirection: 'row' as const, gap: 6, flexWrap: 'wrap' as const }}>
            {s.equityCount > 0 && (
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.cyan }} />
                <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#334155' }}>{s.equityCount} actions/FNB</Text>
              </View>
            )}
            {s.fixedIncomeCount > 0 && (
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#c5a365' }} />
                <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#334155' }}>{s.fixedIncomeCount} revenus fixes</Text>
              </View>
            )}
            {s.cashCount > 0 && (
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#64748b' }} />
                <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#334155' }}>{s.cashCount} liquidités</Text>
              </View>
            )}
            {s.targetsFound > 0 && (
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10b981' }} />
                <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#334155' }}>{s.targetsFound} cours cibles</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Portfolio value: today vs projected */}
      {hasTargets && (() => {
        const portfolioToday = s.totalMarketValue;
        const projected12m = portfolioToday + totalEst;
        const diffPct = portfolioToday > 0 ? (totalEst / portfolioToday) * 100 : 0;
        const cashOther = portfolioToday - (s.totalCurrentValue || 0) - (s.fixedIncomeMarketValue ?? 0);
        return (
          <View style={{
            flexDirection: 'row', gap: 0, marginBottom: 14,
            borderRadius: 10, overflow: 'hidden' as const,
          }}>
            {/* Today */}
            <View style={{ flex: 1, position: 'relative' as const, overflow: 'hidden' as const, padding: 16 }}>
              <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 300 100" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="todayGrad" x1="0" y1="0" x2="300" y2="100" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#e0eefb" />
                    <Stop offset="0.5" stopColor="#eef5fc" />
                    <Stop offset="1" stopColor="#f8fbff" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={300} height={100} fill="url(#todayGrad)" />
              </Svg>
              <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
                Portefeuille aujourd&apos;hui
              </Text>
              <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 8 }}>
                {fmt(portfolioToday)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(s.totalCurrentValue || 0) > 0 && (
                  <Text style={{ fontSize: 6.5, color: '#64748b' }}>Actions: <Text style={{ fontWeight: 600 }}>{fmt(s.totalCurrentValue || 0)}</Text></Text>
                )}
                {(s.fixedIncomeMarketValue ?? 0) > 0 && (
                  <Text style={{ fontSize: 6.5, color: '#64748b' }}>Rev. fixe: <Text style={{ fontWeight: 600 }}>{fmt(s.fixedIncomeMarketValue ?? 0)}</Text></Text>
                )}
                {cashOther > 0 && (
                  <Text style={{ fontSize: 6.5, color: '#64748b' }}>Liquidités: <Text style={{ fontWeight: 600 }}>{fmt(cashOther)}</Text></Text>
                )}
              </View>
            </View>
            {/* Arrow */}
            <View style={{ width: 40, backgroundColor: C.navy, justifyContent: 'center' as const, alignItems: 'center' as const }}>
              <Text style={{ fontSize: 14, color: '#ffffff', fontFamily: 'Montserrat', fontWeight: 800 }}>→</Text>
              <Text style={{ fontSize: 6, color: '#94a3b8', marginTop: 2 }}>12 mois</Text>
            </View>
            {/* Projected */}
            <View style={{ flex: 1, position: 'relative' as const, overflow: 'hidden' as const, padding: 16 }}>
              <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 300 100" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="projGrad" x1="0" y1="0" x2="300" y2="100" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor={totalEst >= 0 ? '#d5f5e3' : '#fde8e8'} />
                    <Stop offset="0.5" stopColor={totalEst >= 0 ? '#e8faf0' : '#fef2f2'} />
                    <Stop offset="1" stopColor={totalEst >= 0 ? '#f5fdf8' : '#fffafa'} />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={300} height={100} fill="url(#projGrad)" />
              </Svg>
              <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
                Portefeuille projeté 12 mois
              </Text>
              <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: totalEst >= 0 ? '#059669' : '#dc2626', marginBottom: 8 }}>
                {fmt(projected12m)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ backgroundColor: totalEst >= 0 ? '#d1fae5' : '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 700, color: totalEst >= 0 ? '#047857' : '#b91c1c' }}>
                    {fmtPct(diffPct)}
                  </Text>
                </View>
                <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: totalEst >= 0 ? '#059669' : '#dc2626' }}>
                  {totalEst >= 0 ? '+' : ''}{fmt(totalEst)}
                </Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Répartition — classes d'actifs (mini-donut) + secteurs (donut + légende à icônes) */}
      {(assetClassSlices.length > 0 || sectorSlices.length > 0) && (
        <RepartitionBlock assetClassSlices={assetClassSlices} sectorSlices={sectorSlices} />
      )}

      {/* Projections 12 mois — section title */}
      {hasTargets && (
        <>
          <View style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 3, height: 14, backgroundColor: C.cyan, borderRadius: 1.5 }} />
            <View>
              <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
                Détail des projections
              </Text>
              <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 1 }}>
                Sur l&apos;ensemble des actions et FNB (titres avec ou sans cours cible)
              </Text>
            </View>
          </View>

          {/* 3 breakdown cards */}
          {(() => {
            const eqMv = s.totalCurrentValue || 0;
            const fiMv = s.fixedIncomeMarketValue ?? 0;
            return (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {/* Dividendes projetés */}
            <View style={{ flex: 1, position: 'relative' as const, overflow: 'hidden' as const, borderRadius: 8, padding: 12 }}>
              <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 200 120" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="divGrad" x1="0" y1="0" x2="200" y2="120" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#d5f5e3" />
                    <Stop offset="0.5" stopColor="#eafaf1" />
                    <Stop offset="1" stopColor="#f8fdfb" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={200} height={120} fill="url(#divGrad)" />
              </Svg>
              <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3 }} viewBox="0 0 200 3" preserveAspectRatio="none">
                <Defs><LinearGradient id="divTop" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor={C.duoGreen} /><Stop offset="1" stopColor="#6ee7b7" /></LinearGradient></Defs>
                <Rect x={0} y={0} width={200} height={3} fill="url(#divTop)" />
              </Svg>
              <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
                Dividendes projetés
              </Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, marginBottom: 4 }}>
                Actions (forward)
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Montserrat', fontWeight: 800, color: upColor, marginBottom: 2 }}>
                {fmt(eqDiv)}
              </Text>
              <Text style={{ fontSize: 6.5, color: '#64748b', marginBottom: 4 }}>
                sur {fmt(eqMv)} — toutes les actions/FNB
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#065f46' }}>
                    {fmtPct(eqDivYieldPct)}
                  </Text>
                </View>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>yield annuel</Text>
              </View>
            </View>

            {/* Revenus fixes */}
            <View style={{ flex: 1, position: 'relative' as const, overflow: 'hidden' as const, borderRadius: 8, padding: 12 }}>
              <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 200 120" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="fiGrad" x1="0" y1="0" x2="200" y2="120" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#dbeafe" />
                    <Stop offset="0.5" stopColor="#eff6ff" />
                    <Stop offset="1" stopColor="#f8fbff" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={200} height={120} fill="url(#fiGrad)" />
              </Svg>
              <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3 }} viewBox="0 0 200 3" preserveAspectRatio="none">
                <Defs><LinearGradient id="fiTop" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor={C.duoBlue} /><Stop offset="1" stopColor="#93c5fd" /></LinearGradient></Defs>
                <Rect x={0} y={0} width={200} height={3} fill="url(#fiTop)" />
              </Svg>
              <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
                Revenus fixes
              </Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, marginBottom: 4 }}>
                Coupons obligations
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Montserrat', fontWeight: 800, color: upColor, marginBottom: 2 }}>
                {fmt(fiIncome)}
              </Text>
              <Text style={{ fontSize: 6.5, color: '#64748b', marginBottom: 4 }}>
                sur {fmt(fiMv)} en obligations
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#065f46' }}>
                    {fmtPct(fiYieldPct)}
                  </Text>
                </View>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>rendement annuel</Text>
              </View>
            </View>

            {/* Gains en capital */}
            <View style={{ flex: 1, position: 'relative' as const, overflow: 'hidden' as const, borderRadius: 8, padding: 12 }}>
              <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 200 120" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="capGrad" x1="0" y1="0" x2="200" y2="120" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#ede9fe" />
                    <Stop offset="0.5" stopColor="#f5f3ff" />
                    <Stop offset="1" stopColor="#fbfaff" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={200} height={120} fill="url(#capGrad)" />
              </Svg>
              <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3 }} viewBox="0 0 200 3" preserveAspectRatio="none">
                <Defs><LinearGradient id="capTop" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor={C.duoPurple} /><Stop offset="1" stopColor="#c4b5fd" /></LinearGradient></Defs>
                <Rect x={0} y={0} width={200} height={3} fill="url(#capTop)" />
              </Svg>
              <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
                Gain en capital
              </Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, marginBottom: 4 }}>
                Actions (cible 1 an)
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Montserrat', fontWeight: 800, color: eqGain >= 0 ? upColor : downColor, marginBottom: 2 }}>
                {fmt(eqGain)}
              </Text>
              <Text style={{ fontSize: 6.5, color: '#64748b', marginBottom: 4 }}>
                sur {fmt(eqMv)} — toutes les actions/FNB
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: eqGainPct >= 0 ? '#065f46' : '#991b1b' }}>
                    {fmtPct(eqGainPct)}
                  </Text>
                </View>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>prix → cible</Text>
              </View>
            </View>
          </View>
            );
          })()}

          {/* Total projeté 12 mois — barre compacte (répartition + montants + rendement) */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderRadius: 10, padding: 11, marginBottom: 12,
            backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderStyle: 'solid' as const,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 6, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
                Total revenus + gains projetés 12 mois
              </Text>
              {partsSum > 0 && (
                <View style={{ flexDirection: 'row', height: 7, borderRadius: 3.5, overflow: 'hidden' as const, marginBottom: 5, backgroundColor: '#e2e8f0' }}>
                  {pctCap > 0 && <View style={{ width: `${pctCap}%`, backgroundColor: C.duoPurple }} />}
                  {pctDiv > 0 && <View style={{ width: `${pctDiv}%`, backgroundColor: C.duoGreen }} />}
                  {pctFi > 0 && <View style={{ width: `${pctFi}%`, backgroundColor: C.duoBlue }} />}
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' as const, gap: 12 }}>
                {eqGain !== 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 1.5, backgroundColor: C.duoPurple }} />
                    <Text style={{ fontSize: 6.5, color: '#64748b' }}>Gain capital </Text>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 700, color: eqGain >= 0 ? '#059669' : '#dc2626' }}>{eqGain >= 0 ? '+' : ''}{fmt(eqGain)}</Text>
                  </View>
                )}
                {eqDiv > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 1.5, backgroundColor: C.duoGreen }} />
                    <Text style={{ fontSize: 6.5, color: '#64748b' }}>Dividendes </Text>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 700, color: '#059669' }}>{fmt(eqDiv)}</Text>
                  </View>
                )}
                {fiIncome > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 1.5, backgroundColor: C.duoBlue }} />
                    <Text style={{ fontSize: 6.5, color: '#64748b' }}>Revenus fixes </Text>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 700, color: '#059669' }}>{fmt(fiIncome)}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' as const, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: '#bae6fd', borderLeftStyle: 'solid' as const }}>
              <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: totalEst >= 0 ? '#059669' : '#dc2626' }}>
                {totalEst >= 0 ? '+' : ''}{fmt(totalEst)}
              </Text>
              <View style={{ backgroundColor: totalEstPct >= 0 ? '#d1fae5' : '#fee2e2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 2 }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: totalEstPct >= 0 ? '#047857' : '#b91c1c' }}>
                  {fmtPct(totalEstPct)} rendement
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Disclaimer */}
      <View style={{ marginTop: 'auto' as const, paddingTop: 12 }}>
        <Text style={{ fontSize: 6.5, color: '#94a3b8', lineHeight: 1.5 }}>
          Les cours cibles proviennent du consensus des analystes (Yahoo Finance). Pour les titres sans couverture,
          une estimation basée sur le rendement historique 12 mois est utilisée. Ce document est fourni à titre
          informatif et ne constitue pas un conseil en placement.
        </Text>
      </View>

      <PageFooter />
    </Page>
  );
}

// ─── Equity Table Page ───────────────────────────────────────────────────────

// Column widths for the cours-cibles table — single source of truth so the
// header, data rows and total stay perfectly aligned. Tuned for content:
// wide "Description", roomy "Qté", and tight money columns (no wasted space).
const EQ_COL = {
  // cpte à 7 % : « Comptant » (le plus long libellé de compte) tient sur une ligne.
  cpte: '7%', symbole: '9%', desc: '15%', qte: '6%', pbr: '7%', prix: '7%',
  marche: '8%', cible: '7%', gainPct: '8%', gainDollar: '9%', div: '9%', divPct: '8%',
} as const;

function EquityTablePage({ holdings, orientation, logos, usdCadRate }: {
  holdings: PriceTargetHolding[];
  orientation: 'portrait' | 'landscape';
  logos: Record<string, string>;
  usdCadRate?: number | null;
}) {
  // Valeur marché « effective » : si la valeur collée est absente (saisie manuelle
  // / prospect sans prix), on la reconstruit avec quantité × prix actuel (live).
  // Évite MARCHÉ = 0 $ et un Div. % vide (Div. % = dividende ÷ valeur marché).
  const effMv = (h: PriceTargetHolding): number => {
    if (h.marketValue > 0) return h.marketValue;
    const cp = h.currentPrice || h.marketPrice;
    return cp > 0 ? h.quantity * cp : 0;
  };
  const totalMv = holdings.reduce((s, h) => s + effMv(h), 0);
  const totalGain = holdings.reduce((s, h) => {
    if (h.targetPrice && (h.currentPrice || h.marketPrice) > 0)
      return s + h.quantity * (h.targetPrice - (h.currentPrice || h.marketPrice));
    return s;
  }, 0);
  const totalDiv = holdings.reduce((s, h) => s + (h.forwardDividend || 0), 0);
  const totalTarget = holdings.reduce((s, h) => h.targetPrice ? s + h.quantity * h.targetPrice : s + effMv(h), 0);
  const totalPct = totalMv > 0 ? (totalGain / totalMv) * 100 : 0;
  const divYieldPct = totalMv > 0 ? (totalDiv / totalMv) * 100 : 0;
  const projection12m = totalDiv + totalGain;
  const projectionPct = totalMv > 0 ? (projection12m / totalMv) * 100 : 0;
  const gc = (v: number) => v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#94a3b8';

  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.navy, borderBottomStyle: 'solid' as const }}>
        <View>
          <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Cours cibles des analystes — Actions / FNB</Text>
          <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 2 }}>Gain en capital espéré selon les cibles des analystes (prix actuel → cours cible 12 mois)</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Val. marché: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalMv)}</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Val. cible: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalTarget)}</Text></Text>
        </View>
      </View>

      {/* Compact projection 12 mois — before table */}
      {(() => {
        const divPct = projection12m > 0 ? (Math.max(totalDiv, 0) / projection12m) * 100 : 0;
        const gainPct = projection12m > 0 ? (Math.max(totalGain, 0) / projection12m) * 100 : 0;
        return (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            marginBottom: 8, padding: 7, borderRadius: 8,
            backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderStyle: 'solid' as const,
          }}>
            {/* Title accent */}
            <View style={{ width: 2.5, height: 20, backgroundColor: '#0891b2', borderRadius: 1.5 }} />
            {/* Dividendes */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 5, color: '#64748b', fontFamily: 'Open Sans', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 1 }}>Dividendes (revenu)</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: '#0891b2' }}>{fmt(totalDiv)}</Text>
              <Text style={{ fontSize: 5, color: '#94a3b8' }}>{divYieldPct.toFixed(2)} % yield annuel</Text>
            </View>
            <Text style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'Montserrat', fontWeight: 700 }}>+</Text>
            {/* Gain capital */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 5, color: '#64748b', fontFamily: 'Open Sans', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 1 }}>Gain en capital (cible)</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: totalGain >= 0 ? '#059669' : '#dc2626' }}>{fmt(totalGain)}</Text>
              <Text style={{ fontSize: 5, color: '#94a3b8' }}>{fmtPct(totalPct)} prix → cible</Text>
            </View>
            <Text style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'Montserrat', fontWeight: 700 }}>=</Text>
            {/* Total */}
            <View style={{
              flex: 1.2, backgroundColor: C.navy, borderRadius: 6, padding: 6,
            }}>
              <Text style={{ fontSize: 5, color: '#94a3b8', fontFamily: 'Open Sans', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 1 }}>Total actions 12 mois</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>{fmt(projection12m)}</Text>
            </View>
            {/* Rendement pill with label */}
            <View style={{ alignItems: 'center' as const, gap: 2 }}>
              <Text style={{ fontSize: 4.5, color: '#64748b', fontFamily: 'Open Sans', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Rend. total</Text>
              <View style={{
                backgroundColor: projectionPct >= 0 ? '#059669' : '#dc2626',
                paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
              }}>
                <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
                  {fmtPct(projectionPct)}
                </Text>
              </View>
              <Text style={{ fontSize: 4, color: '#94a3b8' }}>div. + cap.</Text>
            </View>
          </View>
        );
      })()}

      {/* USD/CAD exchange rate indicator */}
      {usdCadRate && usdCadRate > 0 && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
          marginBottom: 6, gap: 6,
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: '#f0fdfa', borderRadius: 6,
            paddingHorizontal: 8, paddingVertical: 3,
            borderWidth: 1, borderColor: '#99f6e4', borderStyle: 'solid' as const,
          }}>
            <Text style={{ fontSize: 6.5, color: '#0d9488', fontFamily: 'Open Sans', fontWeight: 600 }}>
              Taux USD/CAD appliqué :
            </Text>
            <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: '#0f766e' }}>
              {usdCadRate.toFixed(4)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.tablePremium}>
        <View style={styles.thPremium}>
          <Text style={[styles.thCellPremium, { width: EQ_COL.cpte }]}>Cpte</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.symbole, letterSpacing: 0.3 }]}>Symbole</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.desc }]}>Description</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.qte, textAlign: 'right' }]}>Qté</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.pbr, textAlign: 'right' }]}>PBR</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.prix, textAlign: 'right' }]}>Prix</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.marche, textAlign: 'right' }]}>Marché</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.cible, textAlign: 'right' }]}>Cible</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.gainPct, textAlign: 'right' }]}>Gain %</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.gainDollar, textAlign: 'right' }]}>Gain $</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.div, textAlign: 'right' }]}>Div. $</Text>
          <Text style={[styles.thCellPremium, { width: EQ_COL.divPct, textAlign: 'right' }]}>Div. %</Text>
        </View>

        {holdings.map((h, i) => {
          const row = getRowStyle(i, holdings.length);
          const gp = h.gainPct ?? 0;
          const cp = h.currentPrice || h.marketPrice;
          const mv = effMv(h);
          const gd = h.targetPrice && cp > 0 ? h.quantity * (h.targetPrice - cp) : 0;
          const div = h.forwardDividend || 0;
          const divPct = div > 0 && mv > 0 ? (div / mv) * 100 : 0;
          const dotColor = getAssetColor(h.assetType);
          const logoSrc = logos[h.symbol];

          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row', paddingVertical: 4.5, paddingHorizontal: 8,
              backgroundColor: row.bg,
              borderBottomWidth: row.borderBottomWidth,
              borderBottomColor: row.borderBottomColor,
              borderBottomStyle: 'solid' as const,
              alignItems: 'center',
            }} wrap={false}>
              <Text style={[styles.td, { width: EQ_COL.cpte, fontSize: 6.5, color: '#94a3b8' }]}>{h.accountLabel}</Text>
              {/* Symbol with company logo (falls back to category dot) */}
              <View style={{ width: EQ_COL.symbole, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
                {logoSrc ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image
                    src={logoSrc}
                    style={{ width: 10, height: 10, borderRadius: 2, marginRight: 4, objectFit: 'contain' as const }}
                  />
                ) : (
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: dotColor, marginRight: 4 }} />
                )}
                {/* Symboles longs (PMEI-UN.TO…) : police réduite pour ne pas déborder sur la description. */}
                <Text style={{ fontSize: h.symbol.length > 8 ? 6.2 : 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{h.symbol}</Text>
              </View>
              <Text style={[styles.td, { width: EQ_COL.desc, fontSize: 7.5 }]}>{h.name}</Text>
              <Text style={[styles.td, { width: EQ_COL.qte, textAlign: 'right' }]}>{h.quantity.toLocaleString('fr-CA')}</Text>
              <Text style={[styles.td, { width: EQ_COL.pbr, textAlign: 'right', color: '#64748b' }]}>{h.averageCost > 0 ? fmtFull(h.averageCost) : '—'}</Text>
              <Text style={[styles.tdBold, { width: EQ_COL.prix, textAlign: 'right' }]}>{cp > 0 ? fmtFull(cp) : '—'}</Text>
              <Text style={[styles.tdBold, { width: EQ_COL.marche, textAlign: 'right' }]}>{mv > 0 ? fmt(mv) : '—'}</Text>
              <Text style={[styles.tdBold, { width: EQ_COL.cible, textAlign: 'right', color: C.navy }]}>
                {fmtFull(h.targetPrice!)}
              </Text>
              <PctPill value={gp} tone="gain" width={EQ_COL.gainPct} />
              <Text style={[styles.tdBold, { width: EQ_COL.gainDollar, textAlign: 'right', color: gc(gd) }]}>
                {fmt(gd)}
              </Text>
              <Text style={[styles.tdBold, { width: EQ_COL.div, textAlign: 'right', color: div > 0 ? '#0891b2' : '#94a3b8' }]}>
                {div > 0 ? fmt(div) : '—'}
              </Text>
              <PctPill value={divPct} tone="income" width={EQ_COL.divPct} />
            </View>
          );
        })}

        {/* Grand total row — bandeau navy en écho à l'en-tête */}
        <View style={{
          flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8,
          backgroundColor: C.navy, borderTopWidth: 2.5, borderTopColor: C.cyan, borderTopStyle: 'solid' as const,
          alignItems: 'center',
        }} wrap={false}>
          <Text style={{ width: EQ_COL.cpte }}>{''}</Text>
          <Text style={{ width: EQ_COL.symbole }}>{''}</Text>
          <View style={{ width: EQ_COL.desc, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: 0.2 }}>Total actions</Text>
            <Text style={{ fontSize: 5.5, color: '#94a3b8', marginTop: 1 }}>Gain en capital (prix → cible)</Text>
          </View>
          {/* Les colonnes vides Qté/PBR/Prix (20 %) sont réparties pour donner de
              l'air aux montants totaux; les bords droits restent alignés avec
              Marché (59 %) et Cible (66 %) du tableau au-dessus. */}
          <Text style={{ width: '14%' }}>{''}</Text>
          <Text style={{ width: '12%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff', textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalMv)}</Text>
          <Text style={{ width: '9%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#7dd3fc', textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalTarget)}</Text>
          <Text style={{ width: EQ_COL.gainPct, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: totalPct >= 0 ? '#6ee7b7' : '#fca5a5', textAlign: 'right', paddingHorizontal: 4 }}>{fmtPct(totalPct)}</Text>
          <Text style={{ width: EQ_COL.gainDollar, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: totalGain >= 0 ? '#6ee7b7' : '#fca5a5', textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalGain)}</Text>
          <Text style={{ width: EQ_COL.div, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: totalDiv > 0 ? '#67e8f9' : '#ffffff', textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalDiv)}</Text>
          <Text style={{ width: EQ_COL.divPct, fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: divYieldPct > 0 ? '#67e8f9' : '#ffffff', textAlign: 'right', paddingHorizontal: 4 }}>{divYieldPct > 0 ? `${divYieldPct.toFixed(2)} %` : '—'}</Text>
        </View>
      </View>

      {/* Source */}
      <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 6 }}>
        Source : Consensus des analystes via Yahoo Finance. Div. $ : dividende annuel projeté (Yahoo forward rate × quantité). Div. % : dividende annuel ÷ valeur au marché. Ce tableau ne couvre que les actions/FNB ayant un cours cible ; le sommaire en couverture porte sur l&apos;ensemble des actions/FNB, d&apos;où un dividende et un rendement légèrement différents.
      </Text>

      <PageFooter />
    </Page>
  );
}

// ─── Fixed Income Table Page ─────────────────────────────────────────────────

function FixedIncomeTablePage({ holdings, orientation }: {
  holdings: PriceTargetHolding[];
  orientation: 'portrait' | 'landscape';
}) {
  const totalMv = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalIncome = holdings.reduce((s, h) => s + h.annualIncome, 0);
  const totalValDur = holdings.reduce((s, h) => s + (h.modifiedDuration ? h.marketValue : 0), 0);
  const weightedDur = holdings.reduce((s, h) => s + (h.modifiedDuration || 0) * h.marketValue, 0);
  const avgDur = totalValDur > 0 ? (weightedDur / totalValDur).toFixed(2) : '—';
  const avgYieldPct = totalMv > 0 ? (totalIncome / totalMv) * 100 : 0;

  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.gold, borderBottomStyle: 'solid' as const }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Revenus fixes</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Valeur: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalMv)}</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Revenu: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalIncome)}</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Dur. moy.: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{avgDur}</Text></Text>
        </View>
      </View>

      {/* Maturity distribution bar */}
      {(() => {
        const bandData = MATURITY_BANDS.map(band => {
          const matched = holdings.filter(h => {
            const b = getMaturityBand(h.maturityDate);
            return b && b.label === band.label;
          });
          const value = matched.reduce((s, h) => s + h.marketValue, 0);
          return { ...band, value, count: matched.length };
        }).filter(b => b.value > 0);
        const noDate = holdings.filter(h => !getMaturityBand(h.maturityDate));
        const noDateValue = noDate.reduce((s, h) => s + h.marketValue, 0);
        const totalBarValue = bandData.reduce((s, b) => s + b.value, 0) + noDateValue;

        return totalBarValue > 0 ? (
          <View style={{
            marginBottom: 8, padding: 8, borderRadius: 8,
            backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fef08a', borderStyle: 'solid' as const,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                Répartition par échéance
              </Text>
              <Text style={{ fontSize: 6, color: '#94a3b8' }}>
                {holdings.length} position{holdings.length > 1 ? 's' : ''} · {fmt(totalMv)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' as const, marginBottom: 5, backgroundColor: '#e2e8f0' }}>
              {bandData.map(b => (
                <View key={b.label} style={{ width: `${(b.value / totalBarValue) * 100}%`, backgroundColor: b.color }} />
              ))}
              {noDateValue > 0 && (
                <View style={{ width: `${(noDateValue / totalBarValue) * 100}%`, backgroundColor: '#cbd5e1' }} />
              )}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {bandData.map(b => (
                <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: b.color }} />
                  <Text style={{ fontSize: 6, color: '#64748b' }}>
                    {b.label}: {fmt(b.value)} ({b.count})
                  </Text>
                </View>
              ))}
              {noDateValue > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: '#cbd5e1' }} />
                  <Text style={{ fontSize: 6, color: '#64748b' }}>
                    N/D: {fmt(noDateValue)} ({noDate.length})
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>Échéance :</Text>
            {MATURITY_BANDS.map((band) => (
              <View key={band.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: band.color }} />
                <Text style={{ fontSize: 6.5, color: '#64748b' }}>{band.label}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      <View style={styles.tablePremium}>
        <View style={styles.thPremium}>
          <Text style={[styles.thCellPremium, { width: '7%' }]}>Cpte</Text>
          <Text style={[styles.thCellPremium, { width: '9%', letterSpacing: 0.3 }]}>Symbole</Text>
          <Text style={[styles.thCellPremium, { width: '15%' }]}>Description</Text>
          <Text style={[styles.thCellPremium, { width: '8%', textAlign: 'right', letterSpacing: 0.3 }]}>Qté/VN</Text>
          <Text style={[styles.thCellPremium, { width: '7%', textAlign: 'right', letterSpacing: 0.3 }]}>Coupon</Text>
          <Text style={[styles.thCellPremium, { width: '11%', textAlign: 'right' }]}>Échéance</Text>
          <Text style={[styles.thCellPremium, { width: '7%', textAlign: 'right', letterSpacing: 0.3 }]}>Durée</Text>
          <Text style={[styles.thCellPremium, { width: '10%', textAlign: 'right', letterSpacing: 0.3 }]}>Marché</Text>
          <Text style={[styles.thCellPremium, { width: '8%', textAlign: 'right', letterSpacing: 0.3 }]}>Int. $</Text>
          <Text style={[styles.thCellPremium, { width: '10%', textAlign: 'right', letterSpacing: 0.3 }]}>Rev. ann.</Text>
          <Text style={[styles.thCellPremium, { width: '8%', textAlign: 'right', letterSpacing: 0.3 }]}>Rend.</Text>
        </View>

        {holdings.map((h, i) => {
          const row = getRowStyle(i, holdings.length);
          const band = getMaturityBand(h.maturityDate);
          const yieldPct = h.marketValue > 0 ? (h.annualIncome / h.marketValue) * 100 : 0;
          const dotColor = getAssetColor(h.assetType);
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8,
              backgroundColor: row.bg,
              borderBottomWidth: row.borderBottomWidth,
              borderBottomColor: row.borderBottomColor,
              borderBottomStyle: 'solid' as const,
              alignItems: 'center',
            }} wrap={false}>
              <Text style={[styles.td, { width: '7%', fontSize: 6.5, color: '#94a3b8' }]}>{h.accountLabel}</Text>
              <View style={{ width: '9%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: dotColor, marginRight: 4 }} />
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{h.symbol}</Text>
              </View>
              <Text style={[styles.td, { width: '15%', fontSize: 7.5 }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '8%', textAlign: 'right' }]}>{h.quantity.toLocaleString('fr-CA')}</Text>
              <Text style={[styles.tdBold, { width: '7%', textAlign: 'right', color: C.navy }]}>
                {h.couponRate ? `${h.couponRate.toFixed(2)}%` : '—'}
              </Text>
              <View style={{ width: '11%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 4 }}>
                {band && <View style={{ width: 3, height: 10, borderRadius: 1, backgroundColor: band.color, marginRight: 4 }} />}
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: band ? band.color : '#94a3b8' }}>
                  {h.maturityDate || '—'}
                </Text>
              </View>
              <Text style={[styles.td, { width: '7%', textAlign: 'right' }]}>
                {h.modifiedDuration ? h.modifiedDuration.toFixed(2) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right' }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.td, { width: '8%', textAlign: 'right', color: '#94a3b8' }]}>
                {h.accruedInterest ? fmtFull(h.accruedInterest) : '—'}
              </Text>
              <Text style={[styles.td, { width: '10%', textAlign: 'right', color: h.annualIncome > 0 ? '#10b981' : '#94a3b8' }]}>
                {h.annualIncome > 0 ? fmt(h.annualIncome) : '—'}
              </Text>
              <PctPill value={yieldPct} tone="yield" width="8%" />
            </View>
          );
        })}

        {/* Total row — bandeau navy en écho à l'en-tête */}
        <View style={{
          flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8,
          backgroundColor: C.navy, borderTopWidth: 2.5, borderTopColor: C.gold, borderTopStyle: 'solid' as const,
          alignItems: 'center',
        }}>
          <Text style={{ width: '7%' }}>{''}</Text>
          <Text style={{ width: '9%' }}>{''}</Text>
          <View style={{ width: '15%', paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>Total</Text>
            <Text style={{ fontSize: 5.5, color: '#94a3b8', marginTop: 1 }}>Coupons annuels espérés</Text>
          </View>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '7%' }}>{''}</Text>
          <Text style={{ width: '11%' }}>{''}</Text>
          <Text style={{ width: '7%' }}>{''}</Text>
          <Text style={{ width: '10%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff', textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalMv)}</Text>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '10%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: totalIncome > 0 ? '#6ee7b7' : '#ffffff', textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalIncome)}</Text>
          <Text style={{ width: '8%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: avgYieldPct > 0 ? '#6ee7b7' : '#ffffff', textAlign: 'right', paddingHorizontal: 4 }}>{avgYieldPct > 0 ? `${avgYieldPct.toFixed(2)} %` : '—'}</Text>
        </View>
      </View>

      {/* Projection 12 mois — Revenus fixes */}
      <PaleGradientBox gradientId="fiProjGrad" style={{ marginTop: 8, marginBottom: 4 }}>
        <View style={{ padding: 10, paddingTop: 12 }}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 2.5, height: 11, backgroundColor: '#0891b2', borderRadius: 1.5 }} />
              <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
                Projection 12 mois — Revenus fixes
              </Text>
            </View>
            <View style={{
              backgroundColor: '#059669',
              paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
            }}>
              <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
                {avgYieldPct.toFixed(2)} % rendement espéré
              </Text>
            </View>
          </View>

          {/* Three cards row */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {/* Valeur marchande */}
            <View style={{
              flex: 1,
              backgroundColor: '#ffffff',
              borderRadius: 6,
              borderWidth: 1, borderColor: '#e0f2fe', borderStyle: 'solid' as const,
              borderLeftWidth: 2.5, borderLeftColor: '#0891b2', borderLeftStyle: 'solid' as const,
              padding: 7,
            }}>
              <Text style={{ fontSize: 5.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 3 }}>
                Valeur marchande
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 3 }}>
                {fmt(totalMv)}
              </Text>
              <Text style={{ fontSize: 5.5, color: '#94a3b8' }}>
                Capital total investi
              </Text>
            </View>

            {/* Coupons espérés */}
            <View style={{
              flex: 1,
              backgroundColor: '#ffffff',
              borderRadius: 6,
              borderWidth: 1, borderColor: '#d1fae5', borderStyle: 'solid' as const,
              borderLeftWidth: 2.5, borderLeftColor: '#10b981', borderLeftStyle: 'solid' as const,
              padding: 7,
            }}>
              <Text style={{ fontSize: 5.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 3 }}>
                Coupons espérés
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: '#059669', marginBottom: 3 }}>
                {fmt(totalIncome)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                  <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 700, color: '#047857' }}>
                    {avgYieldPct.toFixed(2)} %
                  </Text>
                </View>
                <Text style={{ fontSize: 5.5, color: '#94a3b8' }}>yield</Text>
              </View>
            </View>

            {/* Total hero */}
            <View style={{
              flex: 1.35,
              backgroundColor: C.navy,
              borderRadius: 6,
              padding: 7,
            }}>
              <Text style={{ fontSize: 5.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 3 }}>
                Total espéré 12 mois
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff', marginBottom: 2 }}>
                {fmt(totalMv + totalIncome)}
              </Text>
              <Text style={{ fontSize: 5.5, color: '#cbd5e1' }}>
                Capital + coupons (rendement espéré)
              </Text>
            </View>
          </View>

          {/* Capital vs Coupons breakdown bar */}
          {totalMv > 0 && totalIncome > 0 && (() => {
            const total = totalMv + totalIncome;
            const capPct = (totalMv / total) * 100;
            const coupPct = (totalIncome / total) * 100;
            return (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 5.5, color: '#64748b', fontFamily: 'Open Sans', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.7 }}>
                    Répartition du total projeté
                  </Text>
                  <Text style={{ fontSize: 5.5, color: '#94a3b8' }}>
                    Capital {capPct.toFixed(0)} %  ·  Coupons {coupPct.toFixed(0)} %
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', height: 5, borderRadius: 2.5, overflow: 'hidden' as const, backgroundColor: '#e2e8f0' }}>
                  <View style={{ width: `${capPct}%`, backgroundColor: '#0891b2' }} />
                  <View style={{ width: `${coupPct}%`, backgroundColor: '#10b981' }} />
                </View>
              </View>
            );
          })()}
        </View>
      </PaleGradientBox>

      {/* Maturity alerts — bonds maturing within 18 months */}
      {(() => {
        const now = new Date();
        const horizon = new Date(now.getFullYear(), now.getMonth() + 18, now.getDate());
        const upcoming = holdings
          .map(h => ({ ...h, matDate: parseMaturityDate(h.maturityDate) }))
          .filter(h => h.matDate && h.matDate >= now && h.matDate <= horizon)
          .sort((a, b) => a.matDate!.getTime() - b.matDate!.getTime());

        if (upcoming.length === 0) return null;

        const totalMaturingValue = upcoming.reduce((s, h) => s + (h.quantity > 0 ? h.quantity : h.marketValue), 0);

        return (
          <View style={{
            marginTop: 8, borderRadius: 8, padding: 10,
            backgroundColor: '#fffbeb',
            borderWidth: 1, borderColor: '#fde68a', borderStyle: 'solid' as const,
            borderLeftWidth: 3, borderLeftColor: '#f59e0b', borderLeftStyle: 'solid' as const,
          }} wrap={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: '#ffffff', fontFamily: 'Montserrat', fontWeight: 800 }}>!</Text>
              </View>
              <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                Échéances prochaines (18 mois)
              </Text>
              <View style={{ marginLeft: 'auto' as const, backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 700, color: '#92400e' }}>
                  {fmt(totalMaturingValue)} à recevoir
                </Text>
              </View>
            </View>
            {upcoming.map((h, i) => {
              const nominalValue = h.quantity > 0 ? h.quantity : h.marketValue;
              return (
                <View key={`mat-${i}`} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingVertical: 4, paddingHorizontal: 6,
                  backgroundColor: i % 2 === 0 ? '#fef9ee' : '#ffffff',
                  borderRadius: 4,
                }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#f59e0b' }} />
                  <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#78350f', width: '22%' }}>
                    {h.name.substring(0, 22)}
                  </Text>
                  <Text style={{ fontSize: 7, color: '#92400e', width: '12%' }}>
                    {h.symbol}
                  </Text>
                  <Text style={{ fontSize: 7, color: '#92400e', width: '8%' }}>
                    {h.couponRate ? `${h.couponRate.toFixed(2)}%` : '—'}
                  </Text>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 700, color: '#b45309', width: '18%' }}>
                    Échéance: {formatDateFR(h.matDate!)}
                  </Text>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 700, color: '#059669', textAlign: 'right', width: '18%' as const }}>
                    {fmt(nominalValue)} disponible
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })()}

      <PageFooter />
    </Page>
  );
}

// ─── Descriptions des titres ─────────────────────────────────────────────────

// Icon code + colour + label for a holding: the sector (same icon as the donut)
// for equities/ETFs, otherwise the asset class (revenu fixe, liquidités, …).
function holdingBadge(h: PriceTargetHolding): { code: string; color: string; label: string } {
  if ((h.assetType === 'EQUITY' || h.assetType === 'ETF') && h.sector && SECTOR_META[h.sector]) {
    return { code: h.sector, color: SECTOR_META[h.sector].color, label: SECTOR_META[h.sector].label };
  }
  const ac = ASSET_CLASS_META[h.assetType] || ASSET_CLASS_META.OTHER;
  return { code: h.assetType, color: ac.color, label: ac.label };
}

function DescriptionsPage({ holdings, orientation }: {
  holdings: PriceTargetHolding[];
  orientation: 'portrait' | 'landscape';
}) {
  const sorted = [...holdings].sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue));
  const totalMv = holdings.reduce((s, h) => s + h.marketValue, 0);

  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.cyan, borderBottomStyle: 'solid' as const }}>
        <View>
          <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Descriptions des titres</Text>
          <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 2 }}>Activité de chaque position — le secteur est indiqué par l&apos;icône et l&apos;étiquette</Text>
        </View>
        <Text style={{ fontSize: 7.5, color: '#64748b' }}>{holdings.length} titres · <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalMv)}</Text></Text>
      </View>

      {sorted.map((h, i) => {
        const badge = holdingBadge(h);
        let sub = h.description || '';
        if (!sub && h.assetType === 'FIXED_INCOME') {
          const parts = ['Titre à revenu fixe'];
          if (h.couponRate) parts.push(`coupon ${h.couponRate.toFixed(2)} %`);
          if (h.maturityDate) parts.push(`échéance ${h.maturityDate}`);
          sub = parts.join(' · ');
        } else if (!sub && h.assetType === 'CASH') {
          sub = 'Encaisse / solde du compte.';
        }
        return (
          <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 8,
            paddingVertical: 5,
            borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid' as const,
          }} wrap={false}>
            <View style={{ width: 16, alignItems: 'center', paddingTop: 1 }}>
              <SectorIcon code={badge.code} size={13} color={badge.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 700, color: C.navy }}>{h.symbol}</Text>
                <Text style={{ fontSize: 8, color: C.text, flex: 1 }}>{h.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: '#e2e8f0', borderStyle: 'solid' as const, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 1.5, backgroundColor: badge.color }} />
                  <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: badge.color }}>{badge.label}</Text>
                </View>
              </View>
              {sub ? (
                <Text style={{ fontSize: 7, color: '#64748b', marginTop: 2, lineHeight: 1.35 }}>{sub}</Text>
              ) : null}
            </View>
          </View>
        );
      })}

      <PageFooter />
    </Page>
  );
}

// ─── Main Document ───────────────────────────────────────────────────────────

// ─── Récapitulatif depuis la dernière rencontre ─────────────────────────────
function RecapPage({ evolution, orientation }: {
  evolution: MeetingEvolution;
  orientation: 'portrait' | 'landscape';
}) {
  const { held, exited, added, timeline, lastMeetingDate, meetingCount } = evolution;
  const money = (v: number | null) => (v == null ? '—' : fmtFull(v));
  const dateTxt = (s: string) => {
    try { return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${s}T00:00:00`)); }
    catch { return s; }
  };
  const revised = held.filter(h => h.targetDeltaPct != null && Math.abs(h.targetDeltaPct) >= 0.1);

  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      {/* Section header */}
      <View style={{ marginBottom: 12, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.navy, borderBottomStyle: 'solid' as const }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Récapitulatif depuis la dernière rencontre</Text>
        <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 2 }}>
          Évolution du portefeuille depuis le {dateTxt(lastMeetingDate)} — {meetingCount} rencontre{meetingCount > 1 ? 's' : ''} antérieure{meetingCount > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Compteurs */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Conservés', value: held.length, color: C.cyan },
          { label: 'Vendus', value: exited.length, color: C.gold },
          { label: 'Nouveaux', value: added.length, color: C.duoGreen },
        ].map(c => (
          <View key={c.label} style={{ flex: 1, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const, padding: 12, alignItems: 'center' as const }}>
            <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: c.color }}>{c.value}</Text>
            <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Titres vendus */}
      {exited.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.subsectionTitle}>Titres vendus depuis la dernière rencontre</Text>
          <View style={styles.table}>
            <View style={styles.th}>
              <Text style={[styles.thCell, { width: '18%' }]}>Titre</Text>
              <Text style={[styles.thCell, { width: '30%' }]}>Nom</Text>
              <Text style={[styles.thCell, { width: '10%', textAlign: 'right' as const }]}>Qté</Text>
              <Text style={[styles.thCell, { width: '15%', textAlign: 'right' as const }]}>Prix alors</Text>
              <Text style={[styles.thCell, { width: '15%', textAlign: 'right' as const }]}>Depuis</Text>
              <Text style={[styles.thCell, { width: '12%', textAlign: 'center' as const }]}>Cible</Text>
            </View>
            {exited.map((e, i) => (
              <View key={e.symbol} style={i % 2 ? styles.trAlt : styles.tr}>
                <Text style={[styles.tdBold, { width: '18%' }]}>{e.symbol}</Text>
                <Text style={[styles.td, { width: '30%' }]}>{e.name}</Text>
                <Text style={[styles.td, { width: '10%', textAlign: 'right' as const }]}>{e.prevQty}</Text>
                <Text style={[styles.td, { width: '15%', textAlign: 'right' as const }]}>{money(e.prevPrice)}</Text>
                {e.sinceMeetingPct == null
                  ? <Text style={[styles.td, { width: '15%', textAlign: 'right' as const, color: '#94a3b8' }]}>—</Text>
                  : <PctPill value={e.sinceMeetingPct} tone="gain" width="15%" />}
                <View style={{ width: '12%', alignItems: 'center' as const, justifyContent: 'center' as const }}>
                  {e.reachedPrevTarget === true
                    ? <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.up }} />
                    : e.reachedPrevTarget === false
                      ? <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#e2e8f0' }} />
                      : <Text style={{ fontSize: 7, color: '#cbd5e1' }}>—</Text>}
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.noteText}>● cible atteinte (touchée pendant l&apos;horizon) · ○ cible non atteinte · gain « depuis » = mouvement du prix depuis la dernière rencontre.</Text>
        </View>
      )}

      {/* Cours cibles révisés */}
      {revised.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.subsectionTitle}>Cours cibles révisés (titres conservés)</Text>
          <View style={styles.table}>
            <View style={styles.th}>
              <Text style={[styles.thCell, { width: '24%' }]}>Titre</Text>
              <Text style={[styles.thCell, { width: '28%', textAlign: 'right' as const }]}>Cible précédente</Text>
              <Text style={[styles.thCell, { width: '28%', textAlign: 'right' as const }]}>Nouvelle cible</Text>
              <Text style={[styles.thCell, { width: '20%', textAlign: 'right' as const }]}>Variation</Text>
            </View>
            {revised.map((h, i) => (
              <View key={h.symbol} style={i % 2 ? styles.trAlt : styles.tr}>
                <Text style={[styles.tdBold, { width: '24%' }]}>{h.symbol}</Text>
                <Text style={[styles.td, { width: '28%', textAlign: 'right' as const }]}>{money(h.prevTarget)}</Text>
                <Text style={[styles.td, { width: '28%', textAlign: 'right' as const }]}>{money(h.newTarget)}</Text>
                {h.targetDeltaPct == null
                  ? <Text style={[styles.td, { width: '20%', textAlign: 'right' as const, color: '#94a3b8' }]}>—</Text>
                  : <PctPill value={h.targetDeltaPct} tone="gain" width="20%" />}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Nouveaux titres */}
      {added.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.subsectionTitle}>Nouveaux titres ajoutés</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {added.map(a => (
              <View key={a.symbol} style={{ backgroundColor: C.duoGreenBg, borderWidth: 1, borderColor: C.duoGreenPale, borderStyle: 'solid' as const, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.text }}>{a.symbol}{a.target ? ` · cible ${money(a.target)}` : ''}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Frise des rencontres */}
      {timeline.length > 0 && (
        <View>
          <Text style={styles.subsectionTitle}>Rencontres précédentes</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {timeline.map(t => (
              <View key={t.date} style={{ backgroundColor: C.panel, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{dateTxt(t.date)}</Text>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>{t.positions} position{t.positions > 1 ? 's' : ''}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <PageFooter />
    </Page>
  );
}

export function PriceTargetsDocument({ data }: { data: PriceTargetReportData }) {
  const opts = data.options ?? {};
  const showCover = opts.includeCover !== false;
  const showEquities = opts.includeEquities !== false;
  const showFixedIncome = opts.includeFixedIncome !== false;
  const showDescriptions = opts.includeDescriptions !== false;
  const orientation: 'portrait' | 'landscape' = opts.orientation === 'landscape' ? 'landscape' : 'portrait';

  const equities = showEquities
    ? data.holdings.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType) && h.targetPrice)
    : [];
  const fixedIncome = showFixedIncome
    ? data.holdings.filter(h => h.assetType === 'FIXED_INCOME')
    : [];
  // "Descriptions des titres" — every position with a value (remplace l'ancienne
  // section Liquidités & autres).
  const descriptionHoldings = showDescriptions
    ? data.holdings.filter(h => Math.abs(h.marketValue) > 0)
    : [];

  const logos: Record<string, string> = data.logos ?? {};

  return (
    <Document>
      {showCover && <CoverPage data={data} orientation={orientation} />}

      {data.evolution && (data.evolution.held.length + data.evolution.exited.length + data.evolution.added.length) > 0 && (
        <RecapPage evolution={data.evolution} orientation={orientation} />
      )}

      {equities.length > 0 && (
        <EquityTablePage
          holdings={equities}
          orientation={orientation}
          logos={logos}
          usdCadRate={data.usdCadRate}
        />
      )}

      {fixedIncome.length > 0 && (
        <FixedIncomeTablePage holdings={fixedIncome} orientation={orientation} />
      )}

      {descriptionHoldings.length > 0 && (
        <DescriptionsPage holdings={descriptionHoldings} orientation={orientation} />
      )}
    </Document>
  );
}

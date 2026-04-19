import React from 'react';
import path from 'path';
import {
  Document, Page, Text, View, Image, Font,
  Svg, Defs, LinearGradient, Stop, Rect,
} from '@react-pdf/renderer';
import { styles, C } from './styles';

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo.png');
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');

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
}

export interface PdfRenderOptions {
  includeCover?: boolean;
  includeEquities?: boolean;
  includeFixedIncome?: boolean;
  includeCashOther?: boolean;
  /** Page orientation — defaults to 'portrait'. */
  orientation?: 'portrait' | 'landscape';
}

export interface PriceTargetReportData {
  holdings: PriceTargetHolding[];
  generatedAt: string;
  options?: PdfRenderOptions;
  /** Optional map of symbol → base64 PNG data URI for company logos. */
  logos?: Record<string, string>;
  /** USD/CAD exchange rate applied (if any). Displayed on the PDF. */
  usdCadRate?: number | null;
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

function fmtPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} %`;
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
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
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

  return (
    <Page size="A4" orientation={orientation} style={[styles.page, { backgroundColor: '#f8fafc' }]}>
      {/* White header card */}
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'solid' as const,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <Image src={LOGO_PATH} style={{ width: 110, height: 32, objectFit: 'contain' }} />
          <Text style={{ fontSize: 8.5, color: '#64748b' }}>{dateStr}</Text>
        </View>
        <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 3 }}>
          Analyse des cours cibles
        </Text>
        <View style={{ width: 36, height: 2.5, backgroundColor: C.cyan, borderRadius: 1, marginBottom: 14 }} />
        <Text style={{ fontSize: 8, color: '#64748b', lineHeight: 1.4 }}>
          {s.equityCount > 0 ? `${s.equityCount} actions/FNB` : ''}
          {s.fixedIncomeCount > 0 ? `  |  ${s.fixedIncomeCount} revenus fixes` : ''}
          {s.cashCount > 0 ? `  |  ${s.cashCount} liquidités` : ''}
          {s.pricesFound > 0 ? `  |  ${s.pricesFound} prix temps réel — ${s.targetsFound} cours cibles` : ''}
        </Text>
      </View>

      {/* Projections 12 mois — section title */}
      {hasTargets && (
        <>
          <View style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 3, height: 14, backgroundColor: C.cyan, borderRadius: 1.5 }} />
            <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
              Projections 12 mois
            </Text>
          </View>

          {/* 3 breakdown cards */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {/* Dividendes projetés */}
            <View style={{
              flex: 1, backgroundColor: '#ffffff', borderRadius: 10,
              borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' as const,
              borderLeftWidth: 3, borderLeftColor: C.duoGreen, borderLeftStyle: 'solid' as const,
              padding: 12,
            }}>
              <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
                Dividendes projetés
              </Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Actions (forward)
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Montserrat', fontWeight: 800, color: upColor, marginBottom: 3 }}>
                {fmt(eqDiv)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ backgroundColor: C.upBg, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#065f46' }}>
                    {fmtPct(eqDivYieldPct)}
                  </Text>
                </View>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>yield</Text>
              </View>
            </View>

            {/* Revenus fixes */}
            <View style={{
              flex: 1, backgroundColor: '#ffffff', borderRadius: 10,
              borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' as const,
              borderLeftWidth: 3, borderLeftColor: C.duoBlue, borderLeftStyle: 'solid' as const,
              padding: 12,
            }}>
              <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
                Revenus fixes
              </Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Coupons obligations
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Montserrat', fontWeight: 800, color: upColor, marginBottom: 3 }}>
                {fmt(fiIncome)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ backgroundColor: C.upBg, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#065f46' }}>
                    {fmtPct(fiYieldPct)}
                  </Text>
                </View>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>rendement</Text>
              </View>
            </View>

            {/* Gains en capital */}
            <View style={{
              flex: 1, backgroundColor: '#ffffff', borderRadius: 10,
              borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' as const,
              borderLeftWidth: 3, borderLeftColor: C.duoPurple, borderLeftStyle: 'solid' as const,
              padding: 12,
            }}>
              <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>
                Gain en capital
              </Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Actions (cible 1 an)
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Montserrat', fontWeight: 800, color: eqGain >= 0 ? upColor : downColor, marginBottom: 3 }}>
                {fmt(eqGain)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ backgroundColor: eqGainPct >= 0 ? C.upBg : C.downBg, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: eqGainPct >= 0 ? '#065f46' : '#991b1b' }}>
                    {fmtPct(eqGainPct)}
                  </Text>
                </View>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>vs prix actuel</Text>
              </View>
            </View>
          </View>

          {/* Total + breakdown bar */}
          <PaleGradientBox gradientId="coverTotalGrad" style={{ marginBottom: 14 }}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 6.5, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>
                    Total revenus + gains projetés 12 mois
                  </Text>
                  <Text style={{ fontSize: 24, fontFamily: 'Montserrat', fontWeight: 800, color: totalEst >= 0 ? '#059669' : '#dc2626' }}>
                    {fmt(totalEst)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' as const }}>
                  <Text style={{ fontSize: 6.5, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>
                    Rendement total
                  </Text>
                  <View style={{ backgroundColor: totalEstPct >= 0 ? '#d1fae5' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Montserrat', fontWeight: 800, color: totalEstPct >= 0 ? '#047857' : '#b91c1c' }}>
                      {fmtPct(totalEstPct)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Breakdown bar */}
              {partsSum > 0 && (
                <>
                  <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' as const, marginBottom: 8, backgroundColor: '#ffffff' }}>
                    {pctDiv > 0 && <View style={{ width: `${pctDiv}%`, backgroundColor: C.duoGreen }} />}
                    {pctFi > 0 && <View style={{ width: `${pctFi}%`, backgroundColor: C.duoBlue }} />}
                    {pctCap > 0 && <View style={{ width: `${pctCap}%`, backgroundColor: C.duoPurple }} />}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: C.duoGreen }} />
                      <Text style={{ fontSize: 6.5, color: '#475569' }}>Dividendes {pctDiv.toFixed(0)} %</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: C.duoBlue }} />
                      <Text style={{ fontSize: 6.5, color: '#475569' }}>Revenus fixes {pctFi.toFixed(0)} %</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: C.duoPurple }} />
                      <Text style={{ fontSize: 6.5, color: '#475569' }}>Gain capital {pctCap.toFixed(0)} %</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </PaleGradientBox>
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

function EquityTablePage({ holdings, orientation, logos, usdCadRate }: {
  holdings: PriceTargetHolding[];
  orientation: 'portrait' | 'landscape';
  logos: Record<string, string>;
  usdCadRate?: number | null;
}) {
  const totalMv = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalGain = holdings.reduce((s, h) => {
    if (h.targetPrice && (h.currentPrice || h.marketPrice) > 0)
      return s + h.quantity * (h.targetPrice - (h.currentPrice || h.marketPrice));
    return s;
  }, 0);
  const totalDiv = holdings.reduce((s, h) => s + (h.forwardDividend || 0), 0);
  const totalTarget = holdings.reduce((s, h) => h.targetPrice ? s + h.quantity * h.targetPrice : s + h.marketValue, 0);
  const totalPct = totalMv > 0 ? (totalGain / totalMv) * 100 : 0;
  const divYieldPct = totalMv > 0 ? (totalDiv / totalMv) * 100 : 0;
  const projection12m = totalDiv + totalGain;
  const projectionPct = totalMv > 0 ? (projection12m / totalMv) * 100 : 0;
  const gc = (v: number) => v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#94a3b8';

  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.navy, borderBottomStyle: 'solid' as const }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Cours cibles des analystes</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Marché: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalMv)}</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Cible: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalTarget)}</Text></Text>
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
              <Text style={{ fontSize: 5, color: '#64748b', fontFamily: 'Open Sans', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 1 }}>Dividendes</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: '#0891b2' }}>{fmt(totalDiv)}</Text>
              <Text style={{ fontSize: 5, color: '#94a3b8' }}>{divYieldPct.toFixed(2)} % yield</Text>
            </View>
            <Text style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'Montserrat', fontWeight: 700 }}>+</Text>
            {/* Gain capital */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 5, color: '#64748b', fontFamily: 'Open Sans', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 1 }}>Gain capital</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: totalGain >= 0 ? '#059669' : '#dc2626' }}>{fmt(totalGain)}</Text>
              <Text style={{ fontSize: 5, color: '#94a3b8' }}>{fmtPct(totalPct)} vs actuel</Text>
            </View>
            <Text style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'Montserrat', fontWeight: 700 }}>=</Text>
            {/* Total */}
            <View style={{
              flex: 1.2, backgroundColor: C.navy, borderRadius: 6, padding: 6,
            }}>
              <Text style={{ fontSize: 5, color: '#94a3b8', fontFamily: 'Open Sans', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 1 }}>Total 12 mois</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>{fmt(projection12m)}</Text>
            </View>
            {/* Rendement pill */}
            <View style={{
              backgroundColor: projectionPct >= 0 ? '#059669' : '#dc2626',
              paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
            }}>
              <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
                {fmtPct(projectionPct)}
              </Text>
            </View>
            {/* Mini breakdown bar */}
            {projection12m > 0 && (
              <View style={{ width: 40 }}>
                <View style={{ flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden' as const, backgroundColor: '#e2e8f0' }}>
                  {divPct > 0 && <View style={{ width: `${divPct}%`, backgroundColor: '#0891b2' }} />}
                  {gainPct > 0 && <View style={{ width: `${gainPct}%`, backgroundColor: '#10b981' }} />}
                </View>
                <Text style={{ fontSize: 4.5, color: '#94a3b8', marginTop: 1 }}>
                  Div {divPct.toFixed(0)}% · Cap {gainPct.toFixed(0)}%
                </Text>
              </View>
            )}
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

      <View style={[styles.tablePremium, { width: '96%', marginHorizontal: 'auto' }]}>
        <View style={styles.thPremium}>
          <Text style={[styles.thCellPremium, { width: '5%' }]}>Cpte</Text>
          <Text style={[styles.thCellPremium, { width: '9%' }]}>Symbole</Text>
          <Text style={[styles.thCellPremium, { width: '16%' }]}>Description</Text>
          <Text style={[styles.thCellPremium, { width: '5%', textAlign: 'right' }]}>Qté</Text>
          <Text style={[styles.thCellPremium, { width: '7%', textAlign: 'right' }]}>PBR</Text>
          <Text style={[styles.thCellPremium, { width: '8%', textAlign: 'right' }]}>Prix</Text>
          <Text style={[styles.thCellPremium, { width: '10%', textAlign: 'right' }]}>Marché</Text>
          <Text style={[styles.thCellPremium, { width: '8%', textAlign: 'right' }]}>Cible</Text>
          <Text style={[styles.thCellPremium, { width: '9%', textAlign: 'right' }]}>% espéré</Text>
          <Text style={[styles.thCellPremium, { width: '12%', textAlign: 'right' }]}>$ espéré</Text>
          <Text style={[styles.thCellPremium, { width: '11%', textAlign: 'right' }]}>Div.</Text>
        </View>

        {holdings.map((h, i) => {
          const row = getRowStyle(i, holdings.length);
          const gp = h.gainPct ?? 0;
          const cp = h.currentPrice || h.marketPrice;
          const gd = h.targetPrice && cp > 0 ? h.quantity * (h.targetPrice - cp) : 0;
          const div = h.forwardDividend || 0;
          const dotColor = getAssetColor(h.assetType);
          const logoSrc = logos[h.symbol];

          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 8,
              backgroundColor: row.bg,
              borderBottomWidth: row.borderBottomWidth,
              borderBottomColor: row.borderBottomColor,
              borderBottomStyle: 'solid' as const,
              alignItems: 'center',
            }} wrap={false}>
              <Text style={[styles.td, { width: '5%', fontSize: 6.5, color: '#94a3b8' }]}>{h.accountLabel}</Text>
              {/* Symbol with company logo (falls back to category dot) */}
              <View style={{ width: '9%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
                {logoSrc ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image
                    src={logoSrc}
                    style={{ width: 10, height: 10, borderRadius: 2, marginRight: 4, objectFit: 'contain' as const }}
                  />
                ) : (
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: dotColor, marginRight: 4 }} />
                )}
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{h.symbol}</Text>
              </View>
              <Text style={[styles.td, { width: '16%', fontSize: 7.5 }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '5%', textAlign: 'right' }]}>{h.quantity.toLocaleString('fr-CA')}</Text>
              <Text style={[styles.td, { width: '7%', textAlign: 'right', color: '#64748b' }]}>{h.averageCost > 0 ? fmtFull(h.averageCost) : '—'}</Text>
              <Text style={[styles.tdBold, { width: '8%', textAlign: 'right' }]}>{cp > 0 ? fmtFull(cp) : '—'}</Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right' }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.tdBold, { width: '8%', textAlign: 'right', color: C.navy }]}>
                {fmtFull(h.targetPrice!)}
              </Text>
              <Text style={[styles.tdBold, { width: '9%', textAlign: 'right', color: gc(gp) }]}>
                {fmtPct(gp)}
              </Text>
              <Text style={[styles.tdBold, { width: '12%', textAlign: 'right', color: gc(gd) }]}>
                {fmt(gd)}
              </Text>
              <Text style={[styles.tdBold, { width: '11%', textAlign: 'right', color: div > 0 ? '#10b981' : '#94a3b8' }]}>
                {div > 0 ? fmt(div) : '—'}
              </Text>
            </View>
          );
        })}

        {/* Grand total row */}
        <View style={{
          flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8,
          backgroundColor: '#f0f9ff', borderTopWidth: 2, borderTopColor: C.navy, borderTopStyle: 'solid' as const,
          alignItems: 'center',
        }} wrap={false}>
          <Text style={{ width: '5%' }}>{''}</Text>
          <Text style={{ width: '9%' }}>{''}</Text>
          <Text style={{ width: '16%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textTransform: 'uppercase' as const, letterSpacing: 0.8, paddingHorizontal: 4 }}>Total</Text>
          <Text style={{ width: '5%' }}>{''}</Text>
          <Text style={{ width: '7%' }}>{''}</Text>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '10%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalMv)}</Text>
          <Text style={{ width: '8%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalTarget)}</Text>
          <Text style={{ width: '9%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: gc(totalPct), textAlign: 'right', paddingHorizontal: 4 }}>{fmtPct(totalPct)}</Text>
          <Text style={{ width: '12%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: gc(totalGain), textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalGain)}</Text>
          <Text style={{ width: '11%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: totalDiv > 0 ? '#10b981' : C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalDiv)}</Text>
        </View>
      </View>

      {/* Source */}
      <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 6 }}>
        Source : Consensus des analystes via Yahoo Finance. Dividendes : Yahoo forward rate (actuel) × quantité.
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
          <Text style={[styles.thCellPremium, { width: '5%' }]}>Cpte</Text>
          <Text style={[styles.thCellPremium, { width: '8%' }]}>Symbole</Text>
          <Text style={[styles.thCellPremium, { width: '18%' }]}>Description</Text>
          <Text style={[styles.thCellPremium, { width: '8%', textAlign: 'right' }]}>Qté / VN</Text>
          <Text style={[styles.thCellPremium, { width: '7%', textAlign: 'right' }]}>Coupon</Text>
          <Text style={[styles.thCellPremium, { width: '11%', textAlign: 'right' }]}>Échéance</Text>
          <Text style={[styles.thCellPremium, { width: '7%', textAlign: 'right' }]}>Dur. mod.</Text>
          <Text style={[styles.thCellPremium, { width: '10%', textAlign: 'right' }]}>Val. marché</Text>
          <Text style={[styles.thCellPremium, { width: '8%', textAlign: 'right' }]}>Int. cour.</Text>
          <Text style={[styles.thCellPremium, { width: '10%', textAlign: 'right' }]}>Rev. ann.</Text>
          <Text style={[styles.thCellPremium, { width: '8%', textAlign: 'right' }]}>Rend. %</Text>
        </View>

        {holdings.map((h, i) => {
          const row = getRowStyle(i, holdings.length);
          const band = getMaturityBand(h.maturityDate);
          const yieldPct = h.marketValue > 0 ? (h.annualIncome / h.marketValue) * 100 : 0;
          const dotColor = getAssetColor(h.assetType);
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 8,
              backgroundColor: row.bg,
              borderBottomWidth: row.borderBottomWidth,
              borderBottomColor: row.borderBottomColor,
              borderBottomStyle: 'solid' as const,
              alignItems: 'center',
            }} wrap={false}>
              <Text style={[styles.td, { width: '5%', fontSize: 6.5, color: '#94a3b8' }]}>{h.accountLabel}</Text>
              <View style={{ width: '8%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: dotColor, marginRight: 4 }} />
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{h.symbol}</Text>
              </View>
              <Text style={[styles.td, { width: '18%', fontSize: 7.5 }]}>{h.name}</Text>
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
              <Text style={[styles.tdBold, { width: '8%', textAlign: 'right', color: yieldPct > 0 ? '#10b981' : '#94a3b8' }]}>
                {yieldPct > 0 ? `${yieldPct.toFixed(2)} %` : '—'}
              </Text>
            </View>
          );
        })}

        {/* Total row — premium navy-topped */}
        <View style={{
          flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8,
          backgroundColor: '#f0f9ff', borderTopWidth: 2, borderTopColor: C.navy, borderTopStyle: 'solid' as const,
          alignItems: 'center',
        }}>
          <Text style={{ width: '5%' }}>{''}</Text>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '18%', fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy, paddingHorizontal: 4 }}>Total</Text>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '7%' }}>{''}</Text>
          <Text style={{ width: '11%' }}>{''}</Text>
          <Text style={{ width: '7%' }}>{''}</Text>
          <Text style={{ width: '10%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalMv)}</Text>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '10%', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: totalIncome > 0 ? '#10b981' : C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalIncome)}</Text>
          <Text style={{ width: '8%', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 700, color: avgYieldPct > 0 ? '#10b981' : C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{avgYieldPct > 0 ? `${avgYieldPct.toFixed(2)} %` : '—'}</Text>
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

// ─── Cash / Other Table Page ─────────────────────────────────────────────────

function CashTablePage({ holdings, orientation }: {
  holdings: PriceTargetHolding[];
  orientation: 'portrait' | 'landscape';
}) {
  const totalMv = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalIncome = holdings.reduce((s, h) => s + h.annualIncome, 0);

  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.cyan, borderBottomStyle: 'solid' as const }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Liquidités et autres</Text>
        <Text style={{ fontSize: 7.5, color: '#64748b' }}>Total: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalMv)}</Text></Text>
      </View>

      <View style={styles.tablePremium}>
        <View style={styles.thPremium}>
          <Text style={[styles.thCellPremium, { width: '8%' }]}>Cpte</Text>
          <Text style={[styles.thCellPremium, { width: '14%' }]}>Symbole</Text>
          <Text style={[styles.thCellPremium, { width: '33%' }]}>Description</Text>
          <Text style={[styles.thCellPremium, { width: '10%' }]}>Type</Text>
          <Text style={[styles.thCellPremium, { width: '17%', textAlign: 'right' }]}>Valeur</Text>
          <Text style={[styles.thCellPremium, { width: '18%', textAlign: 'right' }]}>Revenu annuel</Text>
        </View>

        {holdings.map((h, i) => {
          const row = getRowStyle(i, holdings.length);
          const typeLabel = h.assetType === 'CASH' ? 'Liquidité' : h.assetType === 'FUND' ? 'Fonds' : 'Autre';
          const dotColor = getAssetColor(h.assetType);
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 8,
              backgroundColor: row.bg,
              borderBottomWidth: row.borderBottomWidth,
              borderBottomColor: row.borderBottomColor,
              borderBottomStyle: 'solid' as const,
              alignItems: 'center',
            }} wrap={false}>
              <Text style={[styles.td, { width: '8%', fontSize: 6.5, color: '#94a3b8' }]}>{h.accountLabel}</Text>
              <View style={{ width: '14%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: dotColor, marginRight: 4 }} />
                <Text style={{ fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{h.symbol}</Text>
              </View>
              <Text style={[styles.td, { width: '33%' }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '10%', color: '#64748b', fontSize: 7.5 }]}>{typeLabel}</Text>
              <Text style={[styles.tdBold, { width: '17%', textAlign: 'right', color: h.marketValue < 0 ? '#ef4444' : C.text }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.td, { width: '18%', textAlign: 'right', color: h.annualIncome > 0 ? '#10b981' : '#94a3b8' }]}>
                {h.annualIncome > 0 ? fmt(h.annualIncome) : '—'}
              </Text>
            </View>
          );
        })}

        {/* Total row — premium navy-topped */}
        <View style={{
          flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8,
          backgroundColor: '#f0f9ff', borderTopWidth: 2, borderTopColor: C.navy, borderTopStyle: 'solid' as const,
          alignItems: 'center',
        }}>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '14%' }}>{''}</Text>
          <Text style={{ width: '33%', fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy, paddingHorizontal: 4 }}>Total</Text>
          <Text style={{ width: '10%' }}>{''}</Text>
          <Text style={{ width: '17%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalMv)}</Text>
          <Text style={{ width: '18%', fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 800, color: totalIncome > 0 ? '#10b981' : C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{totalIncome > 0 ? fmt(totalIncome) : '—'}</Text>
        </View>
      </View>

      <PageFooter />
    </Page>
  );
}

// ─── Main Document ───────────────────────────────────────────────────────────

export function PriceTargetsDocument({ data }: { data: PriceTargetReportData }) {
  const opts = data.options ?? {};
  const showCover = opts.includeCover !== false;
  const showEquities = opts.includeEquities !== false;
  const showFixedIncome = opts.includeFixedIncome !== false;
  const showCashOther = opts.includeCashOther !== false;
  const orientation: 'portrait' | 'landscape' = opts.orientation === 'landscape' ? 'landscape' : 'portrait';

  const equities = showEquities
    ? data.holdings.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType) && h.targetPrice)
    : [];
  const fixedIncome = showFixedIncome
    ? data.holdings.filter(h => h.assetType === 'FIXED_INCOME')
    : [];
  const cashOther = showCashOther
    ? data.holdings.filter(h => ['CASH', 'FUND', 'OTHER'].includes(h.assetType))
    : [];

  const logos: Record<string, string> = data.logos ?? {};

  return (
    <Document>
      {showCover && <CoverPage data={data} orientation={orientation} />}

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

      {cashOther.length > 0 && (
        <CashTablePage holdings={cashOther} orientation={orientation} />
      )}
    </Document>
  );
}

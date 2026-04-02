import React from 'react';
import path from 'path';
import {
  Document, Page, Text, View, Image, Font,
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
}

export interface PriceTargetReportData {
  holdings: PriceTargetHolding[];
  generatedAt: string;
  options?: PdfRenderOptions;
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

// ─── Maturity color scale ────────────────────────────────────────────────────

const MATURITY_BANDS = [
  { maxYears: 1,  label: '< 1 an',  color: C.duoRed,    bg: '#fff0f0' },
  { maxYears: 2,  label: '1–2 ans', color: C.duoOrange,  bg: C.duoOrangePale },
  { maxYears: 3,  label: '2–3 ans', color: C.duoYellow,  bg: '#fff8e1' },
  { maxYears: 5,  label: '3–5 ans', color: C.duoGreen,   bg: C.duoGreenBg },
  { maxYears: Infinity, label: '5+ ans', color: C.duoBlue, bg: C.duoBlueBg },
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

function getMaturityBand(dateStr?: string) {
  const matDate = parseMaturityDate(dateStr);
  if (!matDate) return null;
  const yearsToMat = (matDate.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
  return MATURITY_BANDS.find(b => yearsToMat < b.maxYears) || MATURITY_BANDS[MATURITY_BANDS.length - 1];
}

const ASSET_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  EQUITY:       { label: 'Action',  color: C.duoBlue,   bg: C.duoBlueBg },
  FIXED_INCOME: { label: 'Rev. fixe', color: C.duoOrange, bg: C.duoOrangePale },
  ETF:          { label: 'FNB',     color: C.duoPurple, bg: C.duoPurplePale },
  FUND:         { label: 'Fonds',   color: '#0d9488',   bg: '#f0fdfa' },
  PREFERRED:    { label: 'Priv.',   color: C.duoPurple, bg: C.duoPurplePale },
  CASH:         { label: 'Liquid.', color: C.duoGreen,  bg: C.duoGreenBg },
  OTHER:        { label: 'Autre',   color: C.textSec,   bg: '#f8fafc' },
};

// ─── Page count helper ───────────────────────────────────────────────────────

function countTotalPages(data: PriceTargetReportData): number {
  const opts = data.options ?? {};
  let count = 0;
  if (opts.includeCover !== false) count += 1;
  const eqCount = (opts.includeEquities !== false)
    ? data.holdings.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType)).length
    : 0;
  if (eqCount > 0) count += Math.ceil(eqCount / 22);
  if ((opts.includeFixedIncome !== false) && data.holdings.some(h => h.assetType === 'FIXED_INCOME')) count += 1;
  if ((opts.includeCashOther !== false) && data.holdings.some(h => ['CASH', 'FUND', 'OTHER'].includes(h.assetType))) count += 1;
  return Math.max(count, 1);
}

// ─── Duolingo Pill Badge ─────────────────────────────────────────────────────

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{
      backgroundColor: bg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: color + '30',
      borderStyle: 'solid' as const,
    }}>
      <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function PageFooter({ pageNum, totalPages }: { pageNum: number; totalPages: number }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Analyse des cours cibles</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{
          backgroundColor: C.duoGreenBg,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: C.duoGreenPale,
          borderStyle: 'solid' as const,
        }}>
          <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 700, color: C.duoGreenDark }}>
            {pageNum} / {totalPages}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Duolingo KPI Card ──────────────────────────────────────────────────────

function KpiCard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon?: string }) {
  const bgColor = accent + '14';
  return (
    <View style={{
      flex: 1,
      backgroundColor: bgColor,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: accent + '30',
      borderStyle: 'solid' as const,
      borderBottomWidth: 4,
      borderBottomColor: accent + '40',
      borderBottomStyle: 'solid' as const,
      padding: 14,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        {icon && (
          <Text style={{ fontSize: 11, marginRight: 4 }}>{icon}</Text>
        )}
        <Text style={{
          fontSize: 6.5,
          fontFamily: 'Montserrat',
          fontWeight: 700,
          color: accent,
          textTransform: 'uppercase' as const,
          letterSpacing: 1.2,
        }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: accent, lineHeight: 1.1 }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Section Title Banner ────────────────────────────────────────────────────

function SectionBanner({ title, color, bg, stats }: {
  title: string;
  color: string;
  bg: string;
  stats?: { label: string; value: string }[];
}) {
  return (
    <View style={{
      backgroundColor: bg,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: color + '30',
      borderStyle: 'solid' as const,
      borderBottomWidth: 4,
      borderBottomColor: color + '40',
      borderBottomStyle: 'solid' as const,
      padding: 12,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 800, color }}>
        {title}
      </Text>
      {stats && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {stats.map((s, i) => (
            <View key={i} style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: color + '99', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                {s.label}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color }}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Gain Badge ──────────────────────────────────────────────────────────────

function GainBadge({ value, large }: { value: number; large?: boolean }) {
  const isUp = value >= 0;
  return (
    <View style={{
      backgroundColor: isUp ? C.duoGreen : C.duoRed,
      paddingHorizontal: large ? 16 : 8,
      paddingVertical: large ? 8 : 3,
      borderRadius: large ? 14 : 10,
      borderBottomWidth: large ? 3 : 2,
      borderBottomColor: isUp ? C.duoGreenDark : '#cc0000',
      borderBottomStyle: 'solid' as const,
    }}>
      <Text style={{
        fontSize: large ? 16 : 8,
        fontFamily: 'Montserrat',
        fontWeight: 800,
        color: '#ffffff',
      }}>
        {fmtPct(value)}
      </Text>
    </View>
  );
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function CoverPage({ data, totalPages }: { data: PriceTargetReportData; totalPages: number }) {
  const s = data.summary;
  const date = new Date(data.generatedAt);
  const dateStr = new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);

  const hasTargets = s.totalTargetValue > 0;
  const eqGain = s.equityGain ?? s.totalGain;
  const eqGainPct = s.equityGainPct ?? s.totalGainPct;
  const totalEst = s.totalEstimated ?? s.totalGain;
  const totalEstPct = s.totalEstimatedPct ?? s.totalGainPct;

  return (
    <Page size="A4" style={styles.page}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Image src={LOGO_PATH} style={{ width: 110, height: 32, objectFit: 'contain' }} />
        <View style={{
          backgroundColor: C.duoBlueBg,
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: C.duoBluePale,
          borderStyle: 'solid' as const,
        }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.duoBlue }}>
            {dateStr}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={{ fontSize: 28, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 4 }}>
        Analyse des cours cibles
      </Text>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 24 }}>
        <View style={{ width: 30, height: 4, backgroundColor: C.duoGreen, borderRadius: 2 }} />
        <View style={{ width: 15, height: 4, backgroundColor: C.duoBlue, borderRadius: 2 }} />
        <View style={{ width: 8, height: 4, backgroundColor: C.duoPurple, borderRadius: 2 }} />
      </View>

      {/* Main KPIs */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        <KpiCard label="Valeur marchande" value={fmt(s.totalMarketValue)} accent={C.duoBlue} />
        <KpiCard label="Revenu annuel" value={fmt(s.totalAnnualIncome)} accent={C.duoGreen} />
        {hasTargets && (
          <KpiCard label="Cible 12 mois" value={fmt(s.totalTargetValue)} accent={C.duoPurple} />
        )}
      </View>

      {/* Gains breakdown */}
      {hasTargets && (
        <>
          {/* Category gains row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {/* Equity card */}
            <View style={{
              flex: 1,
              backgroundColor: eqGain >= 0 ? C.duoGreenBg : C.downBg,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: eqGain >= 0 ? C.duoGreenPale : C.downBorder,
              borderStyle: 'solid' as const,
              borderBottomWidth: 4,
              borderBottomColor: eqGain >= 0 ? C.duoGreenDark + '30' : C.duoRed + '30',
              borderBottomStyle: 'solid' as const,
              padding: 12,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 700, color: eqGain >= 0 ? C.duoGreenDark : C.duoRed }}>
                  Actions — gain en capital
                </Text>
                <GainBadge value={eqGainPct} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: eqGain >= 0 ? C.duoGreen : C.duoRed }}>
                {fmt(eqGain)}
              </Text>
            </View>

            {/* Fixed income card */}
            <View style={{
              flex: 1,
              backgroundColor: C.duoOrangePale,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: C.duoOrange + '30',
              borderStyle: 'solid' as const,
              borderBottomWidth: 4,
              borderBottomColor: C.duoOrange + '40',
              borderBottomStyle: 'solid' as const,
              padding: 12,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 700, color: '#c47600' }}>
                  Revenus fixes — revenu annuel
                </Text>
                <GainBadge value={s.fixedIncomeGainPct ?? 0} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.duoOrange }}>
                {fmt(s.fixedIncomeAnnualIncome ?? 0)}
              </Text>
            </View>
          </View>

          {/* Total banner — Duolingo style big button */}
          <View style={{
            backgroundColor: C.duoGreen,
            borderRadius: 16,
            borderBottomWidth: 5,
            borderBottomColor: C.duoGreenDark,
            borderBottomStyle: 'solid' as const,
            padding: 18,
            marginBottom: 20,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <View>
              <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: '#ffffff99', textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 4 }}>
                Total estimé sur 12 mois
              </Text>
              <Text style={{ fontSize: 26, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
                {fmt(totalEst)}
              </Text>
            </View>
            <View style={{
              backgroundColor: '#ffffff',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 14,
              borderBottomWidth: 3,
              borderBottomColor: '#e0e0e0',
              borderBottomStyle: 'solid' as const,
            }}>
              <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: totalEstPct >= 0 ? C.duoGreen : C.duoRed }}>
                {fmtPct(totalEstPct)}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Position count pills */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {s.equityCount > 0 && (
          <Pill label={`${s.equityCount} action${s.equityCount > 1 ? 's' : ''} / FNB`} color={C.duoBlue} bg={C.duoBlueBg} />
        )}
        {s.fixedIncomeCount > 0 && (
          <Pill label={`${s.fixedIncomeCount} revenu${s.fixedIncomeCount > 1 ? 's' : ''} fixe${s.fixedIncomeCount > 1 ? 's' : ''}`} color={C.duoOrange} bg={C.duoOrangePale} />
        )}
        {s.cashCount > 0 && (
          <Pill label={`${s.cashCount} liquidité${s.cashCount > 1 ? 's' : ''}`} color={C.duoGreen} bg={C.duoGreenBg} />
        )}
        {s.pricesFound > 0 && (
          <Pill label={`${s.pricesFound} prix — ${s.targetsFound} cibles`} color={C.duoPurple} bg={C.duoPurplePale} />
        )}
      </View>

      {/* Disclaimer */}
      <View style={{ marginTop: 'auto' as const, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', borderTopStyle: 'solid' as const }}>
        <Text style={{ fontSize: 7, color: C.textTer, lineHeight: 1.5 }}>
          Les cours cibles proviennent du consensus des analystes (Yahoo Finance). Pour les titres sans couverture,
          une estimation basée sur le rendement historique 12 mois est utilisée. Ce document est fourni à titre
          informatif et ne constitue pas un conseil en placement.
        </Text>
      </View>

      <PageFooter pageNum={1} totalPages={totalPages} />
    </Page>
  );
}

// ─── Progress Bar (prix actuel → cible) ─────────────────────────────────────

function TargetProgressBar({ current, target }: { current: number; target: number }) {
  if (!target || !current || current <= 0) return null;
  const isUp = target >= current;
  // Clamp progress between 5% and 95% for visual clarity
  const raw = current / target;
  const pct = Math.max(0.08, Math.min(0.95, raw));
  const barColor = isUp ? C.duoGreen : C.duoRed;
  const trackColor = isUp ? C.duoGreenBg : C.downBg;

  return (
    <View style={{ width: '100%', marginTop: 2 }}>
      <View style={{
        height: 4,
        backgroundColor: trackColor,
        borderRadius: 2,
        overflow: 'hidden' as const,
      }}>
        <View style={{
          height: '100%',
          width: `${Math.round(pct * 100)}%`,
          backgroundColor: barColor,
          borderRadius: 2,
        }} />
      </View>
    </View>
  );
}

// ─── Equity Table Page ───────────────────────────────────────────────────────

function EquityTablePage({ holdings, pageNum, totalPages, subtitle }: {
  holdings: PriceTargetHolding[];
  pageNum: number;
  totalPages: number;
  subtitle: string;
}) {
  const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalGainDollar = holdings.reduce((s, h) => {
    if (h.targetPrice && (h.currentPrice || h.marketPrice) > 0) {
      return s + h.quantity * (h.targetPrice - (h.currentPrice || h.marketPrice));
    }
    return s;
  }, 0);
  const totalTargetValue = holdings.reduce((s, h) => {
    if (h.targetPrice) return s + h.quantity * h.targetPrice;
    return s + h.marketValue;
  }, 0);

  const thColor = '#1a7ad4';

  return (
    <Page size="A4" style={styles.page}>
      <SectionBanner
        title={subtitle}
        color={C.duoBlue}
        bg={C.duoBlueBg}
        stats={[
          { label: 'Val. marché', value: fmt(totalMarketValue) },
          { label: 'Val. cible', value: fmt(totalTargetValue) },
          ...(totalGainDollar !== 0 ? [{ label: 'Gain cible', value: fmt(totalGainDollar) }] : []),
        ]}
      />

      {/* Table */}
      <View style={[styles.table, { borderColor: C.duoBlue + '25' }]}>
        {/* Header */}
        <View style={[styles.th, { backgroundColor: C.duoBlueBg, borderBottomColor: C.duoBluePale }]}>
          <Text style={[styles.thCell, { width: '5%', color: thColor }]}>Cpte</Text>
          <Text style={[styles.thCell, { width: '8%', color: thColor }]}>Symbole</Text>
          <Text style={[styles.thCell, { width: '18%', color: thColor }]}>Description</Text>
          <Text style={[styles.thCell, { width: '7%', textAlign: 'right', color: thColor }]}>Qté</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right', color: thColor }]}>Prix actuel</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right', color: thColor }]}>Val. marché</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right', color: thColor }]}>Cible 1Y</Text>
          <Text style={[styles.thCell, { width: '14%', textAlign: 'center', color: thColor }]}>Progression</Text>
          <Text style={[styles.thCell, { width: '8%', textAlign: 'right', color: thColor }]}>Gain %</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right', color: thColor }]}>Gain $</Text>
        </View>

        {/* Rows */}
        {holdings.map((h, i) => {
          const rowBg = i % 2 === 1 ? '#f8fbff' : '#ffffff';
          const gainPct = h.gainPct ?? 0;
          const gainColor = gainPct > 0 ? C.duoGreen : gainPct < 0 ? C.duoRed : C.textTer;
          const currentP = h.currentPrice || h.marketPrice;
          const gainDollar = h.targetPrice && currentP > 0
            ? h.quantity * (h.targetPrice - currentP)
            : 0;
          const typeInfo = ASSET_TYPE_LABELS[h.assetType] || ASSET_TYPE_LABELS.EQUITY;

          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row',
              paddingVertical: 5,
              paddingHorizontal: 8,
              backgroundColor: rowBg,
              borderBottomWidth: 1,
              borderBottomColor: '#eef2f7',
              borderBottomStyle: 'solid' as const,
              alignItems: 'center',
            }} wrap={false}>
              {/* Account */}
              <Text style={[styles.td, { width: '5%', fontSize: 6.5, color: C.textTer }]}>{h.accountLabel}</Text>

              {/* Symbol badge */}
              <View style={{ width: '8%', paddingHorizontal: 2 }}>
                <View style={{
                  backgroundColor: typeInfo.bg,
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: typeInfo.color + '25',
                  borderStyle: 'solid' as const,
                  alignSelf: 'flex-start',
                }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 700, color: typeInfo.color }}>
                    {h.symbol.replace('.TO', '').replace('.V', '')}
                  </Text>
                </View>
              </View>

              {/* Name */}
              <Text style={[styles.td, { width: '18%', fontSize: 7.5 }]}>
                {h.name}
              </Text>

              {/* Qty */}
              <Text style={[styles.td, { width: '7%', textAlign: 'right', fontSize: 8 }]}>
                {h.quantity.toLocaleString('fr-CA')}
              </Text>

              {/* Current price */}
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right', fontSize: 8 }]}>
                {currentP > 0 ? fmtFull(currentP) : '—'}
              </Text>

              {/* Market value */}
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right', fontSize: 8 }]}>
                {fmt(h.marketValue)}
              </Text>

              {/* Target 1Y — prominent purple */}
              <View style={{ width: '10%', flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 4 }}>
                {h.targetPrice ? (
                  <View style={{
                    backgroundColor: C.duoPurplePale,
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: C.duoPurple + '30',
                    borderStyle: 'solid' as const,
                  }}>
                    <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: C.duoPurple }}>
                      {fmtFull(h.targetPrice)}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 8, color: C.textTer }}>—</Text>
                )}
              </View>

              {/* Progress bar */}
              <View style={{ width: '14%', paddingHorizontal: 4, justifyContent: 'center' }}>
                {h.targetPrice && currentP > 0 ? (
                  <TargetProgressBar current={currentP} target={h.targetPrice} />
                ) : (
                  <View style={{ height: 4, backgroundColor: '#f1f5f9', borderRadius: 2 }} />
                )}
              </View>

              {/* Gain % pill */}
              <View style={{ width: '8%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 2 }}>
                {h.targetPrice ? (
                  <View style={{
                    backgroundColor: gainPct >= 0 ? C.duoGreenBg : C.downBg,
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                    borderRadius: 8,
                  }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 700, color: gainColor }}>
                      {fmtPct(gainPct)}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 8, color: C.textTer }}>—</Text>
                )}
              </View>

              {/* Gain $ */}
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right', fontSize: 8, color: gainColor }]}>
                {h.targetPrice ? fmt(gainDollar) : '—'}
              </Text>
            </View>
          );
        })}

        {/* ── Total footer row ── */}
        <View style={{
          flexDirection: 'row',
          paddingVertical: 8,
          paddingHorizontal: 8,
          backgroundColor: C.duoBlueBg,
          borderTopWidth: 2,
          borderTopColor: C.duoBluePale,
          borderTopStyle: 'solid' as const,
          alignItems: 'center',
        }}>
          <Text style={{ width: '5%' }}>{''}</Text>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '18%', fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: C.duoBlue, paddingHorizontal: 4 }}>
            Total
          </Text>
          <Text style={{ width: '7%' }}>{''}</Text>
          <Text style={{ width: '10%' }}>{''}</Text>
          <Text style={{ width: '10%', fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, textAlign: 'right', paddingHorizontal: 4 }}>
            {fmt(totalMarketValue)}
          </Text>
          <Text style={{ width: '10%', fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: C.duoPurple, textAlign: 'right', paddingHorizontal: 4 }}>
            {fmt(totalTargetValue)}
          </Text>
          <Text style={{ width: '14%' }}>{''}</Text>
          <View style={{ width: '8%', flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 2 }}>
            {totalMarketValue > 0 && (
              <View style={{
                backgroundColor: totalGainDollar >= 0 ? C.duoGreen : C.duoRed,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 8,
                borderBottomWidth: 2,
                borderBottomColor: totalGainDollar >= 0 ? C.duoGreenDark : '#cc0000',
                borderBottomStyle: 'solid' as const,
              }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
                  {fmtPct(totalMarketValue > 0 ? (totalGainDollar / totalMarketValue) * 100 : 0)}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ width: '10%', fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: totalGainDollar >= 0 ? C.duoGreen : C.duoRed, textAlign: 'right', paddingHorizontal: 4 }}>
            {fmt(totalGainDollar)}
          </Text>
        </View>
      </View>

      <PageFooter pageNum={pageNum} totalPages={totalPages} />
    </Page>
  );
}

// ─── Fixed Income Table Page ─────────────────────────────────────────────────

function FixedIncomeTablePage({ holdings, pageNum, totalPages }: {
  holdings: PriceTargetHolding[];
  pageNum: number;
  totalPages: number;
}) {
  const totalMv = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalIncome = holdings.reduce((s, h) => s + h.annualIncome, 0);
  const totalValDur = holdings.reduce((s, h) => s + (h.modifiedDuration ? h.marketValue : 0), 0);
  const weightedDur = holdings.reduce((s, h) => s + (h.modifiedDuration || 0) * h.marketValue, 0);
  const avgDur = totalValDur > 0 ? (weightedDur / totalValDur).toFixed(2) : '—';

  return (
    <Page size="A4" style={styles.page}>
      <SectionBanner
        title="Revenus fixes"
        color="#c47600"
        bg={C.duoOrangePale}
        stats={[
          { label: 'Valeur', value: fmt(totalMv) },
          { label: 'Revenu', value: fmt(totalIncome) },
          { label: 'Durée moy.', value: String(avgDur) },
        ]}
      />

      {/* Maturity legend pills */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <Text style={{ fontSize: 7, color: C.textSec, fontFamily: 'Montserrat', fontWeight: 700, marginRight: 2 }}>
          Échéance :
        </Text>
        {MATURITY_BANDS.map((band) => (
          <View key={band.label} style={{
            flexDirection: 'row', alignItems: 'center', gap: 3,
            backgroundColor: band.bg,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: band.color }} />
            <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: band.color }}>{band.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.table, { borderColor: C.duoOrange + '25' }]}>
        <View style={[styles.th, { backgroundColor: C.duoOrangePale, borderBottomColor: C.duoOrange + '30' }]}>
          <Text style={[styles.thCell, { width: '6%', color: '#c47600' }]}>Cpte</Text>
          <Text style={[styles.thCell, { width: '8%', color: '#c47600' }]}>Symbole</Text>
          <Text style={[styles.thCell, { width: '22%', color: '#c47600' }]}>Description</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right', color: '#c47600' }]}>Qté / VN</Text>
          <Text style={[styles.thCell, { width: '8%', textAlign: 'right', color: '#c47600' }]}>Coupon</Text>
          <Text style={[styles.thCell, { width: '12%', textAlign: 'right', color: '#c47600' }]}>Échéance</Text>
          <Text style={[styles.thCell, { width: '7%', textAlign: 'right', color: '#c47600' }]}>Dur. mod.</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right', color: '#c47600' }]}>Val. marché</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right', color: '#c47600' }]}>Int. cour.</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right', color: '#c47600' }]}>Rev. ann.</Text>
        </View>

        {holdings.map((h, i) => {
          const rowBg = i % 2 === 1 ? '#fffcf5' : '#ffffff';
          const band = getMaturityBand(h.maturityDate);
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row',
              paddingVertical: 5,
              paddingHorizontal: 8,
              backgroundColor: rowBg,
              borderBottomWidth: 1,
              borderBottomColor: '#f5f0e8',
              borderBottomStyle: 'solid' as const,
            }} wrap={false}>
              <Text style={[styles.td, { width: '6%', fontSize: 7, color: C.textTer }]}>{h.accountLabel}</Text>
              <View style={{ width: '8%', paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 700, color: C.duoOrange }}>{h.symbol}</Text>
              </View>
              <Text style={[styles.td, { width: '22%', fontSize: 7.5 }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right' }]}>{h.quantity.toLocaleString('fr-CA')}</Text>
              <View style={{ width: '8%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 4 }}>
                {h.couponRate ? (
                  <View style={{
                    backgroundColor: C.duoOrangePale,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    borderRadius: 6,
                  }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.duoOrange }}>
                      {h.couponRate.toFixed(2)}%
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 8, color: C.textTer }}>—</Text>
                )}
              </View>
              <View style={{ width: '12%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4 }}>
                {band && (
                  <View style={{
                    backgroundColor: band.bg,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: band.color }} />
                    <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: band.color }}>
                      {h.maturityDate || '—'}
                    </Text>
                  </View>
                )}
                {!band && (
                  <Text style={{ fontSize: 7.5, color: C.textTer }}>
                    {h.maturityDate || '—'}
                  </Text>
                )}
              </View>
              <Text style={[styles.td, { width: '7%', textAlign: 'right' }]}>
                {h.modifiedDuration ? h.modifiedDuration.toFixed(2) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right' }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right', color: C.textTer }]}>
                {h.accruedInterest ? fmtFull(h.accruedInterest) : '—'}
              </Text>
              <View style={{ width: '9%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 2 }}>
                {h.annualIncome > 0 ? (
                  <View style={{
                    backgroundColor: C.duoGreenBg,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    borderRadius: 6,
                  }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.duoGreen }}>
                      {fmt(h.annualIncome)}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 8, color: C.textTer }}>—</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <PageFooter pageNum={pageNum} totalPages={totalPages} />
    </Page>
  );
}

// ─── Cash / Other Table Page ─────────────────────────────────────────────────

function CashTablePage({ holdings, pageNum, totalPages }: {
  holdings: PriceTargetHolding[];
  pageNum: number;
  totalPages: number;
}) {
  const totalMv = holdings.reduce((s, h) => s + h.marketValue, 0);

  return (
    <Page size="A4" style={styles.page}>
      <SectionBanner
        title="Liquidités et autres"
        color={C.duoGreenDark}
        bg={C.duoGreenBg}
        stats={[{ label: 'Total', value: fmt(totalMv) }]}
      />

      <View style={[styles.table, { borderColor: C.duoGreen + '25' }]}>
        <View style={[styles.th, { backgroundColor: C.duoGreenBg, borderBottomColor: C.duoGreenPale }]}>
          <Text style={[styles.thCell, { width: '8%', color: C.duoGreenDark }]}>Cpte</Text>
          <Text style={[styles.thCell, { width: '12%', color: C.duoGreenDark }]}>Symbole</Text>
          <Text style={[styles.thCell, { width: '33%', color: C.duoGreenDark }]}>Description</Text>
          <Text style={[styles.thCell, { width: '12%', color: C.duoGreenDark }]}>Type</Text>
          <Text style={[styles.thCell, { width: '17%', textAlign: 'right', color: C.duoGreenDark }]}>Valeur</Text>
          <Text style={[styles.thCell, { width: '18%', textAlign: 'right', color: C.duoGreenDark }]}>Revenu annuel</Text>
        </View>

        {holdings.map((h, i) => {
          const rowBg = i % 2 === 1 ? '#f8fcf5' : '#ffffff';
          const typeInfo = ASSET_TYPE_LABELS[h.assetType] || ASSET_TYPE_LABELS.OTHER;
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row',
              paddingVertical: 5,
              paddingHorizontal: 8,
              backgroundColor: rowBg,
              borderBottomWidth: 1,
              borderBottomColor: '#f0f5ea',
              borderBottomStyle: 'solid' as const,
            }} wrap={false}>
              <Text style={[styles.td, { width: '8%', fontSize: 7, color: C.textTer }]}>{h.accountLabel}</Text>
              <View style={{ width: '12%', paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 700, color: typeInfo.color }}>{h.symbol}</Text>
              </View>
              <Text style={[styles.td, { width: '33%' }]}>{h.name}</Text>
              <View style={{ width: '12%', paddingHorizontal: 4 }}>
                <View style={{
                  backgroundColor: typeInfo.bg,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 8,
                  alignSelf: 'flex-start',
                }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: typeInfo.color }}>
                    {typeInfo.label}
                  </Text>
                </View>
              </View>
              <Text style={[styles.tdBold, { width: '17%', textAlign: 'right', color: h.marketValue < 0 ? C.duoRed : C.text }]}>
                {fmt(h.marketValue)}
              </Text>
              <View style={{ width: '18%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 2 }}>
                {h.annualIncome > 0 ? (
                  <View style={{
                    backgroundColor: C.duoGreenBg,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 8,
                  }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.duoGreen }}>
                      {fmt(h.annualIncome)}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 8, color: C.textTer }}>—</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <PageFooter pageNum={pageNum} totalPages={totalPages} />
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

  const totalPages = countTotalPages(data);

  const equities = showEquities
    ? data.holdings.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType))
    : [];
  const fixedIncome = showFixedIncome
    ? data.holdings.filter(h => h.assetType === 'FIXED_INCOME')
    : [];
  const cashOther = showCashOther
    ? data.holdings.filter(h => ['CASH', 'FUND', 'OTHER'].includes(h.assetType))
    : [];

  const ROWS_PER_PAGE = 22;
  const equityPages: PriceTargetHolding[][] = [];
  for (let i = 0; i < equities.length; i += ROWS_PER_PAGE) {
    equityPages.push(equities.slice(i, i + ROWS_PER_PAGE));
  }

  let pageNum = showCover ? 1 : 0;

  return (
    <Document>
      {showCover && <CoverPage data={data} totalPages={totalPages} />}

      {equityPages.map((pageHoldings, idx) => {
        pageNum++;
        const subtitle = equityPages.length > 1
          ? `Actions, FNB et privilégiées (${idx + 1}/${equityPages.length})`
          : 'Actions, FNB et privilégiées';
        return (
          <EquityTablePage
            key={`eq-${idx}`}
            holdings={pageHoldings}
            pageNum={pageNum}
            totalPages={totalPages}
            subtitle={subtitle}
          />
        );
      })}

      {fixedIncome.length > 0 && (
        <FixedIncomeTablePage holdings={fixedIncome} pageNum={++pageNum} totalPages={totalPages} />
      )}

      {cashOther.length > 0 && (
        <CashTablePage holdings={cashOther} pageNum={++pageNum} totalPages={totalPages} />
      )}
    </Document>
  );
}

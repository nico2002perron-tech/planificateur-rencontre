import React from 'react';
import path from 'path';
import {
  Document, Page, Text, View, Image, Font,
  Svg, Circle, Rect, Defs, LinearGradient, Stop,
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
  // Target data (for equities/ETFs)
  currentPrice?: number;
  targetPrice?: number;
  gainPct?: number;
  targetSource?: string;
  // Fixed income
  couponRate?: number;
  maturityDate?: string;
  modifiedDuration?: number;
  accruedInterest?: number;
}

export interface PriceTargetReportData {
  holdings: PriceTargetHolding[];
  generatedAt: string;
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
  { maxYears: 1,  label: '< 1 an',   color: '#dc2626', bg: '#fef2f2' },  // red
  { maxYears: 2,  label: '1–2 ans',  color: '#ea580c', bg: '#fff7ed' },  // orange
  { maxYears: 3,  label: '2–3 ans',  color: '#d97706', bg: '#fffbeb' },  // amber
  { maxYears: 5,  label: '3–5 ans',  color: '#16a34a', bg: '#f0fdf4' },  // green
  { maxYears: Infinity, label: '5+ ans', color: '#2563eb', bg: '#eff6ff' }, // blue
] as const;

const MONTH_PARSE: Record<string, number> = {
  jan: 0, fév: 1, mar: 2, avr: 3, mai: 4, jun: 5,
  jul: 6, aoû: 7, sep: 8, oct: 9, nov: 10, déc: 11,
};

function parseMaturityDate(dateStr?: string): Date | null {
  if (!dateStr) return null;

  // ISO: "2028-06-01"
  const iso = dateStr.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // French: "16 sep 2026"
  const fr = dateStr.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (fr) {
    const month = MONTH_PARSE[fr[2].toLowerCase()];
    if (month !== undefined) return new Date(+fr[3], month, +fr[1]);
  }

  // Year only: "2034"
  const yr = dateStr.match(/^(20\d{2})$/);
  if (yr) return new Date(+yr[1], 6, 1); // mid-year estimate

  return null;
}

function getMaturityBand(dateStr?: string) {
  const matDate = parseMaturityDate(dateStr);
  if (!matDate) return null;
  const yearsToMat = (matDate.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
  return MATURITY_BANDS.find(b => yearsToMat < b.maxYears) || MATURITY_BANDS[MATURITY_BANDS.length - 1];
}

const ASSET_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  EQUITY: { label: 'Action', color: C.blue },
  FIXED_INCOME: { label: 'Rev. fixe', color: C.gold },
  ETF: { label: 'FNB', color: '#7c3aed' },
  FUND: { label: 'Fonds', color: '#0d9488' },
  PREFERRED: { label: 'Priv.', color: '#4f46e5' },
  CASH: { label: 'Liquid.', color: C.up },
  OTHER: { label: 'Autre', color: C.textTer },
};

// ─── Cover decorations ───────────────────────────────────────────────────────

function CoverDecorations() {
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <Defs>
        <LinearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={C.cyan} stopOpacity="0.08" />
          <Stop offset="100%" stopColor={C.blue} stopOpacity="0.04" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="595" height="842" fill="url(#grad1)" />
      <Circle cx="520" cy="80" r="120" fill={C.cyan} opacity="0.06" />
      <Circle cx="75" cy="760" r="90" fill={C.blue} opacity="0.05" />
      <Circle cx="400" cy="700" r="60" fill={C.navy} opacity="0.03" />
    </Svg>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function PageFooter({ pageNum, totalPages }: { pageNum: number; totalPages: number }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Cours cibles — Analyse rapide</Text>
      <Text style={styles.footerText}>
        Page {pageNum} / {totalPages}
      </Text>
    </View>
  );
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function CoverPage({ data }: { data: PriceTargetReportData }) {
  const s = data.summary;
  const date = new Date(data.generatedAt);
  const dateStr = new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);

  return (
    <Page size="A4" style={[styles.page, { padding: 0 }]}>
      <CoverDecorations />

      <View style={{ padding: 50, paddingTop: 60, flex: 1 }}>
        {/* Logo */}
        <View style={{ marginBottom: 50 }}>
          <Image src={LOGO_PATH} style={{ width: 140, height: 40, objectFit: 'contain' }} />
        </View>

        {/* Title */}
        <View style={{ marginBottom: 40 }}>
          <Text style={{ fontSize: 32, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 8 }}>
            Cours cibles
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan }}>
            Analyse rapide du portefeuille
          </Text>
          <View style={{ width: 60, height: 3, backgroundColor: C.cyan, borderRadius: 2, marginTop: 16 }} />
        </View>

        {/* Date */}
        <Text style={{ fontSize: 11, color: C.textSec, marginBottom: 40 }}>
          {dateStr}
        </Text>

        {/* Summary KPIs */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 30 }}>
          <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: C.cyan, borderLeftStyle: 'solid' as const }]}>
            <Text style={styles.kpiLabel}>Valeur marchande</Text>
            <Text style={[styles.kpiValue, { fontSize: 20 }]}>{fmt(s.totalMarketValue)}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: C.up, borderLeftStyle: 'solid' as const }]}>
            <Text style={styles.kpiLabel}>Revenu annuel</Text>
            <Text style={[styles.kpiValue, { fontSize: 20, color: C.up }]}>{fmt(s.totalAnnualIncome)}</Text>
          </View>
        </View>

        {s.totalTargetValue > 0 && (
          <>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: C.blue, borderLeftStyle: 'solid' as const }]}>
                <Text style={styles.kpiLabel}>Valeur cible 12 mois</Text>
                <Text style={[styles.kpiValue, { fontSize: 20, color: C.blue }]}>{fmt(s.totalTargetValue)}</Text>
              </View>
            </View>

            {/* Gains breakdown heading */}
            <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Gains estimés par catégorie
            </Text>

            {/* Actions + Revenus fixes side by side */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              {/* Actions */}
              <View style={[styles.statCard, { flex: 1, borderLeftWidth: 3, borderLeftColor: C.up, borderLeftStyle: 'solid' as const }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.kpiLabel, { fontSize: 7.5, marginBottom: 0 }]}>Actions (gain en capital)</Text>
                  <View style={{ backgroundColor: (s.equityGainPct ?? s.totalGainPct) >= 0 ? '#dcfce7' : '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: (s.equityGainPct ?? s.totalGainPct) >= 0 ? C.up : C.down }}>
                      {fmtPct(s.equityGainPct ?? s.totalGainPct)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.kpiValue, { fontSize: 18, color: (s.equityGain ?? s.totalGain) >= 0 ? C.up : C.down }]}>
                  {fmt(s.equityGain ?? s.totalGain)}
                </Text>
              </View>
              {/* Revenus fixes */}
              <View style={[styles.statCard, { flex: 1, borderLeftWidth: 3, borderLeftColor: C.up, borderLeftStyle: 'solid' as const }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.kpiLabel, { fontSize: 7.5, marginBottom: 0 }]}>Revenus fixes (revenu annuel)</Text>
                  <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.up }}>
                      {fmtPct(s.fixedIncomeGainPct ?? 0)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.kpiValue, { fontSize: 18, color: C.up }]}>
                  {fmt(s.fixedIncomeAnnualIncome ?? 0)}
                </Text>
              </View>
            </View>

            {/* Total estimé — prominent */}
            <View style={[styles.statCard, { borderLeftWidth: 4, borderLeftColor: C.up, borderLeftStyle: 'solid' as const, backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#86efac', borderStyle: 'solid' as const, marginBottom: 30 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Total estimé</Text>
                <View style={{ backgroundColor: (s.totalEstimatedPct ?? s.totalGainPct) >= 0 ? '#bbf7d0' : '#fecaca', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Open Sans', fontWeight: 600, color: (s.totalEstimatedPct ?? s.totalGainPct) >= 0 ? '#15803d' : C.down }}>
                    {fmtPct(s.totalEstimatedPct ?? s.totalGainPct)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.kpiValue, { fontSize: 22, color: (s.totalEstimated ?? s.totalGain) >= 0 ? C.up : C.down }]}>
                {fmt(s.totalEstimated ?? s.totalGain)}
              </Text>
            </View>
          </>
        )}

        {/* Position counts */}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {s.equityCount > 0 && (
            <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 8, color: C.blue, fontFamily: 'Open Sans', fontWeight: 600 }}>
                {s.equityCount} action{s.equityCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {s.fixedIncomeCount > 0 && (
            <View style={{ backgroundColor: C.goldPale, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 8, color: '#92400e', fontFamily: 'Open Sans', fontWeight: 600 }}>
                {s.fixedIncomeCount} revenu{s.fixedIncomeCount > 1 ? 's' : ''} fixe{s.fixedIncomeCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {s.cashCount > 0 && (
            <View style={{ backgroundColor: C.upBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 8, color: '#065f46', fontFamily: 'Open Sans', fontWeight: 600 }}>
                {s.cashCount} liquidité{s.cashCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {s.otherCount > 0 && (
            <View style={{ backgroundColor: C.panel, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 8, color: C.textSec, fontFamily: 'Open Sans', fontWeight: 600 }}>
                {s.otherCount} autre{s.otherCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {s.pricesFound > 0 && (
            <View style={{ backgroundColor: C.cyanPale, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 8, color: '#155e75', fontFamily: 'Open Sans', fontWeight: 600 }}>
                {s.pricesFound} prix temps réel — {s.targetsFound} cours cibles
              </Text>
            </View>
          )}
        </View>
      </View>

      <PageFooter pageNum={1} totalPages={0} />
    </Page>
  );
}

// ─── Equity Table Page ───────────────────────────────────────────────────────

function EquityTablePage({ holdings, pageNum, subtitle }: { holdings: PriceTargetHolding[]; pageNum: number; subtitle: string }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>{subtitle}</Text>

      {/* Table */}
      <View style={styles.table}>
        {/* Header */}
        <View style={styles.th}>
          <Text style={[styles.thCell, { width: '6%' }]}>Cpte</Text>
          <Text style={[styles.thCell, { width: '9%' }]}>Symbole</Text>
          <Text style={[styles.thCell, { width: '22%' }]}>Description</Text>
          <Text style={[styles.thCell, { width: '7%', textAlign: 'right' }]}>Qté</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right' }]}>PRU</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right' }]}>Prix</Text>
          <Text style={[styles.thCell, { width: '11%', textAlign: 'right' }]}>Val. marché</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right' }]}>Cible</Text>
          <Text style={[styles.thCell, { width: '7%', textAlign: 'right' }]}>Gain %</Text>
          <Text style={[styles.thCell, { width: '11%', textAlign: 'right' }]}>Gain $</Text>
        </View>

        {/* Rows */}
        {holdings.map((h, i) => {
          const rowStyle = i % 2 === 1 ? styles.trAlt : styles.tr;
          const gainColor = (h.gainPct ?? 0) > 0 ? C.up : (h.gainPct ?? 0) < 0 ? C.down : C.textTer;
          const gainDollar = h.targetPrice && (h.currentPrice || h.marketPrice) > 0
            ? h.quantity * (h.targetPrice - (h.currentPrice || h.marketPrice))
            : 0;

          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={rowStyle} wrap={false}>
              <Text style={[styles.td, { width: '6%', fontSize: 7, color: C.textSec }]}>{h.accountLabel}</Text>
              <Text style={[styles.tdBold, { width: '9%', color: C.cyan, fontSize: 7.5 }]}>{h.symbol}</Text>
              <Text style={[styles.td, { width: '22%', fontSize: 7.5, overflow: 'hidden', textOverflow: 'ellipsis' }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '7%', textAlign: 'right' }]}>{h.quantity.toLocaleString('fr-CA')}</Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right', color: C.textSec }]}>
                {h.averageCost > 0 ? fmtFull(h.averageCost) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '9%', textAlign: 'right' }]}>
                {(h.currentPrice || h.marketPrice) > 0 ? fmtFull(h.currentPrice || h.marketPrice) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '11%', textAlign: 'right' }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.tdBold, { width: '9%', textAlign: 'right', color: h.targetPrice ? C.blue : C.textTer }]}>
                {h.targetPrice ? fmtFull(h.targetPrice) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '7%', textAlign: 'right', color: gainColor }]}>
                {h.targetPrice ? fmtPct(h.gainPct ?? 0) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '11%', textAlign: 'right', color: gainColor }]}>
                {h.targetPrice ? fmt(gainDollar) : '—'}
              </Text>
            </View>
          );
        })}
      </View>

      <PageFooter pageNum={pageNum} totalPages={0} />
    </Page>
  );
}

// ─── Fixed Income Table Page ─────────────────────────────────────────────────

function FixedIncomeTablePage({ holdings, pageNum }: { holdings: PriceTargetHolding[]; pageNum: number }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Revenus fixes</Text>

      {/* Maturity color legend */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' }}>
        <Text style={{ fontSize: 7.5, color: C.textSec, fontFamily: 'Open Sans', fontWeight: 600, marginRight: 4 }}>
          Échéance :
        </Text>
        {MATURITY_BANDS.map((band) => (
          <View key={band.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: band.color }} />
            <Text style={{ fontSize: 7, color: C.textSec }}>{band.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.table}>
        <View style={styles.th}>
          <Text style={[styles.thCell, { width: '6%' }]}>Cpte</Text>
          <Text style={[styles.thCell, { width: '8%' }]}>Symbole</Text>
          <Text style={[styles.thCell, { width: '22%' }]}>Description</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right' }]}>Qté / VN</Text>
          <Text style={[styles.thCell, { width: '8%', textAlign: 'right' }]}>Coupon</Text>
          <Text style={[styles.thCell, { width: '12%', textAlign: 'right' }]}>Échéance</Text>
          <Text style={[styles.thCell, { width: '7%', textAlign: 'right' }]}>Dur. mod.</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right' }]}>Val. marché</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right' }]}>Int. cour.</Text>
          <Text style={[styles.thCell, { width: '9%', textAlign: 'right' }]}>Rev. ann.</Text>
        </View>

        {holdings.map((h, i) => {
          const rowStyle = i % 2 === 1 ? styles.trAlt : styles.tr;
          const band = getMaturityBand(h.maturityDate);
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={rowStyle} wrap={false}>
              <Text style={[styles.td, { width: '6%', fontSize: 7, color: C.textSec }]}>{h.accountLabel}</Text>
              <Text style={[styles.td, { width: '8%', fontSize: 7, color: C.gold, fontFamily: 'Open Sans', fontWeight: 600 }]}>{h.symbol}</Text>
              <Text style={[styles.td, { width: '22%', fontSize: 7.5, overflow: 'hidden', textOverflow: 'ellipsis' }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right' }]}>{h.quantity.toLocaleString('fr-CA')}</Text>
              <Text style={[styles.tdBold, { width: '8%', textAlign: 'right', color: C.gold }]}>
                {h.couponRate ? `${h.couponRate.toFixed(2)}%` : '—'}
              </Text>
              <View style={{ width: '12%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4 }}>
                {band && (
                  <View style={{ width: 4, height: 12, borderRadius: 1, backgroundColor: band.color, marginRight: 4 }} />
                )}
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: band ? band.color : C.textTer }}>
                  {h.maturityDate || '—'}
                </Text>
              </View>
              <Text style={[styles.td, { width: '7%', textAlign: 'right' }]}>
                {h.modifiedDuration ? h.modifiedDuration.toFixed(2) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right' }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right', color: C.textSec }]}>
                {h.accruedInterest ? fmtFull(h.accruedInterest) : '—'}
              </Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right', color: h.annualIncome > 0 ? C.up : C.textTer }]}>
                {h.annualIncome > 0 ? fmt(h.annualIncome) : '—'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Fixed income summary */}
      <View style={[styles.card, { marginTop: 8 }]}>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <View>
            <Text style={styles.label}>Valeur marchande totale</Text>
            <Text style={[styles.tdBold, { fontSize: 12, color: C.navy }]}>
              {fmt(holdings.reduce((s, h) => s + h.marketValue, 0))}
            </Text>
          </View>
          <View>
            <Text style={styles.label}>Revenu annuel (coupons)</Text>
            <Text style={[styles.tdBold, { fontSize: 12, color: C.up }]}>
              {fmt(holdings.reduce((s, h) => s + h.annualIncome, 0))}
            </Text>
          </View>
          <View>
            <Text style={styles.label}>Durée mod. moyenne pondérée</Text>
            <Text style={[styles.tdBold, { fontSize: 12, color: C.navy }]}>
              {(() => {
                const totalVal = holdings.reduce((s, h) => s + (h.modifiedDuration ? h.marketValue : 0), 0);
                const weighted = holdings.reduce((s, h) => s + (h.modifiedDuration || 0) * h.marketValue, 0);
                return totalVal > 0 ? (weighted / totalVal).toFixed(2) : '—';
              })()}
            </Text>
          </View>
        </View>
      </View>

      <PageFooter pageNum={pageNum} totalPages={0} />
    </Page>
  );
}

// ─── Cash / Other Table Page ─────────────────────────────────────────────────

function CashTablePage({ holdings, pageNum }: { holdings: PriceTargetHolding[]; pageNum: number }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Liquidités et autres positions</Text>

      <View style={styles.table}>
        <View style={styles.th}>
          <Text style={[styles.thCell, { width: '8%' }]}>Cpte</Text>
          <Text style={[styles.thCell, { width: '12%' }]}>Symbole</Text>
          <Text style={[styles.thCell, { width: '35%' }]}>Description</Text>
          <Text style={[styles.thCell, { width: '10%' }]}>Type</Text>
          <Text style={[styles.thCell, { width: '17%', textAlign: 'right' }]}>Valeur</Text>
          <Text style={[styles.thCell, { width: '18%', textAlign: 'right' }]}>Revenu annuel</Text>
        </View>

        {holdings.map((h, i) => {
          const rowStyle = i % 2 === 1 ? styles.trAlt : styles.tr;
          const typeInfo = ASSET_TYPE_LABELS[h.assetType] || ASSET_TYPE_LABELS.OTHER;
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={rowStyle} wrap={false}>
              <Text style={[styles.td, { width: '8%', fontSize: 7, color: C.textSec }]}>{h.accountLabel}</Text>
              <Text style={[styles.tdBold, { width: '12%', color: typeInfo.color }]}>{h.symbol}</Text>
              <Text style={[styles.td, { width: '35%' }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '10%', color: C.textSec, fontSize: 7.5 }]}>{typeInfo.label}</Text>
              <Text style={[styles.tdBold, { width: '17%', textAlign: 'right', color: h.marketValue < 0 ? C.down : C.text }]}>
                {fmt(h.marketValue)}
              </Text>
              <Text style={[styles.td, { width: '18%', textAlign: 'right', color: h.annualIncome > 0 ? C.up : C.textTer }]}>
                {h.annualIncome > 0 ? fmt(h.annualIncome) : '—'}
              </Text>
            </View>
          );
        })}
      </View>

      <PageFooter pageNum={pageNum} totalPages={0} />
    </Page>
  );
}

// ─── Main Document ───────────────────────────────────────────────────────────

export function PriceTargetsDocument({ data }: { data: PriceTargetReportData }) {
  const equities = data.holdings.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType));
  const fixedIncome = data.holdings.filter(h => h.assetType === 'FIXED_INCOME');
  const cashOther = data.holdings.filter(h => ['CASH', 'FUND', 'OTHER'].includes(h.assetType));

  // Paginate equities (max ~25 rows per page)
  const ROWS_PER_PAGE = 25;
  const equityPages: PriceTargetHolding[][] = [];
  for (let i = 0; i < equities.length; i += ROWS_PER_PAGE) {
    equityPages.push(equities.slice(i, i + ROWS_PER_PAGE));
  }

  let pageNum = 1; // cover

  return (
    <Document>
      <CoverPage data={data} />

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
            subtitle={subtitle}
          />
        );
      })}

      {fixedIncome.length > 0 && (
        <FixedIncomeTablePage holdings={fixedIncome} pageNum={++pageNum} />
      )}

      {cashOther.length > 0 && (
        <CashTablePage holdings={cashOther} pageNum={++pageNum} />
      )}
    </Document>
  );
}

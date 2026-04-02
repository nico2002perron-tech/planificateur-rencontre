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

function getMaturityBand(dateStr?: string) {
  const matDate = parseMaturityDate(dateStr);
  if (!matDate) return null;
  const yearsToMat = (matDate.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
  return MATURITY_BANDS.find(b => yearsToMat < b.maxYears) || MATURITY_BANDS[MATURITY_BANDS.length - 1];
}

// ─── Page count ──────────────────────────────────────────────────────────────

function countTotalPages(data: PriceTargetReportData): number {
  const opts = data.options ?? {};
  let count = 0;
  if (opts.includeCover !== false) count += 1;
  const eqCount = (opts.includeEquities !== false)
    ? data.holdings.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType)).length
    : 0;
  if (eqCount > 0) count += Math.ceil(eqCount / 24);
  if ((opts.includeFixedIncome !== false) && data.holdings.some(h => h.assetType === 'FIXED_INCOME')) count += 1;
  if ((opts.includeCashOther !== false) && data.holdings.some(h => ['CASH', 'FUND', 'OTHER'].includes(h.assetType))) count += 1;
  return Math.max(count, 1);
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function PageFooter({ pageNum, totalPages }: { pageNum: number; totalPages: number }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Groupe Financier Ste-Foy — Analyse des cours cibles</Text>
      <Text style={styles.footerText}>{pageNum} / {totalPages}</Text>
    </View>
  );
}

// ─── Stat Card (cover) ──────────────────────────────────────────────────────

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#ffffff',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderStyle: 'solid' as const,
      padding: 14,
    }}>
      <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 17, fontFamily: 'Montserrat', fontWeight: 800, color: valueColor || C.navy }}>
        {value}
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
  const upColor = '#10b981';
  const downColor = '#ef4444';

  return (
    <Page size="A4" style={[styles.page, { backgroundColor: '#f8fafc' }]}>
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

      {/* KPI row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <StatCard label="Valeur marchande" value={fmt(s.totalMarketValue)} />
        <StatCard label="Revenu annuel" value={fmt(s.totalAnnualIncome)} />
        {hasTargets && <StatCard label="Valeur cible 12 mois" value={fmt(s.totalTargetValue)} />}
      </View>

      {/* Gains */}
      {hasTargets && (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{
              flex: 1, backgroundColor: '#ffffff', borderRadius: 10,
              borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' as const, padding: 14,
            }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>
                Actions — gain en capital
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 17, fontFamily: 'Montserrat', fontWeight: 800, color: eqGain >= 0 ? upColor : downColor }}>
                  {fmt(eqGain)}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Open Sans', fontWeight: 600, color: eqGainPct >= 0 ? upColor : downColor }}>
                  {fmtPct(eqGainPct)}
                </Text>
              </View>
            </View>
            <View style={{
              flex: 1, backgroundColor: '#ffffff', borderRadius: 10,
              borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' as const, padding: 14,
            }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>
                Revenus fixes — revenu annuel
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 17, fontFamily: 'Montserrat', fontWeight: 800, color: upColor }}>
                  {fmt(s.fixedIncomeAnnualIncome ?? 0)}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Open Sans', fontWeight: 600, color: upColor }}>
                  {fmtPct(s.fixedIncomeGainPct ?? 0)}
                </Text>
              </View>
            </View>
          </View>

          {/* Total */}
          <View style={{
            backgroundColor: C.navy, borderRadius: 12, padding: 18, marginBottom: 16,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <View>
              <Text style={{ fontSize: 6.5, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 5 }}>
                Total estimé sur 12 mois
              </Text>
              <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
                {fmt(totalEst)}
              </Text>
            </View>
            <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: totalEstPct >= 0 ? '#6ee7b7' : '#fca5a5' }}>
              {fmtPct(totalEstPct)}
            </Text>
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

      <PageFooter pageNum={1} totalPages={totalPages} />
    </Page>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function TargetBar({ current, target }: { current: number; target: number }) {
  if (!target || !current || current <= 0) return null;
  const pct = Math.max(0.08, Math.min(0.95, current / target));
  const color = target >= current ? '#10b981' : '#ef4444';

  return (
    <View style={{ height: 3, backgroundColor: '#e2e8f0', borderRadius: 1.5, overflow: 'hidden' as const }}>
      <View style={{ height: '100%', width: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: 1.5 }} />
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
  const totalMv = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalGain = holdings.reduce((s, h) => {
    if (h.targetPrice && (h.currentPrice || h.marketPrice) > 0)
      return s + h.quantity * (h.targetPrice - (h.currentPrice || h.marketPrice));
    return s;
  }, 0);
  const totalTarget = holdings.reduce((s, h) => h.targetPrice ? s + h.quantity * h.targetPrice : s + h.marketValue, 0);
  const totalPct = totalMv > 0 ? (totalGain / totalMv) * 100 : 0;
  const gc = (v: number) => v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#94a3b8';

  return (
    <Page size="A4" style={styles.page}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.navy, borderBottomStyle: 'solid' as const }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>{subtitle}</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Marché: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalMv)}</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Cible: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalTarget)}</Text></Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.th}>
          <Text style={[styles.thCell, { width: '5%' }]}>Cpte</Text>
          <Text style={[styles.thCell, { width: '8%' }]}>Symbole</Text>
          <Text style={[styles.thCell, { width: '19%' }]}>Description</Text>
          <Text style={[styles.thCell, { width: '7%', textAlign: 'right' }]}>Qté</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right' }]}>Prix</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right' }]}>Val. marché</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right' }]}>Cible 1 an</Text>
          <Text style={[styles.thCell, { width: '13%', textAlign: 'center' }]}>Potentiel</Text>
          <Text style={[styles.thCell, { width: '8%', textAlign: 'right' }]}>Gain %</Text>
          <Text style={[styles.thCell, { width: '10%', textAlign: 'right' }]}>Gain $</Text>
        </View>

        {holdings.map((h, i) => {
          const bg = i % 2 === 1 ? '#fafbfc' : '#ffffff';
          const gp = h.gainPct ?? 0;
          const cp = h.currentPrice || h.marketPrice;
          const gd = h.targetPrice && cp > 0 ? h.quantity * (h.targetPrice - cp) : 0;

          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8,
              backgroundColor: bg, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid' as const,
              alignItems: 'center',
            }} wrap={false}>
              <Text style={[styles.td, { width: '5%', fontSize: 6.5, color: '#94a3b8' }]}>{h.accountLabel}</Text>
              <Text style={[styles.tdBold, { width: '8%', fontSize: 7.5, color: C.navy }]}>{h.symbol}</Text>
              <Text style={[styles.td, { width: '19%', fontSize: 7.5 }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '7%', textAlign: 'right' }]}>{h.quantity.toLocaleString('fr-CA')}</Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right' }]}>{cp > 0 ? fmtFull(cp) : '—'}</Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right' }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right', color: h.targetPrice ? C.navy : '#cbd5e1' }]}>
                {h.targetPrice ? fmtFull(h.targetPrice) : '—'}
              </Text>
              <View style={{ width: '13%', paddingHorizontal: 6, justifyContent: 'center' }}>
                {h.targetPrice && cp > 0
                  ? <TargetBar current={cp} target={h.targetPrice} />
                  : <View style={{ height: 3, backgroundColor: '#f1f5f9', borderRadius: 1.5 }} />
                }
              </View>
              <Text style={[styles.tdBold, { width: '8%', textAlign: 'right', color: gc(gp) }]}>
                {h.targetPrice ? fmtPct(gp) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right', color: gc(gd) }]}>
                {h.targetPrice ? fmt(gd) : '—'}
              </Text>
            </View>
          );
        })}

        {/* Total */}
        <View style={{
          flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8,
          backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', borderTopStyle: 'solid' as const,
          alignItems: 'center',
        }}>
          <Text style={{ width: '5%' }}>{''}</Text>
          <Text style={{ width: '8%' }}>{''}</Text>
          <Text style={{ width: '19%', fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy, paddingHorizontal: 4 }}>Total</Text>
          <Text style={{ width: '7%' }}>{''}</Text>
          <Text style={{ width: '10%' }}>{''}</Text>
          <Text style={{ width: '10%', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalMv)}</Text>
          <Text style={{ width: '10%', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalTarget)}</Text>
          <Text style={{ width: '13%' }}>{''}</Text>
          <Text style={{ width: '8%', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: gc(totalPct), textAlign: 'right', paddingHorizontal: 4 }}>{fmtPct(totalPct)}</Text>
          <Text style={{ width: '10%', fontSize: 8.5, fontFamily: 'Open Sans', fontWeight: 600, color: gc(totalGain), textAlign: 'right', paddingHorizontal: 4 }}>{fmt(totalGain)}</Text>
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.gold, borderBottomStyle: 'solid' as const }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Revenus fixes</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Valeur: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalMv)}</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Revenu: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalIncome)}</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Dur. moy.: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{avgDur}</Text></Text>
        </View>
      </View>

      {/* Maturity legend */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>Échéance :</Text>
        {MATURITY_BANDS.map((band) => (
          <View key={band.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: band.color }} />
            <Text style={{ fontSize: 6.5, color: '#64748b' }}>{band.label}</Text>
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
          const bg = i % 2 === 1 ? '#fafbfc' : '#ffffff';
          const band = getMaturityBand(h.maturityDate);
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8,
              backgroundColor: bg, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid' as const,
            }} wrap={false}>
              <Text style={[styles.td, { width: '6%', fontSize: 6.5, color: '#94a3b8' }]}>{h.accountLabel}</Text>
              <Text style={[styles.tdBold, { width: '8%', fontSize: 7.5, color: C.navy }]}>{h.symbol}</Text>
              <Text style={[styles.td, { width: '22%', fontSize: 7.5 }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right' }]}>{h.quantity.toLocaleString('fr-CA')}</Text>
              <Text style={[styles.tdBold, { width: '8%', textAlign: 'right', color: C.navy }]}>
                {h.couponRate ? `${h.couponRate.toFixed(2)}%` : '—'}
              </Text>
              <View style={{ width: '12%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 4 }}>
                {band && <View style={{ width: 3, height: 10, borderRadius: 1, backgroundColor: band.color, marginRight: 4 }} />}
                <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 600, color: band ? band.color : '#94a3b8' }}>
                  {h.maturityDate || '—'}
                </Text>
              </View>
              <Text style={[styles.td, { width: '7%', textAlign: 'right' }]}>
                {h.modifiedDuration ? h.modifiedDuration.toFixed(2) : '—'}
              </Text>
              <Text style={[styles.tdBold, { width: '10%', textAlign: 'right' }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right', color: '#94a3b8' }]}>
                {h.accruedInterest ? fmtFull(h.accruedInterest) : '—'}
              </Text>
              <Text style={[styles.td, { width: '9%', textAlign: 'right', color: h.annualIncome > 0 ? '#10b981' : '#94a3b8' }]}>
                {h.annualIncome > 0 ? fmt(h.annualIncome) : '—'}
              </Text>
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: C.cyan, borderBottomStyle: 'solid' as const }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>Liquidités et autres</Text>
        <Text style={{ fontSize: 7.5, color: '#64748b' }}>Total: <Text style={{ fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{fmt(totalMv)}</Text></Text>
      </View>

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
          const bg = i % 2 === 1 ? '#fafbfc' : '#ffffff';
          const typeLabel = h.assetType === 'CASH' ? 'Liquidité' : h.assetType === 'FUND' ? 'Fonds' : 'Autre';
          return (
            <View key={`${h.symbol}-${h.accountType}-${i}`} style={{
              flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8,
              backgroundColor: bg, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid' as const,
            }} wrap={false}>
              <Text style={[styles.td, { width: '8%', fontSize: 6.5, color: '#94a3b8' }]}>{h.accountLabel}</Text>
              <Text style={[styles.tdBold, { width: '12%', color: C.navy }]}>{h.symbol}</Text>
              <Text style={[styles.td, { width: '35%' }]}>{h.name}</Text>
              <Text style={[styles.td, { width: '10%', color: '#64748b', fontSize: 7.5 }]}>{typeLabel}</Text>
              <Text style={[styles.tdBold, { width: '17%', textAlign: 'right', color: h.marketValue < 0 ? '#ef4444' : C.text }]}>{fmt(h.marketValue)}</Text>
              <Text style={[styles.td, { width: '18%', textAlign: 'right', color: h.annualIncome > 0 ? '#10b981' : '#94a3b8' }]}>
                {h.annualIncome > 0 ? fmt(h.annualIncome) : '—'}
              </Text>
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

  const ROWS_PER_PAGE = 24;
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

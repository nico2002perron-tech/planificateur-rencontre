import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, fmt, fmtPct, fmtCap } from './shared';
import type { HoldingDNA } from '../../analytics/portfolio-dna';

export interface AssetSheetData {
  symbol: string;
  name: string;
  weight: number;
  currentPrice: number;
  targetPrice?: number;
  sector: string;
  assetClass: string;
  // Scores
  safetyScore?: number;
  upsideScore?: number;
  quadrant?: string;
  // Fundamentals
  pe?: number;
  roe?: number;
  debtToEquity?: number;
  dividendYield?: number;
  marketCap?: number;
  beta?: number;
  // DNA
  dnaStyle: string;
  dnaReason: string;
  // AI description — factual role in portfolio
  whyItExists: string;
  // For funds
  isFund?: boolean;
  morningstarRating?: number;
  mer?: number;
  topHoldings?: Array<{ name: string; weight: number }>;
  // Pre-computed upside (optional, computed from targetPrice if absent)
  upsidePct?: number | null;
}

interface AssetSheetsPageProps {
  pageNum: number;
  totalPages: number;
  assets: AssetSheetData[];
  currency: string;
}

/**
 * Asset sheets page — renders 3 holdings per page
 */
export function AssetSheetsPage({ pageNum, totalPages, assets, currency }: AssetSheetsPageProps) {
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Fiches des actifs" subtitle="Pourquoi chaque actif existe dans votre portefeuille" />

      <View style={{ gap: 10 }}>
        {assets.map((asset, i) => (
          <AssetCard key={i} asset={asset} currency={currency} />
        ))}
      </View>
    </ReportPage>
  );
}

function AssetCard({ asset, currency }: { asset: AssetSheetData; currency: string }) {
  // Use pre-computed upside if available, otherwise compute inline (backwards compat)
  const upsidePct = asset.upsidePct !== undefined ? asset.upsidePct
    : (asset.targetPrice && asset.currentPrice
      ? ((asset.targetPrice - asset.currentPrice) / asset.currentPrice) * 100
      : null);

  return (
    <View style={{
      backgroundColor: C.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: C.cardBorder, borderStyle: 'solid' as const,
      borderLeftWidth: 4, borderLeftColor: getStyleColor(asset.dnaStyle), borderLeftStyle: 'solid' as const,
    }}>
      {/* Header row: Symbol + Name + Weight + Style badge */}
      <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flex: 1 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
            {asset.symbol}
          </Text>
          <Text style={{ fontSize: 8, color: C.textSec, flex: 1 }}>
            {asset.name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
          {/* Style badge */}
          <View style={{
            backgroundColor: `${getStyleColor(asset.dnaStyle)}18`,
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
          }}>
            <Text style={{ fontSize: 6.5, color: getStyleColor(asset.dnaStyle), fontFamily: 'Open Sans', fontWeight: 600 }}>
              {asset.dnaStyle}
            </Text>
          </View>
          {/* Weight */}
          <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
            {(asset.weight * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* "Why it exists" — the key factual sentence */}
      <View style={{
        backgroundColor: '#f0fafb', borderRadius: 8, padding: 10, marginBottom: 8,
        borderLeftWidth: 2, borderLeftColor: C.cyan, borderLeftStyle: 'solid' as const,
      }}>
        <Text style={{ fontSize: 8.5, color: C.text, lineHeight: 1.5, fontStyle: 'italic' as const }}>
          {asset.whyItExists}
        </Text>
      </View>

      {/* Metrics row */}
      <View style={{ flexDirection: 'row' as const, gap: 6, flexWrap: 'wrap' as const }}>
        <MiniMetric label="Prix" value={`${asset.currentPrice.toFixed(2)}$`} />
        {asset.targetPrice && (
          <MiniMetric
            label="Cible"
            value={`${asset.targetPrice.toFixed(2)}$`}
            sub={upsidePct ? `${upsidePct >= 0 ? '+' : ''}${upsidePct.toFixed(0)}%` : undefined}
            subColor={upsidePct && upsidePct >= 0 ? C.up : C.down}
          />
        )}
        {asset.dividendYield !== undefined && asset.dividendYield > 0 && (
          <MiniMetric label="Dividende" value={`${(asset.dividendYield * 100).toFixed(1)}%`} />
        )}
        {asset.pe !== undefined && asset.pe > 0 && (
          <MiniMetric label="P/E" value={`${asset.pe.toFixed(1)}x`} />
        )}
        {asset.beta !== undefined && (
          <MiniMetric label="Beta" value={`${asset.beta.toFixed(2)}`} />
        )}
        {asset.roe !== undefined && asset.roe > 0 && (
          <MiniMetric label="ROE" value={`${asset.roe.toFixed(0)}%`} />
        )}
        {asset.marketCap !== undefined && asset.marketCap > 0 && (
          <MiniMetric label="Cap." value={fmtCap(asset.marketCap)} />
        )}
        {asset.safetyScore !== undefined && (
          <MiniMetric
            label="Securite"
            value={`${asset.safetyScore.toFixed(1)}/10`}
            valueColor={asset.safetyScore >= 6 ? C.up : asset.safetyScore >= 4 ? C.warn : C.down}
          />
        )}
        {asset.upsideScore !== undefined && (
          <MiniMetric
            label="Potentiel"
            value={`${asset.upsideScore.toFixed(1)}/10`}
            valueColor={asset.upsideScore >= 6 ? C.up : asset.upsideScore >= 4 ? C.warn : C.down}
          />
        )}

        {/* Fund-specific metrics */}
        {asset.isFund && asset.morningstarRating !== undefined && (
          <MiniMetric label="Morningstar" value={'\u2605'.repeat(asset.morningstarRating)} />
        )}
        {asset.isFund && asset.mer !== undefined && (
          <MiniMetric label="RFG" value={`${asset.mer.toFixed(2)}%`} />
        )}
      </View>

      {/* Fund top holdings */}
      {asset.isFund && asset.topHoldings && asset.topHoldings.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 6.5, color: C.textTer, marginBottom: 3 }}>Top positions :</Text>
          <Text style={{ fontSize: 7, color: C.textSec }}>
            {asset.topHoldings.slice(0, 5).map(h => `${h.name} (${(h.weight * 100).toFixed(1)}%)`).join(' · ')}
          </Text>
        </View>
      )}
    </View>
  );
}

function MiniMetric({ label, value, sub, subColor, valueColor }: {
  label: string; value: string; sub?: string; subColor?: string; valueColor?: string;
}) {
  return (
    <View style={{
      backgroundColor: C.white, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
      borderWidth: 0.5, borderColor: C.cardBorder, borderStyle: 'solid' as const,
    }}>
      <Text style={{ fontSize: 5.5, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</Text>
      <View style={{ flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 3 }}>
        <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: valueColor || C.navy }}>{value}</Text>
        {sub && <Text style={{ fontSize: 6.5, color: subColor || C.textSec }}>{sub}</Text>}
      </View>
    </View>
  );
}

const STYLE_COLORS: Record<string, string> = {
  'Quality Growth': '#00b4d8',
  'Dividend Income': '#22c55e',
  'Defensive': '#6366f1',
  'Cyclical': '#f59e0b',
  'Speculative Growth': '#ef4444',
  'Value': '#8b5cf6',
  'Fixed Income': '#0ea5e9',
  'Alternative': '#64748b',
};

function getStyleColor(style: string): string {
  return STYLE_COLORS[style] || '#94a3b8';
}

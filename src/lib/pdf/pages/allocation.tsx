import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, C } from '../styles';
import { ReportPage, SectionTitle, AIBlock, DonutChart, Legend, SectorBars, fmtPctShort } from './shared';

export interface AllocationSlice {
  label: string;
  weight: number; // 0-1
  color: string;
}

interface AllocationPageProps {
  pageNum: number;
  totalPages: number;
  assetClassSlices: AllocationSlice[];
  sectorSlices: AllocationSlice[];
  regionSlices: AllocationSlice[];
  currencySlices: AllocationSlice[];
  top10Holdings: Array<{ symbol: string; name: string; weight: number; sector: string }>;
  aiComment?: string;
}

export function AllocationPage({
  pageNum, totalPages,
  assetClassSlices, sectorSlices, regionSlices, currencySlices,
  top10Holdings, aiComment,
}: AllocationPageProps) {
  return (
    <ReportPage num={pageNum} total={totalPages}>
      <SectionTitle title="Repartition de l'actif" subtitle="Comment votre portefeuille est structure" />

      {/* Asset class allocation — donut + legend */}
      <View style={{ flexDirection: 'row' as const, gap: 24, marginBottom: 16 }}>
        <View style={{ alignItems: 'center' as const }}>
          <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
            Classe d'actifs
          </Text>
          <DonutChart
            slices={assetClassSlices.map(s => ({ label: s.label, percentage: s.weight * 100, color: s.color }))}
            size={100}
          />
          <Legend items={assetClassSlices.map(s => ({ label: s.label, color: s.color, value: `${(s.weight * 100).toFixed(0)}%` }))} />
        </View>

        {/* Region breakdown */}
        <View style={{ alignItems: 'center' as const }}>
          <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
            Geographie
          </Text>
          <DonutChart
            slices={regionSlices.map(s => ({ label: s.label, percentage: s.weight * 100, color: s.color }))}
            size={100}
          />
          <Legend items={regionSlices.map(s => ({ label: s.label, color: s.color, value: `${(s.weight * 100).toFixed(0)}%` }))} />
        </View>

        {/* Currency breakdown */}
        <View style={{ alignItems: 'center' as const }}>
          <Text style={{ fontSize: 7, color: C.textTer, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
            Devise
          </Text>
          <DonutChart
            slices={currencySlices.map(s => ({ label: s.label, percentage: s.weight * 100, color: s.color }))}
            size={100}
          />
          <Legend items={currencySlices.map(s => ({ label: s.label, color: s.color, value: `${(s.weight * 100).toFixed(0)}%` }))} />
        </View>
      </View>

      {/* Stacked allocation bar */}
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.subsectionTitle}>Allocation par classe d'actifs</Text>
        <View style={styles.allocBar}>
          {assetClassSlices.filter(s => s.weight > 0).map((s, i) => (
            <View key={i} style={{ width: `${s.weight * 100}%`, height: '100%', backgroundColor: s.color }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 }}>
          {assetClassSlices.filter(s => s.weight > 0).map((s, i) => (
            <View key={i} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
              <Text style={{ fontSize: 7, color: C.text }}>{s.label}</Text>
              <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>{(s.weight * 100).toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Sector breakdown bars */}
      <View style={{ marginBottom: 14 }}>
        <Text style={styles.subsectionTitle}>Repartition sectorielle</Text>
        <SectorBars sectors={sectorSlices.map(s => ({ label: s.label, weight: s.weight, color: s.color }))} />
      </View>

      {/* Top 10 holdings table */}
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.subsectionTitle}>Top 10 positions</Text>
        <View style={styles.tablePremium}>
          <View style={styles.thPremium}>
            <Text style={{ ...styles.thCellPremium, flex: 0.5 }}>#</Text>
            <Text style={{ ...styles.thCellPremium, flex: 1.2 }}>Symbole</Text>
            <Text style={{ ...styles.thCellPremium, flex: 2.5 }}>Nom</Text>
            <Text style={{ ...styles.thCellPremium, flex: 1.2 }}>Secteur</Text>
            <Text style={{ ...styles.thCellPremium, flex: 0.8, textAlign: 'right' as const }}>Poids</Text>
          </View>
          {top10Holdings.slice(0, 10).map((h, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
              <Text style={{ ...styles.td, flex: 0.5 }}>{i + 1}</Text>
              <Text style={{ ...styles.tdBold, flex: 1.2 }}>{h.symbol}</Text>
              <Text style={{ ...styles.td, flex: 2.5 }}>{h.name}</Text>
              <Text style={{ ...styles.td, flex: 1.2, fontSize: 7 }}>{h.sector}</Text>
              <Text style={{ ...styles.tdBold, flex: 0.8, textAlign: 'right' as const }}>{(h.weight * 100).toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      </View>

      {aiComment && <AIBlock label="Composition" text={aiComment} />}
    </ReportPage>
  );
}

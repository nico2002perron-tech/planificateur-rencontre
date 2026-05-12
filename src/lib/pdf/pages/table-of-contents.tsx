import React from 'react';
import { Page, Text, View, Svg, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer';
import { styles, C } from '../styles';

export interface TOCEntry {
  number: string;      // "01", "02", etc.
  title: string;
  subtitle?: string;
  pageNumber: number;
}

interface TOCPageProps {
  entries: TOCEntry[];
  totalPages: number;
}

export function TableOfContentsPage({ entries, totalPages }: TOCPageProps) {
  return (
    <Page size="LETTER" style={{ fontFamily: 'Open Sans', fontSize: 9, color: C.text, backgroundColor: C.white, padding: 50, paddingTop: 50 }}>
      {/* Top accent bar */}
      <Svg width={612} height={4} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="tocBar" x1="0" y1="0" x2="612" y2="0">
            <Stop offset="0%" stopColor={C.navy} />
            <Stop offset="30%" stopColor={C.blue} />
            <Stop offset="50%" stopColor={C.cyan} />
            <Stop offset="70%" stopColor={C.gold} />
            <Stop offset="100%" stopColor={C.navy} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={612} height={4} fill="url(#tocBar)" />
      </Svg>

      {/* Title */}
      <View style={{ marginBottom: 30 }}>
        <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: C.cyan, textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8 }}>
          Sommaire
        </Text>
        <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy, marginBottom: 6 }}>
          Table des matieres
        </Text>
        <View style={{ width: 50, height: 3, backgroundColor: C.cyan, borderRadius: 2, marginTop: 4 }} />
      </View>

      {/* Entries */}
      <View style={{ gap: 2 }}>
        {entries.map((entry, i) => (
          <TOCRow key={i} entry={entry} isLast={i === entries.length - 1} />
        ))}
      </View>

      {/* Footer */}
      <View style={{ ...styles.footer, position: 'absolute' as const, bottom: 14, left: 50, right: 50 }}>
        <Text style={styles.footerText}>Groupe Financier Ste-Foy — Confidentiel</Text>
        <Text style={styles.footerText}>2 / {totalPages}</Text>
      </View>
    </Page>
  );
}

function TOCRow({ entry, isLast }: { entry: TOCEntry; isLast: boolean }) {
  return (
    <View style={{
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: isLast ? 0 : 0.5,
      borderBottomColor: C.cardBorder,
      borderBottomStyle: 'solid' as const,
    }}>
      {/* Section number */}
      <View style={{
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: C.navy, alignItems: 'center' as const, justifyContent: 'center' as const,
        marginRight: 14,
      }}>
        <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 700, color: C.white }}>
          {entry.number}
        </Text>
      </View>

      {/* Title + subtitle */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
          {entry.title}
        </Text>
        {entry.subtitle && (
          <Text style={{ fontSize: 7.5, color: C.textSec, marginTop: 2 }}>
            {entry.subtitle}
          </Text>
        )}
      </View>

      {/* Dotted line */}
      <View style={{ flex: 0.3, borderBottomWidth: 1, borderBottomColor: C.cardBorder, borderBottomStyle: 'dotted' as const, marginHorizontal: 8, marginBottom: 4 }} />

      {/* Page number */}
      <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 700, color: C.cyan, width: 24, textAlign: 'right' as const }}>
        {entry.pageNumber}
      </Text>
    </View>
  );
}

/**
 * Build TOC entries dynamically based on what sections are included
 */
export function buildTOCEntries(options: {
  hasBonds: boolean;
  holdingCount: number;
}): TOCEntry[] {
  let page = 3; // Start after cover + TOC
  const entries: TOCEntry[] = [];

  const sections = [
    { num: '01', title: 'Resume executif', subtitle: 'Vue d\'ensemble du portefeuille et objectifs' },
    { num: '02', title: 'ADN du portefeuille', subtitle: 'Style d\'investissement et composition' },
    { num: '03', title: 'Allocation d\'actifs', subtitle: 'Repartition par classe, secteur, region et devise' },
    { num: '04', title: 'Projections', subtitle: 'Scenarios probabilistes et simulation Monte Carlo' },
    { num: '05', title: 'Analyse fondamentale', subtitle: 'Qualite, croissance, valorisation et rentabilite' },
    { num: '06', title: 'Analyse de valorisation', subtitle: 'Juste valeur DCF et potentiel de rendement' },
    { num: '07', title: 'Analyse du revenu', subtitle: 'Dividendes, coupons et revenu projete' },
    ...(options.hasBonds ? [{ num: '08', title: 'Analyse obligataire', subtitle: 'Duration, credit, stress tests de taux' }] : []),
    { num: options.hasBonds ? '09' : '08', title: 'Analyse de risque', subtitle: 'Volatilite, drawdowns, VaR et ratios ajustes' },
    { num: options.hasBonds ? '10' : '09', title: 'Stress Radar', subtitle: 'Sensibilite aux chocs macroeconomiques' },
    { num: options.hasBonds ? '11' : '10', title: 'Correlations et diversification', subtitle: 'Matrice de correlation et score de diversification' },
    { num: options.hasBonds ? '12' : '11', title: 'Analyse comportementale', subtitle: 'Performance estimee durant les crises historiques' },
    { num: options.hasBonds ? '13' : '12', title: 'Intelligence de marche', subtitle: 'Contexte macro et tendances actuelles' },
    { num: options.hasBonds ? '14' : '13', title: 'Recommandations', subtitle: 'Suggestions d\'optimisation du portefeuille' },
    { num: options.hasBonds ? '15' : '14', title: 'Comparaisons', subtitle: 'Performance vs indices de reference' },
    { num: options.hasBonds ? '16' : '15', title: 'Fiches des actifs', subtitle: `Detail de chaque position (${options.holdingCount} actifs)` },
  ];

  for (const section of sections) {
    entries.push({ number: section.num, title: section.title, subtitle: section.subtitle, pageNumber: page });
    // Estimate pages per section
    if (section.title === 'Fiches des actifs') {
      page += Math.ceil(options.holdingCount / 3); // ~3 holdings per page
    } else {
      page += 1;
    }
  }

  return entries;
}

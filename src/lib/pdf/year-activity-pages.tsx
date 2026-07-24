import React from 'react';
import {
  Page,
  Text,
  View,
  Svg,
  Path,
  Circle,
} from '@react-pdf/renderer';
import { styles, C } from './styles';
import { SectorIcon, SectorDonut, buildEquitySectorSlices, buildAssetClassSlices, type SectorSlice } from './sectors';
import type { PriceTargetHolding } from './price-targets-template';
import type { PortfolioActivitySummary, IncomeCategory } from '@/lib/portfolio/year-activity';

// Code couleur des natures de revenu — LE MÊME que le calendrier de la couverture
// (IncomeDashboard : dividendes duoGreen, revenus fixes duoBlue) : le client
// apprend UN seul code par document, dans le langage visuel « candy » de l'app.
const NATURE: Record<IncomeCategory, { label: string; fill: string; tokenBg: string; tokenFg: string }> = {
  dividend: { label: 'Dividendes', fill: C.duoGreen, tokenBg: C.duoGreenBg, tokenFg: C.duoGreenDark },
  fixed_income: { label: 'Revenus fixes', fill: C.duoBlue, tokenBg: C.duoBluePale, tokenFg: '#0077b6' },
  // #64748b (pas #94a3b8) : la ligne de moyenne utilise #94a3b8 — une entité, une teinte.
  other: { label: 'Autres', fill: '#64748b', tokenBg: '#f1f5f9', tokenFg: '#64748b' },
};

/** « s » de pluriel français quand n > 1. */
const plur = (n: number) => (n > 1 ? 's' : '');

type Orientation = 'portrait' | 'landscape';

interface Slice {
  label: string;
  value: number;
  pct: number;
  color: string;
}

function fmt(value: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00`));
  return formatted.replace(/^1 /, '1er ');
}

export function PageFooterV12() {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        bottom: 18,
        left: 36,
        right: 36,
        paddingTop: 6,
        borderTopWidth: 0.5,
        borderTopColor: '#e2e8f0',
        borderTopStyle: 'solid',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 6, color: '#94a3b8' }}>
        Groupe Financier Ste-Foy — Analyse des cours cibles 1.2
      </Text>
      <Text
        style={{ fontSize: 6, color: '#94a3b8' }}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

export function SectionHeader({ title, subtitle, accent = C.cyan }: {
  title: string;
  subtitle: string;
  accent?: string;
}) {
  return (
    <View
      style={{
        marginBottom: 18,
        paddingBottom: 9,
        borderBottomWidth: 1.5,
        borderBottomColor: accent,
        borderBottomStyle: 'solid',
      }}
    >
      <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
        {title}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 7.5, color: '#64748b' }}>{subtitle}</Text>
    </View>
  );
}

export function YearSummaryPanel({ activity }: { activity: PortfolioActivitySummary }) {
  const valueChange = activity.totalValueChange;
  return (
    <View
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#dbeafe',
        borderStyle: 'solid',
        backgroundColor: '#ffffff',
        marginBottom: 12,
      }}
      wrap={false}
    >
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          backgroundColor: C.navy,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
          {activity.title}
        </Text>
        <Text style={{ fontSize: 6.5, color: '#cbd5e1' }}>{activity.periodLabel}</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 9 }}>
        {[
          { label: 'Revenus encaissés', value: activity.income, color: '#0891b2' },
          { label: 'Cotisations', value: activity.contributions, color: '#2563eb' },
          { label: 'Retraits', value: activity.withdrawals, color: '#dc2626' },
          {
            label: 'Croissance des placements',
            value: activity.investmentGrowth,
            color: (activity.investmentGrowth ?? 0) >= 0 ? '#059669' : '#dc2626',
          },
        ].map((item, index) => (
          <View
            key={item.label}
            style={{
              flex: 1,
              paddingHorizontal: 8,
              borderRightWidth: index < 3 ? 0.5 : 0,
              borderRightColor: '#e2e8f0',
              borderRightStyle: 'solid',
            }}
          >
            <Text style={{ fontSize: 5.5, color: '#94a3b8', textTransform: 'uppercase' }}>
              {item.label}
            </Text>
            <Text
              style={{
                marginTop: 3,
                fontSize: 11,
                fontFamily: 'Montserrat',
                fontWeight: 800,
                color: item.value == null ? '#cbd5e1' : item.color,
              }}
            >
              {item.value == null ? 'À compléter' : fmt(item.value)}
            </Text>
          </View>
        ))}
      </View>

      {valueChange != null && (
        <View
          style={{
            marginHorizontal: 14,
            marginBottom: 9,
            borderRadius: 7,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: valueChange >= 0 ? '#ecfdf5' : '#fef2f2',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#475569' }}>
            Création de valeur - évolution totale du portefeuille
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Montserrat',
              fontWeight: 800,
              color: valueChange >= 0 ? '#047857' : '#b91c1c',
            }}
          >
            {fmt(valueChange)}
          </Text>
        </View>
      )}

      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        <Text style={{ fontSize: 7.5, color: '#475569', lineHeight: 1.55 }}>{activity.narrative}</Text>
      </View>
    </View>
  );
}

// NOTE : la page force le portrait — en paysage, son contenu déborde sur deux
// pages (vérifié au rendu) ; le reste du document suit l'orientation choisie.
export function YearActivityPage({ activity, montreParcours = false }: {
  activity: PortfolioActivitySummary;
  orientation: Orientation;
  /** La page « Le parcours de votre argent » suit : la note la cite. */
  montreParcours?: boolean;
}) {
  const months = activity.monthlyIncome;
  const maxIncome = Math.max(1, ...months.map(month => month.income));
  const barMax = 110; // hauteur max d'une barre (pt)
  const labelZone = 18; // libellé de mois (~9) + marge 6 + réserve du marqueur (~3)

  const pageTitle = activity.period === 'year_to_date'
    ? "ACTIVITÉ DE L'ANNÉE"
    : activity.period === 'six_months'
      ? 'ACTIVITÉ — 6 DERNIERS MOIS'
      : 'ACTIVITÉ — 12 DERNIERS MOIS';

  // Décomposition par nature disponible ? (au moins 5 % du revenu est catégorisé)
  const hasBreakdown = activity.income > 0
    && (activity.dividendIncome + activity.fixedIncomeIncome) / activity.income >= 0.05;

  // Étiquetage : complet jusqu'à 8 mois, sélectif (pic + dernier) au-delà.
  const peakIndex = months.reduce((best, m, i, arr) => (m.income > arr[best].income ? i : best), 0);
  const lastNonZero = months.reduce((last, m, i) => (m.income > 0 ? i : last), -1);
  const selective = months.length > 8;

  // Ligne de moyenne : repère recessif, seulement si assez de mois actifs.
  // showAverage exige moyenne < max, donc lineBottom ≤ labelZone + barMax : pas de plafond requis.
  const activeMonths = months.filter(m => m.income > 0).length;
  const showAverage = activity.averageMonthlyIncome > 0 && activeMonths >= 3
    && activity.averageMonthlyIncome < maxIncome;
  const lineBottom = labelZone + (activity.averageMonthlyIncome / maxIncome) * barMax;
  // Le libellé « moy. » va du côté où les barres ne croisent pas la ligne.
  const tailCrosses = months.slice(-3).some(m => m.income > activity.averageMonthlyIncome);
  const headCrosses = months.slice(0, 3).some(m => m.income > activity.averageMonthlyIncome);
  const avgLabelOnLeft = tailCrosses && !headCrosses;

  // Bande de décomposition du total (sert aussi de légende aux barres empilées).
  const bandSegments = (
    [
      { key: 'dividend', value: activity.dividendIncome },
      { key: 'fixed_income', value: activity.fixedIncomeIncome },
      { key: 'other', value: activity.otherIncome },
    ] as { key: IncomeCategory; value: number }[]
  ).filter(s => s.value > 0);

  // Statistiques : le doublon « encaissés » (déjà le héros) cède sa place aux
  // cotisations nettes ; une rangée annuelle conditionnelle donne le point de
  // comparaison factuel (jamais de « rythme annualisé » — conformité).
  const nVersements = activity.incomeTransactionCount;
  const statRows = [
    {
      value: String(nVersements),
      label: `versement${plur(nVersements)} de revenus reçu${plur(nVersements)}`,
    },
    { value: fmt(activity.contributions), label: 'cotisés' },
    { value: fmt(activity.withdrawals), label: 'retirés' },
    { value: fmt(activity.netContributions), label: 'cotisations nettes' },
  ];
  // La moyenne mensuelle n'apparaît ici que si la ligne du graphique ne la montre pas déjà.
  if (!showAverage && activity.averageMonthlyIncome > 0) {
    statRows.splice(1, 0, { value: fmt(activity.averageMonthlyIncome), label: 'par mois en moyenne' });
  }
  // Dernière année antérieure présente dans l'historique collé. On n'affirme
  // JAMAIS « année complète » : la couverture du collage n'est pas vérifiable ici.
  const prevYear = [...activity.annualIncome].reverse()
    .find(y => y.year < activity.currentYear) ?? null;
  if (prevYear) {
    statRows.push({ value: fmt(prevYear.amount), label: `encaissés en ${prevYear.year} (selon l'historique collé)` });
  }

  const topPct = activity.topIncomeSources[0]?.pct ?? 1;
  const coveredPct = activity.topIncomeSources.reduce((s, x) => s + x.pct, 0);

  return (
    <Page size="A4" orientation="portrait" style={[styles.page, { backgroundColor: '#fbfdff' }]}>
      <SectionHeader
        title={pageTitle}
        subtitle={`${activity.periodLabel} — revenus réellement encaissés selon l'historique Croesus`}
      />

      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
        <View
          style={{
            flex: 1.75,
            borderRadius: 10,
            padding: 16,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#dbeafe',
            borderStyle: 'solid',
          }}
        >
          <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', letterSpacing: 0.8 }}>
            REVENUS ENCAISSÉS
          </Text>
          <Text style={{ marginTop: 5, fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
            {fmt(activity.income)}
          </Text>
          <Text style={{ marginTop: 3, fontSize: 6.5, color: '#94a3b8' }}>
            Total — {activity.periodLabel.toLowerCase()}
          </Text>

          {hasBreakdown && (
            <>
              <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', marginTop: 8 }}>
                {bandSegments.map(segment => (
                  <View
                    key={segment.key}
                    style={{
                      width: `${(segment.value / activity.income) * 100}%`,
                      backgroundColor: NATURE[segment.key].fill,
                    }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                {bandSegments.map(segment => (
                  <View key={segment.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 6.5, height: 6.5, borderRadius: 2, backgroundColor: NATURE[segment.key].fill }} />
                    <Text style={{ fontSize: 6.5, color: '#64748b' }}>
                      {NATURE[segment.key].label} {fmt(segment.value)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={{ marginTop: 10, fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: '#94a3b8', letterSpacing: 0.8 }}>
            RÉPARTITION MENSUELLE
          </Text>
          <View
            style={{
              height: 170,
              marginTop: 6,
              position: 'relative',
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: months.length > 8 ? 5 : 9,
              paddingTop: 15,
              borderBottomWidth: 0.8,
              borderBottomColor: '#cbd5e1',
              borderBottomStyle: 'solid',
            }}
          >
            {/* Repère recessif : moyenne mensuelle (déclaré en premier = peint derrière). */}
            {showAverage && (
              <>
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: lineBottom,
                    borderTopWidth: 0.8,
                    borderTopColor: '#94a3b8',
                    borderTopStyle: 'dashed',
                  }}
                />
                <Text
                  style={{
                    position: 'absolute',
                    ...(avgLabelOnLeft ? { left: 0 } : { right: 0 }),
                    bottom: lineBottom + 2,
                    // Largeur fixe : sans elle, l'absolu reçoit une largeur
                    // shrink-to-fit (~30 pt) et le libellé se replie sur 3 lignes.
                    width: 90,
                    textAlign: avgLabelOnLeft ? 'left' : 'right',
                    fontSize: 6,
                    color: '#64748b',
                    paddingHorizontal: 2,
                  }}
                >
                  moy. {fmt(activity.averageMonthlyIncome)}/mois
                </Text>
              </>
            )}

            {months.map((month, index) => {
              const barHeight = month.income > 0 ? Math.max(5, (month.income / maxIncome) * barMax) : 1;
              const isLast = index === months.length - 1;
              const showLabel = month.income > 0
                && (!selective || index === peakIndex || index === lastNonZero);
              // Liseré minimal seulement quand la barre est assez haute : sinon les
              // minimums cumulés dépassent barHeight et le segment du haut se fait clipper.
              const minSeg = barHeight >= 8 ? 0.7 : 0;
              const segments = hasBreakdown && month.income > 0
                ? (
                    [
                      { key: 'other', value: month.otherIncome },
                      { key: 'fixed_income', value: month.fixedIncome },
                      { key: 'dividend', value: month.dividends },
                    ] as { key: IncomeCategory; value: number }[]
                  ).filter(s => s.value > 0)
                : [];
              return (
                <View key={month.key} style={{ flex: 1, height: 155, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {showLabel && (
                    <Text
                      style={{
                        marginBottom: 4,
                        fontSize: 6.5,
                        fontFamily: 'Open Sans',
                        // Open Sans n'est enregistrée qu'en 400/600 : 600 = le gras réel.
                        fontWeight: index === peakIndex || selective ? 600 : 400,
                        color: index === peakIndex ? C.navy : selective ? '#334155' : '#94a3b8',
                      }}
                    >
                      {fmt(month.income)}
                    </Text>
                  )}
                  <View
                    style={{
                      width: months.length > 8 ? 18 : 24,
                      height: barHeight,
                      borderTopLeftRadius: 5,
                      borderTopRightRadius: 5,
                      overflow: 'hidden',
                      justifyContent: 'flex-end',
                      backgroundColor: month.income > 0
                        ? (segments.length > 0 ? undefined : '#38bdf8')
                        : '#e2e8f0',
                    }}
                  >
                    {segments.map(segment => (
                      <View
                        key={segment.key}
                        style={{
                          height: Math.max((segment.value / month.income) * barHeight, minSeg),
                          backgroundColor: NATURE[segment.key].fill,
                        }}
                      />
                    ))}
                  </View>
                  {/* Même police partout : une famille différente au pic décale la
                      ligne de base de sa colonne (~1 pt). L'emphase passe par la couleur. */}
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 6.5,
                      fontFamily: 'Open Sans',
                      fontWeight: 600,
                      color: index === peakIndex ? '#475569' : '#94a3b8',
                    }}
                  >
                    {month.label}
                  </Text>
                  {/* Réservé dans TOUTES les colonnes : sinon le marqueur du dernier
                      mois soulève sa colonne de 2,5 pt et brise la ligne de base. */}
                  <View
                    style={{
                      marginTop: 1,
                      width: 10,
                      height: 1.5,
                      borderRadius: 1,
                      backgroundColor: isLast ? C.cyan : 'transparent',
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>

        <View
          style={{
            flex: 0.8,
            borderRadius: 10,
            padding: 16,
            backgroundColor: C.navy,
          }}
        >
          <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
            Statistiques
          </Text>
          <View style={{ marginTop: 10 }}>
            {statRows.map((stat, index) => (
              <View
                key={stat.label}
                style={{
                  paddingVertical: 8,
                  borderBottomWidth: index < statRows.length - 1 ? 0.5 : 0,
                  borderBottomColor: '#334e68',
                  borderBottomStyle: 'solid',
                }}
              >
                <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
                  {stat.value}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 6.5, color: '#94a3b8' }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Le récit factuel calculé par le moteur (constats, jamais de recommandation). */}
      <View
        style={{
          marginBottom: 14,
          borderRadius: 10,
          padding: 12,
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#dbeafe',
          borderStyle: 'solid',
          borderLeftWidth: 3,
          borderLeftColor: C.cyan,
        }}
      >
        <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
          Lecture de la période
        </Text>
        <Text style={{ marginTop: 5, fontSize: 8.5, lineHeight: 1.55, color: '#475569' }}>
          {activity.narrative}
        </Text>
      </View>

      <View>
        <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
          Principales sources de revenus
        </Text>
        <Text style={{ marginTop: 3, marginBottom: 8, fontSize: 6.5, color: '#94a3b8' }}>
          Part de chaque titre dans les revenus encaissés de la période
          {activity.topIncomeSources.length > 1
            ? ` — ces ${activity.topIncomeSources.length} titres représentent ${coveredPct.toFixed(0)} % du total`
            : activity.topIncomeSources.length === 1
              ? ` — ce titre représente ${coveredPct.toFixed(0)} % du total`
              : ''}
        </Text>

        {activity.topIncomeSources.map((source, index) => {
          const tint = hasBreakdown
            ? NATURE[source.category]
            : { label: '', fill: '#38bdf8', tokenBg: '#e0f2fe', tokenFg: '#0369a1' };
          return (
            <View
              key={`${source.symbol}-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                borderBottomWidth: 0.5,
                borderBottomColor: '#edf2f7',
                borderBottomStyle: 'solid',
              }}
            >
              {/* Le rang est une DONNÉE imprimée en nombre ; la couleur porte la nature. */}
              <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: tint.tokenBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: tint.tokenFg }}>
                  {index + 1}
                </Text>
              </View>
              <View style={{ width: 150, marginLeft: 10 }}>
                <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy, maxLines: 1 }}>
                  {source.name}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 6, color: '#94a3b8' }}>
                  {source.symbol} · {source.pct.toFixed(0)} % des revenus
                </Text>
              </View>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                <View style={{ width: `${Math.min(100, (source.pct / Math.max(topPct, 1)) * 100)}%`, height: '100%', backgroundColor: tint.fill }} />
              </View>
              <Text style={{ width: 54, marginLeft: 10, textAlign: 'right', fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
                {fmt(source.amount)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* L'arithmétique boucle : revenus retenus + cotisations/retraits (à part)
          + opérations exclues = transactions de la fenêtre. USD divulgué. */}
      <Text style={{ marginTop: 'auto', paddingTop: 10, fontSize: 6, color: '#94a3b8', lineHeight: 1.45 }}>
        Sur {activity.transactionCount > 1 ? 'les' : 'la'} {activity.transactionCount} transaction{plur(activity.transactionCount)} de la période du {fmtDate(activity.startDate)} au {fmtDate(activity.endDate)}, {activity.incomeTransactionCount} versement{plur(activity.incomeTransactionCount)} de revenus {activity.incomeTransactionCount > 1 ? 'ont été retenus' : 'a été retenu'} ; les cotisations et retraits sont comptabilisés séparément, et {activity.ignoredTransactionCount} opération{plur(activity.ignoredTransactionCount)} (achats, ventes, frais et transferts internes) {activity.ignoredTransactionCount > 1 ? 'sont exclues' : 'est exclue'} du calcul des revenus{montreParcours && (activity.buyCount ?? 0) + (activity.sellCount ?? 0) > 0
          ? `, dont ${activity.buyCount ?? 0} achat${plur(activity.buyCount ?? 0)} et ${activity.sellCount ?? 0} vente${plur(activity.sellCount ?? 0)} pris en compte à la page « Le parcours de votre argent »`
          : ''}. Les montants proviennent des valeurs nettes de l&apos;historique Croesus collé ; les montants en dollars américains sont convertis en dollars canadiens lorsqu&apos;un taux est appliqué.
        {activity.investmentGrowth != null
          ? ' La croissance des placements correspond à l’écart entre la valeur actuelle et la valeur de départ, après cotisations nettes et revenus encaissés.'
          : ''}
      </Text>
      <PageFooterV12 />
    </Page>
  );
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const radians = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function donutArcPath(startAngle: number, endAngle: number, radius: number, innerRadius: number, center: number): string {
  const safeEnd = Math.min(endAngle, startAngle + 359.99);
  const outerStart = polarPoint(center, center, radius, startAngle);
  const outerEnd = polarPoint(center, center, radius, safeEnd);
  const innerEnd = polarPoint(center, center, innerRadius, safeEnd);
  const innerStart = polarPoint(center, center, innerRadius, startAngle);
  const largeArc = safeEnd - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function buildDonutSegments(slices: Slice[]) {
  return slices.reduce<Array<{ slice: Slice; start: number; end: number }>>((segments, slice) => {
    const start = segments.length > 0 ? segments[segments.length - 1].end : 0;
    return [...segments, { slice, start, end: start + slice.pct * 3.6 }];
  }, []);
}

function CompositionDonut({ slices, centerValue }: { slices: Slice[]; centerValue: number }) {
  const size = 220;
  const center = size / 2;
  const segments = buildDonutSegments(slices);
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={95} fill="#f1f5f9" />
        {segments.map(({ slice, start, end }, index) => (
          <Path
            key={`${slice.label}-${index}`}
            d={donutArcPath(start, end, 95, 62, center)}
            fill={slice.color}
          />
        ))}
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 72,
          left: 48,
          width: 124,
          height: 76,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 21, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
          {fmt(centerValue)}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 6, color: '#94a3b8', textTransform: 'uppercase' }}>
          évolution totale
        </Text>
      </View>
    </View>
  );
}

export function GrowthSourcesPage({ activity, orientation }: {
  activity: PortfolioActivitySummary;
  orientation: Orientation;
}) {
  if (
    activity.investmentGrowth == null ||
    activity.totalValueChange == null ||
    activity.startingPortfolioValue == null
  ) {
    return null;
  }

  const components = [
    { label: 'Croissance des placements', value: Math.max(0, activity.investmentGrowth), color: '#0ea5e9' },
    { label: 'Cotisations nettes', value: Math.max(0, activity.netContributions), color: '#2563eb' },
    { label: 'Revenus encaissés', value: Math.max(0, activity.income), color: '#10b981' },
  ];
  const positiveTotal = components.reduce((sum, component) => sum + component.value, 0);
  const slices = components
    .filter(component => component.value > 0)
    .map(component => ({
      ...component,
      pct: positiveTotal > 0 ? component.value / positiveTotal * 100 : 0,
    }));
  const mainSource = [...slices].sort((a, b) => b.value - a.value)[0];
  const sourceSentence = mainSource
    ? `L'évolution du portefeuille provient principalement de ${mainSource.label.toLowerCase()}, qui représente ${mainSource.pct.toFixed(0)} % des composantes positives de la période.`
    : 'La période ne présente aucune composante positive à répartir.';

  return (
    <Page size="A4" orientation={orientation} style={[styles.page, { backgroundColor: '#fbfdff' }]}>
      <SectionHeader
        title="D'OÙ VIENT LA CROISSANCE ?"
        subtitle={`${fmtDate(activity.startDate)} au ${fmtDate(activity.endDate)} - décomposition factuelle de l'évolution du portefeuille`}
        accent="#2563eb"
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 42, marginTop: 30 }}>
        <CompositionDonut slices={slices} centerValue={activity.totalValueChange} />

        <View style={{ width: 245 }}>
          {slices.map(slice => (
            <View
              key={slice.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: '#e2e8f0',
                borderBottomStyle: 'solid',
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: slice.color }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 8, color: '#475569' }}>{slice.label}</Text>
                <Text style={{ marginTop: 2, fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
                  {fmt(slice.value)}
                </Text>
              </View>
              <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 800, color: slice.color }}>
                {slice.pct.toFixed(0)} %
              </Text>
            </View>
          ))}

          {activity.investmentGrowth < 0 && (
            <View style={{ marginTop: 12, borderRadius: 8, padding: 10, backgroundColor: '#fef2f2' }}>
              <Text style={{ fontSize: 7, color: '#b91c1c' }}>
                Variation négative des placements: {fmt(activity.investmentGrowth)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View
        style={{
          marginTop: 42,
          borderRadius: 10,
          padding: 18,
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#dbeafe',
          borderStyle: 'solid',
        }}
      >
        <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
          Lecture de la période
        </Text>
        <Text style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: '#475569' }}>
          {sourceSentence}
        </Text>
        <Text style={{ marginTop: 8, fontSize: 7, lineHeight: 1.5, color: '#94a3b8' }}>
          La croissance des placements est calculée à partir de la valeur de départ, de la valeur actuelle, des cotisations nettes et des revenus encaissés. Elle ne constitue ni une prévision ni une recommandation.
        </Text>
      </View>

      <PageFooterV12 />
    </Page>
  );
}

function AllocationPanel({ title, subtitle, slices, withIcons }: {
  title: string;
  subtitle: string;
  slices: SectorSlice[];
  withIcons: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 10,
        padding: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'solid',
      }}
    >
      <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>{title}</Text>
      <Text style={{ marginTop: 2, fontSize: 6, color: '#94a3b8', textTransform: 'uppercase' }}>{subtitle}</Text>
      <View style={{ marginTop: 12, alignItems: 'center' }}>
        <SectorDonut slices={slices} size={104} />
        <View style={{ width: '100%', marginTop: 12 }}>
          {slices.slice(0, 8).map((slice, index) => (
            <View
              key={`${slice.code}-${index}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2.5 }}
            >
              {withIcons ? (
                <SectorIcon code={slice.code} size={11} color={slice.color} />
              ) : (
                <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: slice.color }} />
              )}
              <Text style={{ fontSize: 7.5, color: C.text }}>{slice.label}</Text>
              <View style={{ flex: 1, height: 1, marginHorizontal: 4, backgroundColor: '#f1f5f9' }} />
              <Text style={{ fontSize: 7.5, fontFamily: 'Open Sans', fontWeight: 700, color: C.navy }}>
                {slice.pct.toFixed(1)} %
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function PortfolioAllocationPage({ holdings, orientation }: {
  holdings: PriceTargetHolding[];
  orientation: Orientation;
}) {
  const total = holdings.reduce((sum, holding) => sum + Math.abs(holding.marketValue), 0);
  const assetSlices = buildAssetClassSlices(holdings);
  const sectorSlices = buildEquitySectorSlices(holdings);
  const grouped = new Map<string, { symbol: string; name: string; value: number }>();
  for (const holding of holdings) {
    const key = holding.symbol || holding.name;
    const current = grouped.get(key) ?? { symbol: holding.symbol, name: holding.name, value: 0 };
    current.value += Math.abs(holding.marketValue);
    grouped.set(key, current);
  }
  const topPositions = Array.from(grouped.values()).sort((a, b) => b.value - a.value).slice(0, 5);
  const topFiveValue = topPositions.reduce((sum, position) => sum + position.value, 0);
  const mainPosition = topPositions[0];
  const topFivePct = total > 0 ? topFiveValue / total * 100 : 0;
  const mainPct = total > 0 && mainPosition ? mainPosition.value / total * 100 : 0;

  return (
    <Page size="A4" orientation={orientation} style={[styles.page, { backgroundColor: '#fbfdff' }]}>
      <SectionHeader
        title="RÉPARTITION DU PORTEFEUILLE"
        subtitle={`Portrait actuel du portefeuille - valeur totale ${fmt(total)}`}
        accent="#10b981"
      />

      <View style={{ flexDirection: 'row', gap: 14 }}>
        <AllocationPanel title="Classes d'actifs" subtitle="Toutes les positions" slices={assetSlices} withIcons={false} />
        <AllocationPanel title="Secteurs" subtitle="Actions et FNB" slices={sectorSlices} withIcons />
      </View>

      <View
        style={{
          marginTop: 18,
          borderRadius: 10,
          padding: 16,
          backgroundColor: C.navy,
        }}
      >
        <Text style={{ fontSize: 10, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
          Concentration
        </Text>
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 13 }}>
          <View style={{ width: 160 }}>
            <Text style={{ fontSize: 6.5, color: '#94a3b8', textTransform: 'uppercase' }}>Top 5 positions</Text>
            <Text style={{ marginTop: 4, fontSize: 24, fontFamily: 'Montserrat', fontWeight: 800, color: '#67e8f9' }}>
              {topFivePct.toFixed(0)} %
            </Text>
            <Text style={{ marginTop: 3, fontSize: 7, color: '#cbd5e1' }}>du portefeuille</Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#334e68' }} />
          <View style={{ width: 185 }}>
            <Text style={{ fontSize: 6.5, color: '#94a3b8', textTransform: 'uppercase' }}>Principale position</Text>
            <Text style={{ marginTop: 4, fontSize: 13, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
              {mainPosition?.name || 'Non disponible'}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: '#6ee7b7' }}>
              {mainPct.toFixed(1)} %
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            {topPositions.map((position, index) => {
              const pct = total > 0 ? position.value / total * 100 : 0;
              return (
                <View key={`${position.symbol}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5 }}>
                  <Text style={{ width: 70, fontSize: 6.5, fontFamily: 'Open Sans', fontWeight: 600, color: '#e2e8f0' }}>
                    {position.symbol || position.name}
                  </Text>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#334e68', overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, pct / Math.max(mainPct, 1) * 100)}%`, height: '100%', backgroundColor: index === 0 ? '#67e8f9' : '#38bdf8' }} />
                  </View>
                  <Text style={{ width: 34, textAlign: 'right', fontSize: 6.5, color: '#cbd5e1' }}>{pct.toFixed(1)} %</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <Text style={{ marginTop: 14, fontSize: 6.5, color: '#94a3b8', lineHeight: 1.45 }}>
        La concentration est calculée à partir de la valeur au marché des positions incluses dans le rapport. Les positions détenues dans plusieurs comptes sont regroupées.
      </Text>
      <PageFooterV12 />
    </Page>
  );
}

export function AnnualIncomeProgression({ activity }: { activity?: PortfolioActivitySummary }) {
  const years = activity?.annualIncome ?? [];
  if (years.length === 0) return null;
  const max = Math.max(1, ...years.map(year => year.amount));

  return (
    <View
      style={{
        marginBottom: 12,
        borderRadius: 8,
        padding: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'solid',
      }}
      wrap={false}
    >
      <Text style={{ fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
        Progression du revenu encaissé
      </Text>
      <Text style={{ marginTop: 2, fontSize: 5.5, color: '#94a3b8' }}>
        Historique réellement reçu selon les transactions collées
      </Text>
      <View style={{ marginTop: 8, flexDirection: 'row', gap: 10 }}>
        {years.map(year => (
          <View key={year.year} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Montserrat', fontWeight: 800, color: '#475569' }}>{year.year}</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 800, color: '#059669' }}>{fmt(year.amount)}</Text>
            </View>
            <View style={{ height: 7, borderRadius: 3.5, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
              <View style={{ width: `${year.amount / max * 100}%`, height: '100%', backgroundColor: '#10b981' }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

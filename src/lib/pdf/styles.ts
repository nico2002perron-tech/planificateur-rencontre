import { StyleSheet } from '@react-pdf/renderer';

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    color: '#1a2a3a',
  },
  coverPage: {
    fontFamily: 'Helvetica',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    padding: 60,
  },
  coverBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#03045e',
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#03045e',
    marginBottom: 12,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#586e82',
    marginBottom: 30,
    textAlign: 'center',
  },
  coverInfo: {
    fontSize: 11,
    color: '#586e82',
    marginBottom: 6,
    textAlign: 'center',
  },
  coverLogo: {
    width: 80,
    height: 80,
    marginBottom: 30,
  },

  // Section headers
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#03045e',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#00b4d8',
    borderBottomStyle: 'solid',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1a2a3a',
    marginBottom: 8,
  },
  subsectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#03045e',
    marginBottom: 6,
    marginTop: 12,
  },

  // Table
  table: {
    width: '100%',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f6fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    backgroundColor: '#fafbfc',
  },
  tableCell: {
    fontSize: 9,
    paddingHorizontal: 4,
  },
  tableCellHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#586e82',
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },

  // Cards
  card: {
    backgroundColor: '#f3f6fa',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 8,
    color: '#586e82',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1a2a3a',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f3f6fa',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },

  // Allocation bar (horizontal stacked bar)
  allocationBar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  allocationBarSegment: {
    height: '100%',
  },

  // Legend
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  colorSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 8,
    color: '#586e82',
  },

  // Stress test
  stressTestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    borderBottomStyle: 'solid',
  },

  // Note
  noteText: {
    fontSize: 7,
    color: '#8a9bb0',
    fontStyle: 'italic',
    marginTop: 6,
  },

  // Bullets
  bullet: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00b4d8',
    marginRight: 8,
    marginTop: 4,
  },
  bulletText: {
    fontSize: 10,
    flex: 1,
    color: '#1a2a3a',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#8a9bb0',
  },

  // Positive/negative values
  positive: {
    color: '#10b981',
  },
  negative: {
    color: '#ef4444',
  },

  // Disclaimer
  disclaimer: {
    fontSize: 7,
    color: '#8a9bb0',
    lineHeight: 1.5,
    marginTop: 20,
  },

  // ─── Performance Chart (bar chart via Views) ──────────────────
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 6,
    marginBottom: 8,
    paddingLeft: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  chartBarGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  chartBar: {
    width: 18,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  chartBarGreen: {
    backgroundColor: '#00b4d8',
  },
  chartBarRed: {
    backgroundColor: '#ef4444',
  },
  chartBarBench: {
    backgroundColor: '#c4c4c4',
  },
  chartLabel: {
    fontSize: 7,
    color: '#586e82',
    textAlign: 'center',
    marginTop: 3,
  },

  // ─── Target Table (Cours Cibles) ──────────────────────────────
  targetTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#03045e',
    paddingVertical: 6,
  },
  targetHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    paddingHorizontal: 3,
    textTransform: 'uppercase',
  },
  targetRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
  },
  targetRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    backgroundColor: '#f8f9fb',
  },
  targetCell: {
    fontSize: 8,
    paddingHorizontal: 3,
  },
  targetTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f6fa',
    paddingVertical: 6,
    borderTopWidth: 1.5,
    borderTopColor: '#03045e',
    borderTopStyle: 'solid',
  },
  targetPositive: {
    color: '#10b981',
    fontFamily: 'Helvetica-Bold',
  },
  targetNegative: {
    color: '#ef4444',
    fontFamily: 'Helvetica-Bold',
  },

  // ─── Holding Cards (Fiches descriptives) ──────────────────────
  holdingCard: {
    backgroundColor: '#f8f9fb',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00b4d8',
    borderLeftStyle: 'solid',
  },
  holdingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  holdingCardTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#03045e',
  },
  holdingCardSymbol: {
    fontSize: 9,
    color: '#586e82',
  },
  holdingDescription: {
    fontSize: 8,
    color: '#3a4a5a',
    lineHeight: 1.4,
    marginBottom: 6,
  },
  holdingMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  holdingMeta: {
    width: '30%',
  },
  holdingMetaLabel: {
    fontSize: 7,
    color: '#8a9bb0',
    marginBottom: 1,
  },
  holdingMetaValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1a2a3a',
  },

  // ─── Sector Bars (horizontal) ─────────────────────────────────
  sectorBarContainer: {
    marginBottom: 4,
  },
  sectorBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectorLabel: {
    width: '30%',
    fontSize: 9,
    color: '#1a2a3a',
  },
  sectorBarOuter: {
    flex: 1,
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  sectorBarInner: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#00b4d8',
  },
  sectorPercent: {
    width: '10%',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#03045e',
    textAlign: 'right',
  },

  // ─── Summary Pie Row ──────────────────────────────────────────
  pieSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    borderBottomStyle: 'solid',
  },

  // ─── AI Narrative Blocks ────────────────────────────────────────
  aiNarrativeBlock: {
    backgroundColor: '#f8fafb',
    borderLeftWidth: 3,
    borderLeftColor: '#00b4d8',
    borderLeftStyle: 'solid' as const,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    marginTop: 8,
  },
  aiNarrativeLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#00b4d8',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  aiNarrative: {
    fontSize: 9,
    color: '#1a2a3a',
    lineHeight: 1.5,
  },

  // ─── Valuation Page ──────────────────────────────────────────────
  valuationTableHeader: {
    flexDirection: 'row' as const,
    backgroundColor: '#03045e',
    paddingVertical: 5,
  },
  valuationHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    paddingHorizontal: 3,
  },
  valuationRow: {
    flexDirection: 'row' as const,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid' as const,
    paddingVertical: 4,
  },
  valuationRowAlt: {
    flexDirection: 'row' as const,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid' as const,
    paddingVertical: 4,
    backgroundColor: '#f8f9fb',
  },
  valuationCell: {
    fontSize: 8,
    paddingHorizontal: 3,
  },
  badgeUndervalued: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  badgeOvervalued: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  badgeFairValue: {
    backgroundColor: '#fef9c3',
    color: '#854d0e',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  sensitivityCell: {
    fontSize: 7,
    textAlign: 'center' as const,
    paddingVertical: 3,
    paddingHorizontal: 2,
    width: '20%',
  },
  sensitivityHeader: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center' as const,
    paddingVertical: 3,
    paddingHorizontal: 2,
    width: '20%',
    backgroundColor: '#f3f6fa',
    color: '#03045e',
  },
  scoreBarOuter: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden' as const,
    flex: 1,
    marginLeft: 4,
  },
  scoreBarInner: {
    height: '100%',
    borderRadius: 3,
  },

  // Spacing
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb16: { marginBottom: 16 },
  mb24: { marginBottom: 24 },
  textRight: { textAlign: 'right' },
  textCenter: { textAlign: 'center' },
  bold: { fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row' },
});

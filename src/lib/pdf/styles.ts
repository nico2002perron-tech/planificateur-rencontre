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

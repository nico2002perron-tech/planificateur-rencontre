import { StyleSheet } from '@react-pdf/renderer';

// ─── Design Tokens (exported for inline SVG, gradients, etc.) ───
export const C = {
  // Brand
  navy: '#03045e',
  blue: '#0077b6',
  cyan: '#00b4d8',
  cyanLight: '#48cae4',
  cyanPale: '#e0f7fa',
  gold: '#c5a365',
  goldPale: '#fdf8f0',

  // Surface
  white: '#ffffff',
  card: '#f8fafc',
  cardBorder: '#e2e8f0',
  panel: '#f1f5f9',

  // Text
  text: '#0f172a',
  textSec: '#475569',
  textTer: '#94a3b8',
  textMuted: '#cbd5e1',

  // Semantic
  up: '#10b981',
  upBg: '#ecfdf5',
  upBorder: '#a7f3d0',
  down: '#ef4444',
  downBg: '#fef2f2',
  downBorder: '#fecaca',
  warn: '#f59e0b',
  warnBg: '#fffbeb',
  warnBorder: '#fde68a',

  // Table
  thBg: '#0f172a',
  thText: '#ffffff',
  trAlt: '#f8fafc',
  border: '#e2e8f0',
};

// ─── Reusable Styles ────────────────────────────────────────────
export const styles = StyleSheet.create({

  /* ── Page ─────────────────────────────────────────────── */
  page: {
    fontFamily: 'Open Sans',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.white,
    padding: 36,
    paddingTop: 44,
    paddingBottom: 50,
  },

  /* ── Typography ───────────────────────────────────────── */
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat',
    fontWeight: 700,
    color: C.navy,
    marginBottom: 14,
  },
  subsectionTitle: {
    fontSize: 11,
    fontFamily: 'Montserrat',
    fontWeight: 700,
    color: C.navy,
    marginBottom: 8,
    marginTop: 12,
  },
  label: {
    fontSize: 7,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    color: C.textTer,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  /* ── KPI ──────────────────────────────────────────────── */
  kpiValue: {
    fontSize: 26,
    fontFamily: 'Montserrat',
    fontWeight: 800,
    color: C.navy,
    lineHeight: 1.1,
  },
  kpiLabel: {
    fontSize: 7,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    color: C.textTer,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  /* ── Cards ────────────────────────────────────────────── */
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderStyle: 'solid' as const,
    padding: 16,
    marginBottom: 10,
  },

  /* ── Tables ───────────────────────────────────────────── */
  table: {
    width: '100%',
    marginBottom: 14,
  },
  th: {
    flexDirection: 'row' as const,
    backgroundColor: C.thBg,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  thCell: {
    fontSize: 7,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    color: C.thText,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  tr: {
    flexDirection: 'row' as const,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderBottomStyle: 'solid' as const,
  },
  trAlt: {
    flexDirection: 'row' as const,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: C.trAlt,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderBottomStyle: 'solid' as const,
  },
  td: {
    fontSize: 8.5,
    paddingHorizontal: 4,
    color: C.text,
  },
  tdBold: {
    fontSize: 8.5,
    paddingHorizontal: 4,
    color: C.text,
    fontFamily: 'Open Sans',
    fontWeight: 600,
  },

  /* ── Stats Row ────────────────────────────────────────── */
  statsRow: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderStyle: 'solid' as const,
    padding: 14,
    alignItems: 'center' as const,
  },

  /* ── Allocation Bar ───────────────────────────────────── */
  allocBar: {
    flexDirection: 'row' as const,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden' as const,
    marginBottom: 10,
  },

  /* ── Legend ────────────────────────────────────────────── */
  legendWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 12,
  },

  /* ── Sector Bars ──────────────────────────────────────── */
  sectorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 5,
  },
  sectorLabel: {
    width: '28%',
    fontSize: 8.5,
    color: C.text,
  },
  sectorBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden' as const,
    marginHorizontal: 8,
  },
  sectorBarInner: {
    height: '100%',
    borderRadius: 4,
  },
  sectorPct: {
    width: '10%',
    fontSize: 8.5,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    color: C.navy,
    textAlign: 'right' as const,
  },

  /* ── Holding Cards ────────────────────────────────────── */
  holdingCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderStyle: 'solid' as const,
    borderLeftWidth: 3,
    borderLeftColor: C.cyan,
    borderLeftStyle: 'solid' as const,
    padding: 14,
    marginBottom: 10,
  },

  /* ── AI Block ─────────────────────────────────────────── */
  aiBlock: {
    backgroundColor: '#f0fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: C.cyan,
    borderLeftStyle: 'solid' as const,
  },
  aiLabel: {
    fontSize: 7,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    color: C.cyan,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  aiText: {
    fontSize: 8.5,
    color: C.text,
    lineHeight: 1.5,
  },

  /* ── Footer ───────────────────────────────────────────── */
  footer: {
    position: 'absolute' as const,
    bottom: 14,
    left: 36,
    right: 36,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.cardBorder,
    borderTopStyle: 'solid' as const,
  },
  footerText: {
    fontSize: 7,
    color: C.textMuted,
  },

  /* ── Badges ───────────────────────────────────────────── */
  badgeUp: {
    backgroundColor: C.upBg,
    color: '#065f46',
    fontSize: 7,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDown: {
    backgroundColor: C.downBg,
    color: '#991b1b',
    fontSize: 7,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeNeutral: {
    backgroundColor: C.warnBg,
    color: '#854d0e',
    fontSize: 7,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  /* ── Sensitivity Matrix ───────────────────────────────── */
  sensitivityCell: {
    fontSize: 7,
    textAlign: 'center' as const,
    paddingVertical: 3,
    paddingHorizontal: 2,
    width: '20%',
  },
  sensitivityHeader: {
    fontSize: 7,
    fontFamily: 'Open Sans',
    fontWeight: 600,
    textAlign: 'center' as const,
    paddingVertical: 3,
    paddingHorizontal: 2,
    width: '20%',
    backgroundColor: '#f1f5f9',
    color: C.navy,
  },

  /* ── Score Bar ────────────────────────────────────────── */
  scoreBarOuter: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden' as const,
    flex: 1,
    marginLeft: 4,
  },
  scoreBarInner: {
    height: '100%',
    borderRadius: 3,
  },

  /* ── Disclaimer ───────────────────────────────────────── */
  disclaimer: {
    fontSize: 7,
    color: C.textTer,
    lineHeight: 1.5,
  },
  noteText: {
    fontSize: 7,
    color: C.textTer,
    fontStyle: 'italic' as const,
    marginTop: 6,
  },

  /* ── Utilities ────────────────────────────────────────── */
  row: { flexDirection: 'row' as const },
  bold: { fontFamily: 'Open Sans', fontWeight: 600 },
  up: { color: C.up },
  down: { color: C.down },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  textRight: { textAlign: 'right' as const },
  textCenter: { textAlign: 'center' as const },
});

// Shared constants for simulation components

export const DUO_COLORS = ['#58CC02', '#CE82FF', '#1CB0F6', '#FF9600', '#FF4B4B', '#FFC800', '#00CD9C'];

export function duoColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return DUO_COLORS[Math.abs(hash) % DUO_COLORS.length];
}

export const BENCHMARK_LABELS: Record<string, string> = { '^GSPTSE': 'S&P/TSX', '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ' };
export const BENCHMARK_COLORS: Record<string, string> = { '^GSPTSE': '#64748b', '^GSPC': '#03045e', '^IXIC': '#7c3aed' };

export const SECTOR_COLORS: Record<string, string> = {
  TECHNOLOGY: '#1CB0F6', HEALTHCARE: '#CE82FF', FINANCIALS: '#FF9600',
  ENERGY: '#FF4B4B', MATERIALS: '#FFC800', INDUSTRIALS: '#58CC02',
  CONSUMER_DISC: '#00CD9C', CONSUMER_DISCRETIONARY: '#00CD9C',
  CONSUMER_STAPLES: '#7c3aed', UTILITIES: '#64748b',
  REAL_ESTATE: '#f472b6', TELECOM: '#0ea5e9', TELECOMS: '#0ea5e9',
  COMMUNICATION: '#3b82f6', MILITARY: '#475569',
  EQUITY: '#94a3b8', FIXED_INCOME: '#a78bfa', CASH: '#d1d5db',
};

export const SECTOR_LABELS: Record<string, string> = {
  TECHNOLOGY: 'Technologie', HEALTHCARE: 'Santé', FINANCIALS: 'Finance',
  ENERGY: 'Énergie', MATERIALS: 'Matériaux', INDUSTRIALS: 'Industriels',
  CONSUMER_DISC: 'Cons. discrétionnaire', CONSUMER_DISCRETIONARY: 'Cons. discrétionnaire',
  CONSUMER_STAPLES: 'Cons. de base', UTILITIES: 'Services publics',
  REAL_ESTATE: 'Immobilier', TELECOM: 'Télécommunications', TELECOMS: 'Télécoms',
  COMMUNICATION: 'Communication', MILITARY: 'Militaire',
  EQUITY: 'Actions', FIXED_INCOME: 'Obligations', CASH: 'Encaisse',
};

export const REGION_LABELS: Record<string, string> = { CA: 'Canada', US: 'États-Unis', INTL: 'International', EM: 'Marchés émergents' };

export const CHART_PERIODS = ['1J', '1S', '1M', '3M', '1A', '5A', 'Max'] as const;
export type ChartPeriod = typeof CHART_PERIODS[number];

// Formatting helpers
export function fmtMoney(v: number, currency = 'CAD'): string {
  return v.toLocaleString('fr-CA', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
export function fmtMoneyFull(v: number, currency = 'CAD'): string {
  return v.toLocaleString('fr-CA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtPct(v: number): string { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`; }
export function fmtDate(d: string): string { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
export function fmtDateShort(d: string): string { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }); }

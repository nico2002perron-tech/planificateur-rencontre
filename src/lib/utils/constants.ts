export const ACCOUNT_TYPES = [
  { value: 'REER', label: 'REER' },
  { value: 'CELI', label: 'CELI' },
  { value: 'REEE', label: 'REEE' },
  { value: 'NON_ENREGISTRE', label: 'Non enregistré' },
  { value: 'FERR', label: 'FERR' },
  { value: 'CRI', label: 'CRI' },
  { value: 'FRV', label: 'FRV' },
  { value: 'REER_COLLECTIF', label: 'REER collectif' },
] as const;

export const RISK_PROFILES = [
  { value: 'CONSERVATEUR', label: 'Conservateur' },
  { value: 'MODERE', label: 'Modéré' },
  { value: 'EQUILIBRE', label: 'Équilibré' },
  { value: 'CROISSANCE', label: 'Croissance' },
  { value: 'DYNAMIQUE', label: 'Dynamique' },
] as const;

export const ASSET_CLASSES = [
  { value: 'EQUITY', label: 'Actions' },
  { value: 'FIXED_INCOME', label: 'Revenu fixe' },
  { value: 'CASH', label: 'Liquidités' },
  { value: 'ALTERNATIVE', label: 'Alternatifs' },
  { value: 'REAL_ESTATE', label: 'Immobilier' },
  { value: 'COMMODITY', label: 'Matières premières' },
] as const;

export const REGIONS = [
  { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'États-Unis' },
  { value: 'INTL', label: 'International' },
  { value: 'EM', label: 'Marchés émergents' },
] as const;

export const SECTORS = [
  { value: 'TECHNOLOGY', label: 'Technologie' },
  { value: 'HEALTHCARE', label: 'Santé' },
  { value: 'FINANCIALS', label: 'Finance' },
  { value: 'ENERGY', label: 'Énergie' },
  { value: 'MATERIALS', label: 'Matériaux' },
  { value: 'INDUSTRIALS', label: 'Industriels' },
  { value: 'CONSUMER_DISC', label: 'Cons. discrétionnaire' },
  { value: 'CONSUMER_STAPLES', label: 'Cons. de base' },
  { value: 'UTILITIES', label: 'Services publics' },
  { value: 'REAL_ESTATE', label: 'Immobilier' },
  { value: 'TELECOM', label: 'Télécommunications' },
] as const;

export const BENCHMARK_DEFAULTS = [
  { symbol: '^GSPTSE', name: 'S&P/TSX Composite', region: 'CA' },
  { symbol: '^GSPC', name: 'S&P 500', region: 'US' },
  { symbol: 'URTH', name: 'MSCI World ETF', region: 'INTL' },
  { symbol: 'XBB.TO', name: 'iShares Core Canadian Universe Bond', region: 'CA' },
] as const;

export const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

export const MARKET_HOURS = {
  open: 9.5, // 9:30 AM EST
  close: 16, // 4:00 PM EST
  timezone: 'America/New_York',
} as const;

export const CACHE_TTL = {
  QUOTE: 15 * 60 * 1000,       // 15 min
  PROFILE: 24 * 60 * 60 * 1000, // 24h
  HISTORICAL: Infinity,          // permanent
  EXCHANGE_RATE: 12 * 60 * 60 * 1000, // 12h
} as const;

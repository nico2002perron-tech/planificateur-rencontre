export const PREDEFINED_BENCHMARKS = [
  {
    symbol: '^GSPTSE',
    name: 'S&P/TSX Composite',
    region: 'CA',
    description: 'Indice principal du marché canadien',
    color: '#ef4444',
  },
  {
    symbol: '^GSPC',
    name: 'S&P 500',
    region: 'US',
    description: 'Indice des 500 plus grandes entreprises américaines',
    color: '#3b82f6',
  },
  {
    symbol: 'URTH',
    name: 'MSCI World ETF',
    region: 'INTL',
    description: 'ETF répliquant l\'indice MSCI World',
    color: '#10b981',
  },
  {
    symbol: 'XBB.TO',
    name: 'iShares Canadian Universe Bond',
    region: 'CA',
    description: 'ETF obligataire canadien',
    color: '#f59e0b',
  },
  {
    symbol: '^IXIC',
    name: 'NASDAQ Composite',
    region: 'US',
    description: 'Indice technologique américain',
    color: '#8b5cf6',
  },
  {
    symbol: 'XIU.TO',
    name: 'iShares S&P/TSX 60',
    region: 'CA',
    description: 'ETF des 60 plus grandes entreprises canadiennes',
    color: '#ec4899',
  },
] as const;

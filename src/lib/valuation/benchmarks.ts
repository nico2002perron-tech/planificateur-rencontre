/** Benchmarks — port de data/benchmarks.py */

export interface BenchmarkData {
  tickers?: string[];
  gr_sales: number;
  gr_fcf: number;
  gr_eps: number;
  ps: number;
  pe: number;
  p_fcf: number;
  wacc: number;
  name: string;
  source?: string;
  peers?: string;
}

export const PEER_GROUPS: Record<string, BenchmarkData> = {
  SPACE_TECH: {
    tickers: ['MDA', 'RKLB', 'ASTS', 'LUNR', 'PL', 'SPIR', 'SPCE', 'PNG', 'IONQ'],
    gr_sales: 20, gr_fcf: 25, gr_eps: 25, ps: 6, pe: 40, p_fcf: 35, wacc: 11,
    name: 'Space Tech & Robotics',
  },
  CYBERSECURITY: {
    tickers: ['PANW', 'CRWD', 'FTNT', 'ZS', 'OKTA', 'NET', 'CYBR'],
    gr_sales: 22, gr_fcf: 25, gr_eps: 25, ps: 9, pe: 45, p_fcf: 35, wacc: 10,
    name: 'Cybersecurity & Network',
  },
  SEMICONDUCTORS: {
    tickers: ['NVDA', 'AMD', 'INTC', 'TSM', 'AVGO', 'QCOM', 'MU', 'TXN'],
    gr_sales: 18, gr_fcf: 20, gr_eps: 20, ps: 8, pe: 35, p_fcf: 30, wacc: 10,
    name: 'Semiconductors & IA',
  },
  BIG_TECH: {
    tickers: ['AAPL', 'MSFT', 'GOOG', 'GOOGL', 'AMZN', 'META'],
    gr_sales: 12, gr_fcf: 15, gr_eps: 15, ps: 6.5, pe: 25, p_fcf: 28, wacc: 9,
    name: 'Big Tech / GAFAM',
  },
  CONSUMER_APPS: {
    tickers: ['DUOL', 'UBER', 'ABNB', 'SPOT', 'DASH', 'BKNG', 'PINS', 'SNAP'],
    gr_sales: 18, gr_fcf: 25, gr_eps: 25, ps: 5, pe: 30, p_fcf: 25, wacc: 10,
    name: 'Consumer Apps & Platforms',
  },
  SAAS_CLOUD: {
    tickers: ['CRM', 'ADBE', 'SNOW', 'DDOG', 'PLTR', 'NOW', 'SHOP', 'WDAY', 'MDB'],
    gr_sales: 20, gr_fcf: 22, gr_eps: 25, ps: 9, pe: 40, p_fcf: 35, wacc: 10,
    name: 'SaaS & Enterprise Cloud',
  },
  PHARMA_BIO: {
    tickers: ['LLY', 'NVO', 'JNJ', 'PFE', 'MRK', 'ABBV', 'AMGN'],
    gr_sales: 8, gr_fcf: 10, gr_eps: 12, ps: 5, pe: 25, p_fcf: 22, wacc: 8.5,
    name: 'Pharma & Biotech',
  },
  FINANCE_US: {
    tickers: ['JPM', 'BAC', 'V', 'MA', 'AXP', 'GS', 'MS'],
    gr_sales: 6, gr_fcf: 8, gr_eps: 10, ps: 3, pe: 15, p_fcf: 15, wacc: 9,
    name: 'US Finance & Payments',
  },
  ENERGY_OIL: {
    tickers: ['XOM', 'CVX', 'SHEL', 'TTE', 'BP', 'COP', 'VLE', 'SU', 'CNQ'],
    gr_sales: 3, gr_fcf: 5, gr_eps: 5, ps: 1.5, pe: 10, p_fcf: 8, wacc: 10,
    name: 'Energy & Oil Majors',
  },
  AEROSPACE_DEF: {
    tickers: ['LMT', 'RTX', 'BA', 'GD', 'NOC', 'GE'],
    gr_sales: 5, gr_fcf: 8, gr_eps: 8, ps: 2, pe: 18, p_fcf: 18, wacc: 8.5,
    name: 'Aerospace & Defense',
  },
  STREAMING: {
    tickers: ['NFLX', 'DIS', 'WBD', 'PARA', 'ROKU'],
    gr_sales: 10, gr_fcf: 15, gr_eps: 18, ps: 4, pe: 25, p_fcf: 20, wacc: 9,
    name: 'Streaming & Media',
  },
  EV_AUTO: {
    tickers: ['TSLA', 'RIVN', 'LCID', 'BYD', 'F', 'GM'],
    gr_sales: 15, gr_fcf: 12, gr_eps: 15, ps: 3, pe: 30, p_fcf: 25, wacc: 11,
    name: 'Véhicules Électriques',
  },
  BANKS_CA: {
    tickers: ['RY', 'TD', 'BMO', 'BNS', 'CM', 'NA'],
    gr_sales: 4, gr_fcf: 5, gr_eps: 6, ps: 2.5, pe: 11, p_fcf: 12, wacc: 8,
    name: 'Banques Canadiennes',
  },
};

export const SECTOR_BENCHMARKS: Record<string, Omit<BenchmarkData, 'name'>> = {
  Technology: { gr_sales: 12, gr_fcf: 15, gr_eps: 15, ps: 5, pe: 25, p_fcf: 25, wacc: 9.5 },
  Default:    { gr_sales: 7,  gr_fcf: 8,  gr_eps: 8,  ps: 2.5, pe: 15, p_fcf: 15, wacc: 9 },
};

export function getBenchmarkData(ticker: string, sector: string): BenchmarkData {
  const clean = ticker.toUpperCase().split('.')[0];

  for (const [, data] of Object.entries(PEER_GROUPS)) {
    const cleanList = (data.tickers ?? []).map((t) => t.toUpperCase().split('.')[0]);
    if (cleanList.includes(clean)) {
      const peers = (data.tickers ?? [])
        .filter((t) => t.toUpperCase().split('.')[0] !== clean)
        .slice(0, 5)
        .join(', ');
      return { ...data, source: 'Comparables', peers: peers || 'Pairs non disponibles' };
    }
  }

  const bench = SECTOR_BENCHMARKS[sector] ?? SECTOR_BENCHMARKS['Default'];
  return {
    ...bench,
    name: sector || 'Général',
    source: 'Secteur',
    peers: 'Moyenne sectorielle',
  };
}

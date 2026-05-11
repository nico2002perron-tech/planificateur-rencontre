/**
 * EODHD API client — Fundamentals data
 * Plan: Fundamentals Data Feed ($59.99/mo)
 * Available: Stock fundamentals, ETF fundamentals, Mutual Fund fundamentals
 * NOT available: EOD prices, dividends (use Yahoo Finance for those)
 */

const BASE = 'https://eodhd.com/api';

function apiKey(): string {
  const key = process.env.EODHD_API_KEY;
  if (!key) throw new Error('EODHD_API_KEY not configured');
  return key;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface EODHDFundamentals {
  general: {
    code: string;
    type: string;
    name: string;
    exchange: string;
    currencyCode: string;
    countryName: string;
    countryISO: string;
    sector: string;
    industry: string;
    gicSector: string;
    gicGroup: string;
    gicIndustry: string;
    gicSubIndustry: string;
    description: string;
    ipoDate: string | null;
    marketCap: number;
  };
  highlights: {
    marketCapitalization: number;
    peRatio: number | null;
    pegRatio: number | null;
    earningsShare: number | null;
    dividendShare: number | null;
    dividendYield: number | null;
    profitMargin: number | null;
    operatingMarginTTM: number | null;
    returnOnAssetsTTM: number | null;
    returnOnEquityTTM: number | null;
    revenueTTM: number | null;
    revenuePerShareTTM: number | null;
    quarterlyRevenueGrowthYOY: number | null;
    grossProfitTTM: number | null;
    ebitda: number | null;
    netIncomeToCommon: number | null;
    eps: number | null;
    bookValue: number | null;
    priceToBook: number | null;
    priceToSales: number | null;
    wallStreetTargetPrice: number | null;
  };
  valuation: {
    trailingPE: number | null;
    forwardPE: number | null;
    priceSalesTTM: number | null;
    priceBookMRQ: number | null;
    enterpriseValueRevenue: number | null;
    enterpriseValueEbitda: number | null;
  };
  technicals: {
    beta: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    fiftyDayMA: number | null;
    twoHundredDayMA: number | null;
    sharesOutstanding: number | null;
    sharesFloat: number | null;
    shortRatio: number | null;
  };
}

export interface EODHDETFData {
  general: {
    code: string;
    name: string;
    exchange: string;
    currencyCode: string;
    countryName: string;
  };
  etfData: {
    isin: string;
    companyName: string;
    yield: number;
    dividendPayingFrequency: string;
    inceptionDate: string;
    netExpenseRatio: number;
    totalAssets: number;
    averageMktCapMil: number;
    marketCapitalisation: {
      mega: number;
      big: number;
      medium: number;
      small: number;
      micro: number;
    };
    assetAllocation: Record<string, { longPct: number; shortPct: number; netAssetsPct: number }>;
    worldRegions: Record<string, { equityPct: number; relativePct: number }>;
    sectorWeights: Record<string, { equityPct: number; relativePct: number }>;
    topTenHoldings: Record<string, { name: string; assets: number }>;
    holdings: Record<string, { code: string; exchange: string; name: string; sector: string; industry: string; country: string; region: string; assets: number }>;
    valuationsGrowth: {
      realtimePosition?: number;
      categoryAverage?: number;
    };
  };
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function eodhFetch(endpoint: string): Promise<unknown> {
  const url = `${BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_token=${apiKey()}&fmt=json`;
  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) {
    if (res.status === 403) throw new Error(`EODHD Forbidden — check plan for: ${endpoint}`);
    throw new Error(`EODHD ${res.status}: ${endpoint}`);
  }
  return res.json();
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch stock fundamentals from EODHD.
 * Symbol format: "AAPL.US", "RY.TO", etc.
 */
export async function getEODHDFundamentals(symbol: string): Promise<EODHDFundamentals | null> {
  try {
    const raw = await eodhFetch(`/fundamentals/${encodeURIComponent(symbol)}`) as Record<string, unknown>;
    if (!raw || !raw.General) return null;

    const gen = raw.General as Record<string, unknown>;
    const hl = (raw.Highlights ?? {}) as Record<string, unknown>;
    const val = (raw.Valuation ?? {}) as Record<string, unknown>;
    const tech = (raw.Technicals ?? {}) as Record<string, unknown>;

    const num = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return isFinite(n) ? n : null;
    };

    return {
      general: {
        code: String(gen.Code ?? ''),
        type: String(gen.Type ?? ''),
        name: String(gen.Name ?? ''),
        exchange: String(gen.Exchange ?? ''),
        currencyCode: String(gen.CurrencyCode ?? ''),
        countryName: String(gen.CountryName ?? ''),
        countryISO: String(gen.CountryISO ?? ''),
        sector: String(gen.Sector ?? ''),
        industry: String(gen.Industry ?? ''),
        gicSector: String(gen.GicSector ?? ''),
        gicGroup: String(gen.GicGroup ?? ''),
        gicIndustry: String(gen.GicIndustry ?? ''),
        gicSubIndustry: String(gen.GicSubIndustry ?? ''),
        description: String(gen.Description ?? ''),
        ipoDate: gen.IPODate ? String(gen.IPODate) : null,
        marketCap: num(hl.MarketCapitalization) ?? 0,
      },
      highlights: {
        marketCapitalization: num(hl.MarketCapitalization) ?? 0,
        peRatio: num(hl.PERatio),
        pegRatio: num(hl.PEGRatio),
        earningsShare: num(hl.EarningsShare),
        dividendShare: num(hl.DividendShare),
        dividendYield: num(hl.DividendYield),
        profitMargin: num(hl.ProfitMargin),
        operatingMarginTTM: num(hl.OperatingMarginTTM),
        returnOnAssetsTTM: num(hl.ReturnOnAssetsTTM),
        returnOnEquityTTM: num(hl.ReturnOnEquityTTM),
        revenueTTM: num(hl.RevenueTTM),
        revenuePerShareTTM: num(hl.RevenuePerShareTTM),
        quarterlyRevenueGrowthYOY: num(hl.QuarterlyRevenueGrowthYOY),
        grossProfitTTM: num(hl.GrossProfitTTM),
        ebitda: num(hl.EBITDA),
        netIncomeToCommon: num(hl.NetIncomeToCommon),
        eps: num(hl.EarningsShare),
        bookValue: num(hl.BookValue),
        priceToBook: num(val.PriceBookMRQ),
        priceToSales: num(val.PriceSalesTTM),
        wallStreetTargetPrice: num(hl.WallStreetTargetPrice),
      },
      valuation: {
        trailingPE: num(val.TrailingPE),
        forwardPE: num(val.ForwardPE),
        priceSalesTTM: num(val.PriceSalesTTM),
        priceBookMRQ: num(val.PriceBookMRQ),
        enterpriseValueRevenue: num(val.EnterpriseValueRevenue),
        enterpriseValueEbitda: num(val.EnterpriseValueEbitda),
      },
      technicals: {
        beta: num(tech.Beta),
        fiftyTwoWeekHigh: num(tech['52WeekHigh']),
        fiftyTwoWeekLow: num(tech['52WeekLow']),
        fiftyDayMA: num(tech['50DayMA']),
        twoHundredDayMA: num(tech['200DayMA']),
        sharesOutstanding: num(tech.SharesOutstanding),
        sharesFloat: num(tech.SharesFloat),
        shortRatio: num(tech.ShortRatio),
      },
    };
  } catch (e) {
    console.error(`EODHD fundamentals error for ${symbol}:`, e);
    return null;
  }
}

/**
 * Fetch ETF data from EODHD (includes holdings, sectors, regions, allocation).
 */
export async function getEODHDETFData(symbol: string): Promise<EODHDETFData | null> {
  try {
    const raw = await eodhFetch(`/fundamentals/${encodeURIComponent(symbol)}`) as Record<string, unknown>;
    if (!raw || !raw.General) return null;

    const gen = raw.General as Record<string, unknown>;
    const etf = (raw.ETF_Data ?? {}) as Record<string, unknown>;

    if (!etf || Object.keys(etf).length === 0) return null;

    const num = (v: unknown): number => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(v);
      return isFinite(n) ? n : 0;
    };

    const mktCap = (etf.Market_Capitalisation ?? {}) as Record<string, unknown>;
    const assetAlloc = (etf.Asset_Allocation ?? {}) as Record<string, Record<string, unknown>>;
    const worldRegs = (etf.World_Regions ?? {}) as Record<string, Record<string, unknown>>;
    const sectors = (etf.Sector_Weights ?? {}) as Record<string, Record<string, unknown>>;
    const top10 = (etf.Top_10_Holdings ?? {}) as Record<string, Record<string, unknown>>;
    const holdingsRaw = (etf.Holdings ?? {}) as Record<string, Record<string, unknown>>;

    const parseAllocMap = (data: Record<string, Record<string, unknown>>) => {
      const result: Record<string, { longPct: number; shortPct: number; netAssetsPct: number }> = {};
      for (const [key, val] of Object.entries(data)) {
        result[key] = {
          longPct: num(val['Long_%']),
          shortPct: num(val['Short_%']),
          netAssetsPct: num(val['Net_Assets_%']),
        };
      }
      return result;
    };

    const parseWeightMap = (data: Record<string, Record<string, unknown>>) => {
      const result: Record<string, { equityPct: number; relativePct: number }> = {};
      for (const [key, val] of Object.entries(data)) {
        result[key] = {
          equityPct: num(val['Equity_%']),
          relativePct: num(val['Relative_to_Category']),
        };
      }
      return result;
    };

    const holdingsMap: EODHDETFData['etfData']['holdings'] = {};
    for (const [key, val] of Object.entries(holdingsRaw)) {
      holdingsMap[key] = {
        code: String(val.Code ?? ''),
        exchange: String(val.Exchange ?? ''),
        name: String(val.Name ?? ''),
        sector: String(val.Sector ?? ''),
        industry: String(val.Industry ?? ''),
        country: String(val.Country ?? ''),
        region: String(val.Region ?? ''),
        assets: num(val['Assets_%']),
      };
    }

    const top10Map: Record<string, { name: string; assets: number }> = {};
    for (const [key, val] of Object.entries(top10)) {
      top10Map[key] = {
        name: String(val.Name ?? ''),
        assets: num(val['Assets_%']),
      };
    }

    return {
      general: {
        code: String(gen.Code ?? ''),
        name: String(gen.Name ?? ''),
        exchange: String(gen.Exchange ?? ''),
        currencyCode: String(gen.CurrencyCode ?? ''),
        countryName: String(gen.CountryName ?? ''),
      },
      etfData: {
        isin: String(etf.ISIN ?? ''),
        companyName: String(etf.Company_Name ?? ''),
        yield: num(etf.Yield),
        dividendPayingFrequency: String(etf.Dividend_Paying_Frequency ?? ''),
        inceptionDate: String(etf.Inception_Date ?? ''),
        netExpenseRatio: num(etf.NetExpenseRatio),
        totalAssets: num(etf.TotalAssets),
        averageMktCapMil: num(etf.Average_Mkt_Cap_Mil),
        marketCapitalisation: {
          mega: num(mktCap.Mega),
          big: num(mktCap.Big),
          medium: num(mktCap.Medium),
          small: num(mktCap.Small),
          micro: num(mktCap.Micro),
        },
        assetAllocation: parseAllocMap(assetAlloc),
        worldRegions: parseWeightMap(worldRegs),
        sectorWeights: parseWeightMap(sectors),
        topTenHoldings: top10Map,
        holdings: holdingsMap,
        valuationsGrowth: {},
      },
    };
  } catch (e) {
    console.error(`EODHD ETF data error for ${symbol}:`, e);
    return null;
  }
}

/**
 * Batch-fetch fundamentals (max 4 concurrent to respect rate limits).
 */
export async function getEODHDFundamentalsBatch(
  symbols: string[]
): Promise<Map<string, EODHDFundamentals>> {
  const BATCH = 4;
  const result = new Map<string, EODHDFundamentals>();

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(s => getEODHDFundamentals(s)));
    batch.forEach((s, j) => {
      if (results[j]) result.set(s, results[j]!);
    });
  }

  return result;
}

/**
 * Convert internal symbol format to EODHD format.
 * e.g., "AAPL" → "AAPL.US", "RY.TO" → "RY.TO" (already correct)
 */
export function toEODHDSymbol(symbol: string): string {
  if (symbol.includes('.')) return symbol; // Already has exchange suffix
  return `${symbol}.US`; // Default to US
}

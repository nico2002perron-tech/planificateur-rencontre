/**
 * Yahoo Finance — Client partagé (côté serveur uniquement)
 * Utilisé par : /api/valuation/stock/[ticker] et /api/reports/generate
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Crumb cache module-level ──────────────────────────────────────────────────
let crumbCache: { crumb: string; cookie: string; ts: number } | null = null;

export async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (crumbCache && Date.now() - crumbCache.ts < 3_600_000) return crumbCache;

  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    redirect: 'follow',
  });
  const rawCookies: string[] = [];
  cookieRes.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'set-cookie') rawCookies.push(val.split(';')[0]);
  });
  const cookie = rawCookies.join('; ');

  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  });
  if (!crumbRes.ok) throw new Error(`Yahoo crumb: ${crumbRes.status}`);
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes('<')) throw new Error('Crumb Yahoo invalide');

  crumbCache = { crumb, cookie, ts: Date.now() };
  return crumbCache;
}

export async function yahooFetch(url: string): Promise<Response> {
  const { crumb, cookie } = await getYahooCrumb();
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}crumb=${encodeURIComponent(crumb)}`, {
    headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json' },
  });
  if (res.status === 401) {
    crumbCache = null;
    const { crumb: c2, cookie: ck2 } = await getYahooCrumb();
    return fetch(`${url}${sep}crumb=${encodeURIComponent(c2)}`, {
      headers: { 'User-Agent': UA, Cookie: ck2, Accept: 'application/json' },
    });
  }
  return res;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface YahooPriceTarget {
  targetLow: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  numAnalysts: number;
  recommendationKey: string;
}

export interface YahooNewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string; // ISO date string
  thumbnail?: string;
}

export interface YahooEarnings {
  nextEarningsDate: string | null;   // "YYYY-MM-DD"
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

// ── Symbol conversion (Canadian REITs: EIF.UN.TO → EIF-UN.TO) ─────────────────

/** Convert dot-separated unit symbols to Yahoo format (e.g. EIF.UN.TO → EIF-UN.TO) */
export function toYahooSymbol(symbol: string): string {
  // Match patterns like X.UN.TO, X.PR.A.TO, X.DB.TO etc.
  return symbol.replace(/\.([A-Z]{1,3})\.TO$/i, '-$1.TO')
               .replace(/\.([A-Z]{1,3})\.V$/i, '-$1.V');
}

// ── USD/CAD Exchange Rate (cached, for .TO fallback conversion) ───────────────

let usdCadCache: { rate: number; ts: number } | null = null;

/**
 * Fetch current USD/CAD exchange rate from Yahoo Finance.
 * Cached for 1 hour. Used to convert US price targets to CAD
 * when falling back to US tickers for interlisted .TO stocks.
 */
export async function getUsdCadRate(): Promise<number> {
  if (usdCadCache && Date.now() - usdCadCache.ts < 3_600_000) return usdCadCache.rate;

  try {
    const url = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/USDCAD%3DX?modules=price';
    const res = await yahooFetch(url);
    if (!res.ok) return usdCadCache?.rate ?? 1.38; // fallback to approximate
    const json = await res.json();
    const rate = json?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw;
    if (rate && isFinite(rate) && rate > 0) {
      usdCadCache = { rate, ts: Date.now() };
      return rate;
    }
  } catch { /* use fallback */ }

  return usdCadCache?.rate ?? 1.38;
}

// ── Prix cible 1 an ───────────────────────────────────────────────────────────

const EMPTY_TARGET: YahooPriceTarget = { targetLow: null, targetMean: null, targetHigh: null, numAnalysts: 0, recommendationKey: 'none' };

/** Internal: fetch price target for a single symbol without fallback. */
async function fetchYahooPriceTargetDirect(sym: string): Promise<YahooPriceTarget> {
  try {
    const ySym = toYahooSymbol(sym);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=financialData`;
    const res = await yahooFetch(url);
    if (!res.ok) return EMPTY_TARGET;

    const json = await res.json();
    const fd = json?.quoteSummary?.result?.[0]?.financialData ?? {};

    function raw(obj: unknown): number | null {
      if (obj && typeof obj === 'object' && 'raw' in obj) {
        const v = Number((obj as { raw: number }).raw);
        return isFinite(v) && v > 0 ? v : null;
      }
      return null;
    }

    return {
      targetLow:  raw(fd.targetLowPrice),
      targetMean: raw(fd.targetMeanPrice),
      targetHigh: raw(fd.targetHighPrice),
      numAnalysts: Number((fd.numberOfAnalystOpinions as { raw?: number })?.raw ?? 0),
      recommendationKey: String(fd.recommendationKey ?? 'none'),
    };
  } catch {
    return EMPTY_TARGET;
  }
}

/**
 * Fetch analyst price target from Yahoo Finance.
 * Falls back to US base ticker for interlisted .TO stocks with no target.
 * When falling back, converts USD targets to CAD using live exchange rate.
 */
export async function getYahooPriceTarget(symbol: string): Promise<YahooPriceTarget> {
  const result = await fetchYahooPriceTargetDirect(symbol);

  // Fallback: .TO with no analyst target → try US ticker, convert USD → CAD
  if (symbol.endsWith('.TO') && !result.targetMean) {
    const usTicker = symbol.replace('.TO', '');
    const usResult = await fetchYahooPriceTargetDirect(usTicker);
    if (usResult.targetMean) {
      const rate = await getUsdCadRate();
      return {
        targetLow: usResult.targetLow ? Math.round(usResult.targetLow * rate * 100) / 100 : null,
        targetMean: usResult.targetMean ? Math.round(usResult.targetMean * rate * 100) / 100 : null,
        targetHigh: usResult.targetHigh ? Math.round(usResult.targetHigh * rate * 100) / 100 : null,
        numAnalysts: usResult.numAnalysts,
        recommendationKey: usResult.recommendationKey,
      };
    }
  }

  return result;
}

/**
 * Récupère les prix cibles pour une liste de symboles en parallèle (max 6 à la fois).
 * Retourne une Map symbol → YahooPriceTarget
 */
export async function getYahooPriceTargets(symbols: string[]): Promise<Map<string, YahooPriceTarget>> {
  const BATCH = 6;
  const result = new Map<string, YahooPriceTarget>();

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((s) => getYahooPriceTarget(s)));
    batch.forEach((s, j) => result.set(s.toUpperCase(), results[j]));
  }

  return result;
}

// ── News ──────────────────────────────────────────────────────────────────────

/** Resolve a ticker symbol to its company name via Yahoo search (for better news lookup) */
async function resolveCompanyName(symbol: string): Promise<string | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=0&quotesCount=1&enableFuzzyQuery=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const quote = json?.quotes?.[0];
    if (!quote) return null;
    // Use longname or shortname — strip suffixes like "Inc.", "Corp." etc. for cleaner search
    return quote.longname || quote.shortname || null;
  } catch {
    return null;
  }
}

function parseNewsItems(items: Record<string, unknown>[]): YahooNewsItem[] {
  return items.map((item) => ({
    title:       String(item.title ?? ''),
    publisher:   String(item.publisher ?? ''),
    link:        String(item.link ?? ''),
    publishedAt: item.providerPublishTime
      ? new Date(Number(item.providerPublishTime) * 1000).toISOString()
      : '',
    thumbnail:   (item.thumbnail as { resolutions?: { url: string }[] })?.resolutions?.[0]?.url,
  }));
}

export async function getYahooNews(symbol: string, count = 8): Promise<YahooNewsItem[]> {
  try {
    // Step 1: resolve the company name from the ticker for better news results
    const companyName = await resolveCompanyName(symbol);
    const searchQuery = companyName || symbol;

    // Step 2: search news by company name (much more relevant than ticker search)
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}&newsCount=${count}&quotesCount=0&enableFuzzyQuery=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const json = await res.json();
    const items = json?.news ?? [];

    return parseNewsItems(items as Record<string, unknown>[]);
  } catch {
    return [];
  }
}

// ── Earnings ──────────────────────────────────────────────────────────────────

export async function getYahooEarnings(symbol: string): Promise<YahooEarnings> {
  try {
    const ySym = toYahooSymbol(symbol);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=calendarEvents,earningsTrend`;
    const res = await yahooFetch(url);
    if (!res.ok) return { nextEarningsDate: null, epsEstimate: null, revenueEstimate: null };

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0] ?? {};
    const cal = result.calendarEvents ?? {};

    // Prochaine date de résultats
    const earningsDate = (cal.earnings?.earningsDate ?? []) as { fmt?: string }[];
    const nextDate = earningsDate[0]?.fmt ?? null;

    // Estimés analystes (earningsTrend — trimestre courant)
    const trend = (result.earningsTrend?.trend ?? []) as Record<string, unknown>[];
    const current = trend.find((t) => t.period === '0q') ?? trend[0];
    const epsEst = (current?.earningsEstimate as { avg?: { raw?: number } })?.avg?.raw ?? null;
    const revEst = (current?.revenueEstimate as { avg?: { raw?: number } })?.avg?.raw ?? null;

    return {
      nextEarningsDate: nextDate,
      epsEstimate: epsEst != null && isFinite(epsEst) ? epsEst : null,
      revenueEstimate: revEst != null && isFinite(revEst) ? revEst : null,
    };
  } catch {
    return { nextEarningsDate: null, epsEstimate: null, revenueEstimate: null };
  }
}

// ── Yahoo Profile (replaces FMP getProfile) ─────────────────────────────────

export interface YahooProfileData {
  symbol: string;
  companyName: string;
  description: string;
  sector: string;
  industry: string;
  country: string;
  beta: number;
  lastDiv: number;       // Annual dividend per share (dividendRate)
  dividendYield: number; // e.g. 0.025 = 2.5%
  mktCap: number;
  exchange: string;
  pe: number;              // summaryDetail.trailingPE
  eps: number;             // defaultKeyStatistics.trailingEps
  week52High: number;      // summaryDetail.fiftyTwoWeekHigh
  week52Low: number;       // summaryDetail.fiftyTwoWeekLow
  earningsGrowth: number;  // financialData.earningsGrowth
  debtToEquity: number;    // financialData.debtToEquity (e.g. 150 = 150%)
  currentRatio: number;    // financialData.currentRatio
  profitMargins: number;   // financialData.profitMargins (decimal, e.g. 0.25 = 25%)
  revenueGrowth: number;   // financialData.revenueGrowth (decimal, e.g. 0.12 = 12%)
  freeCashflow: number;    // financialData.freeCashflow (absolute $)
  returnOnEquity: number;  // financialData.returnOnEquity (decimal, e.g. 0.18 = 18%)
  forwardPE: number;       // defaultKeyStatistics.forwardPe
}

/**
 * Count how many key fundamental fields have real data (non-zero).
 * Used to detect sparse profiles (e.g., interlisted .TO tickers with no fundamentals).
 */
function profileDataPoints(p: YahooProfileData): number {
  let n = 0;
  if (p.pe > 0) n++;
  if (p.eps !== 0) n++;
  if (p.beta > 0) n++;
  if (p.profitMargins !== 0) n++;
  if (p.debtToEquity > 0) n++;
  if (p.earningsGrowth !== 0) n++;
  if (p.mktCap > 0) n++;
  if (p.freeCashflow !== 0) n++;
  if (p.returnOnEquity !== 0) n++;
  if (p.revenueGrowth !== 0) n++;
  return n;
}

/** Internal: fetch a single Yahoo profile without fallback logic. */
async function fetchYahooProfileDirect(sym: string): Promise<YahooProfileData | null> {
  try {
    const ySym = toYahooSymbol(sym);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=price,summaryDetail,assetProfile,defaultKeyStatistics,financialData`;
    const res = await yahooFetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const r = json?.quoteSummary?.result?.[0];
    if (!r) return null;

    const price = r.price ?? {};
    const sd = r.summaryDetail ?? {};
    const ap = r.assetProfile ?? {};
    const ks = r.defaultKeyStatistics ?? {};
    const fd = r.financialData ?? {};

    const raw = (obj: unknown): number => {
      if (obj && typeof obj === 'object' && 'raw' in obj) {
        const v = Number((obj as { raw: number }).raw);
        return isFinite(v) ? v : 0;
      }
      return 0;
    };

    return {
      symbol: sym,
      companyName: price.shortName ?? price.longName ?? '',
      description: typeof ap.longBusinessSummary === 'string' ? ap.longBusinessSummary : '',
      sector: ap.sector ?? '',
      industry: ap.industry ?? '',
      country: ap.country ?? '',
      beta: raw(ks.beta) || raw(sd.beta) || 0,
      lastDiv: raw(sd.dividendRate),
      dividendYield: raw(sd.dividendYield),
      mktCap: raw(price.marketCap) || raw(sd.marketCap),
      exchange: price.exchangeName ?? price.exchange ?? '',
      pe: raw(sd.trailingPE),
      eps: raw(ks.trailingEps),
      week52High: raw(sd.fiftyTwoWeekHigh),
      week52Low: raw(sd.fiftyTwoWeekLow),
      earningsGrowth: raw(fd.earningsGrowth),
      debtToEquity: raw(fd.debtToEquity),
      currentRatio: raw(fd.currentRatio),
      profitMargins: raw(fd.profitMargins),
      revenueGrowth: raw(fd.revenueGrowth),
      freeCashflow: raw(fd.freeCashflow),
      returnOnEquity: raw(fd.returnOnEquity),
      forwardPE: raw(ks.forwardPe),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch company profile from Yahoo Finance (replaces FMP getProfile).
 * Modules: price + summaryDetail + assetProfile + defaultKeyStatistics + financialData
 *
 * For interlisted .TO stocks (e.g., LMT.TO, MSFT.TO): if the Canadian ticker
 * returns sparse/no fundamental data, automatically falls back to the US base
 * ticker (LMT, MSFT) which typically has full data on Yahoo Finance.
 */
export async function getYahooProfile(symbol: string): Promise<YahooProfileData | null> {
  const result = await fetchYahooProfileDirect(symbol);

  // Fallback: .TO symbols with sparse data → try US base ticker
  // Converts USD absolute values (mktCap, FCF, EPS, lastDiv) to CAD.
  // Ratios (PE, margins, beta, yields, growth rates) are currency-agnostic.
  if (symbol.endsWith('.TO')) {
    const isSparse = !result || profileDataPoints(result) < 3;
    if (isSparse) {
      const usTicker = symbol.replace('.TO', '');
      const usResult = await fetchYahooProfileDirect(usTicker);
      if (usResult && profileDataPoints(usResult) >= 3) {
        const rate = await getUsdCadRate();
        return {
          ...usResult,
          symbol,
          // Convert absolute USD values to CAD
          mktCap: Math.round(usResult.mktCap * rate),
          freeCashflow: Math.round(usResult.freeCashflow * rate),
          eps: Math.round(usResult.eps * rate * 100) / 100,
          lastDiv: Math.round(usResult.lastDiv * rate * 100) / 100,
        };
      }
    }
  }

  return result;
}

/**
 * Batch-fetch Yahoo profiles (max 6 concurrent).
 */
export async function getYahooProfiles(symbols: string[]): Promise<Map<string, YahooProfileData>> {
  const BATCH = 6;
  const result = new Map<string, YahooProfileData>();

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((s) => getYahooProfile(s)));
    batch.forEach((s, j) => {
      if (results[j]) result.set(s, results[j]!);
    });
  }

  return result;
}

// ── Yahoo Quotes (replaces FMP getQuotes) ────────────────────────────────────

export interface YahooQuote {
  symbol: string;
  price: number;
  name: string;
  currency: string;
  sector?: string;
  dividendRate?: number;   // trailing annual dividend per share
  dividendYield?: number;  // e.g. 0.025 = 2.5%
  exDividendDate?: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Fetch current prices from Yahoo Finance (replaces FMP getQuotes).
 */
export async function getYahooQuotes(symbols: string[]): Promise<YahooQuote[]> {
  if (symbols.length === 0) return [];

  const BATCH = 6;
  const results: YahooQuote[] = [];

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const ySym = toYahooSymbol(symbol);
          const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=price,summaryDetail`;
          const res = await yahooFetch(url);
          if (!res.ok) return null;

          const json = await res.json();
          const result0 = json?.quoteSummary?.result?.[0];
          const p = result0?.price;
          const sd = result0?.summaryDetail;
          if (!p) return null;

          const currentPrice = p.regularMarketPrice?.raw ?? 0;
          if (currentPrice <= 0) return null;

          const divRate = p.trailingAnnualDividendRate?.raw;
          const divYield = sd?.dividendYield?.raw;
          const exDivRaw = sd?.exDividendDate?.raw;
          let exDivDate: string | undefined;
          if (exDivRaw && typeof exDivRaw === 'number') {
            exDivDate = new Date(exDivRaw * 1000).toISOString().split('T')[0];
          }

          return {
            symbol,
            price: Math.round(currentPrice * 100) / 100,
            name: p.shortName ?? p.longName ?? '',
            currency: p.currency ?? '',
            sector: undefined,
            dividendRate: divRate && isFinite(divRate) && divRate > 0 ? Math.round(divRate * 10000) / 10000 : undefined,
            dividendYield: divYield && isFinite(divYield) && divYield > 0 ? Math.round(divYield * 10000) / 10000 : undefined,
            exDividendDate: exDivDate,
          } as YahooQuote;
        } catch {
          return null;
        }
      })
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

// ── Historical Chart Data (10y monthly) ─────────────────────────────

export interface YahooChartPoint {
  date: string;     // YYYY-MM-DD
  adjClose: number; // Adjusted close (includes dividends/splits)
}

/**
 * Fetch monthly adjusted close prices from Yahoo Finance chart API.
 * Used for benchmark comparison (S&P 500, TSX) and portfolio simulation.
 * @param symbol Yahoo symbol (e.g. ^GSPC, ^GSPTSE, AAPL)
 * @param years Number of years of history (default 10)
 * @returns Array of monthly { date, adjClose } sorted ascending
 */
export async function getYahooHistoricalChart(
  symbol: string,
  years = 10
): Promise<YahooChartPoint[]> {
  try {
    const ySym = toYahooSymbol(symbol);
    const range = years <= 5 ? '5y' : years <= 10 ? '10y' : 'max';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?range=${range}&interval=1mo&includeAdjustedClose=true`;
    const res = await yahooFetch(url);
    if (!res.ok) return [];

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp ?? [];
    const adjCloseArr: number[] =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      [];

    if (timestamps.length === 0 || adjCloseArr.length === 0) return [];

    const points: YahooChartPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const adj = adjCloseArr[i];
      if (adj == null || !isFinite(adj) || adj <= 0) continue;
      const d = new Date(timestamps[i] * 1000);
      points.push({
        date: d.toISOString().split('T')[0],
        adjClose: Math.round(adj * 100) / 100,
      });
    }

    return points.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// ── ETF Sector Breakdown ─────────────────────────────────────────────────────

/**
 * Yahoo topHoldings sector key → FMP-compatible sector name
 * (matches the keys used in SECTOR_LABELS_FR in report-data.ts)
 */
const YAHOO_SECTOR_MAP: Record<string, string> = {
  realestate: 'Real Estate',
  consumer_cyclical: 'Consumer Cyclical',
  basic_materials: 'Basic Materials',
  consumer_defensive: 'Consumer Defensive',
  technology: 'Technology',
  communication_services: 'Communication Services',
  financial_services: 'Financial Services',
  utilities: 'Utilities',
  industrials: 'Industrials',
  energy: 'Energy',
  healthcare: 'Healthcare',
};

export interface ETFSectorWeight {
  sector: string;   // FMP-compatible sector name
  weight: number;   // 0–1 (e.g. 0.318 = 31.8%)
}

/**
 * Fetch ETF sector breakdown from Yahoo Finance topHoldings module.
 * Returns null if the symbol is not an ETF or has no sector data.
 */
export async function getYahooETFSectors(symbol: string): Promise<ETFSectorWeight[] | null> {
  try {
    const ySym = toYahooSymbol(symbol);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=topHoldings`;
    const res = await yahooFetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const topHoldings = json?.quoteSummary?.result?.[0]?.topHoldings;
    if (!topHoldings?.sectorWeightings) return null;

    const weightings = topHoldings.sectorWeightings as Record<string, { raw?: number }>[];
    if (!Array.isArray(weightings) || weightings.length === 0) return null;

    const sectors: ETFSectorWeight[] = [];
    for (const entry of weightings) {
      // Each entry is { "technology": { "raw": 0.318 } }
      for (const [yahooKey, valObj] of Object.entries(entry)) {
        const weight = valObj?.raw ?? 0;
        if (weight > 0) {
          const sector = YAHOO_SECTOR_MAP[yahooKey] || yahooKey;
          sectors.push({ sector, weight });
        }
      }
    }

    return sectors.length > 0 ? sectors : null;
  } catch {
    return null;
  }
}

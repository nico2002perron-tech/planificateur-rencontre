import { NextRequest, NextResponse } from 'next/server';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Crumb cache ───────────────────────────────────────────────────────────────
let crumbCache: { crumb: string; cookie: string; ts: number } | null = null;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
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
  if (!crumbRes.ok) throw new Error(`Crumb fetch failed: ${crumbRes.status}`);
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes('<')) throw new Error('Crumb invalide reçu');

  crumbCache = { crumb, cookie, ts: Date.now() };
  return crumbCache;
}

async function yahooFetch(url: string): Promise<Response> {
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function raw(obj: unknown): number {
  if (obj && typeof obj === 'object' && 'raw' in obj) return Number((obj as { raw: number }).raw) || 0;
  return 0;
}

function normalizeSymbol(s: string) { return s.toUpperCase().trim(); }

// ── Timeseries: données financières historiques annuelles ─────────────────────
// Yahoo Finance utilise cet endpoint sur son propre site pour les graphiques financiers
interface TimeseriesRow { year: string; [key: string]: number | string }

async function fetchTimeseries(symbol: string, cookie: string, crumb: string): Promise<TimeseriesRow[]> {
  const types = [
    'annualTotalRevenue',
    'annualNetIncome',
    'annualGrossProfit',
    'annualFreeCashFlow',
    'annualOperatingCashFlow',
    'annualCapitalExpenditure',
    'annualCashAndCashEquivalents',
    'annualTotalDebt',
    'annualTotalAssets',
    'annualTotalStockholdersEquity',
  ].join(',');

  const p1 = Math.floor(new Date('2018-01-01').getTime() / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${types}&period1=${p1}&period2=${p2}&crumb=${encodeURIComponent(crumb)}`;

  const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } });
  if (!res.ok) return [];

  const json = await res.json();
  const results: Record<string, unknown>[] = json?.timeseries?.result ?? [];

  // Regrouper par année
  const byYear: Record<string, TimeseriesRow> = {};

  for (const series of results) {
    const meta = series.meta as { type?: string[] };
    const typeName = meta?.type?.[0] ?? '';
    // Le nom court sans "annual" prefix, ex: "annualFreeCashFlow" → "freeCashFlow"
    const shortKey = typeName.replace(/^annual/, '');
    shortKey[0]?.toLowerCase();
    const key = shortKey.charAt(0).toLowerCase() + shortKey.slice(1);

    const rows = (series[typeName] ?? []) as { asOfDate: string; reportedValue?: { raw: number } }[];
    for (const row of rows) {
      const year = row.asOfDate?.substring(0, 4) ?? '';
      if (!byYear[year]) byYear[year] = { year };
      byYear[year][key] = row.reportedValue?.raw ?? 0;
    }
  }

  return Object.values(byYear).sort((a, b) => String(a.year).localeCompare(String(b.year)));
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = normalizeSymbol(ticker);

  try {
    const { crumb, cookie } = await getYahooCrumb();

    const modules = [
      'price', 'summaryDetail', 'defaultKeyStatistics', 'financialData',
      'recommendationTrend', 'upgradeDowngradeHistory', 'insiderTransactions',
      'calendarEvents', 'earningsTrend',
    ].join(',');

    const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&lang=en-US&region=US`;
    const chartUrl   = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
    const newsUrl    = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=10&quotesCount=0&enableFuzzyQuery=false`;

    const [summaryRes, chartRes, newsRes, tsData] = await Promise.all([
      yahooFetch(summaryUrl),
      yahooFetch(chartUrl),
      yahooFetch(newsUrl),
      fetchTimeseries(symbol, cookie, crumb),
    ]);

    if (!summaryRes.ok) {
      return NextResponse.json(
        { error: `Yahoo Finance: ${summaryRes.status} pour ${symbol}. Vérifiez le ticker (ex: AAPL, RY.TO, SHOP.TO).` },
        { status: summaryRes.status === 404 ? 404 : 502 }
      );
    }

    const summaryJson = await summaryRes.json();
    const chartJson   = chartRes.ok ? await chartRes.json() : {};
    const newsJson    = newsRes.ok  ? await newsRes.json()  : {};

    const result = summaryJson?.quoteSummary?.result?.[0];
    if (!result) {
      const errMsg = summaryJson?.quoteSummary?.error?.description ?? 'Ticker introuvable';
      return NextResponse.json({ error: errMsg }, { status: 404 });
    }

    // ── Extraction des métriques courantes ────────────────────────────────
    const priceData     = result.price               ?? {};
    const financialData = result.financialData       ?? {};
    const keyStats      = result.defaultKeyStatistics ?? {};
    const summaryDetail = result.summaryDetail       ?? {};

    const currentPrice      = raw(priceData.regularMarketPrice) || raw(financialData.currentPrice);
    const sharesOutstanding = raw(keyStats.sharesOutstanding)   || raw(priceData.sharesOutstanding);
    const marketCap         = raw(priceData.marketCap)          || sharesOutstanding * currentPrice;

    const revenue        = raw(financialData.totalRevenue);
    const fcf            = raw(financialData.freeCashflow);
    const eps            = raw(keyStats.trailingEps);
    const pe             = raw(summaryDetail.trailingPE) || (eps > 0 ? currentPrice / eps : 0);
    const ps             = marketCap > 0 && revenue > 0 ? marketCap / revenue : 0;
    const cash           = raw(financialData.totalCash);
    const totalDebt      = raw(financialData.totalDebt);
    const revenueGrowth  = raw(financialData.revenueGrowth);
    const earningsGrowth = raw(financialData.earningsGrowth);

    const targetLow  = financialData.targetLowPrice  ? raw(financialData.targetLowPrice)  : null;
    const targetMean = financialData.targetMeanPrice ? raw(financialData.targetMeanPrice) : null;
    const targetHigh = financialData.targetHighPrice ? raw(financialData.targetHighPrice) : null;
    const numAnalysts       = raw(financialData.numberOfAnalystOpinions);
    const recommendationKey = String(financialData.recommendationKey ?? 'none');

    // Dividend
    const dividendYield = raw(summaryDetail.dividendYield) || raw(summaryDetail.trailingAnnualDividendYield);
    const dividendRate  = raw(summaryDetail.dividendRate)  || raw(summaryDetail.trailingAnnualDividendRate);
    const payoutRatio   = raw(summaryDetail.payoutRatio);
    const exDividendDate = (summaryDetail.exDividendDate as { fmt?: string })?.fmt ?? null;

    // 52-week
    const week52High = raw(summaryDetail.fiftyTwoWeekHigh);
    const week52Low  = raw(summaryDetail.fiftyTwoWeekLow);
    const beta       = raw(summaryDetail.beta);

    // Marges (financialData)
    const grossMargin     = raw(financialData.grossMargins);
    const operatingMargin = raw(financialData.operatingMargins);
    const profitMargin    = raw(financialData.profitMargins);
    const returnOnEquity  = raw(financialData.returnOnEquity);
    const returnOnAssets  = raw(financialData.returnOnAssets);
    const debtToEquity    = raw(financialData.debtToEquity);
    const currentRatio    = raw(financialData.currentRatio);

    // Insiders & recommandations
    const insiders = ((result.insiderTransactions?.transactions ?? []) as Record<string, unknown>[])
      .slice(0, 15)
      .map((t) => ({
        date:        (t.startDate as { fmt?: string })?.fmt ?? '',
        name:        String(t.filerName ?? ''),
        relation:    String(t.filerRelation ?? ''),
        shares:      raw(t.shares),
        value:       raw(t.value),
        transaction: String(t.transactionText ?? ''),
      }));

    const recTrend = (result.recommendationTrend?.trend ?? []) as Record<string, unknown>[];
    const upgrades = ((result.upgradeDowngradeHistory?.history ?? []) as Record<string, unknown>[]).slice(0, 20);

    // ── Historique de prix ──────────────────────────────────────────────
    const chart      = chartJson?.chart?.result?.[0];
    const timestamps: number[] = chart?.timestamp ?? [];
    const q          = chart?.indicators?.quote?.[0] ?? {};

    const priceHistory = timestamps
      .map((ts, i) => ({
        date:   new Date(ts * 1000).toISOString().split('T')[0],
        close:  (q.close?.[i]  as number | null) ?? null,
        volume: (q.volume?.[i] as number | null) ?? null,
        open:   (q.open?.[i]   as number | null) ?? null,
        high:   (q.high?.[i]   as number | null) ?? null,
        low:    (q.low?.[i]    as number | null) ?? null,
      }))
      .filter((p) => p.close !== null);

    // ── Données annuelles (timeseries) ─────────────────────────────────
    const annualData = tsData;

    // ── News ────────────────────────────────────────────────────────────
    const newsItems = (newsJson?.finance?.result?.[0]?.news ?? []) as Record<string, unknown>[];
    const news = newsItems.slice(0, 10).map((item) => ({
      title:       String(item.title ?? ''),
      publisher:   String(item.publisher ?? ''),
      link:        String(item.link ?? ''),
      publishedAt: item.providerPublishTime
        ? new Date(Number(item.providerPublishTime) * 1000).toISOString()
        : '',
      thumbnail:   (item.thumbnail as { resolutions?: { url: string }[] })?.resolutions?.[0]?.url ?? null,
    }));

    // ── Earnings ─────────────────────────────────────────────────────────
    const cal = result.calendarEvents ?? {};
    const earningsDates = (cal.earnings?.earningsDate ?? []) as { fmt?: string }[];
    const nextEarningsDate = earningsDates[0]?.fmt ?? null;

    const trend = (result.earningsTrend?.trend ?? []) as Record<string, unknown>[];
    const currentTrend = trend.find((t) => t.period === '0q') ?? trend[0];
    const epsEstimate = (currentTrend?.earningsEstimate as { avg?: { raw?: number } })?.avg?.raw ?? null;
    const revenueEstimate = (currentTrend?.revenueEstimate as { avg?: { raw?: number } })?.avg?.raw ?? null;

    return NextResponse.json({
      symbol,
      name:     String(priceData.longName ?? priceData.shortName ?? symbol),
      sector:   String(priceData.sector   ?? priceData.industry ?? ''),
      currency: String(priceData.currency ?? 'USD'),
      exchange: String(priceData.exchangeName ?? ''),
      currentPrice, sharesOutstanding, marketCap,
      revenue, fcf, eps, pe, ps,
      cash, totalDebt, revenueGrowth, earningsGrowth,
      week52High, week52Low, beta,
      dividendYield, dividendRate, payoutRatio, exDividendDate,
      grossMargin, operatingMargin, profitMargin,
      returnOnEquity, returnOnAssets, debtToEquity, currentRatio,
      targetLow, targetMean, targetHigh, numAnalysts, recommendationKey,
      recTrend, upgrades, insiders,
      priceHistory, annualData,
      news,
      nextEarningsDate, epsEstimate, revenueEstimate,
    });

  } catch (err) {
    console.error(`[valuation/stock/${symbol}]`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

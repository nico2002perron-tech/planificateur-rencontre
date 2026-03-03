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

// ── Prix cible 1 an ───────────────────────────────────────────────────────────

export async function getYahooPriceTarget(symbol: string): Promise<YahooPriceTarget> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData`;
    const res = await yahooFetch(url);
    if (!res.ok) return { targetLow: null, targetMean: null, targetHigh: null, numAnalysts: 0, recommendationKey: 'none' };

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
    return { targetLow: null, targetMean: null, targetHigh: null, numAnalysts: 0, recommendationKey: 'none' };
  }
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

export async function getYahooNews(symbol: string, count = 8): Promise<YahooNewsItem[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=${count}&quotesCount=0&enableFuzzyQuery=false`;
    const res = await yahooFetch(url);
    if (!res.ok) return [];

    const json = await res.json();
    const items = json?.finance?.result?.[0]?.news ?? [];

    return (items as Record<string, unknown>[]).map((item) => ({
      title:       String(item.title ?? ''),
      publisher:   String(item.publisher ?? ''),
      link:        String(item.link ?? ''),
      publishedAt: item.providerPublishTime
        ? new Date(Number(item.providerPublishTime) * 1000).toISOString()
        : '',
      thumbnail:   (item.thumbnail as { resolutions?: { url: string }[] })?.resolutions?.[0]?.url,
    }));
  } catch {
    return [];
  }
}

// ── Earnings ──────────────────────────────────────────────────────────────────

export async function getYahooEarnings(symbol: string): Promise<YahooEarnings> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents,earningsTrend`;
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

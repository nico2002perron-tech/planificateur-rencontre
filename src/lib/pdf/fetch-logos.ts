// Pre-fetches company logos server-side and returns a map of
// `symbol → base64 PNG data URI` that can be embedded in @react-pdf/renderer.
//
// Strategy: hit Financial Modeling Prep's public image endpoint, which returns
// a PNG with no API key required. Failures are swallowed so that missing logos
// simply fall back to the category dot in the template.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 4000;
const BATCH = 8;

/** Normalizes a portfolio symbol to the form FMP expects. */
function normalize(symbol: string): string {
  // FMP uses plain tickers for US and `.TO` / `.V` suffixes for Canadian listings,
  // which matches the portfolio format already.
  return symbol.trim().toUpperCase();
}

async function fetchOne(symbol: string): Promise<string | null> {
  const url = `https://financialmodelingprep.com/image-stock/${encodeURIComponent(normalize(symbol))}.png`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/png,image/*' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < 200) return null; // Tiny responses are usually 1×1 placeholders.

    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches PNG data URIs for a list of symbols. Missing logos are omitted. */
export async function fetchLogoDataUris(symbols: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const uniq = Array.from(new Set(symbols));

  for (let i = 0; i < uniq.length; i += BATCH) {
    const batch = uniq.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((s) => fetchOne(s)));
    batch.forEach((s, idx) => {
      const uri = results[idx];
      if (uri) out[s] = uri;
    });
  }

  return out;
}

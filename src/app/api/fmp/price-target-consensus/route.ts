import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { getTargetConsensus } from '@/lib/fmp/client';
import { getYahooPriceTarget, getYahooHistoricalChart, toYahooSymbol, yahooFetch } from '@/lib/yahoo/client';

export interface PriceTargetConsensus {
  targetConsensus: number;
  targetHigh: number;
  targetLow: number;
  numberOfAnalysts: number;
  source: 'yahoo' | 'fmp' | 'manual' | 'historical';
  resolvedSymbol?: string; // The actual Yahoo symbol that worked
  cdrGainPct?: number; // For CDRs: the US underlying's gain %, so client can apply to Croesus price
}

/**
 * Try to get an analyst target for a single symbol variant.
 * Returns the data or null.
 */
async function tryYahooTarget(sym: string): Promise<PriceTargetConsensus | null> {
  const yahoo = await getYahooPriceTarget(sym);
  if (yahoo.targetMean && yahoo.targetMean > 0) {
    return {
      targetConsensus: yahoo.targetMean,
      targetHigh: yahoo.targetHigh ?? yahoo.targetMean,
      targetLow: yahoo.targetLow ?? yahoo.targetMean,
      numberOfAnalysts: yahoo.numAnalysts,
      source: 'yahoo',
      resolvedSymbol: sym,
    };
  }
  return null;
}

/**
 * Fallback: estimate a 1Y target from historical 1Y return.
 */
async function estimateFromHistory(sym: string): Promise<PriceTargetConsensus | null> {
  try {
    const chart = await getYahooHistoricalChart(sym, 5);
    if (chart.length < 13) return null;

    const ySym = toYahooSymbol(sym);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=price`;
    const res = await yahooFetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const currentPrice = json?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw;
    if (!currentPrice || currentPrice <= 0) return null;

    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    let closest = chart[0];
    let closestDiff = Math.abs(new Date(chart[0].date).getTime() - oneYearAgo.getTime());
    for (const point of chart) {
      const diff = Math.abs(new Date(point.date).getTime() - oneYearAgo.getTime());
      if (diff < closestDiff) {
        closest = point;
        closestDiff = diff;
      }
    }

    if (closestDiff > 45 * 24 * 3600 * 1000) return null;

    const priceOneYearAgo = closest.adjClose;
    if (priceOneYearAgo <= 0) return null;

    const returnPct = (currentPrice - priceOneYearAgo) / priceOneYearAgo;
    const cappedReturn = Math.max(0, Math.min(1.0, returnPct));
    const estimatedTarget = Math.round(currentPrice * (1 + cappedReturn) * 100) / 100;

    return {
      targetConsensus: estimatedTarget,
      targetHigh: estimatedTarget,
      targetLow: estimatedTarget,
      numberOfAnalysts: 0,
      source: 'historical',
      resolvedSymbol: sym,
    };
  } catch {
    return null;
  }
}

/**
 * The parser already adds .TO for CAD symbols based on the currency column.
 * So symbols arrive pre-formatted: ENB.TO (CAD), AAPL (USD).
 * No need to guess — just use the symbol as-is.
 */
function getSymbolVariants(symbol: string): string[] {
  return [symbol];
}

/**
 * Full lookup for a single symbol: tries all variants, all sources.
 */
async function lookupTarget(symbol: string): Promise<{ symbol: string; data: PriceTargetConsensus | null }> {
  const variants = getSymbolVariants(symbol);

  // 1. Try Yahoo analyst targets for each variant
  for (const sym of variants) {
    const yahoo = await tryYahooTarget(sym);
    if (yahoo) return { symbol, data: yahoo };
  }

  // 2. Try FMP (original symbol only — FMP uses its own format)
  try {
    const consensus = await getTargetConsensus(symbol);
    if (consensus && consensus.targetConsensus > 0) {
      return {
        symbol,
        data: {
          targetConsensus: consensus.targetConsensus,
          targetHigh: consensus.targetHigh,
          targetLow: consensus.targetLow,
          numberOfAnalysts: 0,
          source: 'fmp',
        },
      };
    }
  } catch { /* ignore */ }

  // 3. Try historical estimation for each variant
  for (const sym of variants) {
    const historical = await estimateFromHistory(sym);
    if (historical) return { symbol, data: historical };
  }

  return { symbol, data: null };
}

/**
 * CDR lookup: fetch the US underlying's target, then apply
 * the % gain to the CDR's current NEO price.
 */
/**
 * Search Yahoo Finance for a ticker. Used when CDR NEO symbol (VISA) differs
 * from the real US ticker (V). Returns the first US equity match.
 */
async function searchYahooTicker(query: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0&enableFuzzyQuery=false`;
    const res = await yahooFetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const quotes = (json?.quotes ?? []) as { symbol?: string; quoteType?: string; exchange?: string }[];
    // Prefer US equity exchanges
    const usExchanges = ['NMS', 'NYQ', 'NGM', 'PCX', 'BTS', 'NCM'];
    for (const q of quotes) {
      if (q.quoteType === 'EQUITY' && q.exchange && usExchanges.includes(q.exchange)) {
        return q.symbol ?? null;
      }
    }
    // Fallback: first equity result
    for (const q of quotes) {
      if (q.quoteType === 'EQUITY') return q.symbol ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a single Yahoo quoteSummary with financialData+price.
 */
async function fetchYahooSummary(sym: string): Promise<{
  usPrice: number; targetMean: number; targetHigh: number; targetLow: number;
  numAnalysts: number; resolvedSymbol: string;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,price`;
    const res = await yahooFetch(url);
    if (!res.ok) { console.log(`[CDR] Yahoo ${sym}: HTTP ${res.status}`); return null; }

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) { console.log(`[CDR] Yahoo ${sym}: no result`); return null; }

    const fd = result.financialData ?? {};
    const price = result.price ?? {};
    const usPrice = price.regularMarketPrice?.raw ?? 0;
    const targetMean = fd.targetMeanPrice?.raw ?? 0;

    if (usPrice <= 0) { console.log(`[CDR] Yahoo ${sym}: no price`); return null; }
    if (targetMean <= 0) { console.log(`[CDR] Yahoo ${sym}: price=$${usPrice} but no target`); return null; }

    console.log(`[CDR] Yahoo ${sym}: price=$${usPrice}, target=$${targetMean}`);
    return {
      usPrice, targetMean,
      targetHigh: fd.targetHighPrice?.raw ?? targetMean,
      targetLow: fd.targetLowPrice?.raw ?? targetMean,
      numAnalysts: fd.numberOfAnalystOpinions?.raw ?? 0,
      resolvedSymbol: sym,
    };
  } catch { return null; }
}

/**
 * Directly fetch a US stock's price + analyst target from Yahoo.
 * Tries the symbol as-is, then without class suffix (V-A → V),
 * then Yahoo search to find the real US ticker (VISA → V).
 */
async function fetchUSUnderlyingData(symbol: string): Promise<{
  usPrice: number; targetMean: number; targetHigh: number; targetLow: number;
  numAnalysts: number; resolvedSymbol: string;
} | null> {
  // Build list of symbols to try
  const variants = [symbol];
  const withoutClass = symbol.replace(/-[A-Z]{1,2}$/, '');
  if (withoutClass !== symbol) variants.push(withoutClass);

  // Try each variant directly
  for (const sym of variants) {
    const data = await fetchYahooSummary(sym);
    if (data) return data;
  }

  // Fallback: Yahoo search to find the real US ticker
  // e.g. CDR symbol "VISA" on NEO → Yahoo search finds "V" (Visa Inc, NYSE)
  console.log(`[CDR] Direct lookup failed for "${symbol}", searching Yahoo...`);
  const realTicker = await searchYahooTicker(symbol);
  if (realTicker && !variants.includes(realTicker)) {
    console.log(`[CDR] Yahoo search: "${symbol}" → "${realTicker}"`);
    const data = await fetchYahooSummary(realTicker);
    if (data) return data;
  }

  return null;
}

async function lookupCDRTarget(
  cdrSymbol: string,
  underlyingSymbol: string
): Promise<{ symbol: string; data: PriceTargetConsensus | null }> {
  try {
    console.log(`[CDR] Looking up: cdrSymbol="${cdrSymbol}", underlying="${underlyingSymbol}"`);

    // 1. Fetch US underlying price + target in one Yahoo call
    const us = await fetchUSUnderlyingData(underlyingSymbol);
    if (!us) {
      console.log(`[CDR] Could not get US data for "${underlyingSymbol}"`);
      return { symbol: cdrSymbol, data: null };
    }

    // 2. Compute % gain from US underlying
    const gainPct = (us.targetMean - us.usPrice) / us.usPrice;
    const gainPctHigh = (us.targetHigh - us.usPrice) / us.usPrice;
    const gainPctLow = (us.targetLow - us.usPrice) / us.usPrice;

    console.log(`[CDR] ${cdrSymbol}: US ${us.resolvedSymbol} price=$${us.usPrice}, target=$${us.targetMean}, gain=${(gainPct * 100).toFixed(1)}%`);

    return {
      symbol: cdrSymbol,
      data: {
        targetConsensus: 0, // Client recalculates from Croesus price × gainPct
        targetHigh: 0,
        targetLow: 0,
        numberOfAnalysts: us.numAnalysts,
        source: 'yahoo',
        resolvedSymbol: `${us.resolvedSymbol} (CDR)`,
        cdrGainPct: gainPct,
      },
    };
  } catch (err) {
    console.error(`[CDR] Error for ${cdrSymbol}:`, err);
    return { symbol: cdrSymbol, data: null };
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const symbolsParam = request.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) {
    return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  // Parse CDR map: { "META": "META", "AMZN": "AMZN" } (cdr symbol → US underlying)
  let cdrMap: Record<string, string> = {};
  const cdrsParam = request.nextUrl.searchParams.get('cdrs');
  if (cdrsParam) {
    try { cdrMap = JSON.parse(cdrsParam); } catch { /* ignore */ }
  }

  const symbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ error: 'No valid symbols provided' }, { status: 400 });
  }

  try {
    const result: Record<string, PriceTargetConsensus> = {};

    const results = await Promise.all(
      symbols.map((sym) => {
        // If this symbol is a CDR, use the CDR-specific lookup
        const underlying = cdrMap[sym];
        if (underlying) {
          return lookupCDRTarget(sym, underlying).catch(() => ({ symbol: sym, data: null }));
        }
        return lookupTarget(sym).catch(() => ({ symbol: sym, data: null }));
      })
    );

    for (const { symbol, data } of results) {
      if (data) {
        result[symbol] = data;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Price target consensus error:', error);
    return NextResponse.json({ error: 'Failed to fetch price targets' }, { status: 500 });
  }
}

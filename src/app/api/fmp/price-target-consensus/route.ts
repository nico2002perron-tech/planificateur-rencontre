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
 * Build a list of symbol variants to try on Yahoo Finance.
 * e.g. "ENB" → ["ENB", "ENB.TO"]
 *      "ENB.TO" → ["ENB.TO"]
 *      "GIB-A" → ["GIB-A", "GIB-A.TO"]
 *      "AAPL" → ["AAPL", "AAPL.TO"] (AAPL.TO will fail gracefully)
 */
function getSymbolVariants(symbol: string): string[] {
  // Already has an exchange suffix → don't add another
  if (/\.(TO|V|CN|NE)$/.test(symbol)) return [symbol];
  // Try as-is first (works for US stocks), then with .TO (for Canadian)
  return [symbol, `${symbol}.TO`];
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
async function lookupCDRTarget(
  cdrSymbol: string,
  underlyingSymbol: string
): Promise<{ symbol: string; data: PriceTargetConsensus | null }> {
  try {
    // 1. Get the US underlying's current price and target
    //    Try the symbol as-is first, then without class suffix (V-A → V)
    let underlyingResult = await lookupTarget(underlyingSymbol);
    let resolvedUnderlying = underlyingSymbol;
    if (!underlyingResult.data || underlyingResult.data.targetConsensus <= 0) {
      // Try without class suffix: V-A → V, BRK-B stays BRK-B (tried as-is already)
      const withoutClass = underlyingSymbol.replace(/-[A-Z]{1,2}$/, '');
      if (withoutClass !== underlyingSymbol) {
        underlyingResult = await lookupTarget(withoutClass);
        resolvedUnderlying = withoutClass;
      }
      if (!underlyingResult.data || underlyingResult.data.targetConsensus <= 0) {
        return { symbol: cdrSymbol, data: null };
      }
    }

    // 2. Get the US underlying's current price to compute gain %
    const ySym = toYahooSymbol(resolvedUnderlying);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=price`;
    const res = await yahooFetch(url);
    if (!res.ok) return { symbol: cdrSymbol, data: null };
    const json = await res.json();
    const usPrice = json?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw;
    if (!usPrice || usPrice <= 0) return { symbol: cdrSymbol, data: null };

    // 3. Compute the % gain from the US underlying target
    const usTarget = underlyingResult.data.targetConsensus;
    const gainPct = (usTarget - usPrice) / usPrice;
    const gainPctHigh = (underlyingResult.data.targetHigh - usPrice) / usPrice;
    const gainPctLow = (underlyingResult.data.targetLow - usPrice) / usPrice;
    const cdrSource = underlyingResult.data.source;

    // 4. Try to get CDR's NEO price for server-side target calculation
    const neoSymbol = `${cdrSymbol.replace(/\.(NE|NEO)$/i, '')}.NE`;
    const neoUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(neoSymbol)}?modules=price`;
    const neoRes = await yahooFetch(neoUrl);
    let cdrPrice = 0;
    if (neoRes.ok) {
      const neoJson = await neoRes.json();
      cdrPrice = neoJson?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw ?? 0;
    }

    // 5. Compute target — use NEO price if available, otherwise client will recalculate
    const basePrice = cdrPrice > 0 ? cdrPrice : 0;
    const cdrTarget = basePrice > 0 ? Math.round(basePrice * (1 + gainPct) * 100) / 100 : 0;

    return {
      symbol: cdrSymbol,
      data: {
        targetConsensus: cdrTarget,
        targetHigh: basePrice > 0 ? Math.round(basePrice * (1 + gainPctHigh) * 100) / 100 : 0,
        targetLow: basePrice > 0 ? Math.round(basePrice * (1 + gainPctLow) * 100) / 100 : 0,
        numberOfAnalysts: underlyingResult.data.numberOfAnalysts,
        source: cdrSource,
        resolvedSymbol: `${resolvedUnderlying} (CDR)`,
        cdrGainPct: gainPct, // Always pass gain % so client can apply to Croesus price
      },
    };
  } catch {
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

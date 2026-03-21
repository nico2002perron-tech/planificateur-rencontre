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
}

/**
 * Fallback: estimate a 1Y target from historical 1Y return.
 * Fetches current price + price ~12 months ago, projects the same return forward.
 */
async function estimateFromHistory(symbol: string): Promise<PriceTargetConsensus | null> {
  try {
    // Fetch 2 years of monthly data to ensure we have a point ~12 months ago
    const chart = await getYahooHistoricalChart(symbol, 5);
    if (chart.length < 13) return null;

    // Get current price from Yahoo
    const ySym = toYahooSymbol(symbol);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=price`;
    const res = await yahooFetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const currentPrice = json?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw;
    if (!currentPrice || currentPrice <= 0) return null;

    // Find the price closest to 12 months ago
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const targetDate = oneYearAgo.toISOString().split('T')[0];

    let closest = chart[0];
    let closestDiff = Math.abs(new Date(chart[0].date).getTime() - oneYearAgo.getTime());
    for (const point of chart) {
      const diff = Math.abs(new Date(point.date).getTime() - oneYearAgo.getTime());
      if (diff < closestDiff) {
        closest = point;
        closestDiff = diff;
      }
    }

    // Require the point to be within 45 days of the target date
    if (closestDiff > 45 * 24 * 3600 * 1000) return null;

    const priceOneYearAgo = closest.adjClose;
    if (priceOneYearAgo <= 0) return null;

    const returnPct = (currentPrice - priceOneYearAgo) / priceOneYearAgo;

    // Cap the estimated return to a reasonable range (-50% to +100%)
    const cappedReturn = Math.max(-0.5, Math.min(1.0, returnPct));
    const estimatedTarget = Math.round(currentPrice * (1 + cappedReturn) * 100) / 100;

    return {
      targetConsensus: estimatedTarget,
      targetHigh: estimatedTarget,
      targetLow: estimatedTarget,
      numberOfAnalysts: 0,
      source: 'historical',
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const symbolsParam = request.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) {
    return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ error: 'No valid symbols provided' }, { status: 400 });
  }

  try {
    const result: Record<string, PriceTargetConsensus> = {};

    // Fetch price target consensus — Yahoo Finance en premier, FMP en fallback
    // Yahoo Finance est la source principale pour les 1Y targets
    const promises = symbols.map(async (symbol) => {
      try {
        // 1. Essayer Yahoo Finance en premier (source principale)
        const yahoo = await getYahooPriceTarget(symbol);
        if (yahoo.targetMean && yahoo.targetMean > 0) {
          return {
            symbol,
            data: {
              targetConsensus: yahoo.targetMean,
              targetHigh: yahoo.targetHigh ?? yahoo.targetMean,
              targetLow: yahoo.targetLow ?? yahoo.targetMean,
              numberOfAnalysts: yahoo.numAnalysts,
              source: 'yahoo' as const,
            },
          };
        }

        // 2. Fallback FMP
        const consensus = await getTargetConsensus(symbol);
        if (consensus && consensus.targetConsensus > 0) {
          return {
            symbol,
            data: {
              targetConsensus: consensus.targetConsensus,
              targetHigh: consensus.targetHigh,
              targetLow: consensus.targetLow,
              numberOfAnalysts: 0,
              source: 'fmp' as const,
            },
          };
        }

        // 3. Fallback: estimation historique (rendement 12 mois)
        const historical = await estimateFromHistory(symbol);
        if (historical) {
          return { symbol, data: historical };
        }

        return { symbol, data: null };
      } catch {
        return { symbol, data: null };
      }
    });

    const results = await Promise.all(promises);
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

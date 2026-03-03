import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { getTargetConsensus } from '@/lib/fmp/client';
import { getYahooPriceTarget } from '@/lib/yahoo/client';

export interface PriceTargetConsensus {
  targetConsensus: number;
  targetHigh: number;
  targetLow: number;
  numberOfAnalysts: number;
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

    // Fetch price target consensus — FMP en premier, Yahoo Finance en fallback
    // Yahoo Finance couvre les titres canadiens (.TO, .V) non supportés par FMP gratuit
    const promises = symbols.map(async (symbol) => {
      try {
        // 1. Essayer FMP
        const consensus = await getTargetConsensus(symbol);
        if (consensus && consensus.targetConsensus > 0) {
          return {
            symbol,
            data: {
              targetConsensus: consensus.targetConsensus,
              targetHigh: consensus.targetHigh,
              targetLow: consensus.targetLow,
              numberOfAnalysts: 0,
            } as PriceTargetConsensus,
          };
        }

        // 2. Fallback Yahoo Finance
        const yahoo = await getYahooPriceTarget(symbol);
        if (yahoo.targetMean && yahoo.targetMean > 0) {
          return {
            symbol,
            data: {
              targetConsensus: yahoo.targetMean,
              targetHigh:      yahoo.targetHigh  ?? yahoo.targetMean,
              targetLow:       yahoo.targetLow   ?? yahoo.targetMean,
              numberOfAnalysts: yahoo.numAnalysts,
            } as PriceTargetConsensus,
          };
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

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
  source: 'yahoo' | 'fmp' | 'manual';
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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { getPriceTargets } from '@/lib/fmp/client';

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

    // Fetch price targets for each symbol in parallel
    const promises = symbols.map(async (symbol) => {
      try {
        const targets = await getPriceTargets(symbol);
        if (!targets || targets.length === 0) {
          return { symbol, consensus: null };
        }

        // Take only recent targets (last 20 for consensus)
        const recent = targets.slice(0, 20);
        const prices = recent.map((t) => t.adjPriceTarget || t.priceTarget).filter((p) => p > 0);

        if (prices.length === 0) {
          return { symbol, consensus: null };
        }

        const sum = prices.reduce((a, b) => a + b, 0);
        const consensus: PriceTargetConsensus = {
          targetConsensus: sum / prices.length,
          targetHigh: Math.max(...prices),
          targetLow: Math.min(...prices),
          numberOfAnalysts: prices.length,
        };

        return { symbol, consensus };
      } catch {
        return { symbol, consensus: null };
      }
    });

    const results = await Promise.all(promises);
    for (const { symbol, consensus } of results) {
      if (consensus) {
        result[symbol] = consensus;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Price target consensus error:', error);
    return NextResponse.json({ error: 'Failed to fetch price targets' }, { status: 500 });
  }
}

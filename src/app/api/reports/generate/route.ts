import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { renderToBuffer } from '@react-pdf/renderer';
import { FullReportDocument } from '@/lib/pdf/report-template';
import { buildFullReportData } from '@/lib/pdf/report-data';
import type { EnrichedFMPData, FMPProfileData, FMPTargetData, FMPHistoricalData } from '@/lib/pdf/report-data';
import { createClient } from '@/lib/supabase/server';
import { getQuotes, getProfile, getTargetConsensus, getHistoricalPrices } from '@/lib/fmp/client';
import React from 'react';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { portfolio_id, client_id, config } = body;

    if (!portfolio_id || !client_id) {
      return NextResponse.json({ error: 'portfolio_id and client_id required' }, { status: 400 });
    }

    const supabase = createClient();

    // Fetch portfolio with holdings
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('*, holdings(*)')
      .eq('id', portfolio_id)
      .single();

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Verify client belongs to advisor
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .eq('advisor_id', session.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found or unauthorized' }, { status: 404 });
    }

    const symbols = (portfolio.holdings || []).map((h: { symbol: string }) => h.symbol);
    const priceMap: Record<string, { price: number; company_name?: string; sector?: string }> = {};

    // ── Step 1: Fetch current prices (cache first, then FMP) ──
    if (symbols.length > 0) {
      // Try cache first
      const { data: cachedPrices } = await supabase
        .from('price_cache')
        .select('symbol, price, company_name, sector')
        .in('symbol', symbols);

      if (cachedPrices) {
        for (const cp of cachedPrices) {
          priceMap[cp.symbol] = {
            price: cp.price,
            company_name: cp.company_name,
            sector: cp.sector,
          };
        }
      }

      // Fetch fresh quotes from FMP for missing symbols
      const missingSymbols = symbols.filter((s: string) => !priceMap[s]);
      if (missingSymbols.length > 0) {
        try {
          const freshQuotes = await getQuotes(missingSymbols);
          for (const q of freshQuotes) {
            priceMap[q.symbol] = {
              price: q.price,
              company_name: q.name,
            };
          }
        } catch (e) {
          console.warn('FMP quotes fetch failed, using cache only:', e);
        }
      }
    }

    // ── Step 2: Fetch enriched FMP data (profiles, targets, historical) ──
    const fmpData: EnrichedFMPData = {
      profiles: {},
      targets: {},
      holdingHistory: {},
      benchmarkHistory: [],
    };

    if (symbols.length > 0) {
      // Fetch profiles for all holdings in parallel
      const profilePromises = symbols.map(async (symbol: string) => {
        try {
          const profile = await getProfile(symbol);
          if (profile) {
            const data: FMPProfileData = {
              symbol: profile.symbol,
              companyName: profile.companyName,
              description: profile.description,
              sector: profile.sector,
              industry: profile.industry,
              country: profile.country,
              beta: profile.beta,
              lastDiv: profile.lastDiv,
              mktCap: profile.mktCap,
              exchange: profile.exchangeShortName || profile.exchange,
            };
            return { symbol, data };
          }
          return { symbol, data: null };
        } catch {
          return { symbol, data: null };
        }
      });

      // Fetch price target consensus for all holdings in parallel
      const targetPromises = symbols.map(async (symbol: string) => {
        try {
          const consensus = await getTargetConsensus(symbol);
          if (consensus && consensus.targetConsensus > 0) {
            const data: FMPTargetData = {
              targetConsensus: consensus.targetConsensus,
              targetHigh: consensus.targetHigh,
              targetLow: consensus.targetLow,
              numberOfAnalysts: 0,
            };
            return { symbol, data };
          }
          return { symbol, data: null };
        } catch {
          return { symbol, data: null };
        }
      });

      // Fetch historical prices for holdings (use DB cache if available)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const fromDate = fiveYearsAgo.toISOString().split('T')[0];

      const historicalPromises = symbols.map(async (symbol: string) => {
        try {
          // Check DB cache first
          const { data: cached } = await supabase
            .from('historical_prices')
            .select('date, close')
            .eq('symbol', symbol)
            .order('date', { ascending: true });

          if (cached && cached.length >= 30) {
            const histData: FMPHistoricalData[] = cached.map((r) => ({
              date: r.date,
              close: r.close,
            }));
            return { symbol, data: histData };
          }

          // Fetch from FMP
          const history = await getHistoricalPrices(symbol, fromDate);
          if (history && history.length > 0) {
            const histData: FMPHistoricalData[] = history.map((h) => ({
              date: h.date,
              close: h.close,
            }));
            return { symbol, data: histData };
          }
          return { symbol, data: [] };
        } catch {
          return { symbol, data: [] };
        }
      });

      // Fetch benchmark (S&P/TSX) historical
      const benchmarkPromise = (async () => {
        try {
          // Try ^GSPTSE for S&P/TSX
          const { data: cached } = await supabase
            .from('historical_prices')
            .select('date, close')
            .eq('symbol', '^GSPTSE')
            .order('date', { ascending: true });

          if (cached && cached.length >= 30) {
            return cached.map((r) => ({ date: r.date, close: r.close }));
          }

          const history = await getHistoricalPrices('^GSPTSE', fromDate);
          if (history && history.length > 0) {
            return history.map((h) => ({ date: h.date, close: h.close }));
          }
          return [];
        } catch {
          return [];
        }
      })();

      // Await all parallel fetches
      const [profileResults, targetResults, historicalResults, benchmarkResult] = await Promise.all([
        Promise.all(profilePromises),
        Promise.all(targetPromises),
        Promise.all(historicalPromises),
        benchmarkPromise,
      ]);

      // Populate fmpData
      for (const { symbol, data } of profileResults) {
        if (data) {
          fmpData.profiles[symbol] = data;
          // Also update priceMap sector from profile
          if (priceMap[symbol] && data.sector) {
            priceMap[symbol].sector = data.sector;
          }
        }
      }
      for (const { symbol, data } of targetResults) {
        if (data) fmpData.targets[symbol] = data;
      }
      for (const { symbol, data } of historicalResults) {
        if (data && data.length > 0) fmpData.holdingHistory[symbol] = data;
      }
      fmpData.benchmarkHistory = benchmarkResult;
    }

    // ── Step 3: Fetch advisor info ──
    const { data: advisor } = await supabase
      .from('users')
      .select('name, title')
      .eq('id', session.user.id)
      .single();

    // ── Step 4: Build full report data ──
    const reportData = buildFullReportData(
      portfolio,
      portfolio.holdings || [],
      client,
      {
        name: advisor?.name || session.user.name || 'Conseiller',
        title: advisor?.title || '',
      },
      priceMap,
      {
        sections: config?.sections,
        projectionYears: config?.projection_years,
      },
      fmpData
    );

    // ── Step 5: Generate PDF ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(FullReportDocument, { data: reportData }) as any;
    const buffer = await renderToBuffer(element);

    // ── Step 6: Record report in database ──
    const reportTitle = `Rapport - ${client.first_name} ${client.last_name} - ${portfolio.name}`;
    const { data: report } = await supabase
      .from('reports')
      .insert({
        portfolio_id,
        client_id,
        advisor_id: session.user.id,
        title: reportTitle,
        config: config || {},
        status: 'ready',
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-${client.last_name}-${portfolio.name}.pdf"`,
        'X-Report-Id': report?.id || '',
        'X-Report-Title': reportTitle,
      },
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

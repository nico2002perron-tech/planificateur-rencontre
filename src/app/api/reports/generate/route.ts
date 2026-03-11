import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { renderToBuffer } from '@react-pdf/renderer';
import { FullReportDocument } from '@/lib/pdf/report-template';
import { buildFullReportData } from '@/lib/pdf/report-data';
import type { EnrichedFMPData, FMPProfileData, FMPTargetData, FMPHistoricalData } from '@/lib/pdf/report-data';
import type { ValuationDataItem } from '@/lib/ai/types';
import { createClient } from '@/lib/supabase/server';
import { getTargetConsensus, getHistoricalPrices } from '@/lib/fmp/client';
import { getYahooPriceTarget, getYahooETFSectors, getYahooQuotes, getYahooProfile } from '@/lib/yahoo/client';
import { calculateValuation, solveReverseDcf, buildSensitivityMatrix } from '@/lib/valuation/dcf';
import { getBenchmarkData } from '@/lib/valuation/benchmarks';
import { scoreOutOf10 } from '@/lib/valuation/scoring';
import { generateReportAIContent } from '@/lib/ai/groq-client';
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

      // Fetch fresh quotes from Yahoo Finance for missing symbols
      const missingSymbols = symbols.filter((s: string) => !priceMap[s]);
      if (missingSymbols.length > 0) {
        try {
          const freshQuotes = await getYahooQuotes(missingSymbols);
          for (const q of freshQuotes) {
            priceMap[q.symbol] = {
              price: q.price,
              company_name: q.name,
            };
          }
        } catch (e) {
          console.warn('Yahoo quotes fetch failed, using cache only:', e);
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
      // Fetch profiles from Yahoo Finance (replaces FMP getProfile)
      const profilePromises = symbols.map(async (symbol: string) => {
        try {
          const yProfile = await getYahooProfile(symbol);
          if (yProfile) {
            const data: FMPProfileData = {
              symbol: yProfile.symbol,
              companyName: yProfile.companyName,
              description: yProfile.description,
              sector: yProfile.sector,
              industry: yProfile.industry,
              country: yProfile.country,
              beta: yProfile.beta,
              lastDiv: yProfile.lastDiv,
              mktCap: yProfile.mktCap,
              exchange: yProfile.exchange,
            };
            return { symbol, data };
          }
          return { symbol, data: null };
        } catch {
          return { symbol, data: null };
        }
      });

      // Fetch price target consensus — Yahoo Finance en premier, FMP en fallback
      // Yahoo Finance est la source principale pour les 1Y targets
      const targetPromises = symbols.map(async (symbol: string) => {
        try {
          // 1. Essayer Yahoo Finance en premier (source principale)
          const yahoo = await getYahooPriceTarget(symbol);
          if (yahoo.targetMean && yahoo.targetMean > 0) {
            const data: FMPTargetData = {
              targetConsensus: yahoo.targetMean,
              targetHigh: yahoo.targetHigh ?? yahoo.targetMean,
              targetLow: yahoo.targetLow ?? yahoo.targetMean,
              numberOfAnalysts: yahoo.numAnalysts,
            };
            return { symbol, data };
          }

          // 2. Fallback FMP
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

    // ── Step 3b: Fetch ETF sector breakdowns from Yahoo ──
    const etfSectorData: Record<string, { sector: string; weight: number }[]> = {};
    if (symbols.length > 0) {
      const etfPromises = symbols.map(async (symbol: string) => {
        try {
          const sectors = await getYahooETFSectors(symbol);
          return { symbol, sectors };
        } catch {
          return { symbol, sectors: null };
        }
      });
      const etfResults = await Promise.all(etfPromises);
      for (const { symbol, sectors } of etfResults) {
        if (sectors && sectors.length > 0) {
          etfSectorData[symbol] = sectors;
        }
      }
    }

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
        customTargets: config?.custom_targets,
        aiEnabled: config?.ai_enabled,
        includeValuation: config?.include_valuation,
      },
      fmpData,
      etfSectorData
    );

    // ── Step 5: Compute valuation data (if enabled) ──
    let valuationData: ValuationDataItem[] | null = null;
    if (config?.include_valuation && symbols.length > 0) {
      try {
        const valuationPromises = symbols.map(async (symbol: string) => {
          try {
            const res = await fetch(
              `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/valuation/stock/${encodeURIComponent(symbol)}`,
              { headers: { 'User-Agent': 'PlanificateurRencontre/1.0' } }
            );
            if (!res.ok) return null;
            const yahoo = await res.json();

            const profile = fmpData.profiles[symbol];
            const sector = profile?.sector || yahoo.sector || '';
            const bench = getBenchmarkData(symbol, sector);

            const revenue = yahoo.revenue || 0;
            const fcf = yahoo.fcf || 0;
            const eps = yahoo.eps || 0;
            const cash = yahoo.cash || 0;
            const totalDebt = yahoo.totalDebt || 0;
            const shares = yahoo.sharesOutstanding || 1;
            const currentPrice = yahoo.currentPrice || priceMap[symbol]?.price || 0;

            const [priceDcf, priceSales, priceEarnings] = calculateValuation(
              bench.gr_sales / 100,
              bench.gr_fcf / 100,
              bench.gr_eps / 100,
              bench.wacc / 100,
              bench.ps,
              bench.pe,
              revenue,
              fcf,
              eps,
              cash,
              totalDebt,
              shares
            );

            const nonZeroPrices = [priceDcf, priceSales, priceEarnings].filter((p) => p !== 0);
            const avgIntrinsic = nonZeroPrices.length > 0
              ? nonZeroPrices.reduce((s, p) => s + p, 0) / nonZeroPrices.length
              : 0;

            const upsidePercent = currentPrice > 0 && avgIntrinsic !== 0
              ? ((avgIntrinsic - currentPrice) / currentPrice) * 100
              : 0;

            const reverseDcfGrowth = solveReverseDcf(
              currentPrice, fcf, bench.wacc / 100, shares, cash, totalDebt
            );

            const scores = scoreOutOf10(
              {
                ticker: symbol,
                price: currentPrice,
                pe: yahoo.pe || 0,
                ps: yahoo.ps || 0,
                sales_gr: yahoo.revenueGrowth || 0,
                eps_gr: yahoo.earningsGrowth || 0,
                net_cash: cash - totalDebt,
                fcf_yield: currentPrice > 0 && shares > 0 ? fcf / (currentPrice * shares) : 0,
                rule_40: (yahoo.revenueGrowth || 0) * 100 + (yahoo.profitMargin || 0) * 100,
              },
              bench
            );

            return {
              symbol,
              name: profile?.companyName || yahoo.name || symbol,
              currentPrice,
              priceDcf,
              priceSales,
              priceEarnings,
              avgIntrinsic,
              upsidePercent,
              reverseDcfGrowth,
              scores: {
                overall: scores.overall,
                health: scores.health,
                growth: scores.growth,
                valuation: scores.valuation,
              },
            } as ValuationDataItem;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(valuationPromises);

        // Include all results — create placeholders for symbols that failed (ETFs, etc.)
        const allResults: ValuationDataItem[] = [];
        for (let si = 0; si < symbols.length; si++) {
          const r = results[si];
          if (r) {
            allResults.push(r);
          } else {
            // Placeholder for failed symbols (ETFs, tickers without financial data)
            const sym = symbols[si];
            const holdingData = (portfolio.holdings || []).find((h: { symbol: string }) => h.symbol === sym);
            allResults.push({
              symbol: sym,
              name: fmpData.profiles[sym]?.companyName || holdingData?.name || sym,
              currentPrice: priceMap[sym]?.price || 0,
              priceDcf: 0,
              priceSales: 0,
              priceEarnings: 0,
              avgIntrinsic: 0,
              upsidePercent: 0,
              reverseDcfGrowth: 0,
              scores: { overall: 0, health: 0, growth: 0, valuation: 0 },
            } as ValuationDataItem);
          }
        }

        if (allResults.length > 0) {
          // Add sensitivity matrix for top 3 positions by weight (only if they have positive FCF)
          const holdingWeights = reportData.portfolio.holdings
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 3)
            .map((h) => h.symbol);

          for (const item of allResults) {
            if (holdingWeights.includes(item.symbol) && item.priceDcf > 0) {
              try {
                const res = await fetch(
                  `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/valuation/stock/${encodeURIComponent(item.symbol)}`,
                  { headers: { 'User-Agent': 'PlanificateurRencontre/1.0' } }
                );
                if (res.ok) {
                  const yahoo = await res.json();
                  const bench = getBenchmarkData(item.symbol, fmpData.profiles[item.symbol]?.sector || '');
                  item.sensitivityMatrix = buildSensitivityMatrix(
                    bench.wacc,
                    bench.gr_fcf,
                    yahoo.fcf || 0,
                    yahoo.cash || 0,
                    yahoo.totalDebt || 0,
                    yahoo.sharesOutstanding || 1
                  );
                }
              } catch { /* skip sensitivity */ }
            }
          }

          valuationData = allResults;
        }
      } catch (err) {
        console.warn('Valuation computation failed, skipping:', err);
      }
    }
    reportData.valuationData = valuationData;

    // ── Step 6: Generate AI content (if enabled) ──
    if (config?.ai_enabled && process.env.GROQ_API_KEY) {
      try {
        const aiContent = await generateReportAIContent(reportData, valuationData, portfolio_id);
        reportData.aiContent = aiContent;
      } catch (err) {
        console.warn('AI content generation failed, skipping:', err);
        reportData.aiContent = null;
      }
    }

    // ── Step 7: Generate PDF ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(FullReportDocument, { data: reportData }) as any;
    const buffer = await renderToBuffer(element);

    // ── Step 8: Record report in database ──
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

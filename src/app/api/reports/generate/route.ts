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
import { getYahooPriceTarget, getYahooETFSectors, getYahooQuotes, getYahooProfile, getYahooHistoricalChart, yahooFetch, toYahooSymbol } from '@/lib/yahoo/client';
import { AVAILABLE_BENCHMARKS, buildBenchmarkComparison } from '@/lib/pdf/benchmark-data';
import type { BenchmarkComparisonData } from '@/lib/pdf/benchmark-data';
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

    // Identify fund holdings by FundSERV code pattern (e.g., RBF658, TDB900, MFC4367)
    const FUND_CODE_REGEX = /^[A-Z]{2,4}\d{2,6}$/;
    const fundCodes = symbols.filter((s: string) => FUND_CODE_REGEX.test(s));

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
    // Fetches financialData directly from Yahoo Finance (no internal API call)
    let valuationData: ValuationDataItem[] | null = null;
    if (config?.include_valuation && symbols.length > 0) {
      try {
        // Helper to extract raw Yahoo values
        const rawVal = (obj: unknown): number => {
          if (obj && typeof obj === 'object' && 'raw' in obj) {
            const v = Number((obj as { raw: number }).raw);
            return isFinite(v) ? v : 0;
          }
          return 0;
        };

        // Fetch financial data directly from Yahoo for all symbols
        const valuationPromises = symbols.map(async (symbol: string) => {
          try {
            const ySym = toYahooSymbol(symbol);
            const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=price,financialData,defaultKeyStatistics,summaryDetail`;
            const res = await yahooFetch(url);
            if (!res.ok) return null;

            const json = await res.json();
            const result = json?.quoteSummary?.result?.[0];
            if (!result) return null;

            const priceData = result.price ?? {};
            const fd = result.financialData ?? {};
            const ks = result.defaultKeyStatistics ?? {};
            const sd = result.summaryDetail ?? {};

            const currentPrice = rawVal(priceData.regularMarketPrice) || rawVal(fd.currentPrice) || priceMap[symbol]?.price || 0;
            const shares = rawVal(ks.sharesOutstanding) || rawVal(priceData.sharesOutstanding) || 1;
            const marketCap = rawVal(priceData.marketCap) || shares * currentPrice;
            const revenue = rawVal(fd.totalRevenue);
            const fcf = rawVal(fd.freeCashflow);
            const eps = rawVal(ks.trailingEps);
            const cash = rawVal(fd.totalCash);
            const totalDebt = rawVal(fd.totalDebt);
            const pe = rawVal(sd.trailingPE) || (eps > 0 ? currentPrice / eps : 0);
            const ps = marketCap > 0 && revenue > 0 ? marketCap / revenue : 0;
            const revenueGrowth = rawVal(fd.revenueGrowth);
            const earningsGrowth = rawVal(fd.earningsGrowth);
            const profitMargin = rawVal(fd.profitMargins);
            const name = priceData.shortName ?? priceData.longName ?? symbol;

            // Match sector resolution from /api/valuation/stock/[ticker] (price module)
            // so PDF values match the Valuation Master Pro page exactly
            const sector = String(priceData.sector ?? priceData.industry ?? '');
            const bench = getBenchmarkData(symbol, sector);

            const [priceDcf, priceSales, priceEarnings] = calculateValuation(
              bench.gr_sales / 100,
              bench.gr_fcf / 100,
              0.1,              // grEps hardcoded to 10% — matches Valuation page
              bench.wacc / 100,
              bench.ps,
              bench.pe,
              revenue, fcf, eps, cash, totalDebt, shares
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
                ticker: symbol, price: currentPrice, pe, ps,
                sales_gr: revenueGrowth, eps_gr: earningsGrowth,
                net_cash: cash - totalDebt,
                fcf_yield: currentPrice > 0 && shares > 0 ? fcf / (currentPrice * shares) : 0,
                rule_40: revenueGrowth * 100 + profitMargin * 100,
              },
              bench
            );

            const profile = fmpData.profiles[symbol];
            return {
              symbol,
              name: profile?.companyName || name,
              currentPrice, priceDcf, priceSales, priceEarnings,
              avgIntrinsic, upsidePercent, reverseDcfGrowth,
              // Store raw financial data for sensitivity matrix
              _fcf: fcf, _cash: cash, _totalDebt: totalDebt, _shares: shares, _sector: sector,
              scores: {
                overall: scores.overall, health: scores.health,
                growth: scores.growth, valuation: scores.valuation,
              },
            } as ValuationDataItem & { _fcf: number; _cash: number; _totalDebt: number; _shares: number; _sector: string };
          } catch (e) {
            console.warn(`Valuation fetch failed for ${symbol}:`, e);
            return null;
          }
        });

        const results = await Promise.all(valuationPromises);

        // Include all results — create placeholders for symbols that failed (ETFs, etc.)
        const allResults: (ValuationDataItem & { _fcf?: number; _cash?: number; _totalDebt?: number; _shares?: number; _sector?: string })[] = [];
        for (let si = 0; si < symbols.length; si++) {
          const r = results[si];
          if (r) {
            allResults.push(r);
          } else {
            const sym = symbols[si];
            const holdingData = (portfolio.holdings || []).find((h: { symbol: string }) => h.symbol === sym);
            allResults.push({
              symbol: sym,
              name: fmpData.profiles[sym]?.companyName || holdingData?.name || sym,
              currentPrice: priceMap[sym]?.price || 0,
              priceDcf: 0, priceSales: 0, priceEarnings: 0,
              avgIntrinsic: 0, upsidePercent: 0, reverseDcfGrowth: 0,
              scores: { overall: 0, health: 0, growth: 0, valuation: 0 },
            } as ValuationDataItem);
          }
        }

        if (allResults.length > 0) {
          // Add sensitivity matrix for top 3 positions by weight (only if positive DCF)
          const holdingWeights = [...reportData.portfolio.holdings]
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 3)
            .map((h) => h.symbol);

          for (const item of allResults) {
            if (holdingWeights.includes(item.symbol) && item.priceDcf > 0 && item._fcf) {
              try {
                const bench = getBenchmarkData(item.symbol, item._sector || '');
                item.sensitivityMatrix = buildSensitivityMatrix(
                  bench.wacc, bench.gr_fcf,
                  item._fcf, item._cash || 0, item._totalDebt || 0, item._shares || 1
                );
              } catch { /* skip sensitivity */ }
            }
          }

          // Clean temporary fields before storing
          valuationData = allResults.map(({ _fcf, _cash, _totalDebt, _shares, _sector, ...rest }) => rest as ValuationDataItem);
        }
      } catch (err) {
        console.warn('Valuation computation failed, skipping:', err);
      }
    }
    reportData.valuationData = valuationData;

    // ── Step 5b: Estimated targets for holdings without analyst consensus ──
    // Uses existing valuationData if available, else computes lightweight valuation
    {
      const symbolsWithoutTarget = reportData.holdingProfiles
        .filter(hp => hp.targetSource === 'none')
        .map(hp => hp.symbol);

      if (symbolsWithoutTarget.length > 0) {
        // Build a map from existing valuationData
        const valMap = new Map<string, number>();
        if (valuationData) {
          for (const v of valuationData) {
            if (v.avgIntrinsic > 0) valMap.set(v.symbol, v.avgIntrinsic);
          }
        }

        // For symbols not in valuationData, compute lightweight valuation
        const needsComputation = symbolsWithoutTarget.filter(s => !valMap.has(s));
        if (needsComputation.length > 0) {
          const rawVal = (obj: unknown): number => {
            if (obj && typeof obj === 'object' && 'raw' in obj) {
              const v = Number((obj as { raw: number }).raw);
              return isFinite(v) ? v : 0;
            }
            return 0;
          };

          const estPromises = needsComputation.map(async (symbol) => {
            try {
              const ySym = toYahooSymbol(symbol);
              const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=price,financialData,defaultKeyStatistics,summaryDetail`;
              const res = await yahooFetch(url);
              if (!res.ok) return { symbol, estimate: 0 };

              const json = await res.json();
              const result = json?.quoteSummary?.result?.[0];
              if (!result) return { symbol, estimate: 0 };

              const priceData = result.price ?? {};
              const fd = result.financialData ?? {};
              const ks = result.defaultKeyStatistics ?? {};

              const currentPrice = rawVal(priceData.regularMarketPrice) || priceMap[symbol]?.price || 0;
              const shares = rawVal(ks.sharesOutstanding) || rawVal(priceData.sharesOutstanding) || 1;
              const revenue = rawVal(fd.totalRevenue);
              const fcf = rawVal(fd.freeCashflow);
              const eps = rawVal(ks.trailingEps);
              const cash = rawVal(fd.totalCash);
              const totalDebt = rawVal(fd.totalDebt);

              if (revenue === 0 && fcf === 0 && eps <= 0) return { symbol, estimate: 0 };

              const sector = String(priceData.sector ?? priceData.industry ?? '');
              const bench = getBenchmarkData(symbol, sector);

              const [priceDcf, priceSales, priceEarnings] = calculateValuation(
                bench.gr_sales / 100, bench.gr_fcf / 100, 0.1,
                bench.wacc / 100, bench.ps, bench.pe,
                revenue, fcf, eps, cash, totalDebt, shares
              );

              const nonZero = [priceDcf, priceSales, priceEarnings].filter(p => p > 0);
              const avgIntrinsic = nonZero.length > 0
                ? nonZero.reduce((s, p) => s + p, 0) / nonZero.length
                : 0;

              return { symbol, estimate: avgIntrinsic > 0 ? Math.round(avgIntrinsic * 100) / 100 : 0 };
            } catch {
              return { symbol, estimate: 0 };
            }
          });

          const estResults = await Promise.all(estPromises);
          for (const { symbol, estimate } of estResults) {
            if (estimate > 0) valMap.set(symbol, estimate);
          }
        }

        // Inject estimated targets into holdingProfiles
        let changed = false;
        for (const hp of reportData.holdingProfiles) {
          if (hp.targetSource === 'none' && valMap.has(hp.symbol)) {
            const estimate = valMap.get(hp.symbol)!;
            hp.targetPrice = estimate;
            hp.targetSource = 'estimated';
            hp.estimatedGainDollar = Math.round(hp.quantity * (estimate - hp.currentPrice) * 100) / 100;
            hp.estimatedGainPercent = hp.currentPrice > 0
              ? Math.round(((estimate - hp.currentPrice) / hp.currentPrice) * 10000) / 100
              : 0;
            changed = true;
          }
        }

        // Recalculate priceTargetSummary if any targets were added
        if (changed) {
          let totalTargetValue = 0;
          for (const hp of reportData.holdingProfiles) {
            totalTargetValue += hp.targetPrice > 0
              ? hp.quantity * hp.targetPrice
              : hp.quantity * hp.currentPrice;
          }
          const totalCurrentValue = reportData.priceTargetSummary.totalCurrentValue;
          const gainDollar = totalTargetValue - totalCurrentValue;
          reportData.priceTargetSummary = {
            totalCurrentValue,
            totalTargetValue,
            totalEstimatedGainDollar: Math.round(gainDollar * 100) / 100,
            totalEstimatedGainPercent: totalCurrentValue > 0
              ? Math.round((gainDollar / totalCurrentValue) * 10000) / 100
              : 0,
          };
        }
      }
    }

    // ── Step 5c: Benchmark comparison (if benchmarks selected) ──
    let benchmarkComparison: BenchmarkComparisonData | null = null;
    const selectedBenchmarkKeys: string[] = config?.benchmarks ?? [];
    if (selectedBenchmarkKeys.length > 0 && symbols.length > 0) {
      try {
        const selectedBenchmarks = AVAILABLE_BENCHMARKS.filter((b) =>
          selectedBenchmarkKeys.includes(b.key)
        );

        // Fetch 10-year monthly data for each selected index + all holdings in parallel
        const indexFetches = selectedBenchmarks.map(async (bench) => {
          const points = await getYahooHistoricalChart(bench.symbol, 10);
          return { key: bench.key, points };
        });

        const holdingFetches = symbols.map(async (symbol: string) => {
          const points = await getYahooHistoricalChart(symbol, 10);
          return { symbol, points };
        });

        const [indexResults, holdingResults] = await Promise.all([
          Promise.all(indexFetches),
          Promise.all(holdingFetches),
        ]);

        const indexHistories: Record<string, import('@/lib/yahoo/client').YahooChartPoint[]> = {};
        for (const { key, points } of indexResults) {
          if (points.length > 0) indexHistories[key] = points;
        }

        const holdingHistories: Record<string, import('@/lib/yahoo/client').YahooChartPoint[]> = {};
        for (const { symbol, points } of holdingResults) {
          if (points.length > 0) holdingHistories[symbol] = points;
        }

        // Build holding weights from portfolio
        const holdingWeights = reportData.portfolio.holdings.map((h) => ({
          symbol: h.symbol,
          weight: h.weight,
        }));

        benchmarkComparison = buildBenchmarkComparison(
          holdingWeights,
          holdingHistories,
          indexHistories,
          selectedBenchmarks
        );
      } catch (err) {
        console.warn('Benchmark comparison failed, skipping:', err);
      }
    }
    reportData.benchmarkComparison = benchmarkComparison;

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

    // ── Step 7b: Merge fund fact PDFs (if any fund holdings) ──
    let finalPdfBytes: Uint8Array;
    if (fundCodes.length > 0) {
      const { mergeFundPdfs } = await import('@/lib/pdf/merge-fund-pdfs');
      finalPdfBytes = await mergeFundPdfs(buffer, fundCodes);
    } else {
      finalPdfBytes = new Uint8Array(buffer);
    }

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

    return new NextResponse(Buffer.from(finalPdfBytes), {
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

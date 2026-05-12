import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportV2FromAnalysis } from '@/lib/pdf/report-v2';
import { computePortfolioAnalysis } from '@/lib/analytics/pipeline';
import type { RawPortfolioInput, RawHolding, PortfolioAnalysisResult } from '@/lib/analytics/types';
import type { FMPProfileData, FMPTargetData, FMPHistoricalData, EnrichedFMPData } from '@/lib/pdf/report-data';
import { createClient } from '@/lib/supabase/server';
import { getTargetConsensus, getHistoricalPrices } from '@/lib/fmp/client';
import { getYahooPriceTarget, getYahooETFSectors, getYahooQuotes, getYahooProfile, yahooFetch, toYahooSymbol } from '@/lib/yahoo/client';
import { calculateValuation, buildSensitivityMatrix } from '@/lib/valuation/dcf';
import { getBenchmarkData } from '@/lib/valuation/benchmarks';
import { generateReportAIContentV2 } from '@/lib/ai/groq-client-v2';
import type { V2PromptData } from '@/lib/ai/prompts-v2';
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

    // ── Step 1: Fetch current prices (cache first, then Yahoo) ──
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

    // ── Step 2: Fetch enriched data (profiles, targets, historical) ──
    const fmpData: EnrichedFMPData = {
      profiles: {},
      targets: {},
      holdingHistory: {},
      benchmarkHistory: [],
    };

    if (symbols.length > 0) {
      // Fetch profiles from Yahoo Finance
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
              pe: yProfile.pe,
              eps: yProfile.eps,
              week52High: yProfile.week52High,
              week52Low: yProfile.week52Low,
              dividendYield: yProfile.dividendYield,
              earningsGrowth: yProfile.earningsGrowth,
              profitMargins: yProfile.profitMargins,
              debtToEquity: yProfile.debtToEquity,
              currentRatio: yProfile.currentRatio,
              revenueGrowth: yProfile.revenueGrowth,
              freeCashflow: yProfile.freeCashflow,
              returnOnEquity: yProfile.returnOnEquity,
              forwardPE: yProfile.forwardPE,
            };
            return { symbol, data };
          }
          return { symbol, data: null };
        } catch {
          return { symbol, data: null };
        }
      });

      // Fetch price target consensus — Yahoo first, FMP fallback
      const targetPromises = symbols.map(async (symbol: string) => {
        try {
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

    // ═══════════════════════════════════════════════════════════════
    // V2 ANALYTICS PIPELINE
    // ═══════════════════════════════════════════════════════════════

    // Compute total portfolio value
    const totalValue = (portfolio.holdings || []).reduce((sum: number, h: { symbol: string; quantity: number; average_cost: number }) => {
      const price = priceMap[h.symbol]?.price || h.average_cost;
      return sum + h.quantity * price;
    }, 0);

    // ── Step 4: Compute valuations per holding ──
    const valuationMap: Record<string, {
      dcfValue: number; psValue: number; peValue: number; fairValue: number;
      _fcf?: number; _cash?: number; _totalDebt?: number; _shares?: number; _sector?: string;
    }> = {};

    if (config?.include_valuation && symbols.length > 0) {
      try {
        const rawVal = (obj: unknown): number => {
          if (obj && typeof obj === 'object' && 'raw' in obj) {
            const v = Number((obj as { raw: number }).raw);
            return isFinite(v) ? v : 0;
          }
          return 0;
        };

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

            const currentPrice = rawVal(priceData.regularMarketPrice) || rawVal(fd.currentPrice) || priceMap[symbol]?.price || 0;
            const shares = rawVal(ks.sharesOutstanding) || rawVal(priceData.sharesOutstanding) || 1;
            const revenue = rawVal(fd.totalRevenue);
            const fcf = rawVal(fd.freeCashflow);
            const eps = rawVal(ks.trailingEps);
            const cash = rawVal(fd.totalCash);
            const totalDebt = rawVal(fd.totalDebt);
            const sector = String(priceData.sector ?? priceData.industry ?? '');
            const bench = getBenchmarkData(symbol, sector);

            const [priceDcf, priceSales, priceEarnings] = calculateValuation(
              bench.gr_sales / 100,
              bench.gr_fcf / 100,
              0.1,
              bench.wacc / 100,
              bench.ps,
              bench.pe,
              revenue, fcf, eps, cash, totalDebt, shares
            );

            const nonZeroPrices = [priceDcf, priceSales, priceEarnings].filter((p) => p !== 0);
            const avgIntrinsic = nonZeroPrices.length > 0
              ? nonZeroPrices.reduce((s, p) => s + p, 0) / nonZeroPrices.length
              : 0;

            return {
              symbol,
              dcfValue: priceDcf,
              psValue: priceSales,
              peValue: priceEarnings,
              fairValue: avgIntrinsic,
              _fcf: fcf, _cash: cash, _totalDebt: totalDebt, _shares: shares, _sector: sector,
            };
          } catch (e) {
            console.warn(`Valuation fetch failed for ${symbol}:`, e);
            return null;
          }
        });

        const results = await Promise.all(valuationPromises);
        for (const r of results) {
          if (r) valuationMap[r.symbol] = r;
        }
      } catch (err) {
        console.warn('Valuation computation failed, skipping:', err);
      }
    }

    // ── Step 5: Build RawPortfolioInput ──
    const resolveRegion = (h: { region?: string }, profile: FMPProfileData | undefined): string => {
      if (h.region) return h.region;
      const country = profile?.country || '';
      if (country === 'CA' || country === 'Canada') return 'CA';
      if (country === 'US' || country === 'United States') return 'US';
      return 'INTL';
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawHoldings: RawHolding[] = (portfolio.holdings || []).map((h: any) => {
      const profile = fmpData.profiles[h.symbol];
      const target = fmpData.targets[h.symbol];
      const priceInfo = priceMap[h.symbol];
      const currentPrice = priceInfo?.price || h.average_cost;
      const marketValue = h.quantity * currentPrice;
      const val = valuationMap[h.symbol];

      return {
        symbol: h.symbol,
        name: profile?.companyName || h.name || priceInfo?.company_name || h.symbol,
        weight: totalValue > 0 ? marketValue / totalValue : 0,
        currentPrice,
        shares: h.quantity,
        costBasis: h.average_cost * h.quantity,
        assetClass: h.asset_class || 'EQUITY',
        sector: profile?.sector || priceInfo?.sector || h.sector || '',
        region: resolveRegion(h, profile),
        currency: portfolio.currency,
        pe: profile?.pe || undefined,
        roe: profile?.returnOnEquity ? profile.returnOnEquity * 100 : undefined,
        debtToEquity: profile?.debtToEquity || undefined,
        profitMargin: profile?.profitMargins || undefined,
        revenueGrowth: profile?.revenueGrowth || undefined,
        earningsGrowth: profile?.earningsGrowth || undefined,
        dividendYield: profile?.dividendYield || undefined,
        annualDividend: profile?.lastDiv || undefined,
        marketCap: profile?.mktCap || undefined,
        beta: profile?.beta || undefined,
        targetPrice: config?.custom_targets?.[h.symbol] ?? (target?.targetConsensus && target.targetConsensus > 0 ? target.targetConsensus : undefined),
        dcfValue: val?.dcfValue || undefined,
        peValue: val?.peValue || undefined,
        psValue: val?.psValue || undefined,
        fairValue: val?.fairValue || undefined,
        isFund: FUND_CODE_REGEX.test(h.symbol) || undefined,
      } satisfies RawHolding;
    });

    // Convert FMP historical data to pipeline format
    const sortHistorical = (data: FMPHistoricalData[]) => {
      const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
      return { dates: sorted.map(d => d.date), prices: sorted.map(d => d.close) };
    };

    const rawInput: RawPortfolioInput = {
      client: {
        name: `${client.first_name} ${client.last_name}`,
        portfolioName: portfolio.name,
        riskProfile: client.risk_profile || 'EQUILIBRE',
        horizon: client.investment_horizon || '',
        advisorName: advisor?.name || session.user.name || 'Conseiller',
        advisorTitle: advisor?.title || '',
      },
      holdings: rawHoldings,
      historicalPrices: Object.fromEntries(
        Object.entries(fmpData.holdingHistory).map(([sym, data]) => [sym, sortHistorical(data)])
      ),
      benchmarkPrices: sortHistorical(fmpData.benchmarkHistory),
      config: {
        horizonYears: config?.projection_years || 5,
        monthlyContribution: config?.monthly_contribution || 0,
        targetValue: config?.target_value || null,
        riskFreeRate: 0.04,
        inflationRate: 0.025,
        benchmarkSymbol: '^GSPTSE',
        benchmarkName: 'S&P/TSX Composite',
        currency: portfolio.currency,
      },
    };

    // ── Step 6: Run analytics pipeline ──
    const analysisResult = await computePortfolioAnalysis(rawInput);

    // ── Step 6b: Inject sensitivity matrix for top 3 positions ──
    try {
      const top3Symbols = [...rawHoldings]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map(h => h.symbol);

      for (const sym of top3Symbols) {
        const val = valuationMap[sym];
        if (val && val.dcfValue > 0 && val._fcf && val._shares) {
          const bench = getBenchmarkData(sym, val._sector || '');
          const matrix = buildSensitivityMatrix(
            bench.wacc, bench.gr_fcf,
            val._fcf, val._cash || 0, val._totalDebt || 0, val._shares
          );
          if (matrix) {
            analysisResult.valuation.sensitivityMatrix = {
              symbol: sym,
              growthRates: matrix.cols,       // "Cr. X.X%" labels
              discountRates: matrix.rows,     // "WACC X.X%" labels
              values: matrix.data,
              currentPrice: rawHoldings.find(h => h.symbol === sym)?.currentPrice || 0,
            };
            break; // Only first valid one
          }
        }
      }
    } catch {
      // Sensitivity matrix is optional
    }

    // ── Step 7: Generate V2 AI content (if enabled) ──
    if (config?.ai_enabled && process.env.GROQ_API_KEY) {
      try {
        const promptData = buildV2PromptData(analysisResult, client, portfolio);
        const aiContent = await generateReportAIContentV2(promptData, portfolio_id);
        if (aiContent) {
          analysisResult.ai = aiContent;
          // Inject holding descriptions as "whyItExists"
          if (aiContent.holdingDescriptions) {
            for (const h of analysisResult.holdings) {
              const desc = aiContent.holdingDescriptions[h.symbol];
              if (desc) h.whyItExists = desc;
            }
          }
        }
      } catch (err) {
        console.warn('AI V2 content generation failed, skipping:', err);
        analysisResult.ai = null;
      }
    }

    // ── Step 8: Render PDF ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(ReportV2FromAnalysis, { data: analysisResult }) as any;
    const buffer = await renderToBuffer(element);

    // Merge fund fact PDFs (if any fund holdings)
    let finalPdfBytes: Uint8Array;
    if (fundCodes.length > 0) {
      const { mergeFundPdfs } = await import('@/lib/pdf/merge-fund-pdfs');
      finalPdfBytes = await mergeFundPdfs(buffer, fundCodes);
    } else {
      finalPdfBytes = new Uint8Array(buffer);
    }

    // ── Step 9: Record report in database ──
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

// ─── Helper: Build V2 prompt data from analysis result ───────────

function buildV2PromptData(
  result: PortfolioAnalysisResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portfolio: any,
): V2PromptData {
  const firstPeriod = result.benchmark.periodRows[0];

  return {
    clientName: result.client.name,
    riskProfile: result.client.riskProfile,
    objectives: client.objectives || '',
    horizon: result.client.horizon,
    accountType: portfolio.account_type || '',
    currency: result.meta.currency,
    totalValue: result.portfolio.totalValue,

    holdings: result.holdings.map(h => ({
      symbol: h.symbol,
      name: h.name,
      weight: h.weight,
      sector: h.sector,
      region: h.region,
      assetClass: h.assetClass,
    })),

    allocation: {
      byAssetClass: result.allocation.assetClassSlices.map(s => ({ label: s.label, pct: s.weight * 100 })),
      byRegion: result.allocation.regionSlices.map(s => ({ label: s.label, pct: s.weight * 100 })),
      bySector: result.allocation.sectorSlices.map(s => ({ label: s.label, pct: s.weight * 100 })),
    },

    dna: {
      dominantStyle: result.dna.dominantStyle,
      secondaryStyle: result.dna.secondaryStyle || undefined,
      summary: result.dna.summary,
    },

    risk: {
      volatility: result.risk.metrics.annualizedVolatility,
      sharpe: result.risk.metrics.sharpeRatio,
      sortino: result.risk.metrics.sortinoRatio,
      maxDrawdown: result.risk.metrics.maxDrawdown,
      beta: result.risk.metrics.beta,
      var95: result.risk.metrics.var95,
    },

    monteCarlo: {
      medianReturn: result.projection.monteCarlo.medianReturn,
      probLoss: result.projection.monteCarlo.probabilityOfLoss,
      p25Final: result.projection.monteCarlo.finalValues.p25,
      p50Final: result.projection.monteCarlo.finalValues.p50,
      p75Final: result.projection.monteCarlo.finalValues.p75,
    },

    fundamentals: {
      avgPE: result.fundamentals.portfolioAvgPE,
      avgROE: result.fundamentals.portfolioAvgROE,
      avgMargin: result.fundamentals.portfolioAvgMargin,
      avgBeta: result.fundamentals.portfolioAvgBeta,
      avgDebtEquity: result.fundamentals.portfolioAvgDebtEquity,
    },

    portfolioYield: result.income.portfolioYield,
    totalAnnualIncome: result.income.totalAnnualIncome,
    bondAllocation: result.bonds?.allocationPct ?? 0,
    bondDuration: result.bonds?.analytics.modifiedDuration,
    avgCreditQuality: result.bonds?.analytics.avgCreditQuality,

    intelligence: {
      overall: result.intelligence.overall,
      grade: result.intelligence.grade,
      subScores: result.intelligence.subScores.map(c => ({ name: c.name, score: c.score })),
    },

    diversification: {
      score: result.diversification.diversificationScore,
      avgCorrelation: result.diversification.correlationMatrix.avgCorrelation,
      hhi: result.diversification.hhi,
      top5Concentration: result.diversification.top5Concentration,
    },

    stressRadar: {
      resilience: result.stress.overallResilience,
      vulnerabilities: result.stress.vulnerabilities,
      strengths: result.stress.strengths,
    },

    behavioral: {
      worstDrawdown: result.behavioral.worstEstimatedDrawdown,
      avgDrawdown: result.behavioral.avgEstimatedDrawdown,
    },

    benchmark: {
      name: result.benchmark.name,
      portfolioReturn: firstPeriod?.portfolioReturn,
      benchmarkReturn: firstPeriod?.benchmarkReturn,
      alpha: firstPeriod?.diff,
    },

    portfolioUpside: result.valuation.portfolioUpside / 100,
  };
}

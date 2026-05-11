import { NextRequest, NextResponse } from 'next/server';
import { getEODHDFundamentals, getEODHDETFData, toEODHDSymbol } from '@/lib/api/eodhd';
import { getYahooHistoricalChart, getYahooQuotes, getYahooPriceTarget } from '@/lib/yahoo/client';
import Groq from 'groq-sdk';
import {
  calculateRiskStats,
  calculateGrowthSeries,
  calculateAnnualReturns,
  calculateStyleMatrix,
  calculateWeightedFundamentals,
  classifyStyle,
  calculateMonteCarlo,
  calculateStressTests,
  calculateCorrelationMatrix,
  calculateRiskContributions,
  calculateConcentration,
  calculateCurrencyExposure,
  calculateDividendProjection,
  classifyRiskProfile,
} from '@/lib/portfolio/statistics';

// ── Types ────────────────────────────────────────────────────────────────────

interface HoldingInput {
  symbol: string;
  weight: number; // 0-100 (percentage)
  name?: string;
}

interface AnalysisHolding {
  symbol: string;
  name: string;
  weight: number;
  price: number;
  currency: string;

  // Fundamentals (EODHD)
  sector: string;
  gicSector: string;
  industry: string;
  country: string;
  marketCap: number;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  dividendYield: number | null;
  earningsGrowth: number | null;
  profitMargin: number | null;
  beta: number | null;
  eps: number | null;
  description: string;

  // Targets
  targetPrice: number | null;
  targetLow: number | null;
  targetHigh: number | null;
  numAnalysts: number;
  upside: number | null;

  // Style
  styleSize: string;
  styleValue: string;
}

// ── AI Narrative ────────────────────────────────────────────────────────────

interface AINarrative {
  executiveSummary: string;
  performanceComment: string;
  riskComment: string;
  allocationComment: string;
  strengths: string[];
  weaknesses: string[];
  outlook: string;
}

async function generateAINarrative(data: {
  name: string;
  holdingsCount: number;
  benchmark: string;
  riskStats: Record<string, unknown>;
  weightedFundamentals: Record<string, unknown>;
  sectors: Array<{ sector: string; weight: number }>;
  geography: Array<{ region: string; weight: number }>;
  totalDivYield: number;
  riskProfile: { level: string; score: number };
  concentration: { herfindahl: number; top5Weight: number };
  stressTests: Array<{ name: string; portfolioReturn: number; benchmarkReturn: number }>;
}): Promise<AINarrative | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const groq = new Groq({ apiKey });

    const prompt = `Tu es un analyste financier senior. Analyse ce portefeuille et génère un commentaire professionnel EN FRANÇAIS.

DONNÉES DU PORTEFEUILLE "${data.name}":
- ${data.holdingsCount} positions, benchmark: ${data.benchmark}
- Profil de risque: ${data.riskProfile.level} (score ${data.riskProfile.score}/100)
- Rendement 1 an: ${data.riskStats.return1Y !== null ? ((data.riskStats.return1Y as number) * 100).toFixed(1) + '%' : 'N/D'}
- Rendement 3 ans (ann.): ${data.riskStats.return3Y !== null ? ((data.riskStats.return3Y as number) * 100).toFixed(1) + '%' : 'N/D'}
- Sharpe 3 ans: ${data.riskStats.sharpe3Y ?? 'N/D'}
- Max drawdown: ${data.riskStats.maxDrawdown !== undefined ? ((data.riskStats.maxDrawdown as number) * 100).toFixed(1) + '%' : 'N/D'}
- Beta 3 ans: ${data.riskStats.beta3Y ?? 'N/D'}
- Dividende pondéré: ${(data.totalDivYield * 100).toFixed(2)}%
- P/E pondéré: ${data.weightedFundamentals.weightedPE ?? 'N/D'}
- Top secteurs: ${data.sectors.slice(0, 3).map(s => `${s.sector} (${s.weight.toFixed(0)}%)`).join(', ')}
- Géographie: ${data.geography.map(g => `${g.region} (${g.weight.toFixed(0)}%)`).join(', ')}
- Concentration HHI: ${data.concentration.herfindahl}, Top 5: ${(data.concentration.top5Weight * 100).toFixed(0)}%
- Stress tests: ${data.stressTests.map(st => `${st.name}: ${(st.portfolioReturn * 100).toFixed(1)}%`).join(', ')}

Retourne EXACTEMENT ce JSON (pas de markdown, juste le JSON):
{
  "executiveSummary": "Résumé de 3-4 phrases sur le portefeuille, son positionnement et ses caractéristiques principales.",
  "performanceComment": "2-3 phrases sur la performance historique et comparée au benchmark.",
  "riskComment": "2-3 phrases sur le profil de risque, la volatilité et le drawdown.",
  "allocationComment": "2-3 phrases sur la répartition sectorielle et géographique.",
  "strengths": ["Point fort 1", "Point fort 2", "Point fort 3"],
  "weaknesses": ["Point de vigilance 1", "Point de vigilance 2", "Point de vigilance 3"],
  "outlook": "2-3 phrases de perspectives pour les 12 prochains mois."
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const completion = await groq.chat.completions.create(
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: 'Tu es un analyste financier professionnel au Québec. Réponds toujours en français canadien professionnel.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );

    clearTimeout(timeout);

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as AINarrative;
    if (!parsed.executiveSummary) return null;

    return parsed;
  } catch (err) {
    console.error('[AI Portfolio] Groq error:', err);
    return null;
  }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const holdings: HoldingInput[] = body.holdings;
    const benchmarkSymbol: string = body.benchmark ?? 'XIU.TO';
    const portfolioName: string = body.name ?? 'Portefeuille Modèle';

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ error: 'Aucune position fournie' }, { status: 400 });
    }

    if (holdings.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 positions' }, { status: 400 });
    }

    // Normalize weights to sum to 1
    const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
    const normalizedHoldings = holdings.map(h => ({
      ...h,
      weight: totalWeight > 0 ? h.weight / totalWeight : 1 / holdings.length,
    }));

    const symbols = normalizedHoldings.map(h => h.symbol);

    // Additional benchmarks for multi-index comparison
    const additionalBenchmarks = [
      { symbol: '^GSPTSE', label: 'S&P/TSX' },
      { symbol: '^GSPC', label: 'S&P 500' },
      { symbol: 'XBB.TO', label: 'Obligations (XBB)' },
    ].filter(b => b.symbol !== benchmarkSymbol);

    // ── Fetch all data in parallel ──────────────────────────────────────
    const [quotes, benchmarkHistory, ...restHistories] = await Promise.all([
      // Current prices
      getYahooQuotes(symbols),
      // Benchmark historical (10y monthly)
      getYahooHistoricalChart(benchmarkSymbol, 10),
      // Individual historical prices
      ...symbols.map(s => getYahooHistoricalChart(s, 10)),
      // Additional benchmarks
      ...additionalBenchmarks.map(b => getYahooHistoricalChart(b.symbol, 10)),
    ]);

    // Split rest into holding histories and additional benchmark histories
    const holdingHistories = restHistories.slice(0, symbols.length);
    const additionalBenchHistories = restHistories.slice(symbols.length);

    // Fetch fundamentals from EODHD (sequential batches to avoid rate limits)
    const fundamentalsMap = new Map<string, Awaited<ReturnType<typeof getEODHDFundamentals>>>();
    const etfDataMap = new Map<string, Awaited<ReturnType<typeof getEODHDETFData>>>();

    const BATCH = 4;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (sym) => {
          const eodhSym = toEODHDSymbol(sym);
          const [fund, etf] = await Promise.all([
            getEODHDFundamentals(eodhSym),
            getEODHDETFData(eodhSym),
          ]);
          return { sym, fund, etf };
        })
      );
      for (const r of results) {
        if (r.fund) fundamentalsMap.set(r.sym, r.fund);
        if (r.etf) etfDataMap.set(r.sym, r.etf);
      }
    }

    // Fetch price targets
    const targetResults = await Promise.all(symbols.map(s => getYahooPriceTarget(s)));
    const targetsMap = new Map(symbols.map((s, i) => [s, targetResults[i]]));

    // Build quotes map
    const quotesMap = new Map(quotes.map(q => [q.symbol, q]));

    // ── Build analysis holdings ─────────────────────────────────────────
    const analysisHoldings: AnalysisHolding[] = normalizedHoldings.map((h) => {
      const quote = quotesMap.get(h.symbol);
      const fund = fundamentalsMap.get(h.symbol);
      const target = targetsMap.get(h.symbol);

      const marketCap = fund?.general.marketCap ?? fund?.highlights.marketCapitalization ?? 0;
      const pe = fund?.highlights.peRatio ?? null;
      const pb = fund?.highlights.priceToBook ?? null;
      const style = classifyStyle(marketCap, pe, pb);

      return {
        symbol: h.symbol,
        name: h.name ?? fund?.general.name ?? quote?.name ?? h.symbol,
        weight: h.weight * 100,
        price: quote?.price ?? 0,
        currency: quote?.currency ?? fund?.general.currencyCode ?? 'CAD',

        sector: fund?.general.sector ?? '',
        gicSector: fund?.general.gicSector ?? fund?.general.sector ?? '',
        industry: fund?.general.industry ?? '',
        country: fund?.general.countryName ?? '',
        marketCap,
        pe,
        pb,
        roe: fund?.highlights.returnOnEquityTTM ?? null,
        dividendYield: fund?.highlights.dividendYield ?? null,
        earningsGrowth: fund?.highlights.quarterlyRevenueGrowthYOY ?? null,
        profitMargin: fund?.highlights.profitMargin ?? null,
        beta: fund?.technicals.beta ?? null,
        eps: fund?.highlights.eps ?? null,
        description: fund?.general.description ?? '',

        targetPrice: target?.targetMean ?? null,
        targetLow: target?.targetLow ?? null,
        targetHigh: target?.targetHigh ?? null,
        numAnalysts: target?.numAnalysts ?? 0,
        upside: target?.targetMean && quote?.price
          ? ((target.targetMean - quote.price) / quote.price) * 100
          : null,

        styleSize: style.size,
        styleValue: style.style,
      };
    });

    // ── Calculate portfolio historical returns ──────────────────────────
    const benchmarkDates = new Set(benchmarkHistory.map(p => p.date));
    const allDates = [...benchmarkDates].sort();

    const portfolioReturns: number[] = [];
    const returnDates: string[] = [];
    const benchmarkReturns: number[] = [];

    // Build price maps for each holding
    const holdingPriceMaps = symbols.map((_, idx) => {
      const history = holdingHistories[idx] ?? [];
      return new Map(history.map(p => [p.date, p.adjClose]));
    });

    const benchmarkPriceMap = new Map(benchmarkHistory.map(p => [p.date, p.adjClose]));

    // ── Individual holding returns (aligned with portfolio returns) ────
    const holdingReturnsMap = new Map<string, number[]>();
    for (const sym of symbols) holdingReturnsMap.set(sym, []);

    // Calculate weighted portfolio returns for each month
    for (let i = 1; i < allDates.length; i++) {
      const prevDate = allDates[i - 1];
      const currDate = allDates[i];

      const benchPrev = benchmarkPriceMap.get(prevDate);
      const benchCurr = benchmarkPriceMap.get(currDate);
      if (!benchPrev || !benchCurr || benchPrev <= 0) continue;

      let portfolioReturn = 0;
      let validWeight = 0;

      for (let j = 0; j < symbols.length; j++) {
        const prev = holdingPriceMaps[j].get(prevDate);
        const curr = holdingPriceMaps[j].get(currDate);
        if (prev && curr && prev > 0) {
          const ret = (curr - prev) / prev;
          portfolioReturn += ret * normalizedHoldings[j].weight;
          validWeight += normalizedHoldings[j].weight;
        }
      }

      // Scale up if some holdings missing data for this period
      if (validWeight > 0 && validWeight < 0.99) {
        portfolioReturn = portfolioReturn / validWeight;
      }

      if (validWeight > 0) {
        portfolioReturns.push(portfolioReturn);
        benchmarkReturns.push((benchCurr - benchPrev) / benchPrev);
        returnDates.push(currDate);

        // Record individual holding returns for this date (same alignment as portfolioReturns)
        for (let j = 0; j < symbols.length; j++) {
          const prev = holdingPriceMaps[j].get(prevDate);
          const curr = holdingPriceMaps[j].get(currDate);
          const ret = (prev && curr && prev > 0) ? (curr - prev) / prev : 0;
          holdingReturnsMap.get(symbols[j])!.push(ret);
        }
      }
    }

    // ── Risk Stats ──────────────────────────────────────────────────────
    const riskStats = calculateRiskStats(portfolioReturns, benchmarkReturns, returnDates);

    // ── Growth of $10,000 ───────────────────────────────────────────────
    const growthSeries = calculateGrowthSeries(portfolioReturns, benchmarkReturns, returnDates);

    // ── Annual Returns ──────────────────────────────────────────────────
    const annualReturns = calculateAnnualReturns(portfolioReturns, benchmarkReturns, returnDates);

    // ── Style Matrix ────────────────────────────────────────────────────
    const styleHoldings = analysisHoldings
      .filter(h => h.marketCap > 0)
      .map(h => ({ weight: h.weight / 100, marketCap: h.marketCap, pe: h.pe, pb: h.pb }));
    const styleMatrix = calculateStyleMatrix(styleHoldings);

    // ── Weighted Fundamentals ───────────────────────────────────────────
    const fundHoldings = analysisHoldings.map(h => ({
      weight: h.weight / 100,
      pe: h.pe,
      pb: h.pb,
      roe: h.roe,
      dividendYield: h.dividendYield,
      earningsGrowth: h.earningsGrowth,
      profitMargin: h.profitMargin,
      marketCap: h.marketCap,
    }));
    const weightedFundamentals = calculateWeightedFundamentals(fundHoldings);

    // ── Sector Allocation ───────────────────────────────────────────────
    const sectorMap = new Map<string, number>();
    for (const h of analysisHoldings) {
      const sector = h.gicSector || h.sector || 'Autre';
      if (sector) {
        sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.weight);
      }
    }
    const sectors = [...sectorMap.entries()]
      .map(([sector, weight]) => ({ sector, weight }))
      .sort((a, b) => b.weight - a.weight);

    // ── Geography Allocation ────────────────────────────────────────────
    const geoMap = new Map<string, number>();
    for (const h of analysisHoldings) {
      const country = h.country || 'Inconnu';
      let region: string;
      if (['Canada'].includes(country)) region = 'Canada';
      else if (['USA', 'United States'].includes(country)) region = 'États-Unis';
      else if (['United Kingdom', 'France', 'Germany', 'Switzerland', 'Netherlands', 'Sweden', 'Spain', 'Italy', 'Denmark', 'Norway', 'Finland', 'Belgium', 'Ireland', 'Austria', 'Portugal'].includes(country)) region = 'Europe';
      else if (['Japan', 'China', 'Hong Kong', 'South Korea', 'Taiwan', 'Singapore', 'India', 'Australia'].includes(country)) region = 'Asie-Pacifique';
      else region = 'Autre';
      geoMap.set(region, (geoMap.get(region) ?? 0) + h.weight);
    }
    const geography = [...geoMap.entries()]
      .map(([region, weight]) => ({ region, weight }))
      .sort((a, b) => b.weight - a.weight);

    // ── Dividends Summary ───────────────────────────────────────────────
    const totalDivYield = analysisHoldings.reduce((sum, h) => {
      if (h.dividendYield && h.dividendYield > 0) {
        return sum + (h.dividendYield * h.weight / 100);
      }
      return sum;
    }, 0);

    // ── NEW: Monte Carlo ────────────────────────────────────────────────
    const monteCarlo = portfolioReturns.length >= 12
      ? calculateMonteCarlo(portfolioReturns, 5, 1000)
      : null;

    // ── NEW: Stress Tests ───────────────────────────────────────────────
    const stressTests = calculateStressTests(portfolioReturns, benchmarkReturns, returnDates);

    // ── NEW: Correlation Matrix (top 10 by weight) ──────────────────────
    const topSymbols = [...analysisHoldings]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10)
      .map(h => h.symbol);
    const correlationMatrix = topSymbols.length >= 2
      ? calculateCorrelationMatrix(holdingReturnsMap, topSymbols)
      : null;

    // ── NEW: Risk Contributions ─────────────────────────────────────────
    const riskContributions = calculateRiskContributions(
      holdingReturnsMap,
      symbols,
      normalizedHoldings.map(h => h.weight),
      portfolioReturns,
    );

    // ── NEW: Concentration ──────────────────────────────────────────────
    const concentration = calculateConcentration(normalizedHoldings.map(h => h.weight));

    // ── NEW: Currency Exposure ──────────────────────────────────────────
    const currencyExposure = calculateCurrencyExposure(
      analysisHoldings.map(h => ({ weight: h.weight / 100, currency: h.currency })),
    );

    // ── NEW: Dividend Projection ────────────────────────────────────────
    const dividendProjection = totalDivYield > 0
      ? calculateDividendProjection(totalDivYield, 100000)
      : [];

    // ── NEW: Risk Profile ───────────────────────────────────────────────
    // Estimate equity weight (detect bond/fixed income holdings)
    const bondPattern = /\b(bond|obligation|fixed.income|aggregate|treasury|income|revenu)/i;
    let fixedIncomeWeight = 0;
    for (const h of analysisHoldings) {
      if (bondPattern.test(h.name) || bondPattern.test(h.sector) || bondPattern.test(h.industry)) {
        fixedIncomeWeight += h.weight / 100;
      }
    }
    const equityWeight = Math.max(0, Math.min(1, 1 - fixedIncomeWeight));
    const riskProfile = classifyRiskProfile(
      riskStats.stdDev3Y,
      riskStats.beta3Y,
      riskStats.maxDrawdown,
      equityWeight,
    );

    // ── NEW: Multi-index comparison ─────────────────────────────────────
    const multiIndex: Array<{ label: string; growthSeries: Array<{ date: string; value: number }> }> = [
      {
        label: 'Portefeuille',
        growthSeries: growthSeries.map(p => ({ date: p.date, value: p.portfolio })),
      },
      {
        label: benchmarkSymbol,
        growthSeries: growthSeries.map(p => ({ date: p.date, value: p.benchmark })),
      },
    ];

    for (let k = 0; k < additionalBenchmarks.length; k++) {
      const hist = additionalBenchHistories[k] ?? [];
      if (hist.length < 2) continue;

      const priceMap = new Map(hist.map(p => [p.date, p.adjClose]));

      // Build growth series from prices aligned to returnDates
      const series: Array<{ date: string; value: number }> = [];
      let prevPrice: number | null = null;
      let val = 10000;

      for (const date of returnDates) {
        const price = priceMap.get(date);
        if (!price || price <= 0) continue;

        if (prevPrice === null) {
          // First valid price — start at 10K
          series.push({ date, value: 10000 });
        } else {
          const ret = (price - prevPrice) / prevPrice;
          val *= (1 + ret);
          series.push({ date, value: Math.round(val * 100) / 100 });
        }
        prevPrice = price;
      }

      if (series.length > 2) {
        multiIndex.push({
          label: additionalBenchmarks[k].label,
          growthSeries: series,
        });
      }
    }

    // ── ETF Data (if any) ───────────────────────────────────────────────
    const etfDetails: Array<{ symbol: string; name: string; data: NonNullable<Awaited<ReturnType<typeof getEODHDETFData>>> }> = [];
    for (const [sym, data] of etfDataMap) {
      if (data) {
        etfDetails.push({
          symbol: sym,
          name: data.general.name,
          data,
        });
      }
    }

    // ── NEW: AI Narrative (non-blocking) ────────────────────────────────
    let aiNarrative: AINarrative | null = null;
    try {
      aiNarrative = await generateAINarrative({
        name: portfolioName,
        holdingsCount: analysisHoldings.length,
        benchmark: benchmarkSymbol,
        riskStats: riskStats as unknown as Record<string, unknown>,
        weightedFundamentals: weightedFundamentals as unknown as Record<string, unknown>,
        sectors,
        geography,
        totalDivYield,
        riskProfile,
        concentration,
        stressTests,
      });
    } catch {
      // AI narrative is optional — don't fail the whole request
    }

    // ── Sources tracking ────────────────────────────────────────────────
    const sources = {
      fundamentals: 'EODHD (eodhd.com)',
      prices: 'Yahoo Finance',
      historicalData: 'Yahoo Finance (10 ans)',
      benchmark: benchmarkSymbol,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      name: portfolioName,
      holdings: analysisHoldings,
      benchmark: benchmarkSymbol,
      riskStats,
      growthSeries,
      annualReturns,
      styleMatrix,
      weightedFundamentals,
      sectors,
      geography,
      totalDivYield,
      etfDetails,
      sources,
      holdingsCount: analysisHoldings.length,
      dataMonths: portfolioReturns.length,
      // NEW fields
      monteCarlo,
      stressTests,
      correlationMatrix,
      riskContributions,
      concentration,
      currencyExposure,
      dividendProjection,
      riskProfile,
      multiIndex,
      aiNarrative,
    });
  } catch (error) {
    console.error('Portfolio analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur d\'analyse' },
      { status: 500 }
    );
  }
}

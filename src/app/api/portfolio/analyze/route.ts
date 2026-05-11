import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { getEODHDFundamentals, getEODHDETFData, toEODHDSymbol } from '@/lib/api/eodhd';
import { getYahooHistoricalChart, getYahooQuotes, getYahooPriceTarget } from '@/lib/yahoo/client';
import {
  calculateRiskStats,
  calculateGrowthSeries,
  calculateAnnualReturns,
  calculateStyleMatrix,
  calculateWeightedFundamentals,
  classifyStyle,
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

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

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

    // ── Fetch all data in parallel ──────────────────────────────────────
    const [quotes, benchmarkHistory, ...holdingHistories] = await Promise.all([
      // Current prices
      getYahooQuotes(symbols),
      // Benchmark historical (10y monthly)
      getYahooHistoricalChart(benchmarkSymbol, 10),
      // Individual historical prices
      ...symbols.map(s => getYahooHistoricalChart(s, 10)),
    ]);

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
    const analysisHoldings: AnalysisHolding[] = normalizedHoldings.map((h, idx) => {
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
    // Find common date range across all holdings + benchmark
    const benchmarkDates = new Set(benchmarkHistory.map(p => p.date));

    // Build date-aligned price series for portfolio
    const allDates = [...benchmarkDates].sort();

    // Portfolio monthly returns (weighted average of individual returns)
    const portfolioReturns: number[] = [];
    const returnDates: string[] = [];
    const benchmarkReturns: number[] = [];

    // Build price maps for each holding
    const holdingPriceMaps = symbols.map((_, idx) => {
      const history = holdingHistories[idx] ?? [];
      return new Map(history.map(p => [p.date, p.adjClose]));
    });

    const benchmarkPriceMap = new Map(benchmarkHistory.map(p => [p.date, p.adjClose]));

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
      // Group into regions
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
    });
  } catch (error) {
    console.error('Portfolio analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur d\'analyse' },
      { status: 500 }
    );
  }
}

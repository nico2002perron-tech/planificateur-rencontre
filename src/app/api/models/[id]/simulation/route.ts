import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { getYahooQuotes } from '@/lib/yahoo/client';

// ── Types ────────────────────────────────────────────────────────────────

interface SimHolding {
  symbol: string;
  name: string;
  quantity: number;
  purchase_price: number;
  weight: number;
  asset_class: string;
  region?: string;
  annual_dividend?: number; // annual dividend per share (stocks + ETF distributions)
}

// ── POST: Start a new simulation ─────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id: modelId } = await params;

  try {
    const body = await request.json();
    const initialValue = Number(body.initial_value) || 100000;
    const currency = body.currency === 'USD' ? 'USD' : 'CAD';
    const benchmarks = body.benchmarks || ['^GSPTSE', '^GSPC'];

    const supabase = createClient();

    // Verify model exists and belongs to user
    const { data: model } = await supabase
      .from('model_portfolios')
      .select('*')
      .eq('id', modelId)
      .eq('created_by', session.user.id)
      .single();

    if (!model) {
      return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 });
    }

    // Check if there's already an active simulation for this model
    const { data: existing } = await supabase
      .from('model_simulations')
      .select('id')
      .eq('model_id', modelId)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Une simulation est déjà active pour ce modèle' },
        { status: 409 }
      );
    }

    // Fetch live prices + dividend rates for all holdings
    const holdingSymbols = (model.holdings || []).map((h: { symbol: string }) => h.symbol);
    const quotes = await getYahooQuotes(holdingSymbols);
    const priceMap = new Map(quotes.map((q) => [q.symbol, q.price]));
    const divMap = new Map(quotes.map((q) => [q.symbol, q.dividendRate]));

    // Calculate quantities and build holdings snapshot
    const holdingsSnapshot: SimHolding[] = [];
    let allocatedValue = 0;

    for (const h of model.holdings as { symbol: string; name: string; weight: number; asset_class: string; region?: string }[]) {
      const price = priceMap.get(h.symbol);
      if (!price || price <= 0) continue;

      const allocationAmount = (h.weight / 100) * initialValue;
      const quantity = Math.round((allocationAmount / price) * 1000000) / 1000000;
      const annualDiv = divMap.get(h.symbol);

      holdingsSnapshot.push({
        symbol: h.symbol,
        name: h.name,
        quantity,
        purchase_price: price,
        weight: h.weight,
        asset_class: h.asset_class,
        region: h.region,
        annual_dividend: annualDiv && annualDiv > 0 ? annualDiv : undefined,
      });

      allocatedValue += quantity * price;
    }

    if (holdingsSnapshot.length === 0) {
      return NextResponse.json(
        { error: 'Aucun prix disponible pour les titres du modèle' },
        { status: 400 }
      );
    }

    // Fetch benchmark start prices
    const benchQuotes = await getYahooQuotes(benchmarks);
    const benchmarkStartPrices: Record<string, number> = {};
    for (const bq of benchQuotes) {
      benchmarkStartPrices[bq.symbol] = bq.price;
    }

    const today = new Date().toISOString().split('T')[0];

    // Create simulation record
    const { data: simulation, error: simError } = await supabase
      .from('model_simulations')
      .insert({
        model_id: modelId,
        name: `Simulation — ${model.name}`,
        initial_value: initialValue,
        currency,
        status: 'active',
        start_date: today,
        holdings_snapshot: holdingsSnapshot,
        benchmarks,
        benchmark_start_prices: benchmarkStartPrices,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (simError) throw simError;

    // Build holdings detail for day 0 snapshot
    const holdingsDetail = holdingsSnapshot.map((h) => ({
      symbol: h.symbol,
      price: h.purchase_price,
      market_value: Math.round(h.quantity * h.purchase_price * 100) / 100,
      daily_change_pct: 0,
    }));

    // Create day 0 snapshot
    await supabase.from('simulation_snapshots').insert({
      simulation_id: simulation.id,
      date: today,
      total_value: allocatedValue,
      daily_return: 0,
      holdings_detail: holdingsDetail,
      benchmark_values: benchmarkStartPrices,
    });

    return NextResponse.json({
      simulation,
      holdings_count: holdingsSnapshot.length,
      prices_found: quotes.length,
      prices_missing: holdingSymbols.length - quotes.length,
    });
  } catch (error) {
    console.error('Simulation creation error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}

// ── GET: Get simulation data + snapshots + live values ───────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id: modelId } = await params;

  try {
    const supabase = createClient();

    // Get the most recent simulation for this model
    const { data: simulation } = await supabase
      .from('model_simulations')
      .select('*')
      .eq('model_id', modelId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!simulation) {
      return NextResponse.json({ simulation: null, snapshots: [], live: null, stats: null });
    }

    // Get all snapshots
    const { data: snapshots } = await supabase
      .from('simulation_snapshots')
      .select('*')
      .eq('simulation_id', simulation.id)
      .order('date', { ascending: true });

    // Fetch current live prices
    const holdings = simulation.holdings_snapshot as SimHolding[];
    const symbols = holdings.map((h) => h.symbol);
    const benchSymbols = simulation.benchmarks || ['^GSPTSE', '^GSPC'];

    const [stockQuotes, benchQuotes] = await Promise.all([
      getYahooQuotes(symbols),
      getYahooQuotes(benchSymbols),
    ]);

    const priceMap = new Map(stockQuotes.map((q) => [q.symbol, q.price]));
    const benchPriceMap = new Map(benchQuotes.map((q) => [q.symbol, q.price]));

    // Calculate live portfolio value
    let liveTotal = 0;
    const liveHoldings = holdings.map((h) => {
      const currentPrice = priceMap.get(h.symbol) || h.purchase_price;
      const marketValue = h.quantity * currentPrice;
      const costBasis = h.quantity * h.purchase_price;
      liveTotal += marketValue;

      return {
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        purchase_price: h.purchase_price,
        current_price: currentPrice,
        market_value: Math.round(marketValue * 100) / 100,
        cost_basis: Math.round(costBasis * 100) / 100,
        gain_loss: Math.round((marketValue - costBasis) * 100) / 100,
        gain_loss_pct: costBasis > 0 ? Math.round(((marketValue - costBasis) / costBasis) * 10000) / 100 : 0,
        weight: 0, // computed below
        asset_class: h.asset_class,
        region: h.region,
      };
    });

    // Calculate weights
    for (const lh of liveHoldings) {
      lh.weight = liveTotal > 0 ? Math.round((lh.market_value / liveTotal) * 10000) / 100 : 0;
    }

    // Benchmark performance since start
    const benchStartPrices = simulation.benchmark_start_prices as Record<string, number>;
    const benchmarkPerf: Record<string, { current: number; start: number; return_pct: number }> = {};
    for (const sym of benchSymbols) {
      const start = benchStartPrices[sym] || 0;
      const current = benchPriceMap.get(sym) || start;
      benchmarkPerf[sym] = {
        current,
        start,
        return_pct: start > 0 ? Math.round(((current - start) / start) * 10000) / 100 : 0,
      };
    }

    // Calculate stats from snapshots
    const dailyReturns = (snapshots || [])
      .filter((s: { daily_return: number | null }) => s.daily_return != null && s.daily_return !== 0)
      .map((s: { daily_return: number }) => s.daily_return);

    let volatility = 0;
    if (dailyReturns.length > 1) {
      const mean = dailyReturns.reduce((a: number, b: number) => a + b, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum: number, r: number) => sum + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
      volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
    }

    // Max drawdown
    let maxDrawdown = 0;
    let peak = simulation.initial_value;
    for (const snap of snapshots || []) {
      const val = Number(snap.total_value);
      if (val > peak) peak = val;
      const dd = ((peak - val) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Days active
    const startDate = new Date(simulation.start_date);
    const daysActive = Math.floor((Date.now() - startDate.getTime()) / 86400000);

    // Income calculation (dividends + fixed income distributions)
    let totalDividendIncome = 0;
    let totalFixedIncome = 0;
    for (const h of holdings) {
      if (h.annual_dividend && h.annual_dividend > 0 && daysActive > 0) {
        const accruedIncome = h.quantity * h.annual_dividend * (daysActive / 365.25);
        if (h.asset_class === 'FIXED_INCOME') {
          totalFixedIncome += accruedIncome;
        } else {
          totalDividendIncome += accruedIncome;
        }
      }
    }
    totalDividendIncome = Math.round(totalDividendIncome * 100) / 100;
    totalFixedIncome = Math.round(totalFixedIncome * 100) / 100;
    const totalIncome = totalDividendIncome + totalFixedIncome;

    // Capital gains (price appreciation only)
    const capitalGain = liveTotal - simulation.initial_value;

    // Total return (capital + income)
    const totalReturn = capitalGain + totalIncome;
    const totalReturnPct = simulation.initial_value > 0
      ? (totalReturn / simulation.initial_value) * 100 : 0;

    // Annualized return
    const yearsActive = daysActive / 365.25;
    const annualizedReturn = yearsActive > 0.05
      ? (Math.pow(liveTotal / simulation.initial_value, 1 / yearsActive) - 1) * 100 : totalReturnPct;

    // Best and worst day
    const bestDay = dailyReturns.length > 0 ? Math.max(...dailyReturns) * 100 : 0;
    const worstDay = dailyReturns.length > 0 ? Math.min(...dailyReturns) * 100 : 0;

    return NextResponse.json({
      simulation,
      snapshots: snapshots || [],
      live: {
        total_value: Math.round(liveTotal * 100) / 100,
        holdings: liveHoldings.sort((a, b) => b.market_value - a.market_value),
        benchmarks: benchmarkPerf,
      },
      stats: {
        total_return: Math.round(totalReturn * 100) / 100,
        total_return_pct: Math.round(totalReturnPct * 100) / 100,
        capital_gain: Math.round(capitalGain * 100) / 100,
        capital_gain_pct: simulation.initial_value > 0 ? Math.round((capitalGain / simulation.initial_value) * 10000) / 100 : 0,
        dividend_income: totalDividendIncome,
        fixed_income: totalFixedIncome,
        total_income: totalIncome,
        annualized_return: Math.round(annualizedReturn * 100) / 100,
        volatility: Math.round(volatility * 100) / 100,
        max_drawdown: Math.round(maxDrawdown * 100) / 100,
        best_day: Math.round(bestDay * 100) / 100,
        worst_day: Math.round(worstDay * 100) / 100,
        days_active: daysActive,
        sharpe: volatility > 0 ? Math.round((annualizedReturn / volatility) * 100) / 100 : 0,
      },
    });
  } catch (error) {
    console.error('Simulation fetch error:', error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

// ── PUT: Update simulation status ────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id: modelId } = await params;

  try {
    const body = await request.json();
    const newStatus = body.status;

    if (!['active', 'paused', 'closed'].includes(newStatus)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const supabase = createClient();

    const update: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'closed') {
      update.end_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('model_simulations')
      .update(update)
      .eq('model_id', modelId)
      .eq('created_by', session.user.id)
      .neq('status', 'closed')
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ simulation: data });
  } catch (error) {
    console.error('Simulation update error:', error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

'use client';

import { useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useModel } from '@/lib/hooks/useModels';
import { useSimulation, type LiveHolding, type SimulationSnapshot } from '@/lib/hooks/useSimulation';
import { StockAvatar, DuoStat, StartSimulation, duoColor, fmtMoney, fmtMoneyFull, fmtPct, fmtDate, fmtDateShort, BENCHMARK_LABELS, BENCHMARK_COLORS, SECTOR_COLORS, SECTOR_LABELS, REGION_LABELS, CHART_PERIODS, type ChartPeriod } from '@/components/models/simulation';
import { useSymbolsNews } from '@/lib/hooks/useNews';
import { NewsBadge } from '@/components/portfolios/NewsBadge';
import { NewsModal } from '@/components/portfolios/NewsModal';
import Link from 'next/link';
import {
  ArrowLeft, TrendingUp, TrendingDown,
  Activity, Target,
  ChevronUp, ChevronDown, RefreshCw, Zap, Trophy,
  Shield, Calendar, BarChart3, X, FileDown,
} from 'lucide-react';
import {
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, Area, AreaChart, Line, PieChart, Pie, Cell,
} from 'recharts';

// ── Main Dashboard ────────────────────────────────────────────────────────

function SimulationDashboard({ modelId, modelName }: { modelId: string; modelName: string }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSimulation(modelId);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('Max');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [visibleBenchmarks, setVisibleBenchmarks] = useState<Set<string>>(new Set());

  // News system
  const holdingSymbols = useMemo(() => (data?.live?.holdings || []).map((h) => h.symbol), [data?.live?.holdings]);
  const { newsMap } = useSymbolsNews(holdingSymbols);
  const [newsModalSymbol, setNewsModalSymbol] = useState<string | null>(null);
  const selectedNews = newsModalSymbol ? newsMap[newsModalSymbol] : null;

  // Period → cutoff date
  const periodCutoff = useMemo(() => {
    const now = new Date();
    const daysMap: Record<string, number> = { '1J': 1, '1S': 7, '1M': 30, '3M': 90, '1A': 365, '5A': 1825 };
    const days = daysMap[chartPeriod];
    if (!days) return null; // 'Max'
    const cutoff = new Date(now.getTime() - days * 86400000);
    return cutoff.toISOString().split('T')[0];
  }, [chartPeriod]);

  // Build ALL chart points (unfiltered, with benchmark data)
  const allChartPoints = useMemo(() => {
    if (!data?.simulation) return [];
    const sim = data.simulation;
    const actualInvested = sim.holdings_snapshot.reduce(
      (sum: number, h: { quantity: number; purchase_price: number }) => sum + h.quantity * h.purchase_price, 0
    );
    const baseVal = actualInvested > 0 ? actualInvested : sim.initial_value;
    const benchStart = (sim.benchmark_start_prices || {}) as Record<string, number>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points: Record<string, any>[] =
      (data.snapshots || []).map((snap: SimulationSnapshot) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pt: Record<string, any> = {
          date: snap.date, dateLabel: fmtDateShort(snap.date), portfolio: Math.round(snap.total_value),
        };
        // Normalize benchmarks: scale their % return to portfolio start value
        const bv = snap.benchmark_values || {};
        for (const [sym, startPrice] of Object.entries(benchStart)) {
          const curPrice = bv[sym];
          if (startPrice > 0 && curPrice) {
            pt[sym] = Math.round(baseVal * (curPrice / startPrice));
          }
        }
        return pt;
      });

    // Add/replace live point
    if (data?.live) {
      const today = new Date().toISOString().split('T')[0];
      const liveVal = Math.round(data.live.total_value);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const livePt: Record<string, any> = { date: today, dateLabel: 'Auj.', portfolio: liveVal };
      for (const [sym, perf] of Object.entries(data.live.benchmarks || {})) {
        const start = benchStart[sym];
        if (start > 0 && perf.current) {
          livePt[sym] = Math.round(baseVal * (perf.current / start));
        }
      }
      if (points.length > 0 && points[points.length - 1].date === today) {
        points[points.length - 1] = livePt;
      } else {
        points.push(livePt);
      }
    }
    // If only 1 point, prepend start value
    if (points.length === 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const startPt: Record<string, any> = { date: sim.start_date, dateLabel: 'Début', portfolio: Math.round(baseVal) };
      for (const sym of Object.keys(benchStart)) {
        startPt[sym] = Math.round(baseVal); // all start at same value
      }
      points.unshift(startPt);
    }
    return points;
  }, [data?.snapshots, data?.simulation, data?.live]);

  // Filtered chart data based on period
  const chartDataWithLive = useMemo(() => {
    if (!periodCutoff) return allChartPoints; // 'Max'
    const filtered = allChartPoints.filter((p) => p.date >= periodCutoff);
    // Always need at least 2 points — if filtered has <2, grab the last point before cutoff + filtered
    if (filtered.length < 2 && allChartPoints.length >= 2) {
      const beforeCutoff = allChartPoints.filter((p) => p.date < periodCutoff);
      if (beforeCutoff.length > 0) {
        return [beforeCutoff[beforeCutoff.length - 1], ...filtered];
      }
    }
    return filtered.length >= 2 ? filtered : allChartPoints;
  }, [allChartPoints, periodCutoff]);

  // Merge holdings with the same symbol (ETFs can appear in multiple sectors)
  // This combines quantities and values into a single card per symbol
  const mergedHoldings = useMemo(() => {
    if (!data?.live?.holdings) return [];
    const map = new Map<string, LiveHolding>();
    for (const h of data.live.holdings) {
      const existing = map.get(h.symbol);
      if (existing) {
        const totalQty = existing.quantity + h.quantity;
        const totalCost = existing.cost_basis + h.cost_basis;
        const totalMarket = existing.market_value + h.market_value;
        existing.quantity = totalQty;
        existing.cost_basis = totalCost;
        existing.market_value = totalMarket;
        existing.purchase_price = totalQty > 0 ? totalCost / totalQty : existing.purchase_price;
        existing.gain_loss = totalMarket - totalCost;
        existing.gain_loss_pct = totalCost > 0 ? Math.round(((totalMarket - totalCost) / totalCost) * 10000) / 100 : 0;
        existing.weight = existing.weight + h.weight;
      } else {
        map.set(h.symbol, { ...h });
      }
    }
    return Array.from(map.values());
  }, [data?.live?.holdings]);

  // Sorted holdings
  const sortedHoldings = useMemo(() => {
    return [...mergedHoldings].sort((a, b) => b.market_value - a.market_value);
  }, [mergedHoldings]);

  // Allocation data (by sector, with target vs actual — ETFs split by underlying sectors)
  const { allocationData, bondTargetPct } = useMemo(() => {
    if (!data?.live?.holdings || !data?.simulation) return { allocationData: [], bondTargetPct: 0 };
    const totalLive = data.live.holdings.reduce((s, h) => s + h.market_value, 0);
    // Actual: group current market values AND cost basis by sector (split ETFs)
    const actualMap = new Map<string, number>();
    const costMap = new Map<string, number>();
    for (const h of data.live.holdings) {
      if (h.etf_sector_weights && h.etf_sector_weights.length > 0) {
        // Split ETF value across its underlying sectors
        for (const sw of h.etf_sector_weights) {
          actualMap.set(sw.sector, (actualMap.get(sw.sector) || 0) + h.market_value * sw.weight);
          costMap.set(sw.sector, (costMap.get(sw.sector) || 0) + h.cost_basis * sw.weight);
        }
      } else {
        const sec = h.sector || h.asset_class || 'EQUITY';
        actualMap.set(sec, (actualMap.get(sec) || 0) + h.market_value);
        costMap.set(sec, (costMap.get(sec) || 0) + h.cost_basis);
      }
    }
    // Target: group original weights by sector from snapshot (split ETFs)
    const targetMap = new Map<string, number>();
    for (const h of data.simulation.holdings_snapshot) {
      if (h.etf_sector_weights && h.etf_sector_weights.length > 0) {
        for (const sw of h.etf_sector_weights) {
          targetMap.set(sw.sector, (targetMap.get(sw.sector) || 0) + h.weight * sw.weight);
        }
      } else {
        const sec = h.sector || h.asset_class || 'EQUITY';
        targetMap.set(sec, (targetMap.get(sec) || 0) + h.weight);
      }
    }
    // Total stock target weight (may be < 100% if bonds exist)
    const totalStockTarget = Array.from(targetMap.values()).reduce((s, v) => s + v, 0);
    const bondPct = Math.max(0, Math.round((100 - totalStockTarget) * 100) / 100);
    // Normalize targets to equity-only scale so comparison is apples-to-apples
    const normalizer = totalStockTarget > 0 ? 100 / totalStockTarget : 1;
    // Merge all sectors
    const allSectors = new Set([...actualMap.keys(), ...targetMap.keys()]);
    const result = Array.from(allSectors).map((sec) => {
      const actualValue = actualMap.get(sec) || 0;
      const costValue = costMap.get(sec) || 0;
      const actualPct = totalLive > 0 ? Math.round((actualValue / totalLive) * 10000) / 100 : 0;
      const rawTarget = targetMap.get(sec) || 0;
      const targetPct = Math.round(rawTarget * normalizer * 100) / 100;
      const gainPct = costValue > 0 ? Math.round(((actualValue - costValue) / costValue) * 10000) / 100 : 0;
      return { name: sec, value: Math.round(actualValue), actualPct, targetPct, gainPct };
    }).sort((a, b) => b.value - a.value);
    return { allocationData: result, bondTargetPct: bondPct };
  }, [data?.live?.holdings, data?.simulation]);

  // Region data
  const regionData = useMemo(() => {
    if (!data?.live?.holdings) return [];
    const map = new Map<string, number>();
    for (const h of data.live.holdings) {
      map.set(h.region || 'US', (map.get(h.region || 'US') || 0) + h.market_value);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [data?.live?.holdings]);

  async function handleRefresh() {
    setRefreshing(true);
    await mutate();
    setRefreshing(false);
    toast('success', 'Prix mis à jour');
  }

  async function handleExportPDF() {
    if (!data?.simulation || !data?.live || !data?.stats) return;
    setExporting(true);
    try {
      const sim = data.simulation;
      const stats = data.stats;
      const sorted = [...mergedHoldings].sort((a, b) => b.gain_loss_pct - a.gain_loss_pct);

      // Build sector allocation from allocationData
      const sectorAlloc = allocationData.map((s) => ({ sector: s.name, pct: s.actualPct }));

      // Build region allocation from regionData
      const totalRegionValue = regionData.reduce((s, r) => s + r.value, 0);
      const regionAlloc = regionData.map((r) => ({ region: r.name, pct: totalRegionValue > 0 ? Math.round((r.value / totalRegionValue) * 1000) / 10 : 0 }));

      // Benchmark labels
      const benchLabels: Record<string, string> = { '^GSPTSE': 'S&P/TSX', '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ' };
      const benchmarks = Object.entries(data.live.benchmarks || {}).map(([sym, perf]) => ({
        name: benchLabels[sym] || sym,
        returnPct: perf.return_pct,
      }));

      const pdfData = {
        modelName,
        profileName: sim.name || '',
        currency: sim.currency || 'CAD',
        startDate: new Date(sim.start_date).toLocaleDateString('fr-CA'),
        currentDate: new Date().toLocaleDateString('fr-CA'),
        initialValue: sim.initial_value,
        currentValue: data.live.total_value,
        totalReturnPct: stats.total_return_pct,
        totalReturn: stats.total_return,
        annualizedReturn: stats.annualized_return,
        volatility: stats.volatility,
        sharpe: stats.sharpe,
        maxDrawdown: stats.max_drawdown,
        dividendIncome: stats.dividend_income + stats.fixed_income,
        holdings: mergedHoldings.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          weight: h.weight,
          market_value: h.market_value,
          cost_basis: h.cost_basis,
          gain_pct: h.gain_loss_pct,
          dividend_yield: h.dividend_yield || 0,
          sector: h.sector || h.asset_class || '',
          region: h.region || 'US',
        })),
        sectorAllocation: sectorAlloc,
        regionAllocation: regionAlloc,
        benchmarks,
        topPerformers: sorted.slice(0, 5).map((h) => ({ symbol: h.symbol, gainPct: h.gain_loss_pct })),
        worstPerformers: sorted.slice(-5).reverse().map((h) => ({ symbol: h.symbol, gainPct: h.gain_loss_pct })),
      };

      const res = await fetch(`/api/models/${modelId}/simulation/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur' }));
        toast('error', err.error || 'Erreur lors de la génération du PDF');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simulation-${modelName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast('success', 'PDF téléchargé');
    } catch {
      toast('error', 'Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!data?.simulation || !data?.live || !data?.stats) return <StartSimulation modelId={modelId} modelName="" onStarted={() => mutate()} />;

  const sim = data.simulation;
  const live = data.live;
  const stats = data.stats;
  const isPositive = stats.total_return >= 0;
  const actualInvested = sim.holdings_snapshot.reduce(
    (sum: number, h: { quantity: number; purchase_price: number }) => sum + h.quantity * h.purchase_price, 0
  );
  const displayInvested = actualInvested > 0 ? actualInvested : sim.initial_value;

  const topPerformers = [...mergedHoldings].sort((a, b) => b.gain_loss_pct - a.gain_loss_pct).slice(0, 3);
  const flopPerformers = [...mergedHoldings].sort((a, b) => a.gain_loss_pct - b.gain_loss_pct).slice(0, 3);
  const displayedHoldings = showAllHoldings ? sortedHoldings : sortedHoldings.slice(0, 8);

  return (
    <div className="space-y-6">

      {/* ── Hero: Model name + Refresh ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-extrabold text-text-main text-lg">{modelName}</p>
          <p className="text-xs font-semibold text-text-muted flex items-center gap-1.5 mt-0.5">
            <Calendar className="h-3 w-3" />
            Jour {stats.days_active} · Depuis le {fmtDate(sim.start_date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-[3px] border-gray-200 bg-white text-sm font-bold text-text-muted hover:border-[#CE82FF] hover:text-[#CE82FF] transition-all disabled:opacity-50"
            style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}
          >
            <FileDown className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Export...' : 'PDF'}
          </button>
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-[3px] border-gray-200 bg-white text-sm font-bold text-text-muted hover:border-[#1CB0F6] hover:text-[#1CB0F6] transition-all"
            style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* ── Chart (Wealthsimple style + period selector) ── */}
      {chartDataWithLive.length >= 2 && (() => {
        const firstVal = Number(chartDataWithLive[0].portfolio);
        const lastVal = Number(chartDataWithLive[chartDataWithLive.length - 1].portfolio);
        const chartPositive = lastVal >= firstVal;
        const periodReturn = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
        const periodDollar = lastVal - firstVal;
        const lineColor = chartPositive ? '#58CC02' : '#FF4B4B';
        const gradId = chartPositive ? 'gradUp' : 'gradDown';
        const periods: Array<typeof chartPeriod> = ['1J', '1S', '1M', '3M', '1A', '5A', 'Max'];

        return (
          <div className="rounded-3xl border-[3px] border-gray-200 bg-white overflow-hidden" style={{ boxShadow: '0 4px 0 0 #e5e7eb' }}>
            <div className="px-6 pt-5 pb-2">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Valeur du portefeuille</p>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold text-text-main">{fmtMoney(lastVal, sim.currency)}</span>
                <span className={`text-sm font-extrabold px-3 py-1 rounded-xl ${
                  chartPositive ? 'bg-[#58CC02]/10 text-[#58CC02]' : 'bg-[#FF4B4B]/10 text-[#FF4B4B]'
                }`}>
                  {chartPositive ? '▲' : '▼'} {fmtPct(periodReturn)}
                </span>
              </div>
              <p className="text-xs font-semibold text-text-muted mt-1">
                {chartPositive ? '+' : ''}{fmtMoney(periodDollar, sim.currency)} · Investi: {fmtMoney(displayInvested, sim.currency)}
              </p>
            </div>

            <div className="h-[260px] -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDataWithLive} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dateLabel" hide />
                  <YAxis hide domain={visibleBenchmarks.size > 0 ? ['auto', 'auto'] : ['dataMin', 'dataMax']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff', borderRadius: 16, border: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '10px 14px', fontSize: 13, fontWeight: 700,
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => {
                      const label = name === 'portfolio'
                        ? 'Portefeuille'
                        : (BENCHMARK_LABELS[name as string] || name);
                      return [fmtMoney(Number(value), sim.currency), label];
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    labelFormatter={(label: any) => `${label}`}
                    cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="portfolio" stroke={lineColor} strokeWidth={3}
                    fill={`url(#${gradId})`} dot={false}
                    activeDot={{ r: 6, fill: lineColor, stroke: '#fff', strokeWidth: 3 }}
                  />
                  {Array.from(visibleBenchmarks).map((sym) => (
                    <Line key={sym} type="monotone" dataKey={sym}
                      stroke={BENCHMARK_COLORS[sym] || '#64748b'} strokeWidth={2}
                      strokeDasharray="6 3" dot={false}
                      activeDot={{ r: 4, fill: BENCHMARK_COLORS[sym] || '#64748b', stroke: '#fff', strokeWidth: 2 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Period selector */}
            <div className="flex justify-center gap-1 px-6 pb-5 pt-1">
              {periods.map((p) => (
                <button key={p} onClick={() => setChartPeriod(p)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    chartPeriod === p
                      ? 'bg-[#1CB0F6] text-white'
                      : 'text-text-muted hover:bg-gray-100'
                  }`}
                  style={chartPeriod === p ? { boxShadow: '0 3px 0 0 #0a8fd4' } : {}}
                >{p}</button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Benchmark Pills ── */}
      {Object.keys(live.benchmarks).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-[3px] font-bold text-sm ${
            isPositive ? 'border-[#58CC02]/30 bg-[#58CC02]/5 text-[#58CC02]' : 'border-[#FF4B4B]/30 bg-[#FF4B4B]/5 text-[#FF4B4B]'
          }`}>
            <Trophy className="h-4 w-4" /> Mon portefeuille {fmtPct(stats.total_return_pct)}
          </div>
          {Object.entries(live.benchmarks).map(([sym, perf]) => {
            const active = visibleBenchmarks.has(sym);
            const bColor = BENCHMARK_COLORS[sym] || '#64748b';
            return (
              <button key={sym}
                onClick={() => setVisibleBenchmarks(prev => {
                  const next = new Set(prev);
                  if (next.has(sym)) next.delete(sym); else next.add(sym);
                  return next;
                })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-[3px] text-sm font-bold transition-all cursor-pointer ${
                  active
                    ? 'text-white'
                    : 'border-gray-200 bg-white text-text-muted hover:border-gray-300'
                }`}
                style={active
                  ? { backgroundColor: bColor, borderColor: bColor, boxShadow: `0 3px 0 0 ${bColor}90` }
                  : { boxShadow: '0 2px 0 0 #e5e7eb' }
                }
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: active ? '#fff' : bColor }} />
                {BENCHMARK_LABELS[sym] || sym}
                <span className={active ? 'text-white/90' : (perf.return_pct >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]')}>{fmtPct(perf.return_pct)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Stats Grid (Duo badges) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DuoStat label="Rendement" value={fmtPct(stats.total_return_pct)}
          sub={`${isPositive ? '+' : ''}${fmtMoney(stats.total_return, sim.currency)}`}
          icon={isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          color={isPositive ? '#58CC02' : '#FF4B4B'} />
        <DuoStat label="Annualisé" value={fmtPct(stats.annualized_return)}
          icon={<Target className="h-4 w-4" />}
          color={stats.annualized_return >= 0 ? '#58CC02' : '#FF4B4B'} />
        <DuoStat label="Volatilité" value={`${stats.volatility.toFixed(1)}%`}
          sub={`Sharpe: ${stats.sharpe.toFixed(2)}`}
          icon={<Activity className="h-4 w-4" />} color="#FF9600" />
        <DuoStat label="Drawdown max" value={`-${stats.max_drawdown.toFixed(1)}%`}
          icon={<Shield className="h-4 w-4" />} color={stats.max_drawdown > 10 ? '#FF4B4B' : '#1CB0F6'} />
      </div>

      {/* ── Holdings (Card-based, Duolingo style) ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-text-main">
            Mes positions <span className="text-text-muted font-bold">({mergedHoldings.length})</span>
          </h3>
        </div>

        <div className="space-y-2">
          {displayedHoldings.map((h: LiveHolding) => {
            const isUp = h.gain_loss >= 0;
            const pnlColor = isUp ? '#58CC02' : '#FF4B4B';
            const qtyLabel = h.quantity < 1
              ? h.quantity.toFixed(4)
              : h.quantity < 100
                ? h.quantity.toFixed(2)
                : Math.round(h.quantity).toLocaleString();

            return (
              <div key={h.symbol}
                className="rounded-xl border-2 border-gray-200 bg-white px-4 py-3 transition-all hover:border-[#1CB0F6]/40"
                style={{ boxShadow: '0 2px 0 0 #e5e7eb' }}
              >
                {/* Row 1 — Identity + value + P&L */}
                <div className="flex items-center gap-3">
                  <StockAvatar symbol={h.symbol} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-text-main text-sm truncate">{h.name}</p>
                      <NewsBadge
                        symbolNews={newsMap[h.symbol]}
                        onClick={() => setNewsModalSymbol(h.symbol)}
                      />
                    </div>
                    <p className="text-[11px] font-bold text-text-muted">
                      {h.symbol} · {qtyLabel} act. · {fmtMoneyFull(h.current_price)}
                      {h.dividend_yield && h.dividend_yield > 0 && (
                        <span className="text-emerald-500"> · Div. {h.dividend_yield.toFixed(1)}%</span>
                      )}
                      {h.ex_dividend_date && (
                        <span className="text-emerald-400"> · Ex {fmtDateShort(h.ex_dividend_date)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-extrabold text-text-main">{fmtMoney(h.market_value, sim.currency)}</p>
                    <span className="inline-flex items-center gap-0.5 text-xs font-extrabold" style={{ color: pnlColor }}>
                      {isUp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {Math.abs(h.gain_loss_pct).toFixed(2)}%
                      <span className="font-bold text-text-light ml-1">({isUp ? '+' : ''}{fmtMoney(h.gain_loss, sim.currency)})</span>
                    </span>
                  </div>
                </div>

                {/* Row 2 — Weight bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#1CB0F6] transition-all duration-500"
                      style={{ width: `${Math.min(h.weight, 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-extrabold text-text-muted w-14 text-right">{h.weight.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {sortedHoldings.length > 8 && (
          <button onClick={() => setShowAllHoldings(!showAllHoldings)}
            className="w-full mt-3 py-3 rounded-2xl border-[3px] border-gray-200 bg-white text-sm font-extrabold text-[#1CB0F6] hover:bg-[#1CB0F6]/5 transition-all"
            style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}
          >
            {showAllHoldings ? 'Voir moins' : `Voir les ${sortedHoldings.length - 8} autres positions`}
          </button>
        )}

        {/* Total bar */}
        <div className="mt-3 rounded-2xl border-[3px] bg-white p-4 flex items-center justify-between"
          style={{ borderColor: isPositive ? '#58CC02' + '40' : '#FF4B4B' + '40', boxShadow: `0 3px 0 0 ${isPositive ? '#58CC02' : '#FF4B4B'}20` }}>
          <div>
            <span className="text-sm font-extrabold text-text-main">Total portefeuille</span>
            <p className="text-xs font-bold text-text-muted">{mergedHoldings.length} positions</p>
          </div>
          <div className="text-right">
            <span className="text-xl font-extrabold text-text-main">{fmtMoney(live.total_value, sim.currency)}</span>
            <p className="text-sm font-extrabold" style={{ color: isPositive ? '#58CC02' : '#FF4B4B' }}>
              {isPositive ? '+' : ''}{fmtMoney(stats.total_return, sim.currency)} ({fmtPct(stats.total_return_pct)})
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Top/Flop + Allocation + Region ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top / Flop */}
        <div className="rounded-2xl border-[3px] border-gray-200 bg-white p-5" style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}>
          <h3 className="font-extrabold text-text-main mb-4 flex items-center gap-2">
            <span className="text-xl">🏆</span> Podium
          </h3>
          <div className="space-y-2 mb-5">
            {topPerformers.map((h, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={h.symbol} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[#58CC02]/5 border-2 border-[#58CC02]/15">
                  <span className="text-lg">{medals[i]}</span>
                  <StockAvatar symbol={h.symbol} size={32} />
                  <span className="font-extrabold text-text-main text-sm flex-1">{h.symbol.replace('.TO', '')}</span>
                  <span className="text-sm font-extrabold text-[#58CC02]">{fmtPct(h.gain_loss_pct)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">À surveiller</p>
          <div className="space-y-2">
            {flopPerformers.map((h) => (
              <div key={h.symbol} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[#FF4B4B]/5 border-2 border-[#FF4B4B]/15">
                <StockAvatar symbol={h.symbol} size={32} />
                <span className="font-extrabold text-text-main text-sm flex-1">{h.symbol.replace('.TO', '')}</span>
                <span className="text-sm font-extrabold text-[#FF4B4B]">{fmtPct(h.gain_loss_pct)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sector Allocation */}
        <div className="rounded-2xl border-[3px] border-gray-200 bg-white p-5" style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}>
          <h3 className="font-extrabold text-text-main mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-[#1CB0F6]" /> Répartition sectorielle
          </h3>
          <div className="h-[180px] cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={3} stroke="#fff"
                  onClick={(_, index) => setSelectedSector(allocationData[index]?.name || null)}
                >
                  {allocationData.map((entry, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[entry.name] || '#94a3b8'} className="cursor-pointer hover:opacity-80 transition-opacity" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as { name: string; value: number; actualPct: number; targetPct: number; gainPct: number };
                    const diff = d.actualPct - d.targetPct;
                    return (
                      <div className="rounded-2xl bg-white px-4 py-3 border-[3px] border-gray-200" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 180 }}>
                        <p className="text-sm font-extrabold text-text-main mb-2 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: SECTOR_COLORS[d.name] || '#94a3b8' }} />
                          {SECTOR_LABELS[d.name] || d.name}
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs gap-4">
                            <span className="font-bold text-text-muted">Actuel</span>
                            <span className="font-extrabold text-text-main">{d.actualPct.toFixed(1)}% <span className="text-text-muted font-bold">({fmtMoney(d.value, sim.currency)})</span></span>
                          </div>
                          <div className="flex justify-between text-xs gap-4">
                            <span className="font-bold text-text-muted">Cible</span>
                            <span className="font-extrabold text-text-main">{d.targetPct.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-xs pt-1 border-t border-gray-100 gap-4">
                            <span className="font-bold text-text-muted">Écart</span>
                            <span className={`font-extrabold ${Math.abs(diff) < 1 ? 'text-[#58CC02]' : diff > 0 ? 'text-[#FF9600]' : 'text-[#FF4B4B]'}`}>
                              {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-text-light mt-2">Cliquer pour détails</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {allocationData.map((entry) => {
              const drift = entry.actualPct - entry.targetPct;
              const driftColor = Math.abs(drift) < 1 ? 'text-[#58CC02]' : drift > 0 ? 'text-[#FF9600]' : 'text-[#FF4B4B]';
              return (
                <button key={entry.name} onClick={() => setSelectedSector(entry.name)}
                  className="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SECTOR_COLORS[entry.name] || '#94a3b8' }} />
                  <span className="text-[11px] font-bold text-text-muted">{SECTOR_LABELS[entry.name] || entry.name}</span>
                  <span className="text-[11px] font-extrabold text-text-main">{entry.actualPct.toFixed(1)}%</span>
                  <span className={`text-[10px] font-extrabold ${driftColor}`}>
                    {drift >= 0 ? '+' : ''}{drift.toFixed(1)}%
                  </span>
                  {/* Tooltip au hover : $ + cible */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    <div className="rounded-xl bg-white px-3 py-2 border-[2px] border-gray-200 whitespace-nowrap" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      <p className="text-[11px] font-extrabold text-text-main">{fmtMoney(entry.value, sim.currency)}</p>
                      <p className="text-[10px] font-bold text-text-muted">
                        Cible: {entry.targetPct.toFixed(1)}% · Écart: <span className={driftColor}>{drift >= 0 ? '+' : ''}{drift.toFixed(1)}%</span>
                      </p>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-200" />
                  </div>
                </button>
              );
            })}
          </div>
          {bondTargetPct > 0 && (
            <p className="text-[10px] font-bold text-text-light text-center mt-3">
              Obligations ({bondTargetPct.toFixed(0)}% du modèle) non incluses — cibles normalisées sur la portion actions
            </p>
          )}
        </div>

        {/* Sector Detail Modal */}
        {selectedSector && (() => {
          // Direct stock holdings in this sector
          const directHoldings = live.holdings
            .filter((h) => !h.etf_sector_weights?.length && (h.sector || h.asset_class || 'EQUITY') === selectedSector);
          // ETFs that have exposure to this sector
          const etfHoldings = live.holdings
            .filter((h) => h.etf_sector_weights?.some((sw) => sw.sector === selectedSector))
            .map((h) => {
              const sw = h.etf_sector_weights!.find((s) => s.sector === selectedSector)!;
              return { ...h, sector_exposure: sw.weight, sector_value: h.market_value * sw.weight };
            });
          const sectorHoldings = [
            ...directHoldings.map((h) => ({ ...h, sector_exposure: 1, sector_value: h.market_value })),
            ...etfHoldings,
          ].sort((a, b) => b.sector_value - a.sector_value);
          const sectorTotal = sectorHoldings.reduce((s, h) => s + h.sector_value, 0);
          const sectorInfo = allocationData.find((a) => a.name === selectedSector);
          const color = SECTOR_COLORS[selectedSector] || '#94a3b8';

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedSector(null)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border-[3px] bg-white"
                style={{ borderColor: color + '40', boxShadow: `0 6px 0 0 ${color}20` }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white rounded-t-3xl px-6 pt-5 pb-4 border-b-2 border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
                        <Target className="h-5 w-5" style={{ color }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-text-main">{SECTOR_LABELS[selectedSector] || selectedSector}</h3>
                        <p className="text-xs font-bold text-text-muted">
                          {sectorHoldings.length} position{sectorHoldings.length !== 1 ? 's' : ''} · {fmtMoney(sectorTotal, sim.currency)}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedSector(null)}
                      className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                      <X className="h-5 w-5 text-text-muted" />
                    </button>
                  </div>

                  {/* Actual vs Target summary */}
                  {sectorInfo && (
                    <div className="flex gap-3 mt-3">
                      <div className="flex-1 rounded-xl px-3 py-2" style={{ backgroundColor: color + '08' }}>
                        <p className="text-[10px] font-bold text-text-muted uppercase">Actuel</p>
                        <p className="text-base font-extrabold" style={{ color }}>{sectorInfo.actualPct.toFixed(1)}%</p>
                      </div>
                      <div className="flex-1 rounded-xl bg-gray-50 px-3 py-2">
                        <p className="text-[10px] font-bold text-text-muted uppercase">Cible</p>
                        <p className="text-base font-extrabold text-text-main">{sectorInfo.targetPct.toFixed(1)}%</p>
                      </div>
                      <div className="flex-1 rounded-xl bg-gray-50 px-3 py-2">
                        <p className="text-[10px] font-bold text-text-muted uppercase">Écart</p>
                        <p className={`text-base font-extrabold ${
                          Math.abs(sectorInfo.actualPct - sectorInfo.targetPct) < 1 ? 'text-[#58CC02]'
                            : sectorInfo.actualPct > sectorInfo.targetPct ? 'text-[#FF9600]' : 'text-[#FF4B4B]'
                        }`}>
                          {sectorInfo.actualPct - sectorInfo.targetPct >= 0 ? '+' : ''}{(sectorInfo.actualPct - sectorInfo.targetPct).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Holdings list */}
                <div className="px-6 py-4 space-y-3">
                  {sectorHoldings.map((h) => {
                    const isUp = h.gain_loss >= 0;
                    const pnlColor = isUp ? '#58CC02' : '#FF4B4B';
                    const isETF = h.sector_exposure < 1;
                    const sectorValue = h.sector_value;
                    const weightInSector = sectorTotal > 0 ? (sectorValue / sectorTotal) * 100 : 0;

                    return (
                      <div key={h.symbol}
                        className="rounded-2xl border-[3px] border-gray-200 bg-white p-4 transition-all hover:border-gray-300"
                        style={{ boxShadow: '0 2px 0 0 #e5e7eb' }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <StockAvatar symbol={h.symbol} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-text-main text-sm truncate">{h.name}</p>
                              {isETF && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[#CE82FF]/10 text-[#CE82FF] text-[9px] font-extrabold uppercase flex-shrink-0">ETF</span>
                              )}
                            </div>
                            <p className="text-[11px] font-bold text-text-muted">
                              {h.symbol}
                              {isETF && <span className="text-text-light"> · {(h.sector_exposure * 100).toFixed(1)}% du fonds dans ce secteur</span>}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold"
                            style={{ backgroundColor: pnlColor + '12', color: pnlColor }}>
                            {isUp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {Math.abs(h.gain_loss_pct).toFixed(2)}%
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                            <p className="text-[9px] font-bold text-text-light uppercase">{isETF ? 'Exposition' : 'Valeur'}</p>
                            <p className="text-xs font-extrabold text-text-main">{fmtMoney(sectorValue, sim.currency)}</p>
                          </div>
                          <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                            <p className="text-[9px] font-bold text-text-light uppercase">{isETF ? 'Valeur totale' : 'Gain/Perte'}</p>
                            <p className="text-xs font-extrabold" style={{ color: isETF ? undefined : pnlColor }}>
                              {isETF ? fmtMoney(h.market_value, sim.currency) : `${isUp ? '+' : ''}${fmtMoney(h.gain_loss, sim.currency)}`}
                            </p>
                          </div>
                          <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                            <p className="text-[9px] font-bold text-text-light uppercase">Poids secteur</p>
                            <p className="text-xs font-extrabold" style={{ color }}>{weightInSector.toFixed(1)}%</p>
                          </div>
                        </div>

                        {/* Weight bar within sector */}
                        <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(weightInSector, 100)}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}

                  {sectorHoldings.length === 0 && (
                    <p className="text-center text-sm text-text-muted py-8">Aucune position dans ce secteur</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Region */}
        <div className="rounded-2xl border-[3px] border-gray-200 bg-white p-5" style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}>
          <h3 className="font-extrabold text-text-main mb-4 flex items-center gap-2">
            <span className="text-xl">🌍</span> Géographie
          </h3>
          <div className="space-y-4 mt-4">
            {regionData.map((r) => {
              const total = regionData.reduce((s, x) => s + x.value, 0);
              const pct = total > 0 ? (r.value / total) * 100 : 0;
              const regionEmoji: Record<string, string> = { CA: '🇨🇦', US: '🇺🇸', INTL: '🌐', EM: '🌏' };
              return (
                <div key={r.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-extrabold text-text-main flex items-center gap-2">
                      <span>{regionEmoji[r.name] || '🌐'}</span>
                      {REGION_LABELS[r.name] || r.name}
                    </span>
                    <span className="text-sm font-extrabold text-text-main">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: duoColor(r.name) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Income Breakdown (only if income > 0) ── */}
      {stats.total_income > 0 && (
        <div className="rounded-2xl border-[3px] border-[#58CC02]/30 bg-[#58CC02]/5 p-5" style={{ boxShadow: '0 3px 0 0 #58CC0220' }}>
          <h3 className="font-extrabold text-text-main mb-3 flex items-center gap-2">
            <span className="text-xl">💰</span> Revenus accumulés
          </h3>
          <div className="flex flex-wrap gap-4">
            {stats.dividend_income > 0 && (
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#58CC02]" />
                <div>
                  <p className="text-xs font-bold text-text-muted">Dividendes</p>
                  <p className="text-lg font-extrabold text-[#58CC02]">+{fmtMoney(stats.dividend_income, sim.currency)}</p>
                </div>
              </div>
            )}
            {stats.fixed_income > 0 && (
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#1CB0F6]" />
                <div>
                  <p className="text-xs font-bold text-text-muted">Revenu fixe</p>
                  <p className="text-lg font-extrabold text-[#1CB0F6]">+{fmtMoney(stats.fixed_income, sim.currency)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* News Modal */}
      <NewsModal
        open={!!newsModalSymbol}
        onClose={() => setNewsModalSymbol(null)}
        symbol={newsModalSymbol || ''}
        articles={selectedNews?.articles || []}
      />
    </div>
  );
}

// ── Page Component ────────────────────────────────────────────────────────

export default function SimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { model, isLoading: modelLoading } = useModel(id);
  const { data, isLoading: simLoading, mutate } = useSimulation(id);

  if (modelLoading || simLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (!model) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-muted">Modèle introuvable</p>
        <Link href="/models"><Button variant="ghost" className="mt-4">Retour aux modèles</Button></Link>
      </Card>
    );
  }

  const hasActiveSim = !!data?.simulation && data.simulation.status === 'active';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/models')} icon={<ArrowLeft className="h-4 w-4" />}>
            Modèles
          </Button>
          <span className="text-text-light">/</span>
          <h1 className="text-lg font-extrabold text-text-main flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#1CB0F6]" />
            {model.name} — Simulation
          </h1>
        </div>
      </div>

      {hasActiveSim ? (
        <SimulationDashboard modelId={id} modelName={model.name} />
      ) : (
        <StartSimulation modelId={id} modelName={model.name} onStarted={() => mutate()} />
      )}
    </div>
  );
}

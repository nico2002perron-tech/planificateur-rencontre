'use client';

import { useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useModel } from '@/lib/hooks/useModels';
import { useSimulation, type LiveHolding, type SimulationSnapshot } from '@/lib/hooks/useSimulation';
import Link from 'next/link';
import {
  ArrowLeft, TrendingUp, TrendingDown,
  DollarSign, Calendar, BarChart3, Activity, Target,
  ChevronUp, ChevronDown, RefreshCw, Zap,
} from 'lucide-react';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell,
} from 'recharts';

// ── Constants ────────────────────────────────────────────────────────────

const BENCHMARK_LABELS: Record<string, string> = {
  '^GSPTSE': 'S&P/TSX',
  '^GSPC': 'S&P 500',
  '^IXIC': 'NASDAQ',
};

const BENCHMARK_COLORS: Record<string, string> = {
  '^GSPTSE': '#64748b',
  '^GSPC': '#03045e',
  '^IXIC': '#7c3aed',
};

const SECTOR_COLORS: Record<string, string> = {
  EQUITY: '#00b4d8',
  FIXED_INCOME: '#03045e',
  CASH: '#94a3b8',
  ALTERNATIVE: '#f59e0b',
  REAL_ESTATE: '#10b981',
  COMMODITY: '#ef4444',
};

const REGION_LABELS: Record<string, string> = {
  CA: 'Canada',
  US: 'États-Unis',
  INTL: 'International',
  EM: 'Marchés émergents',
};

function fmtMoney(v: number, currency = 'CAD'): string {
  return v.toLocaleString('fr-CA', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMoneyFull(v: number, currency = 'CAD'): string {
  return v.toLocaleString('fr-CA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateShort(d: string): string {
  return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

// ── Start Simulation Form ────────────────────────────────────────────────

function StartSimulation({ modelId, modelName, onStarted }: { modelId: string; modelName: string; onStarted: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(100000);
  const [currency, setCurrency] = useState('CAD');
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (amount < 1000) {
      toast('warning', 'Le montant minimum est de 1 000$');
      return;
    }
    setStarting(true);
    try {
      const res = await fetch(`/api/models/${modelId}/simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_value: amount, currency }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error || 'Erreur');
        return;
      }
      toast('success', `Simulation démarrée avec ${data.holdings_count} positions`);
      onStarted();
    } catch {
      toast('error', 'Erreur lors du démarrage');
    } finally {
      setStarting(false);
    }
  }

  const presets = [25000, 50000, 100000, 250000, 500000, 1000000];

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center mx-auto mb-5">
          <Activity className="h-10 w-10 text-brand-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text-main mb-2">Démarrer une simulation</h2>
        <p className="text-text-muted max-w-md mx-auto">
          Simulez le portefeuille <strong>{modelName}</strong> comme un vrai compte d&apos;investissement
          avec des prix réels du marché.
        </p>
      </div>

      <Card className="!p-8">
        <div className="space-y-6">
          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-text-main mb-2">
              Montant initial d&apos;investissement
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
              <input
                type="number"
                min={1000}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-12 pr-16 py-4 rounded-xl border-2 border-gray-200 text-2xl font-bold text-text-main focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 focus:outline-none transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-text-muted">
                {currency}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    amount === p
                      ? 'bg-brand-primary text-white shadow-md'
                      : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                  }`}
                >
                  {fmtMoney(p)}
                </button>
              ))}
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-semibold text-text-main mb-2">Devise</label>
            <div className="flex gap-3">
              {['CAD', 'USD'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    currency === c
                      ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                      : 'border-gray-200 text-text-muted hover:border-gray-300'
                  }`}
                >
                  {c === 'CAD' ? '🇨🇦 Dollar canadien' : '🇺🇸 Dollar américain'}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
            <p className="text-xs text-sky-700 leading-relaxed">
              <strong>Comment ça fonctionne :</strong> Les prix actuels du marché seront gelés comme prix d&apos;achat.
              Les quantités seront calculées selon les pondérations du modèle. Chaque jour, les prix seront mis à jour
              pour suivre la performance réelle de votre portefeuille virtuel.
            </p>
          </div>

          {/* Start button */}
          <Button
            className="w-full !py-4 !text-base"
            loading={starting}
            onClick={handleStart}
            icon={<Zap className="h-5 w-5" />}
          >
            Démarrer la simulation — {fmtMoney(amount, currency)}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color = 'text-text-main', highlight = false,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${
      highlight ? 'border-brand-primary/30 bg-gradient-to-br from-brand-primary/5 to-brand-accent/5 shadow-sm' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${highlight ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-100 text-text-muted'}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────

function SimulationDashboard({ modelId }: { modelId: string }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSimulation(modelId);
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<'gain_loss_pct' | 'market_value' | 'weight'>('market_value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Build chart data
  const chartData = useMemo(() => {
    if (!data?.snapshots || data.snapshots.length === 0 || !data.simulation) return [];

    const sim = data.simulation;
    // Use actual invested amount (sum of qty * purchase_price) as base,
    // not initial_value which may be higher if some holdings had no price
    const actualInvested = sim.holdings_snapshot.reduce(
      (sum: number, h: { quantity: number; purchase_price: number }) => sum + h.quantity * h.purchase_price, 0
    );
    const initialVal = actualInvested > 0 ? actualInvested : sim.initial_value;
    const benchStarts = sim.benchmark_start_prices;

    return data.snapshots.map((snap: SimulationSnapshot) => {
      const point: Record<string, string | number> = {
        date: snap.date,
        dateLabel: fmtDateShort(snap.date),
        portfolio: Math.round((snap.total_value / initialVal) * 10000) / 100,
      };

      for (const bSym of sim.benchmarks) {
        const startPrice = benchStarts[bSym] || 1;
        const currentPrice = snap.benchmark_values?.[bSym] || startPrice;
        point[bSym] = Math.round((currentPrice / startPrice) * 10000) / 100;
      }

      return point;
    });
  }, [data?.snapshots, data?.simulation]);

  // Add live point to chart
  const chartDataWithLive = useMemo(() => {
    if (!data?.live || !data?.simulation || chartData.length === 0) return chartData;

    const sim = data.simulation;
    const actualInvested = sim.holdings_snapshot.reduce(
      (sum: number, h: { quantity: number; purchase_price: number }) => sum + h.quantity * h.purchase_price, 0
    );
    const initialVal = actualInvested > 0 ? actualInvested : sim.initial_value;
    const benchStarts = sim.benchmark_start_prices;

    const livePoint: Record<string, string | number> = {
      date: new Date().toISOString().split('T')[0],
      dateLabel: 'Maintenant',
      portfolio: Math.round((data.live.total_value / initialVal) * 10000) / 100,
    };

    for (const bSym of sim.benchmarks) {
      const startPrice = benchStarts[bSym] || 1;
      const currentPerf = data.live.benchmarks?.[bSym];
      if (currentPerf) {
        livePoint[bSym] = Math.round((currentPerf.current / startPrice) * 10000) / 100;
      }
    }

    // Only add if different date than last snapshot
    const lastSnap = chartData[chartData.length - 1];
    if (lastSnap && lastSnap.date === livePoint.date) return chartData;

    return [...chartData, livePoint];
  }, [chartData, data?.live, data?.simulation]);

  // Sort holdings
  const sortedHoldings = useMemo(() => {
    if (!data?.live?.holdings) return [];
    const sorted = [...data.live.holdings];
    sorted.sort((a: LiveHolding, b: LiveHolding) => {
      const av = a[sortField], bv = b[sortField];
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
    return sorted;
  }, [data?.live?.holdings, sortField, sortDir]);

  // Allocation data
  const allocationData = useMemo(() => {
    if (!data?.live?.holdings) return [];
    const map = new Map<string, number>();
    for (const h of data.live.holdings) {
      const key = h.asset_class || 'EQUITY';
      map.set(key, (map.get(key) || 0) + h.market_value);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [data?.live?.holdings]);

  // Region data
  const regionData = useMemo(() => {
    if (!data?.live?.holdings) return [];
    const map = new Map<string, number>();
    for (const h of data.live.holdings) {
      const key = h.region || 'US';
      map.set(key, (map.get(key) || 0) + h.market_value);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [data?.live?.holdings]);

  async function handleRefresh() {
    setRefreshing(true);
    await mutate();
    setRefreshing(false);
    toast('success', 'Prix mis à jour');
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!data?.simulation || !data?.live || !data?.stats) {
    return <StartSimulation modelId={modelId} modelName="" onStarted={() => mutate()} />;
  }

  const sim = data.simulation;
  const live = data.live;
  const stats = data.stats;
  const isPositive = stats.total_return >= 0;

  // Actual invested amount from holdings snapshot
  const actualInvested = sim.holdings_snapshot.reduce(
    (sum: number, h: { quantity: number; purchase_price: number }) => sum + h.quantity * h.purchase_price, 0
  );
  const displayInvested = actualInvested > 0 ? actualInvested : sim.initial_value;

  // Top/Flop
  const topPerformers = [...live.holdings].sort((a, b) => b.gain_loss_pct - a.gain_loss_pct).slice(0, 3);
  const flopPerformers = [...live.holdings].sort((a, b) => a.gain_loss_pct - b.gain_loss_pct).slice(0, 3);

  return (
    <div className="space-y-6">

      {/* ── Header Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-text-main">{sim.name}</h2>
            <Badge variant="success">Active</Badge>
          </div>
          <p className="text-sm text-text-muted flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            Démarrée le {fmtDate(sim.start_date)} · {stats.days_active} jour{stats.days_active !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />}>
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* ── Big Numbers ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          label="Valeur actuelle"
          value={fmtMoney(live.total_value + stats.total_income, sim.currency)}
          sub={`Investi: ${fmtMoney(displayInvested, sim.currency)}`}
          icon={<DollarSign className="h-4 w-4" />}
          highlight
        />
        <StatCard
          label="Rendement total"
          value={`${isPositive ? '+' : ''}${fmtMoney(stats.total_return, sim.currency)}`}
          sub={fmtPct(stats.total_return_pct)}
          icon={isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          color={isPositive ? 'text-emerald-600' : 'text-red-600'}
        />
        <StatCard
          label="Rend. annualisé"
          value={fmtPct(stats.annualized_return)}
          icon={<Target className="h-4 w-4" />}
          color={stats.annualized_return >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
        <StatCard
          label="Volatilité"
          value={`${stats.volatility.toFixed(1)}%`}
          sub={`Sharpe: ${stats.sharpe.toFixed(2)}`}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Drawdown max"
          value={`-${stats.max_drawdown.toFixed(1)}%`}
          icon={<TrendingDown className="h-4 w-4" />}
          color={stats.max_drawdown > 10 ? 'text-red-600' : 'text-text-main'}
        />
        <StatCard
          label="Meilleur / Pire jour"
          value={`${stats.best_day >= 0 ? '+' : ''}${stats.best_day.toFixed(1)}%`}
          sub={`Pire: ${stats.worst_day.toFixed(1)}%`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>

      {/* ── Income Breakdown ── */}
      {stats.total_income > 0 && (
        <Card>
          <h3 className="font-semibold text-text-main mb-3">Décomposition du rendement</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Capital gains */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-brand-primary" />
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Gains en capital</span>
              </div>
              <p className={`text-lg font-bold ${stats.capital_gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.capital_gain >= 0 ? '+' : ''}{fmtMoney(stats.capital_gain, sim.currency)}
              </p>
              <p className="text-xs text-text-muted">{fmtPct(stats.capital_gain_pct)} · Appréciation des prix</p>
            </div>
            {/* Dividend income */}
            {stats.dividend_income > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Revenus de dividendes</span>
                </div>
                <p className="text-lg font-bold text-emerald-700">
                  +{fmtMoney(stats.dividend_income, sim.currency)}
                </p>
                <p className="text-xs text-emerald-600">Dividendes actions accumulés</p>
              </div>
            )}
            {/* Fixed income */}
            {stats.fixed_income > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                  <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">Revenus fixes</span>
                </div>
                <p className="text-lg font-bold text-blue-700">
                  +{fmtMoney(stats.fixed_income, sim.currency)}
                </p>
                <p className="text-xs text-blue-600">Distributions obligataires</p>
              </div>
            )}
            {/* If no separate income, show combined */}
            {stats.dividend_income === 0 && stats.fixed_income === 0 && stats.total_income > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Revenus totaux</span>
                </div>
                <p className="text-lg font-bold text-emerald-700">
                  +{fmtMoney(stats.total_income, sim.currency)}
                </p>
              </div>
            )}
          </div>
          {/* Total bar */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-main">Rendement total</span>
              <span className={`text-sm font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                {isPositive ? '+' : ''}{fmtMoney(stats.total_return, sim.currency)} ({fmtPct(stats.total_return_pct)})
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 mt-2 overflow-hidden flex">
              {stats.capital_gain > 0 && (
                <div
                  className="h-full bg-brand-primary"
                  style={{ width: `${Math.max((stats.capital_gain / (stats.capital_gain + stats.total_income)) * 100, 0)}%` }}
                  title={`Capital: ${fmtMoney(stats.capital_gain, sim.currency)}`}
                />
              )}
              {stats.dividend_income > 0 && (
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(stats.dividend_income / (stats.capital_gain + stats.total_income)) * 100}%` }}
                  title={`Dividendes: ${fmtMoney(stats.dividend_income, sim.currency)}`}
                />
              )}
              {stats.fixed_income > 0 && (
                <div
                  className="h-full bg-blue-600"
                  style={{ width: `${(stats.fixed_income / (stats.capital_gain + stats.total_income)) * 100}%` }}
                  title={`Revenu fixe: ${fmtMoney(stats.fixed_income, sim.currency)}`}
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Benchmark Comparison Pills ── */}
      {Object.keys(live.benchmarks).length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${
            isPositive ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
          }`}>
            <div className="w-3 h-3 rounded-full bg-brand-primary" />
            <span className="text-xs font-semibold text-text-main">Portefeuille</span>
            <span className={`text-sm font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
              {fmtPct(stats.total_return_pct)}
            </span>
          </div>
          {Object.entries(live.benchmarks).map(([sym, perf]) => (
            <div key={sym} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BENCHMARK_COLORS[sym] || '#64748b' }} />
              <span className="text-xs font-semibold text-text-muted">{BENCHMARK_LABELS[sym] || sym}</span>
              <span className={`text-sm font-bold ${perf.return_pct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtPct(perf.return_pct)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Performance Chart ── */}
      <Card>
        <h3 className="font-semibold text-text-main mb-1">Performance (base 100)</h3>
        <p className="text-xs text-text-muted mb-4">Rendement cumulatif depuis le début de la simulation</p>

        {chartDataWithLive.length > 1 ? (
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataWithLive} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00b4d8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00b4d8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const label = name === 'portfolio' ? 'Portefeuille' : BENCHMARK_LABELS[name] || name;
                    return [`${Number(value).toFixed(2)}`, label];
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(label: any) => `${label}`}
                />
                <Area type="monotone" dataKey="portfolio" stroke="#00b4d8" strokeWidth={2.5} fill="url(#portfolioGrad)" dot={false} activeDot={{ r: 4, fill: '#00b4d8' }} />
                {sim.benchmarks.map((bSym) => (
                  <Line
                    key={bSym}
                    type="monotone"
                    dataKey={bSym}
                    stroke={BENCHMARK_COLORS[bSym] || '#94a3b8'}
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[340px] flex items-center justify-center text-text-muted text-sm">
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-text-light" />
              <p>Le graphique apparaîtra après le premier jour de marché.</p>
              <p className="text-xs mt-1">Les données sont mises à jour quotidiennement.</p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Holdings Table ── */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text-main">Positions ({live.holdings.length})</h3>
            <p className="text-xs text-text-muted">Performance individuelle de chaque titre depuis l&apos;achat</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-text-muted border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold">Titre</th>
                <th className="text-right py-3 px-3 font-semibold">Qté</th>
                <th className="text-right py-3 px-3 font-semibold">Px achat</th>
                <th className="text-right py-3 px-3 font-semibold">Px actuel</th>
                <th className="text-right py-3 px-3 font-semibold cursor-pointer hover:text-brand-primary" onClick={() => toggleSort('market_value')}>
                  <span className="flex items-center justify-end gap-1">
                    Val. marché
                    {sortField === 'market_value' && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
                  </span>
                </th>
                <th className="text-right py-3 px-3 font-semibold cursor-pointer hover:text-brand-primary" onClick={() => toggleSort('weight')}>
                  <span className="flex items-center justify-end gap-1">
                    Poids
                    {sortField === 'weight' && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
                  </span>
                </th>
                <th className="text-right py-3 px-3 font-semibold">P&amp;L $</th>
                <th className="text-right py-3 px-3 font-semibold cursor-pointer hover:text-brand-primary" onClick={() => toggleSort('gain_loss_pct')}>
                  <span className="flex items-center justify-end gap-1">
                    P&amp;L %
                    {sortField === 'gain_loss_pct' && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h: LiveHolding, i: number) => {
                const isUp = h.gain_loss >= 0;
                return (
                  <tr key={h.symbol} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary/10 to-brand-accent/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-brand-primary">{h.symbol.replace('.TO', '').slice(0, 3)}</span>
                        </div>
                        <div>
                          <span className="font-mono font-semibold text-text-main text-xs">{h.symbol}</span>
                          <p className="text-[11px] text-text-muted truncate max-w-[150px]">{h.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-xs text-text-muted">
                      {h.quantity < 1 ? h.quantity.toFixed(4) : h.quantity < 100 ? h.quantity.toFixed(2) : Math.round(h.quantity).toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-xs text-text-muted">
                      {fmtMoneyFull(h.purchase_price)}
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-xs font-semibold text-text-main">
                      {fmtMoneyFull(h.current_price)}
                    </td>
                    <td className="text-right py-3 px-3 font-semibold text-text-main">
                      {fmtMoney(h.market_value)}
                    </td>
                    <td className="text-right py-3 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(h.weight, 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-text-muted w-10 text-right">{h.weight.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className={`text-right py-3 px-3 font-semibold ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isUp ? '+' : ''}{fmtMoney(h.gain_loss)}
                    </td>
                    <td className="text-right py-3 px-3">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-bold ${
                        isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {isUp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {Math.abs(h.gain_loss_pct).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className="py-3 px-4 font-bold text-text-main">Total</td>
                <td colSpan={3}></td>
                <td className="text-right py-3 px-3 font-bold text-text-main text-base">
                  {fmtMoney(live.total_value, sim.currency)}
                </td>
                <td className="text-right py-3 px-3 font-bold text-text-muted">100%</td>
                <td className={`text-right py-3 px-3 font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{fmtMoney(stats.total_return, sim.currency)}
                </td>
                <td className="text-right py-3 px-3">
                  <span className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {fmtPct(stats.total_return_pct)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ── Bottom Row: Top/Flop + Allocation + Region ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top / Flop */}
        <Card>
          <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Meilleurs / Pires
          </h3>
          <div className="space-y-2 mb-4">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Top performeurs</p>
            {topPerformers.map((h) => (
              <div key={h.symbol} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-emerald-50/50">
                <span className="font-mono text-xs font-semibold text-text-main">{h.symbol}</span>
                <span className="text-xs font-bold text-emerald-700">{fmtPct(h.gain_loss_pct)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Moins performants</p>
            {flopPerformers.map((h) => (
              <div key={h.symbol} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-red-50/50">
                <span className="font-mono text-xs font-semibold text-text-main">{h.symbol}</span>
                <span className="text-xs font-bold text-red-700">{fmtPct(h.gain_loss_pct)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Allocation Pie */}
        <Card>
          <h3 className="font-semibold text-text-main mb-4">Répartition par classe</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {allocationData.map((entry, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => fmtMoney(Number(value), sim.currency)}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {allocationData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SECTOR_COLORS[entry.name] || '#94a3b8' }} />
                <span className="text-[11px] text-text-muted">{entry.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Region breakdown */}
        <Card>
          <h3 className="font-semibold text-text-main mb-4">Répartition géographique</h3>
          <div className="space-y-3 mt-6">
            {regionData.map((r) => {
              const total = regionData.reduce((s, x) => s + x.value, 0);
              const pct = total > 0 ? (r.value / total) * 100 : 0;
              return (
                <div key={r.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-text-main">{REGION_LABELS[r.name] || r.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">{fmtMoney(r.value, sim.currency)}</span>
                      <span className="text-xs font-bold text-text-main">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Page Component ───────────────────────────────────────────────────────

export default function SimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { model, isLoading: modelLoading } = useModel(id);
  const { data, isLoading: simLoading, mutate } = useSimulation(id);

  if (modelLoading || simLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!model) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-muted">Modèle introuvable</p>
        <Link href="/models"><Button variant="ghost" className="mt-4">Retour aux modèles</Button></Link>
      </Card>
    );
  }

  // Show dashboard only for active simulations (not closed/paused)
  const hasActiveSim = !!data?.simulation && data.simulation.status === 'active';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/models/${id}`)} icon={<ArrowLeft className="h-4 w-4" />}>
            {model.name}
          </Button>
          <span className="text-text-light">/</span>
          <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-primary" />
            Simulation
          </h1>
        </div>
      </div>

      {hasActiveSim ? (
        <SimulationDashboard modelId={id} />
      ) : (
        <StartSimulation
          modelId={id}
          modelName={model.name}
          onStarted={() => mutate()}
        />
      )}
    </div>
  );
}

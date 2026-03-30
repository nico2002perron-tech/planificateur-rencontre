'use client';

import { useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useModel } from '@/lib/hooks/useModels';
import { useSimulation, type LiveHolding, type SimulationSnapshot } from '@/lib/hooks/useSimulation';
import Link from 'next/link';
import {
  ArrowLeft, TrendingUp, TrendingDown,
  DollarSign, Activity, Target,
  ChevronUp, ChevronDown, RefreshCw, Zap, Trophy,
  Shield, Calendar, BarChart3,
} from 'lucide-react';
import {
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell,
} from 'recharts';

// ── Duolingo palette ──────────────────────────────────────────────────────

const DUO_COLORS = ['#58CC02', '#CE82FF', '#1CB0F6', '#FF9600', '#FF4B4B', '#FFC800', '#00CD9C'];

function duoColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return DUO_COLORS[Math.abs(hash) % DUO_COLORS.length];
}

// ── Constants ─────────────────────────────────────────────────────────────

const BENCHMARK_LABELS: Record<string, string> = { '^GSPTSE': 'S&P/TSX', '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ' };
const BENCHMARK_COLORS: Record<string, string> = { '^GSPTSE': '#64748b', '^GSPC': '#03045e', '^IXIC': '#7c3aed' };
const SECTOR_COLORS: Record<string, string> = {
  EQUITY: '#1CB0F6', FIXED_INCOME: '#CE82FF', CASH: '#94a3b8',
  ALTERNATIVE: '#FF9600', REAL_ESTATE: '#58CC02', COMMODITY: '#FF4B4B',
};
const SECTOR_LABELS: Record<string, string> = {
  EQUITY: 'Actions', FIXED_INCOME: 'Obligations', CASH: 'Encaisse',
  ALTERNATIVE: 'Alternatifs', REAL_ESTATE: 'Immobilier', COMMODITY: 'Commodités',
};
const REGION_LABELS: Record<string, string> = {
  CA: 'Canada', US: 'États-Unis', INTL: 'International', EM: 'Marchés émergents',
};

function fmtMoney(v: number, currency = 'CAD'): string {
  return v.toLocaleString('fr-CA', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtMoneyFull(v: number, currency = 'CAD'): string {
  return v.toLocaleString('fr-CA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number): string { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`; }
function fmtDate(d: string): string { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtDateShort(d: string): string { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }); }

// ── Stock Avatar (Duolingo style) ─────────────────────────────────────────

function StockAvatar({ symbol, size = 44 }: { symbol: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const ticker = symbol.replace('.TO', '').replace('.V', '').replace('.CN', '');
  const color = duoColor(ticker);

  // Try loading a real logo, fallback to colorful initials
  if (!imgError) {
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`}
          alt={ticker}
          width={size}
          height={size}
          className="rounded-2xl border-[3px] object-contain bg-white"
          style={{ borderColor: color + '40' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border-[3px] flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: color + '18',
        borderColor: color + '50',
        boxShadow: `0 3px 0 0 ${color}30`,
      }}
    >
      <span className="font-extrabold" style={{ color, fontSize: size * 0.32 }}>
        {ticker.slice(0, 3)}
      </span>
    </div>
  );
}

// ── Encouraging message based on performance ──────────────────────────────

function getEncouragingMessage(returnPct: number, daysActive: number): { emoji: string; text: string } {
  if (daysActive === 0) return { emoji: '🚀', text: 'C\'est parti! Votre simulation est lancée.' };
  if (returnPct > 5) return { emoji: '🔥', text: 'En feu! Votre portefeuille performe très bien!' };
  if (returnPct > 2) return { emoji: '📈', text: 'Belle progression! Continuez comme ça!' };
  if (returnPct > 0) return { emoji: '💪', text: 'En territoire positif, beau travail!' };
  if (returnPct > -2) return { emoji: '😌', text: 'Léger recul, rien d\'inquiétant.' };
  if (returnPct > -5) return { emoji: '🧘', text: 'Les marchés fluctuent, gardez le cap!' };
  return { emoji: '💎', text: 'Patience! Les diamants se forment sous pression.' };
}

// ── Start Simulation Form ─────────────────────────────────────────────────

function StartSimulation({ modelId, modelName, onStarted }: { modelId: string; modelName: string; onStarted: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(100000);
  const [currency, setCurrency] = useState('CAD');
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (amount < 1000) { toast('warning', 'Le montant minimum est de 1 000$'); return; }
    setStarting(true);
    try {
      const res = await fetch(`/api/models/${modelId}/simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_value: amount, currency }),
      });
      const data = await res.json();
      if (!res.ok) { toast('error', data.error || 'Erreur'); return; }
      toast('success', `Simulation démarrée avec ${data.holdings_count} positions`);
      onStarted();
    } catch { toast('error', 'Erreur lors du démarrage'); }
    finally { setStarting(false); }
  }

  const presets = [25000, 50000, 100000, 250000, 500000, 1000000];

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🎯</div>
        <h2 className="text-2xl font-extrabold text-text-main mb-2">Prêt à simuler?</h2>
        <p className="text-text-muted max-w-md mx-auto">
          Suivez <strong>{modelName}</strong> comme un vrai portefeuille avec des prix réels du marché.
        </p>
      </div>

      <div className="rounded-3xl border-[3px] border-gray-200 bg-white p-8" style={{ boxShadow: '0 4px 0 0 #e5e7eb' }}>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-text-main mb-2">Montant initial</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
              <input
                type="number" min={1000} step={1000} value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-12 pr-16 py-4 rounded-2xl border-[3px] border-gray-200 text-2xl font-extrabold text-text-main focus:border-[#58CC02] focus:ring-4 focus:ring-[#58CC02]/10 focus:outline-none transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-text-muted">{currency}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {presets.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    amount === p
                      ? 'bg-[#58CC02] text-white shadow-md'
                      : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                  }`}
                  style={amount === p ? { boxShadow: '0 3px 0 0 #46a302' } : {}}
                >{fmtMoney(p)}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-text-main mb-2">Devise</label>
            <div className="flex gap-3">
              {['CAD', 'USD'].map((c) => (
                <button key={c} type="button" onClick={() => setCurrency(c)}
                  className={`flex-1 py-3 rounded-2xl border-[3px] text-sm font-bold transition-all ${
                    currency === c
                      ? 'border-[#1CB0F6] bg-[#1CB0F6]/5 text-[#1CB0F6]'
                      : 'border-gray-200 text-text-muted hover:border-gray-300'
                  }`}
                >{c === 'CAD' ? '🇨🇦 Dollar canadien' : '🇺🇸 Dollar américain'}</button>
              ))}
            </div>
          </div>

          <div className="bg-[#1CB0F6]/10 border-2 border-[#1CB0F6]/20 rounded-2xl p-4">
            <p className="text-xs text-[#0a7fad] leading-relaxed font-medium">
              <strong>💡 Comment ça marche :</strong> Les prix du marché sont gelés comme prix d&apos;achat.
              Ensuite, les prix se mettent à jour en temps réel pour suivre la vraie performance.
            </p>
          </div>

          <button onClick={handleStart} disabled={starting}
            className="w-full py-4 rounded-2xl border-[3px] border-b-[5px] border-[#58CC02] bg-[#58CC02] text-white text-base font-extrabold uppercase tracking-wide hover:bg-[#4db802] active:border-b-[3px] active:mt-[2px] transition-all disabled:opacity-60"
            style={{ boxShadow: 'none' }}
          >
            {starting ? 'Démarrage...' : `🚀 C'est parti! — ${fmtMoney(amount, currency)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Duo Stat Badge ────────────────────────────────────────────────────────

function DuoStat({ label, value, sub, icon, color = '#1CB0F6' }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="rounded-2xl border-[3px] bg-white p-4 transition-all hover:scale-[1.02]"
      style={{ borderColor: color + '30', boxShadow: `0 3px 0 0 ${color}20` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 rounded-xl" style={{ backgroundColor: color + '15' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-extrabold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs font-semibold text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────

function SimulationDashboard({ modelId }: { modelId: string }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSimulation(modelId);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'1J' | '1S' | '1M' | '3M' | '1A' | '5A' | 'Max'>('Max');

  // Period → cutoff date
  const periodCutoff = useMemo(() => {
    const now = new Date();
    const daysMap: Record<string, number> = { '1J': 1, '1S': 7, '1M': 30, '3M': 90, '1A': 365, '5A': 1825 };
    const days = daysMap[chartPeriod];
    if (!days) return null; // 'Max'
    const cutoff = new Date(now.getTime() - days * 86400000);
    return cutoff.toISOString().split('T')[0];
  }, [chartPeriod]);

  // Build ALL chart points (unfiltered)
  const allChartPoints = useMemo(() => {
    if (!data?.simulation) return [];
    const sim = data.simulation;
    const actualInvested = sim.holdings_snapshot.reduce(
      (sum: number, h: { quantity: number; purchase_price: number }) => sum + h.quantity * h.purchase_price, 0
    );
    const baseVal = actualInvested > 0 ? actualInvested : sim.initial_value;
    const points: { date: string; dateLabel: string; portfolio: number }[] =
      (data.snapshots || []).map((snap: SimulationSnapshot) => ({
        date: snap.date, dateLabel: fmtDateShort(snap.date), portfolio: Math.round(snap.total_value),
      }));
    // Add/replace live point
    if (data?.live) {
      const today = new Date().toISOString().split('T')[0];
      const liveVal = Math.round(data.live.total_value);
      if (points.length > 0 && points[points.length - 1].date === today) {
        points[points.length - 1] = { date: today, dateLabel: 'Auj.', portfolio: liveVal };
      } else {
        points.push({ date: today, dateLabel: 'Auj.', portfolio: liveVal });
      }
    }
    // If only 1 point, prepend start value
    if (points.length === 1) {
      points.unshift({ date: sim.start_date, dateLabel: 'Début', portfolio: Math.round(baseVal) });
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

  // Sorted holdings
  const sortedHoldings = useMemo(() => {
    if (!data?.live?.holdings) return [];
    return [...data.live.holdings].sort((a, b) => b.market_value - a.market_value);
  }, [data?.live?.holdings]);

  // Allocation data
  const allocationData = useMemo(() => {
    if (!data?.live?.holdings) return [];
    const map = new Map<string, number>();
    for (const h of data.live.holdings) {
      map.set(h.asset_class || 'EQUITY', (map.get(h.asset_class || 'EQUITY') || 0) + h.market_value);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [data?.live?.holdings]);

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
  const msg = getEncouragingMessage(stats.total_return_pct, stats.days_active);

  const topPerformers = [...live.holdings].sort((a, b) => b.gain_loss_pct - a.gain_loss_pct).slice(0, 3);
  const flopPerformers = [...live.holdings].sort((a, b) => a.gain_loss_pct - b.gain_loss_pct).slice(0, 3);
  const displayedHoldings = showAllHoldings ? sortedHoldings : sortedHoldings.slice(0, 8);

  return (
    <div className="space-y-6">

      {/* ── Hero: Encouraging message + Refresh ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{msg.emoji}</span>
          <div>
            <p className="font-extrabold text-text-main text-lg">{msg.text}</p>
            <p className="text-xs font-semibold text-text-muted flex items-center gap-1.5 mt-0.5">
              <Calendar className="h-3 w-3" />
              Jour {stats.days_active} · Depuis le {fmtDate(sim.start_date)}
            </p>
          </div>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-[3px] border-gray-200 bg-white text-sm font-bold text-text-muted hover:border-[#1CB0F6] hover:text-[#1CB0F6] transition-all"
          style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
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
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff', borderRadius: 16, border: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '10px 14px', fontSize: 13, fontWeight: 700,
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [fmtMoney(Number(value), sim.currency), 'Portefeuille']}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    labelFormatter={(label: any) => `${label}`}
                    cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="portfolio" stroke={lineColor} strokeWidth={3}
                    fill={`url(#${gradId})`} dot={false}
                    activeDot={{ r: 6, fill: lineColor, stroke: '#fff', strokeWidth: 3 }}
                  />
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
          {Object.entries(live.benchmarks).map(([sym, perf]) => (
            <div key={sym} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-[3px] border-gray-200 bg-white text-sm font-bold text-text-muted"
              style={{ boxShadow: '0 2px 0 0 #e5e7eb' }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BENCHMARK_COLORS[sym] || '#64748b' }} />
              {BENCHMARK_LABELS[sym] || sym}
              <span className={perf.return_pct >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}>{fmtPct(perf.return_pct)}</span>
            </div>
          ))}
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
            Mes positions <span className="text-text-muted font-bold">({live.holdings.length})</span>
          </h3>
        </div>

        <div className="space-y-3">
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
                className="rounded-2xl border-[3px] border-gray-200 bg-white p-5 transition-all hover:border-[#1CB0F6]/40"
                style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}
              >
                {/* Row 1 — Identity */}
                <div className="flex items-center gap-3.5 mb-4">
                  <StockAvatar symbol={h.symbol} size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-text-main text-base truncate">{h.name}</p>
                    <p className="text-xs font-bold text-text-muted">{h.symbol} · {qtyLabel} {h.quantity === 1 ? 'action' : 'actions'}</p>
                  </div>
                  {/* P&L badge */}
                  <div className="flex-shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-extrabold"
                      style={{ backgroundColor: pnlColor + '12', color: pnlColor }}>
                      {isUp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {Math.abs(h.gain_loss_pct).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Row 2 — Key numbers in clear labeled boxes */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* Buy price */}
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold text-text-light uppercase tracking-wider mb-0.5">Acheté à</p>
                    <p className="text-sm font-extrabold text-text-muted">{fmtMoneyFull(h.purchase_price)}</p>
                  </div>
                  {/* Current price */}
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold text-text-light uppercase tracking-wider mb-0.5">Prix actuel</p>
                    <p className="text-sm font-extrabold text-text-main">{fmtMoneyFull(h.current_price)}</p>
                  </div>
                  {/* Total value */}
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold text-text-light uppercase tracking-wider mb-0.5">Valeur totale</p>
                    <p className="text-sm font-extrabold text-text-main">{fmtMoney(h.market_value, sim.currency)}</p>
                  </div>
                  {/* Gain / Loss */}
                  <div className="rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: pnlColor + '08' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: pnlColor + '90' }}>
                      {isUp ? 'Gain' : 'Perte'}
                    </p>
                    <p className="text-sm font-extrabold" style={{ color: pnlColor }}>
                      {isUp ? '+' : ''}{fmtMoney(h.gain_loss, sim.currency)}
                    </p>
                  </div>
                </div>

                {/* Row 3 — Weight bar */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#1CB0F6] transition-all duration-500"
                      style={{ width: `${Math.min(h.weight, 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-extrabold text-text-muted w-16 text-right">{h.weight.toFixed(1)}% du total</span>
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
            <p className="text-xs font-bold text-text-muted">{live.holdings.length} positions</p>
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

        {/* Allocation Pie */}
        <div className="rounded-2xl border-[3px] border-gray-200 bg-white p-5" style={{ boxShadow: '0 3px 0 0 #e5e7eb' }}>
          <h3 className="font-extrabold text-text-main mb-4 flex items-center gap-2">
            <span className="text-xl">🎯</span> Répartition
          </h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={3} stroke="#fff">
                  {allocationData.map((entry, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => fmtMoney(Number(value), sim.currency)}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontSize: 12, fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {allocationData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SECTOR_COLORS[entry.name] || '#94a3b8' }} />
                <span className="text-[11px] font-bold text-text-muted">{SECTOR_LABELS[entry.name] || entry.name}</span>
              </div>
            ))}
          </div>
        </div>

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
                <span className="text-lg">📊</span>
                <div>
                  <p className="text-xs font-bold text-text-muted">Dividendes</p>
                  <p className="text-lg font-extrabold text-[#58CC02]">+{fmtMoney(stats.dividend_income, sim.currency)}</p>
                </div>
              </div>
            )}
            {stats.fixed_income > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-lg">🏛️</span>
                <div>
                  <p className="text-xs font-bold text-text-muted">Revenu fixe</p>
                  <p className="text-lg font-extrabold text-[#1CB0F6]">+{fmtMoney(stats.fixed_income, sim.currency)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
          <Button variant="ghost" size="sm" onClick={() => router.push(`/models/${id}`)} icon={<ArrowLeft className="h-4 w-4" />}>
            {model.name}
          </Button>
          <span className="text-text-light">/</span>
          <h1 className="text-lg font-extrabold text-text-main flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#1CB0F6]" />
            Simulation
          </h1>
        </div>
      </div>

      {hasActiveSim ? (
        <SimulationDashboard modelId={id} />
      ) : (
        <StartSimulation modelId={id} modelName={model.name} onStarted={() => mutate()} />
      )}
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles } from '@/lib/hooks/useInvestmentProfiles';
import { ArrowLeft, Activity, TrendingUp, TrendingDown, BarChart3, Shield, Percent } from 'lucide-react';

// ── Types ──

interface BacktestSeries {
  date: string;
  portfolio: number;
  benchmark?: number;
  benchmarkUS?: number;
}

interface BacktestDrawdown {
  date: string;
  portfolio: number;
  benchmark?: number;
}

interface BacktestStats {
  totalReturn: number;
  cagr: number;
  volatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  bestMonth: number;
  worstMonth: number;
  positiveMonths: number;
  years: number;
  nbSymbolsWithData: number;
}

interface BacktestResult {
  series: BacktestSeries[];
  drawdown: BacktestDrawdown[];
  stats: BacktestStats;
  benchmarkStats?: { totalReturn: number; cagr: number; volatility: number; maxDrawdown: number };
  period: { start: string; end: string };
}

interface BacktestResponse {
  backtest: BacktestResult;
  portfolio: { profileName: string; profileNumber: number; nbStocks: number; equityPct: number; bondPct: number };
}

// ── Constantes ──

const BRAND = '#00b4d8';
const DARK = '#03045e';
const RED = '#ef4444';
const AMBER = '#f4a261';

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12,
};

function fmtDec(n: number, d = 2) {
  return new Intl.NumberFormat('fr-CA', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

// ════════════════════════════════════════
// PAGE
// ════════════════════════════════════════

export default function BacktestPage() {
  const { profiles, isLoading: profilesLoading } = useInvestmentProfiles();
  const { toast } = useToast();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [years, setYears] = useState(5);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BacktestResponse | null>(null);

  const handleRun = useCallback(async () => {
    if (!selectedProfileId) {
      toast('warning', 'Selectionnez un profil');
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch('/api/models/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: selectedProfileId, years }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const json = await res.json();
      setData(json);
      toast('success', `Backtest complete — ${json.backtest.stats.years} ans`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [selectedProfileId, years, toast]);

  if (profilesLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Backtesting"
        description="Simulez la performance historique d'un portefeuille modele vs benchmarks"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {/* Parametres */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-main mb-1">Profil d'investissement</label>
            <select
              value={selectedProfileId}
              onChange={(e) => { setSelectedProfileId(e.target.value); setData(null); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            >
              <option value="">-- Selectionnez --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.profile_number}. {p.name} ({p.equity_pct}/{p.bond_pct})
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-40">
            <label className="block text-sm font-medium text-text-main mb-1">Periode</label>
            <select
              value={years}
              onChange={(e) => { setYears(parseInt(e.target.value)); setData(null); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            >
              <option value={1}>1 an</option>
              <option value={3}>3 ans</option>
              <option value={5}>5 ans</option>
              <option value={10}>10 ans</option>
            </select>
          </div>

          <Button
            size="lg"
            loading={loading}
            onClick={handleRun}
            icon={<Activity className="h-4 w-4" />}
          >
            Lancer le backtest
          </Button>
        </div>
      </Card>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted mt-4">Recuperation des donnees historiques Yahoo Finance...</p>
          <p className="text-xs text-text-light mt-1">Cela peut prendre quelques secondes selon le nombre de titres.</p>
        </div>
      )}

      {data && !loading && <BacktestView data={data} />}
    </div>
  );
}

// ════════════════════════════════════════
// RESULTATS BACKTEST
// ════════════════════════════════════════

function BacktestView({ data }: { data: BacktestResponse }) {
  const { backtest: bt, portfolio: ptf } = data;
  const hasBench = bt.series.some(s => s.benchmark != null);
  const hasBenchUS = bt.series.some(s => s.benchmarkUS != null);

  // Déterminer couleur de performance
  const perfColor = bt.stats.cagr >= 0 ? 'text-emerald-600' : 'text-red-500';

  return (
    <div className="space-y-6">
      {/* En-tete */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-main">
            Profil {ptf.profileNumber} — {ptf.profileName}
          </h2>
          <p className="text-sm text-text-muted">
            {ptf.equityPct}/{ptf.bondPct} — {ptf.nbStocks} titres —{' '}
            {bt.period.start} a {bt.period.end} ({bt.stats.years} ans)
          </p>
        </div>
        <Badge variant={bt.stats.nbSymbolsWithData === ptf.nbStocks ? 'success' : 'warning'}>
          {bt.stats.nbSymbolsWithData}/{ptf.nbStocks} titres avec historique
        </Badge>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Rendement total" value={`${bt.stats.totalReturn > 0 ? '+' : ''}${fmtDec(bt.stats.totalReturn)}%`} color={perfColor} />
        <StatCard icon={<Percent className="h-5 w-5" />} label="CAGR" value={`${bt.stats.cagr > 0 ? '+' : ''}${fmtDec(bt.stats.cagr)}%`} color={perfColor} />
        <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Volatilite" value={`${fmtDec(bt.stats.volatility)}%`} color="text-amber-500" />
        <StatCard icon={<Shield className="h-5 w-5" />} label="Sharpe Ratio" value={fmtDec(bt.stats.sharpeRatio)} color={bt.stats.sharpeRatio >= 1 ? 'text-emerald-600' : 'text-amber-500'} />
      </div>

      {/* Stats secondaires */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-xl font-semibold text-red-500">{fmtDec(bt.stats.maxDrawdown)}%</p>
          <p className="text-xs text-text-muted">Perte max.</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xl font-semibold text-emerald-600">+{fmtDec(bt.stats.bestMonth)}%</p>
          <p className="text-xs text-text-muted">Meilleur mois</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xl font-semibold text-red-500">{fmtDec(bt.stats.worstMonth)}%</p>
          <p className="text-xs text-text-muted">Pire mois</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xl font-semibold text-text-main">{bt.stats.positiveMonths}%</p>
          <p className="text-xs text-text-muted">Mois positifs</p>
        </Card>
        {bt.benchmarkStats && (
          <Card padding="sm" className="text-center">
            <p className="text-xl font-semibold text-text-main">{bt.benchmarkStats.cagr > 0 ? '+' : ''}{fmtDec(bt.benchmarkStats.cagr)}%</p>
            <p className="text-xs text-text-muted">CAGR TSX</p>
          </Card>
        )}
      </div>

      {/* Comparaison benchmark */}
      {bt.benchmarkStats && (
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-3">Portefeuille vs S&P/TSX</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted">Metrique</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted">Portefeuille</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted">S&P/TSX</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted">Ecart</p>
            </div>
            {[
              { label: 'CAGR', ptf: bt.stats.cagr, bench: bt.benchmarkStats.cagr },
              { label: 'Rendement total', ptf: bt.stats.totalReturn, bench: bt.benchmarkStats.totalReturn },
              { label: 'Volatilite', ptf: bt.stats.volatility, bench: bt.benchmarkStats.volatility },
              { label: 'Max Drawdown', ptf: bt.stats.maxDrawdown, bench: bt.benchmarkStats.maxDrawdown },
            ].map(row => {
              const diff = row.ptf - row.bench;
              const isGood = row.label === 'Volatilite' || row.label === 'Max Drawdown' ? diff < 0 : diff > 0;
              return (
                <div key={row.label} className="contents">
                  <div className="py-2 font-medium text-text-main">{row.label}</div>
                  <div className="py-2 text-center font-mono">{fmtDec(row.ptf)}%</div>
                  <div className="py-2 text-center font-mono text-text-muted">{fmtDec(row.bench)}%</div>
                  <div className={`py-2 text-center font-mono font-semibold ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
                    {diff > 0 ? '+' : ''}{fmtDec(diff)}%
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Performance chart */}
      <Card>
        <h3 className="text-sm font-semibold text-text-main mb-4">Performance (base 100)</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={bt.series} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#586e82' }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              interval={Math.max(1, Math.floor(bt.series.length / 12))}
            />
            <YAxis tick={{ fontSize: 11, fill: '#586e82' }} />
            <Tooltip
              contentStyle={tooltipStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => new Date(String(label)).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short' })}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const labels: Record<string, string> = { portfolio: 'Portefeuille', benchmark: 'S&P/TSX', benchmarkUS: 'S&P 500' };
                return [fmtDec(Number(value)), labels[name] || name];
              }}
            />
            <Legend formatter={(value: string) => {
              const labels: Record<string, string> = { portfolio: 'Portefeuille', benchmark: 'S&P/TSX', benchmarkUS: 'S&P 500' };
              return labels[value] || value;
            }} />
            <Line type="monotone" dataKey="portfolio" stroke={BRAND} strokeWidth={2.5} dot={false} />
            {hasBench && <Line type="monotone" dataKey="benchmark" stroke={DARK} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />}
            {hasBenchUS && <Line type="monotone" dataKey="benchmarkUS" stroke={AMBER} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Drawdown chart */}
      <Card>
        <h3 className="text-sm font-semibold text-text-main mb-4">Drawdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={bt.drawdown} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#586e82' }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              interval={Math.max(1, Math.floor(bt.drawdown.length / 12))}
            />
            <YAxis tick={{ fontSize: 11, fill: '#586e82' }} tickFormatter={(v: number) => `${v}%`} domain={['dataMin', 0]} />
            <Tooltip
              contentStyle={tooltipStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => new Date(String(label)).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short' })}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [`${fmtDec(Number(value))}%`, 'Drawdown']}
            />
            <Area type="monotone" dataKey="portfolio" stroke={RED} fill={`${RED}20`} strokeWidth={1.5} />
            {hasBench && <Area type="monotone" dataKey="benchmark" stroke={DARK} fill="transparent" strokeWidth={1} strokeDasharray="4 4" />}
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <p className="text-xs text-text-light">
        Backtest base sur les prix ajustes mensuels Yahoo Finance. Les rendements passes ne garantissent pas les rendements futurs.
        La portion obligataire n'est pas incluse dans le backtest (donnees historiques limitees).
      </p>
    </div>
  );
}

// ── Carte stat ──

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className={`text-xl font-semibold leading-tight ${color}`}>{value}</p>
      </div>
    </Card>
  );
}

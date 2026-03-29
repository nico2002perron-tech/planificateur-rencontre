'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles } from '@/lib/hooks/useInvestmentProfiles';
import { StepNav } from '@/components/models/StepNav';
import { ArrowLeft, Target, Shield, TrendingUp, Star, Eye } from 'lucide-react';

// ── Types ──

interface SafetyBreakdown {
  week52Position: number;
  betaScore: number;
  dividendScore: number;
  peReasonableness: number;
  epsStability: number;
  total: number;
  label: string;
  color: string;
}

interface UpsideBreakdown {
  analystUpside: number;
  week52Room: number;
  valuationUpside: number;
  peSectorGap: number;
  epsGrowth: number;
  totalReturn: number;
  total: number;
  label: string;
  color: string;
}

interface ScoredStock {
  symbol: string;
  companyName: string;
  weight: number;
  safety: SafetyBreakdown;
  upside: UpsideBreakdown;
  rank: number;
  quadrant: 'star' | 'safe' | 'growth' | 'watch';
  confidence: 'high' | 'medium' | 'low';
  price: number;
  pe: number;
  dividendYield: number;
  marketCap: number;
  targetPrice: number;
  estimatedGainPercent: number;
  sector: string;
}

interface ScoringResult {
  profileName: string;
  profileNumber: number;
  nbStocks: number;
  portfolioScores: { safety: number; upside: number };
  quadrantDistribution: { star: number; safe: number; growth: number; watch: number };
  stocks: ScoredStock[];
}

// ── Constantes ──

const BRAND = '#00b4d8';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const NAVY = '#03045e';

const QUADRANT_CONFIG = {
  star: { label: 'Etoile', icon: Star, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', color: GREEN },
  safe: { label: 'Sur', icon: Shield, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', color: '#3b82f6' },
  growth: { label: 'Croissance', icon: TrendingUp, bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', color: BRAND },
  watch: { label: 'Veille', icon: Eye, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', color: RED },
};

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12,
};

function fmtDec(n: number, d = 1) {
  return new Intl.NumberFormat('fr-CA', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-600';
  if (score >= 5) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBarColor(score: number, type: 'safety' | 'upside'): string {
  if (type === 'safety') {
    if (score >= 7) return GREEN;
    if (score >= 5) return AMBER;
    return RED;
  }
  if (score >= 7) return BRAND;
  if (score >= 5) return '#c5a365';
  return RED;
}

// ════════════════════════════════════════
// PAGE
// ════════════════════════════════════════

export default function ScoringPage() {
  const { profiles, isLoading: profilesLoading } = useInvestmentProfiles();
  const { toast } = useToast();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ScoringResult | null>(null);

  const handleRun = useCallback(async () => {
    if (!selectedProfileId) {
      toast('warning', 'Selectionnez un profil');
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch('/api/models/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: selectedProfileId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setData(await res.json());
      toast('success', 'Scoring termine');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [selectedProfileId, toast]);

  if (profilesLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Scoring — Securite & Potentiel"
        description="Evaluez la securite et le potentiel de gains de chaque titre"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-main mb-1">Profil d&apos;investissement</label>
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
          <Button size="lg" loading={loading} onClick={handleRun} icon={<Target className="h-4 w-4" />}>
            Analyser
          </Button>
        </div>
      </Card>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted mt-4">Analyse des fondamentaux en cours...</p>
        </div>
      )}

      {data && !loading && <ScoringView data={data} />}

      <StepNav current={4} />
    </div>
  );
}

// ════════════════════════════════════════
// VUE SCORING
// ════════════════════════════════════════

function ScoringView({ data }: { data: ScoringResult }) {
  const ps = data.portfolioScores;
  const composite = Math.round((ps.safety * 0.5 + ps.upside * 0.5) * 10) / 10;

  // Radar chart — safety breakdown (first stock weighted avg)
  const totalWeight = data.stocks.reduce((s, st) => s + st.weight, 0);
  function wAvg(fn: (s: ScoredStock) => number) {
    if (totalWeight === 0) return 0;
    return Math.round(data.stocks.reduce((s, st) => s + fn(st) * st.weight, 0) / totalWeight * 10) / 10;
  }

  const radarData = [
    { dimension: 'Securite', score: ps.safety },
    { dimension: 'Potentiel', score: ps.upside },
    { dimension: 'Beta', score: wAvg(s => s.safety.betaScore) },
    { dimension: 'Dividende', score: wAvg(s => s.safety.dividendScore) },
    { dimension: 'Cible anal.', score: wAvg(s => s.upside.analystUpside) },
    { dimension: 'Crois. BPA', score: wAvg(s => s.upside.epsGrowth) },
  ];

  // Quadrant distribution for bar chart
  const quadDist = [
    { name: 'Etoile', count: data.quadrantDistribution.star, color: GREEN },
    { name: 'Sur', count: data.quadrantDistribution.safe, color: '#3b82f6' },
    { name: 'Croissance', count: data.quadrantDistribution.growth, color: BRAND },
    { name: 'Veille', count: data.quadrantDistribution.watch, color: RED },
  ].filter(d => d.count > 0);

  // Scatter-like data for dual score bar chart
  const stockBarData = data.stocks.slice(0, 25).map(s => ({
    name: s.symbol,
    safety: s.safety.total,
    upside: s.upside.total,
  }));

  return (
    <div className="space-y-6">
      {/* En-tete */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-main">
            Profil {data.profileNumber} — {data.profileName}
          </h2>
          <p className="text-sm text-text-muted">{data.nbStocks} titres analyses</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-text-muted mb-0.5">Securite</p>
            <p className={`text-2xl font-bold ${scoreColor(ps.safety)}`}>
              {fmtDec(ps.safety)}<span className="text-sm text-text-muted">/10</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-text-muted mb-0.5">Potentiel</p>
            <p className={`text-2xl font-bold ${scoreColor(ps.upside)}`}>
              {fmtDec(ps.upside)}<span className="text-sm text-text-muted">/10</span>
            </p>
          </div>
          <div className="text-center pl-4 border-l border-gray-200">
            <p className="text-xs text-text-muted mb-0.5">Composite</p>
            <p className="text-3xl font-bold" style={{ color: NAVY }}>
              {fmtDec(composite)}<span className="text-sm text-text-muted">/10</span>
            </p>
          </div>
        </div>
      </div>

      {/* Quadrant cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['star', 'safe', 'growth', 'watch'] as const).map(q => {
          const cfg = QUADRANT_CONFIG[q];
          const Icon = cfg.icon;
          const stocks = data.stocks.filter(s => s.quadrant === q);
          return (
            <div key={q} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${cfg.text}`} />
                <span className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</span>
                <span className={`ml-auto text-lg font-bold ${cfg.text}`}>{stocks.length}</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {stocks.length > 0 ? stocks.map(s => s.symbol).join(', ') : 'Aucun titre'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Score bars + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dual score bars */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-main">Scores du portefeuille</h3>
          {[
            { label: 'Securite globale', value: ps.safety, type: 'safety' as const, desc: 'Position 52s, beta, dividende, PE, BPA' },
            { label: 'Potentiel de gains', value: ps.upside, type: 'upside' as const, desc: 'Cible analystes, DCF, PE sectoriel, croissance' },
            { label: 'Beta moyen', value: wAvg(s => s.safety.betaScore), type: 'safety' as const, desc: 'Volatilite relative au marche' },
            { label: 'Dividende', value: wAvg(s => s.safety.dividendScore), type: 'safety' as const, desc: 'Coussin de revenu' },
            { label: 'Cible analystes', value: wAvg(s => s.upside.analystUpside), type: 'upside' as const, desc: 'Upside vs consensus' },
            { label: 'Croissance BPA', value: wAvg(s => s.upside.epsGrowth), type: 'upside' as const, desc: 'Moteur de hausse' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-main">{s.label}</span>
                  <span className={`text-sm font-bold ${scoreColor(s.value)}`}>{fmtDec(s.value)}/10</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(s.value / 10) * 100}%`, backgroundColor: scoreBarColor(s.value, s.type) }}
                  />
                </div>
                <p className="text-xs text-text-light mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Radar chart */}
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-2 text-center">Profil de qualite</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#586e82' }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10, fill: '#a0aec0' }} />
              <Radar name="Score" dataKey="score" stroke={BRAND} fill={BRAND} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Quadrant distribution + dual bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution par quadrant */}
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Distribution par quadrant</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={quadDist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#586e82' }} />
              <YAxis tick={{ fontSize: 11, fill: '#586e82' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {quadDist.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {quadDist.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} ({d.count})
              </div>
            ))}
          </div>
        </Card>

        {/* Dual score par titre */}
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Securite vs Potentiel (top 25)</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, stockBarData.length * 22)}>
            <BarChart data={stockBarData} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#586e82' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#586e82' }} width={45} />
              <Tooltip contentStyle={tooltipStyle} // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [fmtDec(Number(value)), name === 'safety' ? 'Securite' : 'Potentiel']} />
              <Bar dataKey="safety" fill={GREEN} radius={[0, 4, 4, 0]} barSize={8} />
              <Bar dataKey="upside" fill={BRAND} radius={[0, 4, 4, 0]} barSize={8} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GREEN }} /> Securite
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND }} /> Potentiel
            </div>
          </div>
        </Card>
      </div>

      {/* Tableau detail */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-text-main">Classement des titres</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-2.5 w-8">#</th>
                <th className="px-3 py-2.5">Symbole</th>
                <th className="px-3 py-2.5">Nom</th>
                <th className="px-3 py-2.5">Secteur</th>
                <th className="px-3 py-2.5 text-right">Poids</th>
                <th className="px-3 py-2.5 text-center">Securite</th>
                <th className="px-3 py-2.5 w-24"></th>
                <th className="px-3 py-2.5 text-center">Potentiel</th>
                <th className="px-3 py-2.5 w-24"></th>
                <th className="px-3 py-2.5 text-center">Quadrant</th>
                <th className="px-3 py-2.5 text-right">Gain est.</th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s) => {
                const qCfg = QUADRANT_CONFIG[s.quadrant];
                const QIcon = qCfg.icon;
                return (
                  <tr key={s.symbol} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-bold" style={{ color: NAVY }}>{s.rank}</td>
                    <td className="px-3 py-2.5 font-mono font-medium text-text-main">{s.symbol}</td>
                    <td className="px-3 py-2.5 text-text-muted max-w-[150px] truncate">{s.companyName}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline">{s.sector}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-muted">{fmtDec(s.weight)}%</td>

                    {/* Safety */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-sm font-bold ${scoreColor(s.safety.total)}`}>
                        {s.confidence === 'low' ? 'N/D' : fmtDec(s.safety.total)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {s.confidence !== 'low' && (
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${s.safety.total * 10}%`, backgroundColor: scoreBarColor(s.safety.total, 'safety') }}
                          />
                        </div>
                      )}
                    </td>

                    {/* Upside */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-sm font-bold ${scoreColor(s.upside.total)}`}>
                        {s.confidence === 'low' ? 'N/D' : fmtDec(s.upside.total)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {s.confidence !== 'low' && (
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${s.upside.total * 10}%`, backgroundColor: scoreBarColor(s.upside.total, 'upside') }}
                          />
                        </div>
                      )}
                    </td>

                    {/* Quadrant */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${qCfg.bg} ${qCfg.text}`}>
                        <QIcon className="h-3 w-3" />
                        {qCfg.label}
                      </span>
                    </td>

                    {/* Gain estime */}
                    <td className="px-3 py-2.5 text-right font-mono">
                      {s.targetPrice > 0 ? (
                        <span className={s.estimatedGainPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {s.estimatedGainPercent >= 0 ? '+' : ''}{fmtDec(s.estimatedGainPercent)}%
                        </span>
                      ) : (
                        <span className="text-text-light">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-text-light">
        Scores bases sur les fondamentaux Yahoo Finance: position 52 sem., beta, dividende, PE, BPA (securite) et cibles analystes, PE sectoriel, croissance BPA, rendement total (potentiel).
        Le scoring est indicatif et ne constitue pas un conseil d&apos;investissement.
      </p>
    </div>
  );
}

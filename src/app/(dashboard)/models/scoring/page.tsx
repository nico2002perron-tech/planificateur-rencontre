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
import { ArrowLeft, Target, Star } from 'lucide-react';

// ── Types ──

interface ScoredStock {
  symbol: string;
  name: string;
  sector: string;
  weight: number;
  price: number;
  pe: number;
  dividendYield: number;
  marketCap: number;
  scores: { overall: number; health: number; growth: number; valuation: number; sector: number };
}

interface ScoringResult {
  profileName: string;
  profileNumber: number;
  nbStocks: number;
  portfolioScores: { overall: number; health: number; growth: number; valuation: number; sector: number };
  distribution: { excellent: number; good: number; average: number; weak: number };
  stocks: ScoredStock[];
}

// ── Constantes ──

const BRAND = '#00b4d8';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';

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
  if (score >= 7.5) return 'text-emerald-600';
  if (score >= 5.5) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBg(score: number): string {
  if (score >= 7.5) return 'bg-emerald-50 text-emerald-700';
  if (score >= 5.5) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function scoreLabel(score: number): string {
  if (score >= 8) return 'Excellent';
  if (score >= 6.5) return 'Bon';
  if (score >= 5) return 'Moyen';
  return 'Faible';
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
        title="Scoring intelligent"
        description="Evaluez la qualite de chaque titre et du portefeuille modele"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

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

  // Radar chart data
  const radarData = [
    { dimension: 'Global', score: ps.overall },
    { dimension: 'Sante', score: ps.health },
    { dimension: 'Croissance', score: ps.growth },
    { dimension: 'Valorisation', score: ps.valuation },
    { dimension: 'Secteur', score: ps.sector },
  ];

  // Distribution chart data
  const distData = [
    { name: 'Excellent', count: data.distribution.excellent, color: GREEN },
    { name: 'Bon', count: data.distribution.good, color: BRAND },
    { name: 'Moyen', count: data.distribution.average, color: AMBER },
    { name: 'Faible', count: data.distribution.weak, color: RED },
  ].filter(d => d.count > 0);

  // Scores par titre pour le bar chart
  const stockScoreData = data.stocks.slice(0, 25).map(s => ({
    name: s.symbol,
    score: s.scores.overall,
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
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-text-muted">Score global</p>
            <p className={`text-3xl font-bold ${scoreColor(ps.overall)}`}>
              {fmtDec(ps.overall)}<span className="text-lg text-text-muted">/10</span>
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${scoreBg(ps.overall)}`}>
            {scoreLabel(ps.overall)}
          </div>
        </div>
      </div>

      {/* Score cards + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scores par dimension */}
        <div className="space-y-3">
          {[
            { label: 'Score global', value: ps.overall, desc: 'Moyenne ponderee de tous les criteres' },
            { label: 'Sante financiere', value: ps.health, desc: 'Tresorerie, endettement, Piotroski' },
            { label: 'Croissance', value: ps.growth, desc: 'Ventes, BPA, flux de tresorerie' },
            { label: 'Valorisation', value: ps.valuation, desc: 'P/E, P/S vs comparables' },
            { label: 'Secteur', value: ps.sector, desc: 'Qualite sectorielle relative' },
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
                    style={{
                      width: `${(s.value / 10) * 100}%`,
                      backgroundColor: s.value >= 7.5 ? GREEN : s.value >= 5.5 ? AMBER : RED,
                    }}
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

      {/* Distribution + Scores par titre */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution */}
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Distribution des scores</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={distData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#586e82' }} />
              <YAxis tick={{ fontSize: 11, fill: '#586e82' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {distData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {distData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} ({d.count})
              </div>
            ))}
          </div>
        </Card>

        {/* Scores par titre */}
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Score par titre (top 25)</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, stockScoreData.length * 22)}>
            <BarChart data={stockScoreData} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#586e82' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#586e82' }} width={45} />
              <Tooltip contentStyle={tooltipStyle} // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [fmtDec(Number(value)), 'Score']} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {stockScoreData.map((s, i) => (
                  <Cell key={i} fill={s.score >= 7.5 ? GREEN : s.score >= 5.5 ? BRAND : s.score >= 4 ? AMBER : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tableau detail */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-text-main">Detail par titre</h3>
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
                <th className="px-3 py-2.5 text-center">Global</th>
                <th className="px-3 py-2.5 text-center">Sante</th>
                <th className="px-3 py-2.5 text-center">Croissance</th>
                <th className="px-3 py-2.5 text-center">Valeur</th>
                <th className="px-3 py-2.5 text-center">Qualite</th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s, i) => (
                <tr key={s.symbol} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-text-light font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-mono font-medium text-text-main">
                    <div className="flex items-center gap-1.5">
                      {s.scores.overall >= 8 && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                      {s.symbol}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-text-muted max-w-[150px] truncate">{s.name}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline">{s.sector}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-muted">{fmtDec(s.weight)}%</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${scoreBg(s.scores.overall)}`}>
                      {fmtDec(s.scores.overall)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-sm">
                    <span className={scoreColor(s.scores.health)}>{fmtDec(s.scores.health)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-sm">
                    <span className={scoreColor(s.scores.growth)}>{fmtDec(s.scores.growth)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-sm">
                    <span className={scoreColor(s.scores.valuation)}>{fmtDec(s.scores.valuation)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs font-medium ${scoreColor(s.scores.overall)}`}>
                      {scoreLabel(s.scores.overall)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-text-light">
        Scores bases sur les fondamentaux Yahoo Finance et les comparables sectoriels.
        Le scoring est indicatif et ne constitue pas un conseil d'investissement.
      </p>
    </div>
  );
}

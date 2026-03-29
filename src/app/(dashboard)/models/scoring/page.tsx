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
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles } from '@/lib/hooks/useInvestmentProfiles';
import { StepNav } from '@/components/models/StepNav';
import {
  ArrowLeft, Target, Shield, TrendingUp, Star, Eye,
  ChevronDown, ChevronUp, Info, Gauge, HelpCircle,
} from 'lucide-react';

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
  star: {
    label: 'Etoile',
    icon: Star,
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', color: GREEN,
    desc: 'Titres a la fois solides et prometteurs. Le meilleur des deux mondes.',
  },
  safe: {
    label: 'Sur',
    icon: Shield,
    bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', color: '#3b82f6',
    desc: 'Titres defensifs et stables, mais avec un potentiel de hausse plus limite.',
  },
  growth: {
    label: 'Croissance',
    icon: TrendingUp,
    bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', color: BRAND,
    desc: 'Fort potentiel de gains, mais avec plus de risque. Titres agressifs.',
  },
  watch: {
    label: 'Veille',
    icon: Eye,
    bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', color: RED,
    desc: 'Titres a surveiller de pres. Securite et potentiel en dessous de la moyenne.',
  },
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

function scoreBgClass(score: number): string {
  if (score >= 7) return 'bg-emerald-500';
  if (score >= 5) return 'bg-amber-400';
  return 'bg-red-500';
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

function compositeVerdict(score: number): { text: string; emoji: string } {
  if (score >= 8) return { text: 'Excellent equilibre securite/potentiel', emoji: '' };
  if (score >= 6.5) return { text: 'Bon portefeuille, bien positionne', emoji: '' };
  if (score >= 5) return { text: 'Portefeuille correct, quelques points a ameliorer', emoji: '' };
  if (score >= 3.5) return { text: 'Attention — plusieurs titres a revoir', emoji: '' };
  return { text: 'Portefeuille fragile — revision recommandee', emoji: '' };
}

// ── Score Gauge (visual arc) ──

function ScoreGauge({ score, label, size = 100 }: { score: number; label: string; size?: number }) {
  const pct = Math.min(score / 10, 1);
  const radius = size * 0.38;
  const stroke = size * 0.08;
  const cx = size / 2;
  const cy = size * 0.55;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle - pct * Math.PI;

  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy - radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy - radius * Math.sin(endAngle);
  const xA = cx + radius * Math.cos(angle);
  const yA = cy - radius * Math.sin(angle);
  const largeArc = pct > 0.5 ? 1 : 0;

  const bgPath = `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;
  const fgPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${xA} ${yA}`;

  const color = score >= 7 ? GREEN : score >= 5 ? AMBER : RED;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        <path d={bgPath} fill="none" stroke="#e5e7eb" strokeWidth={stroke} strokeLinecap="round" />
        <path d={fgPath} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size * 0.22} fontWeight="800" fill={NAVY}>
          {fmtDec(score)}
        </text>
        <text x={cx} y={cy + size * 0.12} textAnchor="middle" fontSize={size * 0.09} fill="#94a3b8">
          /10
        </text>
      </svg>
      <p className="text-xs font-semibold text-text-muted mt-1">{label}</p>
    </div>
  );
}

// ── Score breakdown mini bars ──

function MiniBreakdown({ items }: { items: { label: string; value: number; hint: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 py-2">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs text-text-muted">{item.label}</span>
            <span className={`text-xs font-bold ${scoreColor(item.value)}`}>{fmtDec(item.value)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${scoreBgClass(item.value)}`} style={{ width: `${item.value * 10}%` }} />
          </div>
          <p className="text-[10px] text-text-light mt-0.5">{item.hint}</p>
        </div>
      ))}
    </div>
  );
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
  const [showGuide, setShowGuide] = useState(false);

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
        title="Evaluer la qualite"
        description="Analysez la solidite et le potentiel de chaque titre de votre portefeuille modele"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {/* Guide card */}
      <div
        className="mb-5 rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-4 cursor-pointer"
        onClick={() => setShowGuide(!showGuide)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-100">
              <HelpCircle className="h-4 w-4 text-cyan-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-main">Comment lire les resultats?</p>
              <p className="text-xs text-text-muted">Cliquez pour voir le guide rapide</p>
            </div>
          </div>
          {showGuide ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </div>

        {showGuide && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-text-muted">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-text-main">Score de Securite (0-10)</p>
                  <p>Mesure la solidite du titre : stabilite du prix, faible volatilite, dividendes reguliers, benefices positifs et valorisation raisonnable.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-text-main">Score de Potentiel (0-10)</p>
                  <p>Mesure la marge de hausse : ecart avec la cible des analystes, sous-evaluation potentielle, croissance des benefices et rendement total estime.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-text-main mb-1">Les 4 categories :</p>
              {(['star', 'safe', 'growth', 'watch'] as const).map(q => {
                const cfg = QUADRANT_CONFIG[q];
                const Icon = cfg.icon;
                return (
                  <div key={q} className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                    <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-xs">— {cfg.desc.split('.')[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Profile selector */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-main mb-1">Profil d&apos;investissement</label>
            <select
              value={selectedProfileId}
              onChange={(e) => { setSelectedProfileId(e.target.value); setData(null); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            >
              <option value="">-- Selectionnez un profil --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.profile_number}. {p.name} ({p.equity_pct}/{p.bond_pct})
                </option>
              ))}
            </select>
          </div>
          <Button size="lg" loading={loading} onClick={handleRun} icon={<Target className="h-4 w-4" />}>
            Lancer l&apos;analyse
          </Button>
        </div>
      </Card>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted mt-4 animate-pulse">Analyse des fondamentaux Yahoo Finance en cours...</p>
        </div>
      )}

      {!data && !loading && (
        <div className="text-center py-16 text-text-muted">
          <Gauge className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Selectionnez un profil et cliquez sur <strong>Lancer l&apos;analyse</strong> pour voir les scores.</p>
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
  const verdict = compositeVerdict(composite);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);

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

  const quadDist = [
    { name: 'Etoile', count: data.quadrantDistribution.star, color: GREEN },
    { name: 'Sur', count: data.quadrantDistribution.safe, color: '#3b82f6' },
    { name: 'Croissance', count: data.quadrantDistribution.growth, color: BRAND },
    { name: 'Veille', count: data.quadrantDistribution.watch, color: RED },
  ].filter(d => d.count > 0);

  const stockBarData = data.stocks.slice(0, 25).map(s => ({
    name: s.symbol,
    safety: s.safety.total,
    upside: s.upside.total,
  }));

  return (
    <div className="space-y-6">

      {/* ── Hero banner with 3 gauges + verdict ── */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              Profil {data.profileNumber} — {data.profileName}
            </h2>
            <p className="text-sm text-text-muted">{data.nbStocks} titres analyses</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm">
            <p className="text-xs text-text-muted text-center mb-0.5">Verdict</p>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>{verdict.text}</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 md:gap-16 mt-4">
          <ScoreGauge score={ps.safety} label="Securite" size={110} />
          <ScoreGauge score={composite} label="Score global" size={140} />
          <ScoreGauge score={ps.upside} label="Potentiel" size={110} />
        </div>
      </div>

      {/* ── Quadrant cards with descriptions ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['star', 'safe', 'growth', 'watch'] as const).map(q => {
          const cfg = QUADRANT_CONFIG[q];
          const Icon = cfg.icon;
          const stocks = data.stocks.filter(s => s.quadrant === q);
          return (
            <div key={q} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border} transition-all hover:shadow-md`}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                  <Icon className={`h-4 w-4 ${cfg.text}`} />
                </div>
                <span className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</span>
                <span className={`ml-auto text-xl font-bold ${cfg.text}`}>{stocks.length}</span>
              </div>
              <p className="text-[11px] text-text-muted leading-snug mb-2">{cfg.desc}</p>
              <div className="flex flex-wrap gap-1">
                {stocks.length > 0 ? stocks.map(s => (
                  <span key={s.symbol} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                    {s.symbol}
                  </span>
                )) : (
                  <span className="text-xs text-text-light italic">Aucun</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Score details + Radar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-4 w-4 text-cyan-500" />
            <h3 className="text-sm font-semibold text-text-main">Detail des scores du portefeuille</h3>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Securite
              </p>
              {[
                { label: 'Score global', value: ps.safety, hint: 'Moyenne ponderee de tous les criteres' },
                { label: 'Position 52 sem.', value: wAvg(s => s.safety.week52Position), hint: 'Proche du low = meilleure opportunite' },
                { label: 'Beta (volatilite)', value: wAvg(s => s.safety.betaScore), hint: 'Beta bas = moins volatile = plus sur' },
                { label: 'Dividendes', value: wAvg(s => s.safety.dividendScore), hint: 'Revenu regulier = coussin' },
                { label: 'PE vs secteur', value: wAvg(s => s.safety.peReasonableness), hint: 'PE bas vs benchmark = sous-evalue' },
                { label: 'Benefices (BPA)', value: wAvg(s => s.safety.epsStability), hint: 'Benefices positifs = fondamentaux solides' },
              ].map(item => (
                <div key={item.label} className="mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">{item.label}</span>
                    <span className={`text-xs font-bold ${scoreColor(item.value)}`}>{fmtDec(item.value)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                    <div className="h-full rounded-full" style={{ width: `${item.value * 10}%`, backgroundColor: scoreBarColor(item.value, 'safety') }} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Potentiel
              </p>
              {[
                { label: 'Score global', value: ps.upside, hint: 'Moyenne ponderee de tous les criteres' },
                { label: 'Cible analystes (30%)', value: wAvg(s => s.upside.analystUpside), hint: 'Ecart prix actuel vs cible 12 mois' },
                { label: 'Marge 52 sem. (15%)', value: wAvg(s => s.upside.week52Room), hint: 'Proche du low = plus de marge' },
                { label: 'Valorisation DCF (20%)', value: wAvg(s => s.upside.valuationUpside), hint: 'Sous-evalue selon les modeles internes' },
                { label: 'PE vs secteur (15%)', value: wAvg(s => s.upside.peSectorGap), hint: 'PE bas = potentiel d\'expansion du multiple' },
                { label: 'Croissance BPA (20%)', value: wAvg(s => s.upside.epsGrowth), hint: 'Benefices en croissance = moteur de hausse' },
              ].map(item => (
                <div key={item.label} className="mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">{item.label}</span>
                    <span className={`text-xs font-bold ${scoreColor(item.value)}`}>{fmtDec(item.value)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                    <div className="h-full rounded-full" style={{ width: `${item.value * 10}%`, backgroundColor: scoreBarColor(item.value, 'upside') }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-2 text-center">Vue radar du portefeuille</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#586e82' }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10, fill: '#a0aec0' }} />
              <Radar name="Score" dataKey="score" stroke={BRAND} fill={BRAND} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-text-light text-center mt-1">Plus la zone est large, meilleur est le portefeuille sur cette dimension</p>
        </Card>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Repartition par categorie</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={quadDist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#586e82' }} />
              <YAxis tick={{ fontSize: 11, fill: '#586e82' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Titres" radius={[6, 6, 0, 0]}>
                {quadDist.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-1">Comparaison titre par titre</h3>
          <p className="text-xs text-text-muted mb-3">Vert = securite, Cyan = potentiel de gains</p>
          <ResponsiveContainer width="100%" height={Math.max(180, stockBarData.length * 22)}>
            <BarChart data={stockBarData} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#586e82' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#586e82' }} width={45} />
              <Tooltip contentStyle={tooltipStyle} // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [fmtDec(Number(value)), name === 'safety' ? 'Securite' : 'Potentiel']} />
              <Bar dataKey="safety" name="Securite" fill={GREEN} radius={[0, 4, 4, 0]} barSize={8} />
              <Bar dataKey="upside" name="Potentiel" fill={BRAND} radius={[0, 4, 4, 0]} barSize={8} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Table with expandable rows ── */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-main">Classement des titres</h3>
          <p className="text-xs text-text-muted">Cliquez sur un titre pour voir le detail des scores</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-2.5 w-8">#</th>
                <th className="px-3 py-2.5">Titre</th>
                <th className="px-3 py-2.5 text-center">
                  <span className="flex items-center justify-center gap-1">
                    <Shield className="h-3 w-3 text-emerald-500" /> Securite
                  </span>
                </th>
                <th className="px-3 py-2.5 w-20"></th>
                <th className="px-3 py-2.5 text-center">
                  <span className="flex items-center justify-center gap-1">
                    <TrendingUp className="h-3 w-3 text-cyan-500" /> Potentiel
                  </span>
                </th>
                <th className="px-3 py-2.5 w-20"></th>
                <th className="px-3 py-2.5 text-center">Categorie</th>
                <th className="px-3 py-2.5 text-right">Gain est.</th>
                <th className="px-3 py-2.5 text-right">Poids</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s) => {
                const qCfg = QUADRANT_CONFIG[s.quadrant];
                const QIcon = qCfg.icon;
                const isExpanded = expandedStock === s.symbol;

                return (
                  <React.Fragment key={s.symbol}>
                    <tr
                      className={`border-t border-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-gray-50/50'}`}
                      onClick={() => setExpandedStock(isExpanded ? null : s.symbol)}
                    >
                      <td className="px-4 py-3 font-bold" style={{ color: NAVY }}>{s.rank}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-semibold text-text-main">{s.symbol}</span>
                          <span className="text-xs text-text-muted truncate max-w-[140px]">{s.companyName}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className={`text-base font-bold ${scoreColor(s.safety.total)}`}>
                          {s.confidence === 'low' ? 'N/D' : fmtDec(s.safety.total)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {s.confidence !== 'low' && (
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${s.safety.total * 10}%`, backgroundColor: scoreBarColor(s.safety.total, 'safety') }} />
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className={`text-base font-bold ${scoreColor(s.upside.total)}`}>
                          {s.confidence === 'low' ? 'N/D' : fmtDec(s.upside.total)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {s.confidence !== 'low' && (
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${s.upside.total * 10}%`, backgroundColor: scoreBarColor(s.upside.total, 'upside') }} />
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${qCfg.bg} ${qCfg.text}`}>
                          <QIcon className="h-3 w-3" />
                          {qCfg.label}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-right font-mono">
                        {s.targetPrice > 0 ? (
                          <span className={`font-semibold ${s.estimatedGainPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {s.estimatedGainPercent >= 0 ? '+' : ''}{fmtDec(s.estimatedGainPercent)}%
                          </span>
                        ) : <span className="text-text-light">—</span>}
                      </td>

                      <td className="px-3 py-3 text-right text-text-muted font-mono">{fmtDec(s.weight)}%</td>

                      <td className="px-2 py-3 text-text-light">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && s.confidence !== 'low' && (
                      <tr className="bg-slate-50">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                            <div>
                              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <Shield className="h-3 w-3" /> Detail securite — {s.safety.label}
                              </p>
                              <MiniBreakdown items={[
                                { label: 'Position 52 sem. (20%)', value: s.safety.week52Position, hint: 'Proche du low = meilleure opportunite' },
                                { label: 'Beta / volatilite (25%)', value: s.safety.betaScore, hint: 'Beta < 1 = moins volatile = plus sur' },
                                { label: 'Dividendes (20%)', value: s.safety.dividendScore, hint: 'Dividende regulier = coussin de revenu' },
                                { label: 'PE vs secteur (20%)', value: s.safety.peReasonableness, hint: 'PE bas vs benchmark = sous-evalue' },
                                { label: 'Benefices (15%)', value: s.safety.epsStability, hint: 'BPA positif = fondamentaux solides' },
                              ]} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> Detail potentiel — {s.upside.label}
                              </p>
                              <MiniBreakdown items={[
                                { label: 'Cible analystes (30%)', value: s.upside.analystUpside, hint: 'Ecart prix vs consensus 12 mois' },
                                { label: 'Marge 52 semaines (15%)', value: s.upside.week52Room, hint: 'Loin du sommet = marge de hausse' },
                                { label: 'Valorisation DCF (20%)', value: s.upside.valuationUpside, hint: 'Sous-evalue selon modeles internes' },
                                { label: 'PE vs secteur (15%)', value: s.upside.peSectorGap, hint: 'PE bas = expansion du multiple' },
                                { label: 'Croissance BPA (20%)', value: s.upside.epsGrowth, hint: 'Croissance des benefices = moteur' },
                              ]} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-text-light">
        Donnees en temps reel de Yahoo Finance. Les scores sont indicatifs et ne constituent pas un conseil d&apos;investissement.
      </p>
    </div>
  );
}

// Need React import for Fragment
import React from 'react';

'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
  SlidersHorizontal, RotateCcw,
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

interface SafetyWeights {
  week52: number;
  beta: number;
  dividend: number;
  pe: number;
  eps: number;
}

interface UpsideWeights {
  analyst: number;
  week52: number;
  dcf: number;
  peSector: number;
  epsGrowth: number;
}

const DEFAULT_SAFETY_WEIGHTS: SafetyWeights = { week52: 20, beta: 25, dividend: 20, pe: 20, eps: 15 };
const DEFAULT_UPSIDE_WEIGHTS: UpsideWeights = { analyst: 30, week52: 15, dcf: 20, peSector: 15, epsGrowth: 20 };

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

// ── Legend Data ──

const SAFETY_FACTORS = [
  {
    key: 'beta' as const,
    label: 'Beta (volatilite)',
    color: '#3b82f6',
    tiers: [
      { condition: 'Beta < 0.5', score: '8+', color: GREEN },
      { condition: 'Beta = 1.0', score: '6.5', color: BRAND },
      { condition: 'Beta > 2.0', score: '3 ou moins', color: RED },
    ],
    summary: 'Moins volatile = plus sur',
  },
  {
    key: 'week52' as const,
    label: 'Position 52 semaines',
    color: '#10b981',
    tiers: [
      { condition: 'Pres du 52w low', score: '9-10', color: GREEN },
      { condition: 'Milieu du range', score: '6-7', color: AMBER },
      { condition: 'Pres du 52w high', score: '3-4', color: RED },
    ],
    summary: 'Pres du bas annuel = meilleur prix d\'achat',
  },
  {
    key: 'dividend' as const,
    label: 'Dividendes',
    color: '#8b5cf6',
    tiers: [
      { condition: 'Rendement 3-5%', score: '9', color: GREEN },
      { condition: 'Rendement 1.5-3%', score: '7', color: BRAND },
      { condition: '< 1.5%', score: '6.5', color: AMBER },
      { condition: 'Aucun', score: '5', color: '#94a3b8' },
      { condition: '> 8% (piege)', score: '3', color: RED },
    ],
    summary: 'Dividende regulier = coussin de revenu',
  },
  {
    key: 'pe' as const,
    label: 'PE vs secteur',
    color: '#f59e0b',
    tiers: [
      { condition: 'PE 0.5-1.0x bench', score: '9', color: GREEN },
      { condition: 'PE 1.0-1.3x bench', score: '7', color: BRAND },
      { condition: 'PE > 1.8x bench', score: '2', color: RED },
    ],
    summary: 'PE sous le benchmark = sous-evalue',
  },
  {
    key: 'eps' as const,
    label: 'Benefices (BPA)',
    color: '#ec4899',
    tiers: [
      { condition: 'BPA positif', score: '8', color: GREEN },
      { condition: 'Breakeven', score: '4', color: AMBER },
      { condition: 'BPA negatif', score: '1', color: RED },
    ],
    summary: 'Benefices positifs = fondamentaux solides',
  },
];

const UPSIDE_FACTORS = [
  {
    key: 'analyst' as const,
    label: 'Cible analystes',
    color: '#06b6d4',
    tiers: [
      { condition: 'Upside > 25%', score: '8.5-10', color: GREEN },
      { condition: 'Upside 5-15%', score: '6.5-7', color: BRAND },
      { condition: 'Upside 0%', score: '3', color: RED },
      { condition: 'Downside > 10%', score: '1', color: RED },
    ],
    summary: 'Ecart entre le prix et la cible 12 mois',
  },
  {
    key: 'dcf' as const,
    label: 'Valorisation DCF',
    color: '#8b5cf6',
    tiers: [
      { condition: 'Sous-evalue > 30%', score: '8-10', color: GREEN },
      { condition: 'Sous-evalue 5-15%', score: '5.5-7', color: BRAND },
      { condition: 'Surevalue', score: '1-2.5', color: RED },
    ],
    summary: 'Valeur intrinseque vs prix du marche',
  },
  {
    key: 'epsGrowth' as const,
    label: 'Croissance BPA',
    color: '#ec4899',
    tiers: [
      { condition: 'Croissance > 20%', score: '8-10', color: GREEN },
      { condition: 'Croissance 5-10%', score: '6-7', color: BRAND },
      { condition: 'Negative', score: '2', color: RED },
    ],
    summary: 'Benefices en croissance = moteur de hausse',
  },
  {
    key: 'week52' as const,
    label: 'Marge 52 semaines',
    color: '#10b981',
    tiers: [
      { condition: 'Pres du 52w low', score: '9-10', color: GREEN },
      { condition: 'Milieu du range', score: '6-7', color: AMBER },
      { condition: 'Pres du 52w high', score: '3-4', color: RED },
    ],
    summary: 'Loin du sommet = marge de hausse',
  },
  {
    key: 'peSector' as const,
    label: 'PE vs secteur',
    color: '#f59e0b',
    tiers: [
      { condition: 'PE < 50% bench', score: '9', color: GREEN },
      { condition: 'PE < bench', score: '6.5-8', color: BRAND },
      { condition: 'PE > 1.2x bench', score: '2', color: RED },
    ],
    summary: 'PE bas = potentiel d\'expansion du multiple',
  },
];

const SCORE_SCALE = [
  { min: 8, max: 10, label: 'Excellent', color: GREEN, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { min: 6, max: 8, label: 'Bon', color: BRAND, bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  { min: 4, max: 6, label: 'Modere', color: AMBER, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { min: 2, max: 4, label: 'Risque', color: '#f97316', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  { min: 0, max: 2, label: 'Tres faible', color: RED, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
];

// ── Utilities ──

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

function compositeVerdict(score: number): { text: string } {
  if (score >= 8) return { text: 'Excellent equilibre securite/potentiel' };
  if (score >= 6.5) return { text: 'Bon portefeuille, bien positionne' };
  if (score >= 5) return { text: 'Portefeuille correct, quelques points a ameliorer' };
  if (score >= 3.5) return { text: 'Attention — plusieurs titres a revoir' };
  return { text: 'Portefeuille fragile — revision recommandee' };
}

function weightsAreDefault(sw: SafetyWeights, uw: UpsideWeights): boolean {
  return JSON.stringify(sw) === JSON.stringify(DEFAULT_SAFETY_WEIGHTS) &&
    JSON.stringify(uw) === JSON.stringify(DEFAULT_UPSIDE_WEIGHTS);
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

// ── Scoring Legend ──

function ScoringLegend({ safetyWeights, upsideWeights }: { safetyWeights: SafetyWeights; upsideWeights: UpsideWeights }) {
  const [expanded, setExpanded] = useState(false);

  const safetyTotal = Object.values(safetyWeights).reduce((a, b) => a + b, 0);
  const upsideTotal = Object.values(upsideWeights).reduce((a, b) => a + b, 0);

  const getSafetyPct = (key: keyof SafetyWeights) => safetyTotal > 0 ? Math.round(safetyWeights[key] / safetyTotal * 100) : 0;
  const getUpsidePct = (key: keyof UpsideWeights) => upsideTotal > 0 ? Math.round(upsideWeights[key] / upsideTotal * 100) : 0;

  return (
    <div className="mb-5 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Header + Scale — always visible */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-100 to-emerald-100">
              <Info className="h-4 w-4 text-cyan-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-main">Bareme des scores — comment sont attribues les points</h3>
              <p className="text-xs text-text-muted">Chaque titre est note sur 10 pour sa securite et son potentiel</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </div>

        {/* Color scale — always visible */}
        <div className="flex gap-1.5">
          {SCORE_SCALE.map(s => (
            <div key={s.label} className={`flex-1 rounded-lg px-2 py-1.5 ${s.bg} border ${s.border} text-center`}>
              <p className={`text-xs font-bold ${s.text}`}>{s.min}-{s.max}</p>
              <p className={`text-[10px] ${s.text} opacity-80`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          {/* Quadrant explanation */}
          <div className="mb-4 p-3 rounded-xl bg-gray-50">
            <p className="text-xs font-semibold text-text-main mb-2">Les 4 categories :</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {(['star', 'safe', 'growth', 'watch'] as const).map(q => {
                const cfg = QUADRANT_CONFIG[q];
                const Icon = cfg.icon;
                return (
                  <div key={q} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.text} shrink-0`} />
                    <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Safety factors */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-emerald-700">Score de Securite</h4>
              </div>
              <div className="space-y-3">
                {SAFETY_FACTORS.map(f => {
                  const pct = getSafetyPct(f.key);
                  return (
                    <div key={f.key} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-text-main">{f.label}</span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${f.color}15`, color: f.color }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted mb-2">{f.summary}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {f.tiers.map((t, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
                            style={{ borderColor: `${t.color}40`, backgroundColor: `${t.color}10`, color: t.color }}
                          >
                            {t.condition} = <strong>{t.score} pts</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upside factors */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-cyan-600" />
                <h4 className="text-sm font-bold text-cyan-700">Score de Potentiel</h4>
              </div>
              <div className="space-y-3">
                {UPSIDE_FACTORS.map(f => {
                  const pct = getUpsidePct(f.key);
                  return (
                    <div key={f.key} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-text-main">{f.label}</span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${f.color}15`, color: f.color }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted mb-2">{f.summary}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {f.tiers.map((t, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
                            style={{ borderColor: `${t.color}40`, backgroundColor: `${t.color}10`, color: t.color }}
                          >
                            {t.condition} = <strong>{t.score} pts</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Weight Slider (Duolingo-style) ──

function WeightSlider({
  label, value, onChange, color,
}: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  const pct = Math.min(value * 2, 100); // 50 max → 100% visual
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xs text-text-main font-medium w-40 shrink-0">{label}</span>
      <div className="flex-1 relative h-3 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        <input
          type="range"
          min={0}
          max={50}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <span
        className="text-xs font-bold w-12 text-center rounded-full py-1"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {value}%
      </span>
    </div>
  );
}

// ── Weight Customizer Panel ──

function WeightCustomizer({
  safetyWeights, upsideWeights,
  onSafetyChange, onUpsideChange, onReset,
}: {
  safetyWeights: SafetyWeights;
  upsideWeights: UpsideWeights;
  onSafetyChange: (key: keyof SafetyWeights, value: number) => void;
  onUpsideChange: (key: keyof UpsideWeights, value: number) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDefault = weightsAreDefault(safetyWeights, upsideWeights);

  const safetySum = Object.values(safetyWeights).reduce((a, b) => a + b, 0);
  const upsideSum = Object.values(upsideWeights).reduce((a, b) => a + b, 0);

  return (
    <div className="mb-5 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-violet-100 to-pink-100">
              <SlidersHorizontal className="h-4 w-4 text-violet-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">
                Personnaliser les criteres
                {!isDefault && <span className="ml-2 text-xs font-normal text-violet-500">(modifie)</span>}
              </p>
              <p className="text-xs text-text-muted">Ajustez l&apos;importance de chaque facteur selon votre vision</p>
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Safety weights */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-bold text-emerald-700">Securite</h4>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${safetySum === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  Total : {safetySum}%
                </span>
              </div>
              <WeightSlider label="Beta (volatilite)" value={safetyWeights.beta} onChange={v => onSafetyChange('beta', v)} color="#3b82f6" />
              <WeightSlider label="Position 52 semaines" value={safetyWeights.week52} onChange={v => onSafetyChange('week52', v)} color="#10b981" />
              <WeightSlider label="Dividendes" value={safetyWeights.dividend} onChange={v => onSafetyChange('dividend', v)} color="#8b5cf6" />
              <WeightSlider label="PE vs secteur" value={safetyWeights.pe} onChange={v => onSafetyChange('pe', v)} color="#f59e0b" />
              <WeightSlider label="Benefices (BPA)" value={safetyWeights.eps} onChange={v => onSafetyChange('eps', v)} color="#ec4899" />
              {safetySum !== 100 && (
                <p className="text-[10px] text-amber-600 mt-1">Les poids seront normalises automatiquement ({safetySum}% → 100%)</p>
              )}
            </div>

            {/* Upside weights */}
            <div className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-600" />
                  <h4 className="text-sm font-bold text-cyan-700">Potentiel</h4>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${upsideSum === 100 ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'}`}>
                  Total : {upsideSum}%
                </span>
              </div>
              <WeightSlider label="Cible analystes" value={upsideWeights.analyst} onChange={v => onUpsideChange('analyst', v)} color="#06b6d4" />
              <WeightSlider label="Valorisation DCF" value={upsideWeights.dcf} onChange={v => onUpsideChange('dcf', v)} color="#8b5cf6" />
              <WeightSlider label="Croissance BPA" value={upsideWeights.epsGrowth} onChange={v => onUpsideChange('epsGrowth', v)} color="#ec4899" />
              <WeightSlider label="Marge 52 semaines" value={upsideWeights.week52} onChange={v => onUpsideChange('week52', v)} color="#10b981" />
              <WeightSlider label="PE vs secteur" value={upsideWeights.peSector} onChange={v => onUpsideChange('peSector', v)} color="#f59e0b" />
              {upsideSum !== 100 && (
                <p className="text-[10px] text-amber-600 mt-1">Les poids seront normalises automatiquement ({upsideSum}% → 100%)</p>
              )}
            </div>
          </div>

          {/* Reset button */}
          {!isDefault && (
            <div className="flex justify-center mt-4">
              <button
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-text-muted hover:bg-gray-50 hover:text-text-main transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reinitialiser les poids par defaut
              </button>
            </div>
          )}

          <p className="text-[10px] text-text-light text-center mt-3">
            Les poids personnalises sont sauvegardes automatiquement dans votre navigateur.
            Relancez l&apos;analyse apres modification pour voir les nouveaux scores.
          </p>
        </div>
      )}
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

  // Custom weights state
  const [safetyWeights, setSafetyWeights] = useState<SafetyWeights>({ ...DEFAULT_SAFETY_WEIGHTS });
  const [upsideWeights, setUpsideWeights] = useState<UpsideWeights>({ ...DEFAULT_UPSIDE_WEIGHTS });
  const [usedWeights, setUsedWeights] = useState<{ safety: SafetyWeights; upside: UpsideWeights } | null>(null);
  const [weightsLoaded, setWeightsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scoring-weights');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.safety) setSafetyWeights(w => ({ ...w, ...parsed.safety }));
        if (parsed.upside) setUpsideWeights(w => ({ ...w, ...parsed.upside }));
      }
    } catch { /* ignore */ }
    setWeightsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!weightsLoaded) return;
    localStorage.setItem('scoring-weights', JSON.stringify({ safety: safetyWeights, upside: upsideWeights }));
  }, [safetyWeights, upsideWeights, weightsLoaded]);

  const handleSafetyChange = useCallback((key: keyof SafetyWeights, value: number) => {
    setSafetyWeights(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleUpsideChange = useCallback((key: keyof UpsideWeights, value: number) => {
    setUpsideWeights(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setSafetyWeights({ ...DEFAULT_SAFETY_WEIGHTS });
    setUpsideWeights({ ...DEFAULT_UPSIDE_WEIGHTS });
  }, []);

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
        body: JSON.stringify({
          profile_id: selectedProfileId,
          weights: { safety: safetyWeights, upside: upsideWeights },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setData(await res.json());
      setUsedWeights({ safety: { ...safetyWeights }, upside: { ...upsideWeights } });
      toast('success', 'Scoring termine');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [selectedProfileId, safetyWeights, upsideWeights, toast]);

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

      {/* Detailed legend */}
      <ScoringLegend safetyWeights={safetyWeights} upsideWeights={upsideWeights} />

      {/* Weight customizer (Duolingo-style) */}
      <WeightCustomizer
        safetyWeights={safetyWeights}
        upsideWeights={upsideWeights}
        onSafetyChange={handleSafetyChange}
        onUpsideChange={handleUpsideChange}
        onReset={handleReset}
      />

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

      {data && !loading && <ScoringView data={data} weights={usedWeights} />}

      <StepNav current={4} />
    </div>
  );
}

// ════════════════════════════════════════
// VUE SCORING
// ════════════════════════════════════════

function ScoringView({ data, weights }: { data: ScoringResult; weights: { safety: SafetyWeights; upside: UpsideWeights } | null }) {
  const ps = data.portfolioScores;
  const composite = Math.round((ps.safety * 0.5 + ps.upside * 0.5) * 10) / 10;
  const verdict = compositeVerdict(composite);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);

  const totalWeight = data.stocks.reduce((s, st) => s + st.weight, 0);
  function wAvg(fn: (s: ScoredStock) => number) {
    if (totalWeight === 0) return 0;
    return Math.round(data.stocks.reduce((s, st) => s + fn(st) * st.weight, 0) / totalWeight * 10) / 10;
  }

  // Compute effective weight percentages
  const sw = weights?.safety ?? DEFAULT_SAFETY_WEIGHTS;
  const uw = weights?.upside ?? DEFAULT_UPSIDE_WEIGHTS;
  const sSum = Object.values(sw).reduce((a, b) => a + b, 0);
  const uSum = Object.values(uw).reduce((a, b) => a + b, 0);
  const sPct = (k: keyof SafetyWeights) => sSum > 0 ? Math.round(sw[k] / sSum * 100) : 0;
  const uPct = (k: keyof UpsideWeights) => uSum > 0 ? Math.round(uw[k] / uSum * 100) : 0;

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
                { label: `Position 52 sem. (${sPct('week52')}%)`, value: wAvg(s => s.safety.week52Position), hint: 'Proche du low = meilleure opportunite' },
                { label: `Beta / volatilite (${sPct('beta')}%)`, value: wAvg(s => s.safety.betaScore), hint: 'Beta bas = moins volatile = plus sur' },
                { label: `Dividendes (${sPct('dividend')}%)`, value: wAvg(s => s.safety.dividendScore), hint: 'Revenu regulier = coussin' },
                { label: `PE vs secteur (${sPct('pe')}%)`, value: wAvg(s => s.safety.peReasonableness), hint: 'PE bas vs benchmark = sous-evalue' },
                { label: `Benefices (${sPct('eps')}%)`, value: wAvg(s => s.safety.epsStability), hint: 'Benefices positifs = fondamentaux solides' },
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
                { label: `Cible analystes (${uPct('analyst')}%)`, value: wAvg(s => s.upside.analystUpside), hint: 'Ecart prix actuel vs cible 12 mois' },
                { label: `Marge 52 sem. (${uPct('week52')}%)`, value: wAvg(s => s.upside.week52Room), hint: 'Proche du low = plus de marge' },
                { label: `Valorisation DCF (${uPct('dcf')}%)`, value: wAvg(s => s.upside.valuationUpside), hint: 'Sous-evalue selon les modeles internes' },
                { label: `PE vs secteur (${uPct('peSector')}%)`, value: wAvg(s => s.upside.peSectorGap), hint: 'PE bas = potentiel d\'expansion du multiple' },
                { label: `Croissance BPA (${uPct('epsGrowth')}%)`, value: wAvg(s => s.upside.epsGrowth), hint: 'Benefices en croissance = moteur de hausse' },
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
                                { label: `Position 52 sem. (${sPct('week52')}%)`, value: s.safety.week52Position, hint: 'Proche du low = meilleure opportunite' },
                                { label: `Beta / volatilite (${sPct('beta')}%)`, value: s.safety.betaScore, hint: 'Beta < 1 = moins volatile = plus sur' },
                                { label: `Dividendes (${sPct('dividend')}%)`, value: s.safety.dividendScore, hint: 'Dividende regulier = coussin de revenu' },
                                { label: `PE vs secteur (${sPct('pe')}%)`, value: s.safety.peReasonableness, hint: 'PE bas vs benchmark = sous-evalue' },
                                { label: `Benefices (${sPct('eps')}%)`, value: s.safety.epsStability, hint: 'BPA positif = fondamentaux solides' },
                              ]} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> Detail potentiel — {s.upside.label}
                              </p>
                              <MiniBreakdown items={[
                                { label: `Cible analystes (${uPct('analyst')}%)`, value: s.upside.analystUpside, hint: 'Ecart prix vs consensus 12 mois' },
                                { label: `Marge 52 semaines (${uPct('week52')}%)`, value: s.upside.week52Room, hint: 'Loin du sommet = marge de hausse' },
                                { label: `Valorisation DCF (${uPct('dcf')}%)`, value: s.upside.valuationUpside, hint: 'Sous-evalue selon modeles internes' },
                                { label: `PE vs secteur (${uPct('peSector')}%)`, value: s.upside.peSectorGap, hint: 'PE bas = expansion du multiple' },
                                { label: `Croissance BPA (${uPct('epsGrowth')}%)`, value: s.upside.epsGrowth, hint: 'Croissance des benefices = moteur' },
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

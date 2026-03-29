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
  ChevronDown, ChevronUp, Info, Gauge,
  SlidersHorizontal, RotateCcw,
} from 'lucide-react';

// ── Types ──

interface SafetyBreakdown {
  balanceSheetScore: number;
  betaScore: number;
  profitabilityScore: number;
  valuationScore: number;
  sizeScore: number;
  dividendScore: number;
  total: number;
  label: string;
  color: string;
  redFlag: string | null;
}

interface UpsideBreakdown {
  businessGrowth: number;
  analystTarget: number;
  valuationDiscount: number;
  fcfYield: number;
  totalReturn: number;
  capitalEfficiency: number;
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
  balanceSheet: number;
  beta: number;
  profitability: number;
  valuation: number;
  size: number;
  dividend: number;
}

interface UpsideWeights {
  businessGrowth: number;
  analystTarget: number;
  valuationDiscount: number;
  fcfYield: number;
  totalReturn: number;
  capitalEfficiency: number;
}

const DEFAULT_SAFETY_WEIGHTS: SafetyWeights = { balanceSheet: 25, beta: 20, profitability: 20, valuation: 15, size: 10, dividend: 10 };
const DEFAULT_UPSIDE_WEIGHTS: UpsideWeights = { businessGrowth: 20, analystTarget: 20, valuationDiscount: 20, fcfYield: 15, totalReturn: 15, capitalEfficiency: 10 };
const ZERO_SAFETY_ADJ: SafetyWeights = { balanceSheet: 0, beta: 0, profitability: 0, valuation: 0, size: 0, dividend: 0 };
const ZERO_UPSIDE_ADJ: UpsideWeights = { businessGrowth: 0, analystTarget: 0, valuationDiscount: 0, fcfYield: 0, totalReturn: 0, capitalEfficiency: 0 };

// ── Constantes ──

const BRAND = '#00b4d8';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const NAVY = '#03045e';

const QUADRANT_CONFIG = {
  star: {
    label: 'Etoile', icon: Star,
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', color: GREEN,
    desc: 'Titres a la fois solides et prometteurs. Le meilleur des deux mondes.',
  },
  safe: {
    label: 'Sur', icon: Shield,
    bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', color: '#3b82f6',
    desc: 'Titres defensifs et stables, mais avec un potentiel de hausse plus limite.',
  },
  growth: {
    label: 'Croissance', icon: TrendingUp,
    bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', color: BRAND,
    desc: 'Fort potentiel de gains, mais avec plus de risque. Titres agressifs.',
  },
  watch: {
    label: 'Veille', icon: Eye,
    bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', color: RED,
    desc: 'Titres a surveiller de pres. Securite et potentiel en dessous de la moyenne.',
  },
};

const tooltipStyle = { borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 };

// ── Legend Data (baseScore = numeric for adjustment) ──

interface LegendTier { condition: string; baseScore: number }

interface LegendFactor {
  key: string;
  label: string;
  color: string;
  tiers: LegendTier[];
  summary: string;
}

const SAFETY_FACTORS: LegendFactor[] = [
  { key: 'balanceSheet', label: 'Sante financiere', color: '#ef4444', summary: 'Est-ce que l\'entreprise a trop de dettes? A-t-elle assez de liquidites pour payer ses factures? Les banques sont evaluees separement.',
    tiers: [{ condition: 'Peu de dettes', baseScore: 9.5 }, { condition: 'Dettes moderees', baseScore: 7.5 }, { condition: 'Niveau moyen', baseScore: 6 }, { condition: 'Tres endettee', baseScore: 3.5 }, { condition: 'Endettement critique', baseScore: 1 }] },
  { key: 'beta', label: 'Stabilite du prix', color: '#3b82f6', summary: 'A quel point le titre bouge quand le marche fluctue? Combine la sensibilite au marche et les variations de prix des 12 derniers mois.',
    tiers: [{ condition: 'Tres stable', baseScore: 9.5 }, { condition: 'Plutot stable', baseScore: 7.5 }, { condition: 'Comme le marche', baseScore: 5.5 }, { condition: 'Assez volatile', baseScore: 3 }, { condition: 'Tres volatile', baseScore: 0.5 }] },
  { key: 'profitability', label: 'Rentabilite', color: '#ec4899', summary: 'L\'entreprise fait-elle de bons profits? Ses benefices sont-ils en croissance? Si elle perd de l\'argent, le score est automatiquement limite.',
    tiers: [{ condition: 'Profits eleves', baseScore: 9.5 }, { condition: 'Bons profits', baseScore: 8 }, { condition: 'Profits corrects', baseScore: 6 }, { condition: 'Profits faibles', baseScore: 3.5 }, { condition: 'Perd de l\'argent', baseScore: 3 }] },
  { key: 'valuation', label: 'Le titre est-il cher?', color: '#f59e0b', summary: 'Compare le prix de l\'action a ses benefices. Si l\'entreprise croit vite, un prix plus eleve est justifie. Un prix tres bas peut etre suspect.',
    tiers: [{ condition: 'Aubaine', baseScore: 9 }, { condition: 'Prix raisonnable', baseScore: 8.5 }, { condition: 'Cher mais justifie', baseScore: 8 }, { condition: 'Assez cher', baseScore: 4.5 }, { condition: 'Tres speculatif', baseScore: 2 }] },
  { key: 'size', label: 'Taille de l\'entreprise', color: '#06b6d4', summary: 'Les grandes entreprises sont generalement plus stables, mieux diversifiees et plus faciles a vendre en cas de besoin.',
    tiers: [{ condition: 'Geante (> 200G$)', baseScore: 9.5 }, { condition: 'Tres grande', baseScore: 8.5 }, { condition: 'Grande', baseScore: 7 }, { condition: 'Moyenne', baseScore: 4.5 }, { condition: 'Petite (< 500M$)', baseScore: 2 }] },
  { key: 'dividend', label: 'Revenu de dividende', color: '#8b5cf6', summary: 'Un dividende regulier donne un coussin de revenu. Pas de dividende = neutre. Un rendement trop eleve peut signaler un probleme.',
    tiers: [{ condition: 'Ideal (2-4%)', baseScore: 9.5 }, { condition: 'Correct (1-2%)', baseScore: 7 }, { condition: 'Aucun dividende', baseScore: 5 }, { condition: 'Eleve (attention)', baseScore: 4 }, { condition: 'Signal d\'alarme', baseScore: 2 }] },
];

const UPSIDE_FACTORS: LegendFactor[] = [
  { key: 'businessGrowth', label: 'Croissance de l\'entreprise', color: '#ec4899', summary: 'Les revenus et les profits augmentent-ils? C\'est le moteur fondamental. Les revenus sont durs a manipuler — si les ventes montent, le business grossit vraiment.',
    tiers: [{ condition: 'Forte croissance', baseScore: 9 }, { condition: 'Bonne croissance', baseScore: 7.5 }, { condition: 'Stagnation', baseScore: 4.5 }, { condition: 'En baisse', baseScore: 2 }] },
  { key: 'analystTarget', label: 'Cible des analystes', color: '#06b6d4', summary: 'Ou les analystes de Bay Street / Wall Street pensent que le titre sera dans 12 mois? Plus la cible est haute vs le prix actuel, plus le potentiel est grand.',
    tiers: [{ condition: 'Fort potentiel (> 15%)', baseScore: 7.5 }, { condition: 'Potentiel correct (5-15%)', baseScore: 6 }, { condition: 'Au prix cible', baseScore: 4.5 }, { condition: 'Baisse attendue', baseScore: 2 }] },
  { key: 'valuationDiscount', label: 'Le titre est-il sous-evalue?', color: '#8b5cf6', summary: 'Combine notre calcul de valeur reelle (DCF) et les previsions de benefices (PE forward). Si les benefices sont prevus en hausse, le titre devient moins cher.',
    tiers: [{ condition: 'Tres sous-evalue', baseScore: 9 }, { condition: 'Sous-evalue', baseScore: 7 }, { condition: 'A sa juste valeur', baseScore: 4 }, { condition: 'Surevalue', baseScore: 2 }] },
  { key: 'fcfYield', label: 'Rendement en cash (FCF)', color: '#10b981', summary: 'Combien de vrai cash l\'entreprise genere par rapport a sa valeur en bourse. C\'est la mesure preferee de Warren Buffett — le cash ne ment pas.',
    tiers: [{ condition: 'FCF Yield > 6%', baseScore: 8 }, { condition: 'FCF Yield 3-6%', baseScore: 6.5 }, { condition: 'FCF Yield < 2%', baseScore: 5 }, { condition: 'Brule du cash', baseScore: 2 }] },
  { key: 'totalReturn', label: 'Revenu de dividende', color: '#f59e0b', summary: 'Quel revenu passif le titre genere-t-il? Un bon dividende donne un rendement stable, meme si le prix ne bouge pas. Attention: un rendement trop eleve peut cacher un probleme.',
    tiers: [{ condition: 'Dividende 3-5%', baseScore: 8.5 }, { condition: 'Dividende 1-3%', baseScore: 7 }, { condition: 'Aucun dividende', baseScore: 5 }, { condition: 'Rendement > 9% (suspect)', baseScore: 5 }] },
  { key: 'capitalEfficiency', label: 'Efficacite du capital (ROE)', color: '#ef4444', summary: 'Pour chaque dollar investi par les actionnaires, combien l\'entreprise genere de profit? Un ROE eleve = une machine a creer de la valeur.',
    tiers: [{ condition: 'ROE > 20%', baseScore: 8 }, { condition: 'ROE 10-20%', baseScore: 6.5 }, { condition: 'ROE < 5%', baseScore: 4 }, { condition: 'ROE negatif', baseScore: 2 }] },
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

function clampScore(v: number): number {
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

function tierColor(score: number): string {
  if (score >= 7) return GREEN;
  if (score >= 5) return AMBER;
  if (score >= 3) return '#f97316';
  return RED;
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

function isAllDefault(sw: SafetyWeights, uw: UpsideWeights, sa: SafetyWeights, ua: UpsideWeights): boolean {
  return JSON.stringify(sw) === JSON.stringify(DEFAULT_SAFETY_WEIGHTS) &&
    JSON.stringify(uw) === JSON.stringify(DEFAULT_UPSIDE_WEIGHTS) &&
    JSON.stringify(sa) === JSON.stringify(ZERO_SAFETY_ADJ) &&
    JSON.stringify(ua) === JSON.stringify(ZERO_UPSIDE_ADJ);
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
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size * 0.22} fontWeight="800" fill={NAVY}>{fmtDec(score)}</text>
        <text x={cx} y={cy + size * 0.12} textAnchor="middle" fontSize={size * 0.09} fill="#94a3b8">/10</text>
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

// ── Exigence Selector (3 level pills: Strict / Normal / Souple) ──

function ExigenceSelector({
  value, onChange, color,
}: {
  value: number; onChange: (v: number) => void; color: string;
}) {
  const levels = [
    { v: -1, label: 'Strict' },
    { v: 0, label: 'Normal' },
    { v: 1, label: 'Souple' },
  ];
  return (
    <div className="inline-flex rounded-full bg-gray-100 p-0.5 shrink-0">
      {levels.map(l => (
        <button
          key={l.v}
          onClick={(e) => { e.stopPropagation(); onChange(l.v); }}
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
            value === l.v ? 'text-white shadow-sm' : 'text-text-muted hover:text-text-main'
          }`}
          style={value === l.v ? { backgroundColor: color } : {}}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

// ── Scoring Legend ──

function ScoringLegend({
  safetyWeights, upsideWeights, safetyAdj, upsideAdj,
}: {
  safetyWeights: SafetyWeights; upsideWeights: UpsideWeights;
  safetyAdj: SafetyWeights; upsideAdj: UpsideWeights;
}) {
  const [expanded, setExpanded] = useState(false);

  const sTotal = Object.values(safetyWeights).reduce((a, b) => a + b, 0);
  const uTotal = Object.values(upsideWeights).reduce((a, b) => a + b, 0);
  const sPct = (k: string) => sTotal > 0 ? Math.round((safetyWeights as unknown as Record<string, number>)[k] / sTotal * 100) : 0;
  const uPct = (k: string) => uTotal > 0 ? Math.round((upsideWeights as unknown as Record<string, number>)[k] / uTotal * 100) : 0;
  const sAdj = (k: string) => (safetyAdj as unknown as Record<string, number>)[k] ?? 0;
  const uAdj = (k: string) => (upsideAdj as unknown as Record<string, number>)[k] ?? 0;

  function renderFactor(f: LegendFactor, pct: number, adj: number) {
    return (
      <div key={f.key} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-text-main">{f.label}</span>
          <div className="flex items-center gap-1.5">
            {adj !== 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${adj > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                {adj > 0 ? `+${adj}` : adj}
              </span>
            )}
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
              {pct}%
            </span>
          </div>
        </div>
        <p className="text-[10px] text-text-muted mb-2">{f.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          {f.tiers.map((t, i) => {
            const adjusted = clampScore(t.baseScore + adj);
            const c = tierColor(adjusted);
            return (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
                style={{ borderColor: `${c}40`, backgroundColor: `${c}10`, color: c }}>
                {t.condition} = <strong>{adjusted} pts</strong>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => setExpanded(!expanded)}>
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
        <div className="flex gap-1.5">
          {SCORE_SCALE.map(s => (
            <div key={s.label} className={`flex-1 rounded-lg px-2 py-1.5 ${s.bg} border ${s.border} text-center`}>
              <p className={`text-xs font-bold ${s.text}`}>{s.min}-{s.max}</p>
              <p className={`text-[10px] ${s.text} opacity-80`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
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
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-emerald-700">Score de Securite</h4>
              </div>
              <div className="space-y-3">
                {SAFETY_FACTORS.map(f => renderFactor(f, sPct(f.key), sAdj(f.key)))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-cyan-600" />
                <h4 className="text-sm font-bold text-cyan-700">Score de Potentiel</h4>
              </div>
              <div className="space-y-3">
                {UPSIDE_FACTORS.map(f => renderFactor(f, uPct(f.key), uAdj(f.key)))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Weight Slider ──

function WeightSlider({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  const pct = Math.min(value * 2, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-200" style={{ width: `${pct}%`, backgroundColor: color }} />
        <input type="range" min={0} max={50} step={5} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <span className="text-xs font-bold w-10 text-center rounded-full py-0.5" style={{ backgroundColor: `${color}15`, color }}>
        {value}%
      </span>
    </div>
  );
}

// ── Weight Customizer Panel ──

function WeightCustomizer({
  safetyWeights, upsideWeights, safetyAdj, upsideAdj,
  onSafetyWeight, onUpsideWeight, onSafetyAdj, onUpsideAdj, onReset,
}: {
  safetyWeights: SafetyWeights; upsideWeights: UpsideWeights;
  safetyAdj: SafetyWeights; upsideAdj: UpsideWeights;
  onSafetyWeight: (key: keyof SafetyWeights, value: number) => void;
  onUpsideWeight: (key: keyof UpsideWeights, value: number) => void;
  onSafetyAdj: (key: keyof SafetyWeights, value: number) => void;
  onUpsideAdj: (key: keyof UpsideWeights, value: number) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDefault = isAllDefault(safetyWeights, upsideWeights, safetyAdj, upsideAdj);

  const safetySum = Object.values(safetyWeights).reduce((a, b) => a + b, 0);
  const upsideSum = Object.values(upsideWeights).reduce((a, b) => a + b, 0);

  interface FactorRow { key: string; label: string; color: string }
  const safetyRows: FactorRow[] = [
    { key: 'balanceSheet', label: 'Sante financiere', color: '#ef4444' },
    { key: 'beta', label: 'Stabilite du prix', color: '#3b82f6' },
    { key: 'profitability', label: 'Rentabilite', color: '#ec4899' },
    { key: 'valuation', label: 'Le titre est-il cher?', color: '#f59e0b' },
    { key: 'size', label: 'Taille de l\'entreprise', color: '#06b6d4' },
    { key: 'dividend', label: 'Revenu de dividende', color: '#8b5cf6' },
  ];

  const upsideRows: FactorRow[] = [
    { key: 'businessGrowth', label: 'Croissance de l\'entreprise', color: '#ec4899' },
    { key: 'analystTarget', label: 'Cible des analystes', color: '#06b6d4' },
    { key: 'valuationDiscount', label: 'Sous-evaluation', color: '#8b5cf6' },
    { key: 'fcfYield', label: 'Cash genere (FCF)', color: '#10b981' },
    { key: 'totalReturn', label: 'Revenu de dividende', color: '#f59e0b' },
    { key: 'capitalEfficiency', label: 'Efficacite du capital', color: '#ef4444' },
  ];

  return (
    <div className="mb-5 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => setOpen(!open)}>
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
              <p className="text-xs text-text-muted">Ajustez les poids et le niveau d&apos;exigence de chaque facteur</p>
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Safety */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-bold text-emerald-700">Securite</h4>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${safetySum === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  Total : {safetySum}%
                </span>
              </div>
              <div className="flex items-center gap-4 mb-3 text-[10px] text-text-light">
                <span className="flex-1">Poids (importance)</span>
                <span>Exigence (bareme)</span>
              </div>
              {safetyRows.map(r => (
                <div key={r.key} className="mb-3">
                  <p className="text-xs font-medium text-text-main mb-1">{r.label}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <WeightSlider
                        label="" value={safetyWeights[r.key as keyof SafetyWeights]}
                        onChange={v => onSafetyWeight(r.key as keyof SafetyWeights, v)} color={r.color}
                      />
                    </div>
                    <ExigenceSelector
                      value={safetyAdj[r.key as keyof SafetyWeights]}
                      onChange={v => onSafetyAdj(r.key as keyof SafetyWeights, v)} color={r.color}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Upside */}
            <div className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-600" />
                  <h4 className="text-sm font-bold text-cyan-700">Potentiel</h4>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${upsideSum === 100 ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'}`}>
                  Total : {upsideSum}%
                </span>
              </div>
              <div className="flex items-center gap-4 mb-3 text-[10px] text-text-light">
                <span className="flex-1">Poids (importance)</span>
                <span>Exigence (bareme)</span>
              </div>
              {upsideRows.map(r => (
                <div key={r.key} className="mb-3">
                  <p className="text-xs font-medium text-text-main mb-1">{r.label}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <WeightSlider
                        label="" value={upsideWeights[r.key as keyof UpsideWeights]}
                        onChange={v => onUpsideWeight(r.key as keyof UpsideWeights, v)} color={r.color}
                      />
                    </div>
                    <ExigenceSelector
                      value={upsideAdj[r.key as keyof UpsideWeights]}
                      onChange={v => onUpsideAdj(r.key as keyof UpsideWeights, v)} color={r.color}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isDefault && (
            <div className="flex justify-center mt-4">
              <button
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-text-muted hover:bg-gray-50 hover:text-text-main transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reinitialiser tout par defaut
              </button>
            </div>
          )}

          <p className="text-[10px] text-text-light text-center mt-3">
            Sauvegardes automatiquement dans votre navigateur. Relancez l&apos;analyse apres modification.
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

  // Custom weights + adjustments
  const [safetyWeights, setSafetyWeights] = useState<SafetyWeights>({ ...DEFAULT_SAFETY_WEIGHTS });
  const [upsideWeights, setUpsideWeights] = useState<UpsideWeights>({ ...DEFAULT_UPSIDE_WEIGHTS });
  const [safetyAdj, setSafetyAdj] = useState<SafetyWeights>({ ...ZERO_SAFETY_ADJ });
  const [upsideAdj, setUpsideAdj] = useState<UpsideWeights>({ ...ZERO_UPSIDE_ADJ });
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
        if (parsed.safetyAdj) setSafetyAdj(w => ({ ...w, ...parsed.safetyAdj }));
        if (parsed.upsideAdj) setUpsideAdj(w => ({ ...w, ...parsed.upsideAdj }));
      }
    } catch { /* ignore */ }
    setWeightsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!weightsLoaded) return;
    localStorage.setItem('scoring-weights', JSON.stringify({
      safety: safetyWeights, upside: upsideWeights,
      safetyAdj, upsideAdj,
    }));
  }, [safetyWeights, upsideWeights, safetyAdj, upsideAdj, weightsLoaded]);

  const handleSafetyWeight = useCallback((k: keyof SafetyWeights, v: number) => setSafetyWeights(p => ({ ...p, [k]: v })), []);
  const handleUpsideWeight = useCallback((k: keyof UpsideWeights, v: number) => setUpsideWeights(p => ({ ...p, [k]: v })), []);
  const handleSafetyAdj = useCallback((k: keyof SafetyWeights, v: number) => setSafetyAdj(p => ({ ...p, [k]: v })), []);
  const handleUpsideAdj = useCallback((k: keyof UpsideWeights, v: number) => setUpsideAdj(p => ({ ...p, [k]: v })), []);

  const handleReset = useCallback(() => {
    setSafetyWeights({ ...DEFAULT_SAFETY_WEIGHTS });
    setUpsideWeights({ ...DEFAULT_UPSIDE_WEIGHTS });
    setSafetyAdj({ ...ZERO_SAFETY_ADJ });
    setUpsideAdj({ ...ZERO_UPSIDE_ADJ });
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedProfileId) { toast('warning', 'Selectionnez un profil'); return; }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch('/api/models/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: selectedProfileId,
          weights: {
            safety: safetyWeights,
            upside: upsideWeights,
            safetyAdj,
            upsideAdj,
          },
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      setData(await res.json());
      setUsedWeights({ safety: { ...safetyWeights }, upside: { ...upsideWeights } });
      toast('success', 'Scoring termine');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally { setLoading(false); }
  }, [selectedProfileId, safetyWeights, upsideWeights, safetyAdj, upsideAdj, toast]);

  if (profilesLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Evaluer la qualite"
        description="Analysez la solidite et le potentiel de chaque titre de votre portefeuille modele"
        action={<Link href="/models"><Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button></Link>}
      />

      <ScoringLegend safetyWeights={safetyWeights} upsideWeights={upsideWeights} safetyAdj={safetyAdj} upsideAdj={upsideAdj} />

      <WeightCustomizer
        safetyWeights={safetyWeights} upsideWeights={upsideWeights}
        safetyAdj={safetyAdj} upsideAdj={upsideAdj}
        onSafetyWeight={handleSafetyWeight}
        onUpsideWeight={handleUpsideWeight}
        onSafetyAdj={handleSafetyAdj}
        onUpsideAdj={handleUpsideAdj}
        onReset={handleReset}
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
              <option value="">-- Selectionnez un profil --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.profile_number}. {p.name} ({p.equity_pct}/{p.bond_pct})</option>
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

  const sw = weights?.safety ?? DEFAULT_SAFETY_WEIGHTS;
  const uw = weights?.upside ?? DEFAULT_UPSIDE_WEIGHTS;
  const sSum = Object.values(sw).reduce((a, b) => a + b, 0);
  const uSum = Object.values(uw).reduce((a, b) => a + b, 0);
  const sPct = (k: keyof SafetyWeights) => sSum > 0 ? Math.round(sw[k] / sSum * 100) : 0;
  const uPct = (k: keyof UpsideWeights) => uSum > 0 ? Math.round(uw[k] / uSum * 100) : 0;

  const radarData = [
    { dimension: 'Securite', score: ps.safety },
    { dimension: 'Potentiel', score: ps.upside },
    { dimension: 'Sante fin.', score: wAvg(s => s.safety.balanceSheetScore) },
    { dimension: 'Rentabilite', score: wAvg(s => s.safety.profitabilityScore) },
    { dimension: 'Cible anal.', score: wAvg(s => s.upside.analystTarget) },
    { dimension: 'Croissance', score: wAvg(s => s.upside.businessGrowth) },
  ];

  const quadDist = [
    { name: 'Etoile', count: data.quadrantDistribution.star, color: GREEN },
    { name: 'Sur', count: data.quadrantDistribution.safe, color: '#3b82f6' },
    { name: 'Croissance', count: data.quadrantDistribution.growth, color: BRAND },
    { name: 'Veille', count: data.quadrantDistribution.watch, color: RED },
  ].filter(d => d.count > 0);

  const stockBarData = data.stocks.slice(0, 25).map(s => ({
    name: s.symbol, safety: s.safety.total, upside: s.upside.total,
  }));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-text-main">Profil {data.profileNumber} — {data.profileName}</h2>
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

      {/* Quadrant cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['star', 'safe', 'growth', 'watch'] as const).map(q => {
          const cfg = QUADRANT_CONFIG[q]; const Icon = cfg.icon;
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
                  <span key={s.symbol} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{s.symbol}</span>
                )) : <span className="text-xs text-text-light italic">Aucun</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Score details + Radar */}
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
                { label: 'Score global', value: ps.safety, hint: 'Moyenne de tous les criteres' },
                { label: `Sante financiere (${sPct('balanceSheet')}%)`, value: wAvg(s => s.safety.balanceSheetScore), hint: 'Niveau d\'endettement et liquidites' },
                { label: `Stabilite du prix (${sPct('beta')}%)`, value: wAvg(s => s.safety.betaScore), hint: 'Volatilite du titre vs le marche' },
                { label: `Rentabilite (${sPct('profitability')}%)`, value: wAvg(s => s.safety.profitabilityScore), hint: 'Marges de profit et croissance' },
                { label: `Le titre est-il cher? (${sPct('valuation')}%)`, value: wAvg(s => s.safety.valuationScore), hint: 'Prix vs benefices, ajuste pour la croissance' },
                { label: `Taille (${sPct('size')}%)`, value: wAvg(s => s.safety.sizeScore), hint: 'Plus c\'est gros, plus c\'est stable' },
                { label: `Dividende (${sPct('dividend')}%)`, value: wAvg(s => s.safety.dividendScore), hint: 'Revenu regulier verse aux actionnaires' },
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
                { label: 'Score global', value: ps.upside, hint: 'Moyenne ponderee' },
                { label: `Croissance (${uPct('businessGrowth')}%)`, value: wAvg(s => s.upside.businessGrowth), hint: 'Revenus et profits en hausse' },
                { label: `Cible analystes (${uPct('analystTarget')}%)`, value: wAvg(s => s.upside.analystTarget), hint: 'Ou les pros voient le titre' },
                { label: `Sous-evaluation (${uPct('valuationDiscount')}%)`, value: wAvg(s => s.upside.valuationDiscount), hint: 'Le titre vaut-il plus que son prix?' },
                { label: `Cash genere (${uPct('fcfYield')}%)`, value: wAvg(s => s.upside.fcfYield), hint: 'Free cash flow vs valeur en bourse' },
                { label: `Dividende (${uPct('totalReturn')}%)`, value: wAvg(s => s.upside.totalReturn), hint: 'Revenu passif du dividende' },
                { label: `Efficacite (${uPct('capitalEfficiency')}%)`, value: wAvg(s => s.upside.capitalEfficiency), hint: 'ROE — retour sur capitaux propres' },
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
          <p className="text-[10px] text-text-light text-center mt-1">Plus la zone est large, meilleur est le portefeuille</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Repartition par categorie</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={quadDist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#586e82' }} />
              <YAxis tick={{ fontSize: 11, fill: '#586e82' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Titres" radius={[6, 6, 0, 0]}>
                {quadDist.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-1">Comparaison titre par titre</h3>
          <p className="text-xs text-text-muted mb-3">Vert = securite, Cyan = potentiel</p>
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

      {/* Table */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-main">Classement des titres</h3>
          <p className="text-xs text-text-muted">Cliquez sur un titre pour voir le detail</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-2.5 w-8">#</th>
                <th className="px-3 py-2.5">Titre</th>
                <th className="px-3 py-2.5 text-center"><span className="flex items-center justify-center gap-1"><Shield className="h-3 w-3 text-emerald-500" /> Securite</span></th>
                <th className="px-3 py-2.5 w-20"></th>
                <th className="px-3 py-2.5 text-center"><span className="flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3 text-cyan-500" /> Potentiel</span></th>
                <th className="px-3 py-2.5 w-20"></th>
                <th className="px-3 py-2.5 text-center">Categorie</th>
                <th className="px-3 py-2.5 text-right">Gain est.</th>
                <th className="px-3 py-2.5 text-right">Poids</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s) => {
                const qCfg = QUADRANT_CONFIG[s.quadrant]; const QIcon = qCfg.icon;
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
                          <QIcon className="h-3 w-3" />{qCfg.label}
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

                    {isExpanded && s.confidence !== 'low' && (
                      <tr className="bg-slate-50">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                            <div>
                              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <Shield className="h-3 w-3" /> Detail securite — {s.safety.label}
                              </p>
                              <MiniBreakdown items={[
                                { label: `Sante financiere (${sPct('balanceSheet')}%)`, value: s.safety.balanceSheetScore, hint: 'Dettes et liquidites' },
                                { label: `Stabilite du prix (${sPct('beta')}%)`, value: s.safety.betaScore, hint: 'Volatilite du titre' },
                                { label: `Rentabilite (${sPct('profitability')}%)`, value: s.safety.profitabilityScore, hint: 'Profits et croissance' },
                                { label: `Le titre est-il cher? (${sPct('valuation')}%)`, value: s.safety.valuationScore, hint: 'Prix vs benefices' },
                                { label: `Taille (${sPct('size')}%)`, value: s.safety.sizeScore, hint: 'Grande = plus stable' },
                                { label: `Dividende (${sPct('dividend')}%)`, value: s.safety.dividendScore, hint: 'Revenu verse' },
                              ]} />
                              {s.safety.redFlag && (
                                <div className="mt-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
                                  <p className="text-xs font-semibold text-red-700">Signal d&apos;alarme : {s.safety.redFlag}</p>
                                  <p className="text-[10px] text-red-500">Le score est limite automatiquement a cause de ce risque</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> Detail potentiel — {s.upside.label}
                              </p>
                              <MiniBreakdown items={[
                                { label: `Croissance (${uPct('businessGrowth')}%)`, value: s.upside.businessGrowth, hint: 'Revenus + profits' },
                                { label: `Cible analystes (${uPct('analystTarget')}%)`, value: s.upside.analystTarget, hint: 'Cible 12 mois' },
                                { label: `Sous-evaluation (${uPct('valuationDiscount')}%)`, value: s.upside.valuationDiscount, hint: 'DCF + PE forward' },
                                { label: `Cash genere (${uPct('fcfYield')}%)`, value: s.upside.fcfYield, hint: 'FCF / capitalisation' },
                                { label: `Dividende (${uPct('totalReturn')}%)`, value: s.upside.totalReturn, hint: 'Revenu de dividende' },
                                { label: `Efficacite (${uPct('capitalEfficiency')}%)`, value: s.upside.capitalEfficiency, hint: 'ROE' },
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

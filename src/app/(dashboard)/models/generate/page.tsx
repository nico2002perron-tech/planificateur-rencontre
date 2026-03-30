'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles } from '@/lib/hooks/useInvestmentProfiles';
import { useStockUniverse, type UniverseStock } from '@/lib/hooks/useStockUniverse';
import { useStockScores } from '@/lib/hooks/useStockScores';
import { Modal } from '@/components/ui/Modal';
import { StepNav } from '@/components/models/StepNav';
import {
  ArrowLeft, Zap, Download, Save, ChevronDown, ChevronRight,
  DollarSign, TrendingUp, Percent, BarChart3,
  Monitor, Heart, Landmark, Factory, Gem, ShoppingBag, Coffee,
  Lightbulb, Building2, Wifi, Shield, Zap as ZapIcon,
  Wand2, Lock, Check, Search, Layers, Target, Eye, EyeOff,
  Sparkles, ChevronUp, RotateCcw,
} from 'lucide-react';

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

interface GeneratedStock {
  symbol: string;
  name: string;
  sector: string;
  stock_type: 'obligatoire' | 'variable';
  price: number;
  quantity: number;
  realValue: number;
  targetWeight: number;
  realWeight: number;
}

interface GeneratedBond {
  description: string;
  issuer: string | null;
  cusip: string | null;
  coupon: number | null;
  maturity: string | null;
  price: number;
  yieldPct: number | null;
  quantity: number;
  realValue: number;
  targetWeight: number;
  realWeight: number;
  is_mandatory: boolean;
  source: string;
}

interface SectorSummary {
  sector: string;
  sectorLabel: string;
  targetWeight: number;
  realWeight: number;
  stocks: GeneratedStock[];
  totalValue: number;
}

interface GeneratedPortfolio {
  profileName: string;
  profileNumber: number;
  portfolioValue: number;
  equityPct: number;
  bondPct: number;
  totalStockValue: number;
  totalBondValue: number;
  cashRemaining: number;
  realEquityPct: number;
  realBondPct: number;
  realCashPct: number;
  sectors: SectorSummary[];
  bonds: GeneratedBond[];
  stats: {
    nbStocks: number;
    nbBonds: number;
    nbSectors: number;
    avgDividendYield: number;
    avgBondYield: number;
    estimatedAnnualIncome: number;
  };
  generatedAt: string;
}

// ══════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════

const BRAND = '#00b4d8';
const COLORS = [BRAND, '#0077b6', '#03045e', '#f4a261', '#2ecc71', '#e63946', '#8b5cf6', '#14b8a6', '#f59e0b', '#6366f1', '#ec4899', '#84cc16'];

const SECTOR_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; hex: string; label: string }> = {
  TECHNOLOGY:       { icon: Monitor,     color: 'text-blue-500',    bg: 'bg-blue-50',    hex: '#3b82f6', label: 'Techno' },
  HEALTHCARE:       { icon: Heart,       color: 'text-rose-500',    bg: 'bg-rose-50',    hex: '#f43f5e', label: 'Sante' },
  FINANCIALS:       { icon: Landmark,    color: 'text-emerald-500', bg: 'bg-emerald-50', hex: '#10b981', label: 'Finance' },
  ENERGY:           { icon: ZapIcon,     color: 'text-orange-500',  bg: 'bg-orange-50',  hex: '#f97316', label: 'Energie' },
  MATERIALS:        { icon: Gem,         color: 'text-slate-500',   bg: 'bg-slate-50',   hex: '#64748b', label: 'Materiaux' },
  INDUSTRIALS:      { icon: Factory,     color: 'text-violet-500',  bg: 'bg-violet-50',  hex: '#8b5cf6', label: 'Industriels' },
  CONSUMER_DISC:    { icon: ShoppingBag, color: 'text-pink-500',    bg: 'bg-pink-50',    hex: '#ec4899', label: 'Cons. disc.' },
  CONSUMER_STAPLES: { icon: Coffee,      color: 'text-amber-600',   bg: 'bg-amber-50',   hex: '#d97706', label: 'Cons. base' },
  UTILITIES:        { icon: Lightbulb,   color: 'text-cyan-600',    bg: 'bg-cyan-50',    hex: '#0891b2', label: 'Serv. pub.' },
  REAL_ESTATE:      { icon: Building2,   color: 'text-teal-500',    bg: 'bg-teal-50',    hex: '#14b8a6', label: 'Immobilier' },
  TELECOM:          { icon: Wifi,        color: 'text-indigo-500',  bg: 'bg-indigo-50',  hex: '#6366f1', label: 'Telecom' },
  MILITARY:         { icon: Shield,      color: 'text-red-500',     bg: 'bg-red-50',     hex: '#ef4444', label: 'Militaire' },
};

const PROFILE_VISUALS: Record<number, { icon: React.ComponentType<{ className?: string }>; gradient: string; ring: string }> = {
  1: { icon: Shield,     gradient: 'from-blue-500 to-blue-600',     ring: 'ring-blue-300' },
  2: { icon: Shield,     gradient: 'from-sky-400 to-sky-500',       ring: 'ring-sky-300' },
  3: { icon: Target,     gradient: 'from-amber-400 to-amber-500',   ring: 'ring-amber-300' },
  4: { icon: Layers,     gradient: 'from-emerald-400 to-emerald-500', ring: 'ring-emerald-300' },
  5: { icon: TrendingUp, gradient: 'from-brand-primary to-blue-500', ring: 'ring-brand-primary/40' },
  6: { icon: Zap,        gradient: 'from-violet-500 to-purple-600', ring: 'ring-violet-300' },
};

const BUILDING_STEPS = [
  'Analyse du profil...',
  'Selection des actions...',
  'Recuperation des prix...',
  'Selection des obligations...',
  'Calcul des allocations...',
  'Optimisation finale...',
];

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12,
};

function fmt(n: number) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDec(n: number, dec = 2) {
  return new Intl.NumberFormat('fr-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}

// ══════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════

export default function GeneratePage() {
  const { profiles, isLoading: profilesLoading } = useInvestmentProfiles();
  const { stocks: universeStocks, bySector, sectors: universeSectors, isLoading: universeLoading } = useStockUniverse();
  const { toast } = useToast();

  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [portfolioValue, setPortfolioValue] = useState(100000);
  const [generating, setGenerating] = useState(false);
  const [buildingStep, setBuildingStep] = useState(0);
  const [result, setResult] = useState<GeneratedPortfolio | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [modelName, setModelName] = useState('');
  const [paletteFilter, setPaletteFilter] = useState('');
  const [showPalette, setShowPalette] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);

  // ── User-controlled stock selection ──
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set());

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  // ── Smart scoring ──
  const { scoresMap } = useStockScores(selectedProfileId || null);

  // Profile sector map (which sectors are configured)
  const profileSectors = useMemo(() => {
    if (!selectedProfile) return new Set<string>();
    return new Set(selectedProfile.sectors.map(s => s.sector));
  }, [selectedProfile]);

  // Auto-preselect stocks when profile changes
  useEffect(() => {
    if (!selectedProfile || universeStocks.length === 0) return;
    const preSelected = new Set<string>();
    for (const sc of selectedProfile.sectors) {
      const sectorStocks = universeStocks
        .filter(s => s.sector === sc.sector)
        .sort((a, b) => {
          // Sort by score if available, otherwise by type + position
          const scoreA = scoresMap.get(a.id)?.composite ?? 0;
          const scoreB = scoresMap.get(b.id)?.composite ?? 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          if (a.stock_type !== b.stock_type) return a.stock_type === 'obligatoire' ? -1 : 1;
          return a.position - b.position;
        });
      sectorStocks.slice(0, sc.nb_titles).forEach(s => preSelected.add(s.id));
    }
    setSelectedStockIds(preSelected);
    setResult(null);
  }, [selectedProfile, universeStocks, scoresMap]);

  // Toggle a stock in/out of selection
  const toggleStock = useCallback((stockId: string) => {
    setSelectedStockIds(prev => {
      const next = new Set(prev);
      if (next.has(stockId)) next.delete(stockId);
      else next.add(stockId);
      return next;
    });
    setResult(null);
  }, []);

  // Auto-fill by score
  const handleAutoFill = useCallback(() => {
    if (!selectedProfile) return;
    const autoSelected = new Set<string>();
    for (const sc of selectedProfile.sectors) {
      const sectorStocks = universeStocks
        .filter(s => s.sector === sc.sector)
        .sort((a, b) => {
          const scoreA = scoresMap.get(a.id)?.composite ?? 0;
          const scoreB = scoresMap.get(b.id)?.composite ?? 0;
          return scoreB - scoreA;
        });
      sectorStocks.slice(0, sc.nb_titles).forEach(s => autoSelected.add(s.id));
    }
    setSelectedStockIds(autoSelected);
    setResult(null);
    toast('success', 'Selection auto-remplie par score!');
  }, [selectedProfile, universeStocks, scoresMap, toast]);

  // Select / deselect all stocks in a sector
  const toggleSectorAll = useCallback((sector: string, select: boolean) => {
    setSelectedStockIds(prev => {
      const next = new Set(prev);
      const sectorStocks = universeStocks.filter(s => s.sector === sector);
      sectorStocks.forEach(s => select ? next.add(s.id) : next.delete(s.id));
      return next;
    });
    setResult(null);
  }, [universeStocks]);

  // Building step animation
  useEffect(() => {
    if (!generating) return;
    setBuildingStep(0);
    const interval = setInterval(() => {
      setBuildingStep(prev => (prev + 1) % BUILDING_STEPS.length);
    }, 800);
    return () => clearInterval(interval);
  }, [generating]);

  // Scroll to result when generated
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }, [result]);

  const handleGenerate = useCallback(async () => {
    if (!selectedProfileId) {
      toast('warning', 'Selectionnez un profil');
      return;
    }
    if (portfolioValue < 10000) {
      toast('warning', 'Valeur minimum : 10 000 $');
      return;
    }
    if (selectedStockIds.size === 0) {
      toast('warning', 'Selectionnez au moins un titre');
      return;
    }

    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/models/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: selectedProfileId,
          portfolio_value: portfolioValue,
          selected_stock_ids: Array.from(selectedStockIds),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur de generation');
      }
      const data = await res.json();
      setResult(data.portfolio);
      toast('success', 'Portefeuille construit!');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setGenerating(false);
    }
  }, [selectedProfileId, portfolioValue, selectedStockIds, toast]);

  const handleSaveAsModel = useCallback(async () => {
    if (!result || !modelName.trim()) return;
    setSaving(true);
    try {
      const allStocks = result.sectors.flatMap(s => s.stocks);
      const totalValue = result.totalStockValue + result.totalBondValue + result.cashRemaining;
      const holdings = allStocks.map(s => ({
        symbol: s.symbol,
        name: s.name,
        weight: Math.round((s.realValue / totalValue) * 10000) / 100,
        asset_class: 'EQUITY' as const,
        region: s.symbol.endsWith('.TO') || s.symbol.endsWith('.V') ? 'CA' : 'US',
        sector: s.sector,
      }));

      const profile = profiles.find(p => p.id === selectedProfileId);
      const riskMap: Record<number, string> = { 1: 'CONSERVATEUR', 2: 'CONSERVATEUR', 3: 'MODERE', 4: 'EQUILIBRE', 5: 'CROISSANCE', 6: 'DYNAMIQUE' };
      const riskLevel = profile ? (riskMap[profile.profile_number] || 'EQUILIBRE') : 'EQUILIBRE';

      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modelName.trim(),
          description: `Profil ${result.profileNumber} — ${result.profileName} (${result.equityPct}/${result.bondPct}) — ${fmt(result.portfolioValue)}`,
          risk_level: riskLevel,
          holdings,
        }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      toast('success', 'Modele sauvegarde!');
      setSaveModalOpen(false);
      setModelName('');
      window.location.href = `/models/${saved.id}`;
    } catch {
      toast('error', 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }, [result, modelName, selectedProfileId, profiles, toast]);

  const isLoading = profilesLoading || universeLoading;
  const isReady = !!selectedProfileId && portfolioValue >= 10000;

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-blue-600 flex items-center justify-center">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-main">Construire mon portefeuille</h1>
              <p className="text-sm text-text-muted">Assemblez votre portefeuille ideal a partir de votre univers</p>
            </div>
          </div>
        </div>
        <Link href="/models">
          <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
        </Link>
      </div>

      {/* ══════════════════════════════════════
          SECTION 1 : PROFIL D'INVESTISSEMENT
         ══════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">1</span>
          <span className="text-sm font-semibold text-text-main">Choisir mon profil</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {profiles.map(p => {
            const vis = PROFILE_VISUALS[p.profile_number] || PROFILE_VISUALS[4];
            const ProfileIcon = vis.icon;
            const isSelected = selectedProfileId === p.id;

            return (
              <button
                key={p.id}
                onClick={() => { setSelectedProfileId(p.id); setResult(null); }}
                className={`relative rounded-2xl border-2 p-4 transition-all duration-200 text-left group ${
                  isSelected
                    ? `border-transparent ring-2 ${vis.ring} bg-white shadow-lg scale-[1.03]`
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                }`}
              >
                {/* Selected check */}
                {isSelected && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}

                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${vis.gradient} flex items-center justify-center mb-3`}>
                  <ProfileIcon className="h-5 w-5 text-white" />
                </div>

                {/* Name */}
                <p className="text-sm font-bold text-text-main leading-tight mb-1">{p.name}</p>

                {/* Allocation bar */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                    <div className="h-full bg-brand-primary rounded-full" style={{ width: `${p.equity_pct}%` }} />
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${p.bond_pct}%` }} />
                  </div>
                </div>
                <p className="text-[11px] text-text-muted">
                  <span className="text-brand-primary font-semibold">{p.equity_pct}%</span> actions /{' '}
                  <span className="text-amber-500 font-semibold">{p.bond_pct}%</span> oblig.
                </p>

                {/* Sector count */}
                <p className="text-[10px] text-text-muted mt-1.5">
                  {p.sectors.length} secteurs — {p.nb_bonds} oblig.
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════
          SECTION 2 : BUDGET
         ══════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">2</span>
          <span className="text-sm font-semibold text-text-main">Definir mon budget</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <input
              type="number"
              min={10000}
              step={5000}
              value={portfolioValue}
              onChange={(e) => { setPortfolioValue(parseInt(e.target.value) || 0); setResult(null); }}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-lg font-mono font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {[50000, 100000, 250000, 500000, 1000000].map(v => (
              <button
                key={v}
                onClick={() => { setPortfolioValue(v); setResult(null); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  portfolioValue === v
                    ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/30 scale-105'
                    : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                }`}
              >
                {fmt(v)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          SECTION 3 : MA PALETTE D'ACTIONS
         ══════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">3</span>
            <span className="text-sm font-semibold text-text-main">Choisir mes actions</span>
            {selectedProfile && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                selectedStockIds.size > 0 ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-100 text-text-muted'
              }`}>
                {selectedStockIds.size} selectionne{selectedStockIds.size > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedProfile && (
              <>
                <button
                  onClick={handleAutoFill}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-primary to-blue-600 text-white hover:shadow-md hover:shadow-brand-primary/20 transition-all duration-200"
                  title="Remplir intelligemment"
                >
                  <Wand2 className="h-3 w-3" /> Auto-remplir
                </button>
                {selectedStockIds.size > 0 && (
                  <button
                    onClick={() => { setSelectedStockIds(new Set()); setResult(null); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Vider
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main transition-colors"
            >
              {showPalette ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPalette ? 'Masquer' : 'Afficher'}
            </button>
          </div>
        </div>

        {showPalette && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            {/* Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={paletteFilter}
                onChange={(e) => setPaletteFilter(e.target.value)}
                placeholder="Chercher un titre..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>

            {/* Sector rows */}
            <div className="space-y-2">
              {universeSectors.map(sector => {
                const style = SECTOR_STYLE[sector];
                if (!style) return null;
                const SectorIcon = style.icon;
                const sectorStocks = bySector[sector] || [];
                const isConfigured = profileSectors.has(sector);
                const sectorConfig = selectedProfile?.sectors.find(s => s.sector === sector);
                const nbTarget = sectorConfig?.nb_titles ?? 0;

                // Filter stocks
                const filtered = paletteFilter
                  ? sectorStocks.filter(s =>
                      s.symbol.toLowerCase().includes(paletteFilter.toLowerCase()) ||
                      s.name.toLowerCase().includes(paletteFilter.toLowerCase())
                    )
                  : sectorStocks;

                if (filtered.length === 0) return null;

                // Sort: obligatoire first, then by position
                const sorted = [...filtered].sort((a, b) => {
                  if (a.stock_type !== b.stock_type) return a.stock_type === 'obligatoire' ? -1 : 1;
                  return a.position - b.position;
                });

                // Count selected in this sector
                const selectedInSector = sectorStocks.filter(s => selectedStockIds.has(s.id)).length;
                const isFull = isConfigured && selectedInSector >= nbTarget;
                const isOver = isConfigured && selectedInSector > nbTarget;

                return (
                  <div key={sector} className={`rounded-xl border p-3 transition-all duration-200 ${
                    isConfigured
                      ? 'border-gray-200 bg-white'
                      : 'border-dashed border-gray-200 bg-gray-50/30 opacity-50'
                  }`}>
                    {/* Sector header */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className={`w-6 h-6 rounded-lg ${style.bg} flex items-center justify-center`}>
                        <SectorIcon className={`h-3.5 w-3.5 ${style.color}`} />
                      </div>
                      <span className="text-xs font-semibold text-text-main">{style.label}</span>
                      {isConfigured && selectedProfile && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isFull && !isOver
                            ? 'bg-emerald-100 text-emerald-700'
                            : isOver
                              ? 'bg-amber-100 text-amber-700'
                              : selectedInSector > 0
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-gray-100 text-text-muted'
                        }`}>
                          {selectedInSector}/{nbTarget}
                        </span>
                      )}
                      {!isConfigured && selectedProfile && (
                        <span className="text-[10px] text-text-muted italic">hors profil</span>
                      )}
                    </div>

                    {/* Stock chips — interactive with logos */}
                    <div className="flex flex-wrap gap-1.5">
                      {sorted.map(stock => {
                        const isSelected = selectedStockIds.has(stock.id);
                        const isObligatoire = stock.stock_type === 'obligatoire';
                        const showWarning = isObligatoire && !isSelected && !!selectedProfile;
                        const ticker = stock.symbol.replace('.TO', '').replace('.V', '');

                        return (
                          <button
                            key={stock.id}
                            onClick={() => toggleStock(stock.id)}
                            className={`group/chip inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none ${
                              isSelected
                                ? `bg-white ring-2 ${style.color} shadow-sm hover:shadow-md`
                                : showWarning
                                  ? 'bg-red-50/80 text-red-400 ring-1 ring-red-200/60 hover:ring-red-300'
                                  : 'bg-gray-50 text-text-muted ring-1 ring-gray-200/60 hover:ring-gray-300 hover:bg-white hover:text-text-main'
                            }`}
                            style={isSelected ? { boxShadow: `0 0 0 2px ${style.hex}30`, borderColor: style.hex } : undefined}
                            title={`${stock.name}${isObligatoire ? ' (obligatoire)' : ''}`}
                          >
                            {/* Logo or initials */}
                            {stock.logo_url ? (
                              <img
                                src={stock.logo_url}
                                alt=""
                                className="h-5 w-5 rounded-full object-contain bg-white shrink-0"
                              />
                            ) : (
                              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                isSelected ? `${style.bg} ${style.color}` : 'bg-gray-200 text-gray-500'
                              }`}>
                                {ticker.slice(0, 2)}
                              </span>
                            )}
                            <span className="font-mono font-semibold">{ticker}</span>
                            {isObligatoire && (
                              <Lock className="h-2.5 w-2.5 opacity-50 shrink-0" />
                            )}
                            {isSelected && (
                              <Check className="h-3 w-3 shrink-0" style={{ color: style.hex }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {universeStocks.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-text-muted">Aucun titre dans votre univers.</p>
                <Link href="/models/universe" className="text-sm text-brand-primary font-medium hover:underline mt-1 inline-block">
                  Ajouter des titres a l&apos;etape 2
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          BIG BUILD BUTTON
         ══════════════════════════════════════ */}
      {!result && !generating && (
        <div className="flex justify-center py-4">
          <button
            onClick={handleGenerate}
            disabled={!isReady}
            className={`group relative px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300 ${
              isReady
                ? 'bg-gradient-to-r from-brand-primary to-blue-600 text-white shadow-xl shadow-brand-primary/30 hover:shadow-2xl hover:shadow-brand-primary/40 hover:scale-[1.03] active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <Wand2 className={`h-6 w-6 ${isReady ? 'group-hover:rotate-12 transition-transform' : ''}`} />
              <span>Construire mon portefeuille!</span>
              <Sparkles className={`h-5 w-5 ${isReady ? 'opacity-80' : 'opacity-30'}`} />
            </div>
            {!isReady && (
              <p className="text-xs font-normal mt-1 opacity-70">
                {!selectedProfileId ? 'Selectionnez un profil' : 'Budget minimum 10 000 $'}
              </p>
            )}
          </button>
        </div>
      )}

      {/* ── Building animation ── */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-brand-primary/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-4 border-brand-primary/40 animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-brand-primary to-blue-600 flex items-center justify-center animate-pulse">
              <Wand2 className="h-8 w-8 text-white" />
            </div>
          </div>

          <div className="h-8 flex items-center">
            <p className="text-sm font-medium text-text-main animate-pulse">
              {BUILDING_STEPS[buildingStep]}
            </p>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mt-4">
            {BUILDING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= buildingStep ? 'w-6 bg-brand-primary' : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          SECTION 4 : RÉSULTAT
         ══════════════════════════════════════ */}
      {result && !generating && (
        <div ref={resultRef}>
          <PortfolioResult
            portfolio={result}
            onSave={() => {
              setModelName(`${result.profileName} — ${new Date().toLocaleDateString('fr-CA')}`);
              setSaveModalOpen(true);
            }}
            onRegenerate={() => { setResult(null); handleGenerate(); }}
          />
        </div>
      )}

      <StepNav current={3} />

      {/* ── Save modal ── */}
      <Modal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Sauvegarder comme modele" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Nom du modele</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Ex: Croissance Q1 2026"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && modelName.trim()) handleSaveAsModel(); }}
            />
          </div>
          {result && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-blue-600 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-main">Profil {result.profileNumber} — {result.profileName}</p>
                  <p className="text-xs text-text-muted">{result.stats.nbStocks} actions, {result.stats.nbBonds} obligations</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted pt-1 border-t border-gray-200">
                <span>Valeur: <span className="font-mono font-bold text-text-main">{fmt(result.portfolioValue)}</span></span>
                <span>Revenu est.: <span className="font-mono font-bold text-emerald-600">{fmt(result.stats.estimatedAnnualIncome)}/an</span></span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setSaveModalOpen(false)}>Annuler</Button>
            <Button loading={saving} disabled={!modelName.trim()} onClick={handleSaveAsModel} icon={<Save className="h-4 w-4" />}>
              Sauvegarder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════
// PORTFOLIO RESULT (interactive preview)
// ══════════════════════════════════════════

function PortfolioResult({ portfolio: p, onSave, onRegenerate }: {
  portfolio: GeneratedPortfolio;
  onSave: () => void;
  onRegenerate: () => void;
}) {
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set(p.sectors.filter(s => s.stocks.length > 0).map(s => s.sector))
  );
  const [showBonds, setShowBonds] = useState(false);

  function toggleSector(sector: string) {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }

  const allocationData = [
    { name: 'Actions', value: p.totalStockValue, color: BRAND },
    { name: 'Obligations', value: p.totalBondValue, color: '#f4a261' },
    ...(p.cashRemaining > 0 ? [{ name: 'Liquidites', value: p.cashRemaining, color: '#e5e7eb' }] : []),
  ];

  const activeSectors = p.sectors.filter(s => s.stocks.length > 0);
  const sectorPieData = activeSectors.map(s => ({
    name: SECTOR_STYLE[s.sector]?.label || s.sectorLabel,
    value: s.totalValue,
    sector: s.sector,
    color: SECTOR_STYLE[s.sector]?.hex || '#6b7280',
  }));

  return (
    <div className="space-y-5">
      {/* ── Result header ── */}
      <div className="bg-gradient-to-r from-brand-primary to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Profil {p.profileNumber} — {p.profileName}</h2>
              <p className="text-sm text-white/70">
                {p.equityPct}% actions / {p.bondPct}% obligations — {fmt(p.portfolioValue)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRegenerate}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium flex items-center gap-1.5"
            >
              <Wand2 className="h-3.5 w-3.5" /> Regenerer
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 rounded-xl bg-white text-brand-primary hover:bg-white/90 transition-colors text-sm font-bold flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Sauvegarder
            </button>
          </div>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Actions', value: fmt(p.totalStockValue), sub: `${p.realEquityPct}%`, icon: TrendingUp },
            { label: 'Obligations', value: fmt(p.totalBondValue), sub: `${p.realBondPct}%`, icon: BarChart3 },
            { label: 'Revenu annuel', value: fmt(p.stats.estimatedAnnualIncome), sub: `${fmtDec(p.stats.estimatedAnnualIncome / p.portfolioValue * 100)}%`, icon: DollarSign },
            { label: 'Liquidites', value: fmt(p.cashRemaining), sub: `${p.realCashPct}%`, icon: Percent },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="h-4 w-4 text-white/60" />
                <span className="text-xs text-white/60">{s.label}</span>
              </div>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-xs text-white/50">{s.sub} du ptf</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick stats badges ── */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Titres', value: String(p.stats.nbStocks), color: 'bg-brand-primary/10 text-brand-primary' },
          { label: 'Obligations', value: String(p.stats.nbBonds), color: 'bg-amber-50 text-amber-600' },
          { label: 'Secteurs', value: String(p.stats.nbSectors), color: 'bg-violet-50 text-violet-600' },
          { label: 'Div. moy.', value: `${fmtDec(p.stats.avgDividendYield)}%`, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Yield obl.', value: `${fmtDec(p.stats.avgBondYield)}%`, color: 'bg-orange-50 text-orange-600' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${s.color}`}>
            <span className="text-lg font-bold leading-none">{s.value}</span>
            <span className="opacity-70">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Two donuts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Global allocation */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-text-main mb-3">Repartition globale</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={allocationData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={3} dataKey="value">
                {allocationData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, _: any, entry: any) => [
                  `${fmt(Number(value) || 0)} (${fmtDec((Number(value) || 0) / p.portfolioValue * 100)}%)`,
                  entry?.payload?.name ?? '',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-5 mt-2">
            {allocationData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} — {fmtDec(d.value / p.portfolioValue * 100, 1)}%
              </div>
            ))}
          </div>
        </div>

        {/* Sector donut */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-text-main mb-3">Repartition sectorielle</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sectorPieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={2} dataKey="value">
                {sectorPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, _: any, entry: any) => [
                  `${fmt(Number(value) || 0)} (${fmtDec((Number(value) || 0) / p.totalStockValue * 100)}%)`,
                  entry?.payload?.name ?? '',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
            {sectorPieData.map(d => (
              <div key={d.name} className="flex items-center gap-1 text-[11px] text-text-muted">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sector detail cards ── */}
      <div>
        <h3 className="text-sm font-semibold text-text-main mb-3">Detail par secteur</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {activeSectors.map(sec => {
            const style = SECTOR_STYLE[sec.sector];
            const SectorIcon = style?.icon || TrendingUp;
            const isExpanded = expandedSectors.has(sec.sector);
            const diff = sec.realWeight - sec.targetWeight;
            const diffAbs = Math.abs(diff);

            return (
              <div key={sec.sector} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleSector(sec.sector)}
                  className="w-full px-4 py-3 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${style?.bg || 'bg-gray-100'} flex items-center justify-center shrink-0`}>
                      <SectorIcon className={`h-4.5 w-4.5 ${style?.color || 'text-gray-500'}`} />
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-text-main">{sec.sectorLabel}</span>
                        <Badge variant="outline" className="text-[10px]">{sec.stocks.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span className="font-mono font-semibold text-text-main">{fmt(sec.totalValue)}</span>
                        <span>Cible {fmtDec(sec.targetWeight)}%</span>
                        <span className={diffAbs < 0.5 ? 'text-emerald-600 font-medium' : diffAbs < 1.5 ? 'text-amber-600 font-medium' : 'text-red-500 font-medium'}>
                          Reel {fmtDec(sec.realWeight)}%
                          <span className="ml-0.5">({diff >= 0 ? '+' : ''}{fmtDec(diff)}%)</span>
                        </span>
                      </div>
                    </div>

                    {/* Weight bar */}
                    <div className="w-16 shrink-0">
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden relative">
                        <div
                          className="h-full rounded-full absolute top-0 left-0 opacity-25"
                          style={{ width: `${Math.min(sec.targetWeight * 4, 100)}%`, backgroundColor: style?.hex }}
                        />
                        <div
                          className="h-full rounded-full absolute top-0 left-0"
                          style={{ width: `${Math.min(sec.realWeight * 4, 100)}%`, backgroundColor: style?.hex }}
                        />
                      </div>
                    </div>

                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-text-muted shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
                    }
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {sec.stocks.map((stock, si) => (
                      <div key={stock.symbol} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[si % COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm text-text-main">{stock.symbol}</span>
                            <Badge variant={stock.stock_type === 'obligatoire' ? 'info' : 'default'} className="text-[10px]">
                              {stock.stock_type === 'obligatoire' ? 'Oblig.' : 'Var.'}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted truncate">{stock.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-semibold text-sm text-text-main">{fmt(stock.realValue)}</p>
                          <p className="text-[11px] text-text-muted">
                            {stock.quantity} x {fmtDec(stock.price)} — <span className="font-medium">{fmtDec(stock.realWeight)}%</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bonds section ── */}
      {p.bonds.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowBonds(!showBonds)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-text-main block">Obligations</span>
                <span className="text-xs text-text-muted">{p.bonds.length} positions — {fmt(p.totalBondValue)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{p.bonds.length}</Badge>
              {showBonds ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
            </div>
          </button>

          {showBonds && (
            <div className="border-t border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-2.5">Emetteur</th>
                    <th className="px-3 py-2.5">CUSIP</th>
                    <th className="px-3 py-2.5 text-right">Coupon</th>
                    <th className="px-3 py-2.5">Echeance</th>
                    <th className="px-3 py-2.5 text-right">Yield</th>
                    <th className="px-3 py-2.5 text-right">Qte</th>
                    <th className="px-3 py-2.5 text-right">Valeur</th>
                    <th className="px-3 py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {p.bonds.map((bond, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-text-main max-w-[180px] truncate" title={bond.issuer || bond.description}>
                        <div className="flex items-center gap-2">
                          {bond.is_mandatory && <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" title="Obligatoire" />}
                          {bond.issuer || bond.description}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-text-muted text-xs">{bond.cusip || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{bond.coupon != null ? `${fmtDec(bond.coupon)}%` : '—'}</td>
                      <td className="px-3 py-2 text-text-muted">{bond.maturity ? new Date(bond.maturity).toLocaleDateString('fr-CA') : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{bond.yieldPct != null ? `${fmtDec(bond.yieldPct)}%` : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{bond.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(bond.realValue)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={bond.source === 'CAD' ? 'info' : bond.source === 'US' ? 'warning' : 'default'}>
                          {bond.source}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Footer actions ── */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-text-light">
          Genere le {new Date(p.generatedAt).toLocaleString('fr-CA')}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => {
            const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `portefeuille-${p.profileName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            JSON
          </Button>
          <Button size="sm" onClick={onSave} icon={<Save className="h-3.5 w-3.5" />}>
            Sauvegarder
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useStockUniverse, type UniverseStock } from '@/lib/hooks/useStockUniverse';
import { useBondsUniverse, type UniverseBond } from '@/lib/hooks/useBondsUniverse';
import { SECTORS } from '@/lib/utils/constants';
import { StepNav } from '@/components/models/StepNav';
import {
  ArrowLeft, Plus, Trash2, Upload, Search,
  ChevronDown, ChevronRight, FileSpreadsheet, X, TrendingUp,
  Monitor, Heart, Landmark, Zap, Gem, Factory,
  ShoppingBag, Coffee, Lightbulb, Building2, Wifi, Shield,
  Lock, Unlock, Award, BarChart3, Clock, DollarSign, Calendar,
} from 'lucide-react';

// ── Sector icons (same as profiles page) ──
const SECTOR_META: Record<string, {
  Icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string; border: string;
}> = {
  TECHNOLOGY:       { Icon: Monitor,     color: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  HEALTHCARE:       { Icon: Heart,       color: 'text-rose-500',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  FINANCIALS:       { Icon: Landmark,    color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ENERGY:           { Icon: Zap,         color: 'text-orange-500',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  MATERIALS:        { Icon: Gem,         color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
  INDUSTRIALS:      { Icon: Factory,     color: 'text-violet-500',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  CONSUMER_DISC:    { Icon: ShoppingBag, color: 'text-pink-500',    bg: 'bg-pink-50',    border: 'border-pink-200' },
  CONSUMER_STAPLES: { Icon: Coffee,      color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  UTILITIES:        { Icon: Lightbulb,   color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  REAL_ESTATE:      { Icon: Building2,   color: 'text-teal-500',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  TELECOM:          { Icon: Wifi,        color: 'text-indigo-500',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  MILITARY:         { Icon: Shield,      color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200' },
};

// ── Search result type ──
interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  logo: string | null;
}

// ── Onglets ──
type Tab = 'actions' | 'obligations';

export default function UniversePage() {
  const [tab, setTab] = useState<Tab>('actions');

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/models" className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-text-muted" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-text-main">Choisir mes titres</h1>
          <p className="text-sm text-text-muted">Construisez votre univers d&apos;actions et d&apos;obligations</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 mt-4 border-b border-gray-200">
        <button
          onClick={() => setTab('actions')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'actions'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Actions
        </button>
        <button
          onClick={() => setTab('obligations')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'obligations'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Obligations
        </button>
      </div>

      {tab === 'actions' ? <StocksTab /> : <BondsTab />}

      <StepNav current={2} />
    </div>
  );
}

// ════════════════════════════════════════════════
// ONGLET ACTIONS
// ════════════════════════════════════════════════

function StocksTab() {
  const { stocks, bySector, sectors, isLoading, mutate } = useStockUniverse();
  const { toast } = useToast();
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set(sectors));

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Pending add (selected from search, waiting for sector pick) ──
  const [pending, setPending] = useState<{ symbol: string; name: string; logo: string | null } | null>(null);

  // Recherche TradingView (debounced)
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPending(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 250);
  }, []);

  // Select from search → show sector picker
  function selectResult(r: SearchResult) {
    setPending({ symbol: r.symbol, name: r.name, logo: r.logo });
    setSearchResults([]);
    setSearchQuery('');
  }

  // Pick sector → add immediately
  async function addToSector(sectorValue: string) {
    if (!pending) return;
    try {
      const res = await fetch('/api/models/universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: pending.symbol,
          name: pending.name,
          sector: sectorValue,
          stock_type: 'variable',
          logo_url: pending.logo,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const sectorLabel = SECTORS.find(s => s.value === sectorValue)?.label || sectorValue;
      toast('success', `${pending.symbol} ajouté dans ${sectorLabel}`);
      setPending(null);
      // Auto-expand the sector we just added to
      setExpandedSectors(prev => new Set([...prev, sectorValue]));
      mutate();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    }
  }

  // Supprimer un titre
  async function handleDeleteStock(stock: UniverseStock) {
    try {
      const res = await fetch('/api/models/universe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stock.id }),
      });
      if (!res.ok) throw new Error();
      toast('success', `${stock.symbol} retiré`);
      mutate();
    } catch {
      toast('error', 'Erreur lors de la suppression');
    }
  }

  // Toggle type obligatoire/variable
  async function handleToggleType(stock: UniverseStock) {
    const newType = stock.stock_type === 'obligatoire' ? 'variable' : 'obligatoire';
    try {
      await fetch('/api/models/universe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks: [{ id: stock.id, stock_type: newType }] }),
      });
      mutate();
    } catch {
      toast('error', 'Erreur');
    }
  }

  function toggleSector(sector: string) {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">

      {/* ── Big search bar (always visible) ── */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher un titre... (ex: AAPL, RY.TO, MSFT)"
            className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all shadow-sm"
          />
          {searching && <Spinner size="sm" className="absolute right-4 top-1/2 -translate-y-1/2" />}
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-text-muted font-medium">Cliquez pour ajouter a votre univers</p>
            </div>
            {searchResults.map(r => (
              <button
                key={r.symbol}
                onClick={() => selectResult(r)}
                className="w-full text-left px-4 py-3 hover:bg-brand-primary/5 flex items-center gap-3 text-sm transition-colors border-b border-gray-50 last:border-0"
              >
                {r.logo ? (
                  <img src={r.logo} alt="" className="h-8 w-8 rounded-full object-contain bg-white border border-gray-100 shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-semibold text-text-main">{r.symbol}</div>
                  <div className="text-text-muted text-xs truncate">{r.name}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">{r.exchange}</Badge>
                  <Plus className="h-4 w-4 text-brand-primary" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Sector picker (appears after selecting a search result) ── */}
      {pending && (
        <div className="bg-white rounded-2xl border-2 border-brand-primary/30 p-5 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Selected stock preview */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            {pending.logo ? (
              <img src={pending.logo} alt="" className="h-10 w-10 rounded-full object-contain bg-white border border-gray-100" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <div className="font-mono font-bold text-text-main">{pending.symbol}</div>
              <div className="text-sm text-text-muted">{pending.name}</div>
            </div>
            <button onClick={() => setPending(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sector selection */}
          <p className="text-sm font-medium text-text-main mb-3">Dans quel secteur?</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {SECTORS.map(s => {
              const meta = SECTOR_META[s.value];
              const Icon = meta?.Icon || TrendingUp;
              return (
                <button
                  key={s.value}
                  onClick={() => addToSector(s.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-100 hover:border-transparent hover:shadow-md transition-all duration-150 group ${meta?.bg || 'bg-gray-50'} hover:scale-[1.02]`}
                >
                  <Icon className={`h-5 w-5 ${meta?.color || 'text-gray-500'} transition-transform group-hover:scale-110`} />
                  <span className="text-xs font-medium text-text-main text-center leading-tight">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stats bar ── */}
      {stocks.length > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-text-muted">
            <span className="font-semibold text-text-main">{stocks.length}</span> titre{stocks.length !== 1 ? 's' : ''} dans
            <span className="font-semibold text-text-main ml-1">{sectors.length}</span> secteur{sectors.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── Empty state ── */}
      {stocks.length === 0 && !pending && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-primary/10 mb-4">
            <Search className="h-7 w-7 text-brand-primary" />
          </div>
          <h3 className="font-bold text-text-main mb-2">Votre univers est vide</h3>
          <p className="text-sm text-text-muted max-w-sm mx-auto mb-1">
            Recherchez des actions par symbole ou nom dans la barre ci-dessus, puis choisissez un secteur.
          </p>
          <p className="text-xs text-text-muted">
            Exemples: AAPL, MSFT, RY.TO, BNS.TO, SHOP.TO
          </p>
        </div>
      )}

      {/* ── Sector groups ── */}
      {sectors.map(sector => {
        const sectorStocks = bySector[sector] || [];
        const obligatoires = sectorStocks.filter(s => s.stock_type === 'obligatoire');
        const isExpanded = expandedSectors.has(sector);
        const sectorLabel = SECTORS.find(s => s.value === sector)?.label || sector;
        const meta = SECTOR_META[sector];
        const Icon = meta?.Icon || TrendingUp;

        return (
          <div key={sector} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {/* En-tête secteur */}
            <button
              onClick={() => toggleSector(sector)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
            >
              <div className={`w-9 h-9 rounded-xl ${meta?.bg || 'bg-gray-100'} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${meta?.color || 'text-gray-500'}`} />
              </div>
              <span className="font-semibold text-text-main flex-1 text-left">{sectorLabel}</span>
              <Badge variant="outline">{sectorStocks.length}</Badge>
              {obligatoires.length > 0 && (
                <Badge variant="info"><Lock className="h-3 w-3 mr-0.5 inline" />{obligatoires.length}</Badge>
              )}
              {isExpanded ? <ChevronDown className="h-4 w-4 text-text-muted shrink-0" /> : <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />}
            </button>

            {/* Liste des titres */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {sectorStocks.map(stock => (
                  <div key={stock.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors group">
                    {/* Logo */}
                    {stock.logo_url ? (
                      <img src={stock.logo_url} alt="" className="h-9 w-9 rounded-full object-contain bg-white border border-gray-100 shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    {/* Symbole + Nom */}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-text-main text-sm">{stock.symbol}</div>
                      <div className="text-text-muted text-xs truncate">{stock.name}</div>
                    </div>
                    {/* Type badge */}
                    <button
                      onClick={() => handleToggleType(stock)}
                      className="shrink-0"
                      title={stock.stock_type === 'obligatoire' ? 'Cliquez pour rendre variable' : 'Cliquez pour rendre obligatoire'}
                    >
                      {stock.stock_type === 'obligatoire' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                          <Lock className="h-3 w-3" /> Obligatoire
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                          <Unlock className="h-3 w-3" /> Variable
                        </span>
                      )}
                    </button>
                    {/* Supprimer */}
                    <button
                      onClick={() => handleDeleteStock(stock)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════
// ONGLET OBLIGATIONS
// ════════════════════════════════════════════════

const EXPIRY_DAYS = 30;

// ── Bond scoring engine ──
interface ScoredBond {
  bond: UniverseBond;
  score: number;
  couponScore: number;
  maturityScore: number;
  sizeScore: number;
  typeScore: number;
  yearsToMaturity: number | null;
}

function scoreBonds(bonds: UniverseBond[]): ScoredBond[] {
  const now = new Date();

  // Compute max market value for size normalization
  const marketValues = bonds.map(b => b.price ?? 0).filter(v => v > 0);
  const maxMarketValue = marketValues.length > 0 ? Math.max(...marketValues) : 1;

  return bonds.map(bond => {
    const desc = bond.description || '';
    const isFund = /\/N'FRAC|\/FR|\/SF|ETF/i.test(desc);

    // Years to maturity
    let yearsToMaturity: number | null = null;
    if (bond.maturity) {
      const matDate = new Date(bond.maturity);
      yearsToMaturity = Math.max(0, (matDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    // 1. Coupon Score (0-30) — higher coupon = better income
    const coupon = bond.coupon ?? 0;
    const couponScore = Math.min(30, Math.round((coupon / 7) * 30));

    // 2. Maturity Score (0-25) — sweet spot 2-7 years
    let maturityScore = 0;
    if (yearsToMaturity !== null) {
      if (yearsToMaturity < 0.5) maturityScore = 3;       // expired/too short
      else if (yearsToMaturity < 1) maturityScore = 10;
      else if (yearsToMaturity < 3) maturityScore = 20;
      else if (yearsToMaturity <= 7) maturityScore = 25;   // ideal
      else if (yearsToMaturity <= 10) maturityScore = 18;
      else maturityScore = 12;                             // long duration
    } else {
      maturityScore = isFund ? 15 : 5; // no maturity: funds get default, bonds penalized
    }

    // 3. Size Score (0-25) — larger position = more liquid/popular at IA
    const marketValue = bond.price ?? 0;
    const sizeScore = maxMarketValue > 0
      ? Math.round((marketValue / maxMarketValue) * 25)
      : 0;

    // 4. Type Score (0-20) — real bonds >> funds for model portfolios
    let typeScore = 0;
    if (isFund) {
      typeScore = 5;
    } else if (coupon > 0) {
      typeScore = 20; // real bond with coupon
    } else {
      typeScore = 10; // other type
    }

    const score = couponScore + maturityScore + sizeScore + typeScore;

    return { bond, score, couponScore, maturityScore, sizeScore, typeScore, yearsToMaturity };
  }).sort((a, b) => b.score - a.score);
}

// ── Maturity Timeline Legend ──
const MATURITY_BUCKETS = [
  { key: 'expired',  label: '< 1 an',    min: -Infinity, max: 1,   color: 'bg-red-400',     text: 'text-red-600',    bg: 'bg-red-50' },
  { key: 'short',    label: '1–3 ans',   min: 1,         max: 3,   color: 'bg-amber-400',   text: 'text-amber-600',  bg: 'bg-amber-50' },
  { key: 'medium',   label: '3–5 ans',   min: 3,         max: 5,   color: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'sweet',    label: '5–7 ans',   min: 5,         max: 7,   color: 'bg-brand-primary', text: 'text-brand-primary', bg: 'bg-blue-50' },
  { key: 'long',     label: '7–10 ans',  min: 7,         max: 10,  color: 'bg-violet-400',  text: 'text-violet-600', bg: 'bg-violet-50' },
  { key: 'verylong', label: '10+ ans',   min: 10,        max: Infinity, color: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50' },
] as const;

function MaturityTimeline({ bonds }: { bonds: UniverseBond[] }) {
  const now = new Date();

  // Filter only real bonds with maturity (exclude funds)
  const bondsWithMaturity = bonds.filter(b => {
    if (!b.maturity) return false;
    const desc = b.description || '';
    return !/\/N'FRAC|\/FR|\/SF|ETF/i.test(desc);
  });

  const noMaturityCount = bonds.filter(b => !b.maturity).length;

  // Compute years to maturity and bucket counts
  const bucketCounts: Record<string, number> = {};
  MATURITY_BUCKETS.forEach(b => { bucketCounts[b.key] = 0; });

  const yearsData: number[] = [];
  bondsWithMaturity.forEach(b => {
    const matDate = new Date(b.maturity!);
    const years = (matDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    yearsData.push(years);
    for (const bucket of MATURITY_BUCKETS) {
      if (years >= bucket.min && years < bucket.max) {
        bucketCounts[bucket.key]++;
        break;
      }
    }
  });

  const maxCount = Math.max(1, ...Object.values(bucketCounts));
  const totalWithMaturity = bondsWithMaturity.length;

  if (totalWithMaturity === 0) return null;

  // Average maturity
  const avgYears = yearsData.length > 0 ? yearsData.reduce((a, b) => a + b, 0) / yearsData.length : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <span className="text-sm font-bold text-text-main block">Echeances</span>
            <span className="text-xs text-text-muted">{totalWithMaturity} obligations avec echeance</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold text-text-main">{avgYears.toFixed(1)} ans</span>
          <span className="text-xs text-text-muted block">echeance moyenne</span>
        </div>
      </div>

      {/* Visual timeline */}
      <div className="space-y-2">
        {/* Bar chart (horizontal) */}
        <div className="flex items-end gap-1.5 h-16">
          {MATURITY_BUCKETS.map(bucket => {
            const count = bucketCounts[bucket.key];
            const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={bucket.key} className="flex-1 flex flex-col items-center justify-end h-full">
                {count > 0 && (
                  <span className={`text-[10px] font-bold ${bucket.text} mb-1`}>{count}</span>
                )}
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${count > 0 ? bucket.color : 'bg-gray-100'}`}
                  style={{ height: `${Math.max(count > 0 ? 15 : 4, heightPct)}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Timeline axis */}
        <div className="relative">
          {/* Continuous line */}
          <div className="absolute top-2 left-0 right-0 h-0.5 bg-gray-200" />
          {/* Sweet spot highlight (3-7 years) */}
          <div className="absolute top-1 left-[33.3%] w-[33.4%] h-2 bg-emerald-100 rounded-full opacity-60" />

          {/* Tick marks + labels */}
          <div className="flex">
            {MATURITY_BUCKETS.map(bucket => {
              const count = bucketCounts[bucket.key];
              const pct = totalWithMaturity > 0 ? Math.round((count / totalWithMaturity) * 100) : 0;
              return (
                <div key={bucket.key} className="flex-1 flex flex-col items-center">
                  {/* Tick */}
                  <div className={`w-1.5 h-1.5 rounded-full z-10 ${count > 0 ? bucket.color : 'bg-gray-300'}`} />
                  {/* Label */}
                  <span className={`text-[10px] mt-1.5 font-medium ${count > 0 ? bucket.text : 'text-gray-300'}`}>
                    {bucket.label}
                  </span>
                  {/* Percentage */}
                  {count > 0 && (
                    <span className="text-[9px] text-text-muted">{pct}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sweet spot legend */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-4 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" />
            Zone ideale (3-7 ans)
          </span>
          {noMaturityCount > 0 && (
            <span className="text-gray-400">{noMaturityCount} sans echeance</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Court</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Moyen</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Long</span>
        </div>
      </div>
    </div>
  );
}

function BondsTab() {
  const { bonds, stats, isLoading, mutate } = useBondsUniverse();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showRanking, setShowRanking] = useState(true);
  const [filter, setFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // ── Timer: derive last import from most recent non-manual bond ──
  const lastImportStr = bonds
    .filter(b => b.source !== 'MANUAL')
    .reduce((max, b) => (b.created_at > max ? b.created_at : max), '');
  const lastImportDate = lastImportStr ? new Date(lastImportStr) : null;
  const now = new Date();
  const daysSinceImport = lastImportDate
    ? Math.floor((now.getTime() - lastImportDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysRemaining = daysSinceImport !== null ? Math.max(0, EXPIRY_DAYS - daysSinceImport) : null;
  const isExpired = daysRemaining !== null && daysRemaining === 0;
  const progressPct = daysSinceImport !== null ? Math.min(100, (daysSinceImport / EXPIRY_DAYS) * 100) : 0;

  // ── Import handler (shared by drop + file input) ──
  async function importFile(file: File) {
    if (!file.name.match(/\.(xlsx|xlsm|xls)$/i)) {
      toast('warning', 'Format invalide. Utilisez .xlsx, .xlsm ou .xls');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/models/bonds/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast('success', `${data.stats.inserted} obligations importees depuis ${data.fileName}`);
      mutate();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur d\'import');
    } finally {
      setImporting(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) importFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Drag & drop ──
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) importFile(file);
  }

  const filteredBonds = filter
    ? bonds.filter(b =>
        b.description?.toLowerCase().includes(filter.toLowerCase()) ||
        b.issuer?.toLowerCase().includes(filter.toLowerCase()) ||
        b.cusip?.toLowerCase().includes(filter.toLowerCase())
      )
    : bonds;

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">

      {/* ── Timer card (only if bonds exist) ── */}
      {lastImportDate && (
        <div className={`rounded-2xl border-2 p-5 ${
          isExpired
            ? 'bg-red-50 border-red-200'
            : daysRemaining !== null && daysRemaining <= 7
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-100'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isExpired ? 'bg-red-100' : daysRemaining !== null && daysRemaining <= 7 ? 'bg-amber-100' : 'bg-green-100'
              }`}>
                {isExpired ? (
                  <Upload className="h-5 w-5 text-red-600" />
                ) : (
                  <FileSpreadsheet className={`h-5 w-5 ${daysRemaining !== null && daysRemaining <= 7 ? 'text-amber-600' : 'text-green-600'}`} />
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isExpired ? 'text-red-700' : 'text-text-main'}`}>
                  {isExpired ? 'Liste expiree!' : 'Liste a jour'}
                </p>
                <p className="text-xs text-text-muted">
                  Mise a jour le {lastImportDate.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              {isExpired ? (
                <span className="text-sm font-bold text-red-600">Importez la nouvelle liste</span>
              ) : (
                <span className="text-sm font-semibold text-text-main">{daysRemaining} jour{daysRemaining !== 1 ? 's' : ''} restant{daysRemaining !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2.5 rounded-full bg-white/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isExpired ? 'bg-red-400' : daysRemaining !== null && daysRemaining <= 7 ? 'bg-amber-400' : 'bg-green-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Drag & drop zone ── */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-brand-primary bg-brand-primary/5 scale-[1.01] shadow-lg'
            : isExpired
              ? 'border-red-300 bg-red-50/50 hover:border-red-400 hover:bg-red-50'
              : 'border-gray-200 bg-gray-50/50 hover:border-brand-primary/40 hover:bg-brand-primary/5'
        } ${importing ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="flex flex-col items-center py-10 px-6">
          {importing ? (
            <>
              <Spinner size="lg" className="mb-3" />
              <p className="text-sm font-medium text-text-main">Importation en cours...</p>
            </>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                dragging ? 'bg-brand-primary/10' : isExpired ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                <Upload className={`h-7 w-7 ${
                  dragging ? 'text-brand-primary' : isExpired ? 'text-red-500' : 'text-gray-400'
                }`} />
              </div>
              <p className="text-sm font-semibold text-text-main mb-1">
                {dragging ? 'Lachez le fichier ici!' : 'Glissez votre fichier Excel ici'}
              </p>
              <p className="text-xs text-text-muted mb-3">
                Repartition d&apos;actifs.xlsx, Bonds CAD.xlsm ou Bonds US.xlsm
              </p>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl border border-gray-200 text-xs font-medium text-text-muted hover:border-brand-primary hover:text-brand-primary transition-colors">
                <FileSpreadsheet className="h-3.5 w-3.5" /> ou parcourir les fichiers
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      {bonds.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-text-main' },
            { label: 'CAD', value: stats.cad, color: 'text-blue-600' },
            { label: 'US', value: stats.us, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Maturity Timeline ── */}
      {bonds.length > 0 && <MaturityTimeline bonds={bonds} />}

      {/* ── Classement recommandé ── */}
      {bonds.length > 0 && (() => {
        const scored = scoreBonds(bonds);
        // Only real bonds (with coupon), exclude funds
        const realBonds = scored.filter(s => s.couponScore > 0 && !(/\/N'FRAC|\/FR|\/SF|ETF/i.test(s.bond.description || '')));
        const topBonds = realBonds.slice(0, 25);
        const fundCount = scored.length - realBonds.length;

        return (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => setShowRanking(!showRanking)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Award className="h-5 w-5 text-amber-500" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-text-main block">Classement recommande</span>
                  <span className="text-xs text-text-muted">Top 25 obligations pour portefeuilles modeles ({realBonds.length} obligations, {fundCount} fonds exclus)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showRanking ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
              </div>
            </button>

            {showRanking && (
              <div className="border-t border-gray-100">
                {/* Légende des scores */}
                <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3 text-brand-primary" /> Coupon /30</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-violet-500" /> Echeance /25</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-emerald-500" /> Taille /25</span>
                  <span className="flex items-center gap-1"><Award className="h-3 w-3 text-amber-500" /> Type /20</span>
                </div>

                <div className="divide-y divide-gray-50">
                  {topBonds.map((s, i) => {
                    const rank = i + 1;
                    const medal = rank === 1 ? 'bg-amber-400 text-white' : rank === 2 ? 'bg-gray-300 text-white' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-text-muted';
                    const desc = s.bond.description || '';
                    const displayName = s.bond.issuer || desc.substring(0, 25);
                    const maturityLabel = s.yearsToMaturity !== null
                      ? s.yearsToMaturity < 1 ? '< 1 an' : `${s.yearsToMaturity.toFixed(1)} ans`
                      : '—';

                    return (
                      <div key={s.bond.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                        {/* Rank */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${medal}`}>
                          {rank}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-main truncate" title={desc}>{displayName}</div>
                          <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                            {s.bond.coupon != null && <span className="font-mono">{s.bond.coupon}%</span>}
                            <span>{maturityLabel}</span>
                            {s.bond.price != null && s.bond.price > 0 && (
                              <span>${(s.bond.price / 1000).toFixed(0)}k</span>
                            )}
                          </div>
                        </div>
                        {/* Score breakdown — mini bars */}
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="w-14 flex flex-col items-end gap-0.5" title={`Coupon: ${s.couponScore}/30 | Echeance: ${s.maturityScore}/25 | Taille: ${s.sizeScore}/25 | Type: ${s.typeScore}/20`}>
                            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                              <div className="h-full bg-brand-primary rounded-full" style={{ width: `${(s.couponScore / 30) * 100}%` }} />
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                              <div className="h-full bg-violet-400 rounded-full" style={{ width: `${(s.maturityScore / 25) * 100}%` }} />
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(s.sizeScore / 25) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                        {/* Total score */}
                        <div className="text-right shrink-0 w-12">
                          <span className={`text-sm font-bold ${
                            s.score >= 70 ? 'text-emerald-600' : s.score >= 50 ? 'text-brand-primary' : 'text-text-muted'
                          }`}>
                            {s.score}
                          </span>
                          <span className="text-[10px] text-text-muted">/100</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Collapsible bond list ── */}
      {bonds.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowList(!showList)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
          >
            <span className="text-sm font-semibold text-text-main">Voir les obligations</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{bonds.length}</Badge>
              {showList ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
            </div>
          </button>

          {showList && (
            <div className="border-t border-gray-100">
              {/* Filter */}
              <div className="px-4 py-3 border-b border-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filtrer par emetteur ou CUSIP..."
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                  />
                  {filter && (
                    <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
              {/* List */}
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {filteredBonds.slice(0, 200).map(bond => (
                  <div key={bond.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/70 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-main truncate">{bond.issuer || bond.description}</div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        {bond.cusip && <span className="font-mono">{bond.cusip}</span>}
                        {bond.coupon != null && <span>{bond.coupon}%</span>}
                        {bond.maturity && <span>{new Date(bond.maturity).toLocaleDateString('fr-CA')}</span>}
                      </div>
                    </div>
                    <Badge variant={bond.source === 'CAD' ? 'info' : bond.source === 'US' ? 'warning' : 'default'}>
                      {bond.source}
                    </Badge>
                    {bond.price != null && (
                      <span className="text-xs font-mono text-text-muted w-14 text-right shrink-0">{bond.price.toFixed(2)}</span>
                    )}
                    <Trash2
                      onClick={() => {
                        fetch('/api/models/bonds', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: bond.id }),
                        }).then(() => { toast('success', 'Retiree'); mutate(); });
                      }}
                      className="h-3.5 w-3.5 text-gray-300 hover:text-red-500 cursor-pointer transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    />
                  </div>
                ))}
              </div>
              {filteredBonds.length > 200 && (
                <p className="text-xs text-text-muted text-center py-3 border-t border-gray-100">
                  Affichage limite a 200 / {filteredBonds.length}. Utilisez le filtre.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

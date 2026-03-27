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
  Lock, Unlock,
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

function BondsTab() {
  const { bonds, stats, isLoading, mutate } = useBondsUniverse();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showList, setShowList] = useState(false);
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
                Bonds CAD.xlsm ou Bonds US.xlsm
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

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
  Lock, Unlock, Award, BarChart3, Clock, DollarSign, Calendar, PieChart, Check, Info, ChevronUp, ClipboardPaste, Package,
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

// ── ETF sector breakdown type ──
interface ETFSector { sector: string; weight: number }

// ── Batch queue item ──
interface QueueItem {
  symbol: string;
  name: string;
  logo: string | null;
  type: string;
  sector: string | null; // auto-detected or null
  status: 'detecting' | 'ready' | 'adding' | 'done' | 'error';
}

// ── Quick packs ──
const QUICK_PACKS = [
  { label: 'Banques CA', symbols: ['RY.TO', 'TD.TO', 'BNS.TO', 'BMO.TO', 'CM.TO', 'NA.TO'] },
  { label: 'Big Tech', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META'] },
  { label: 'Energie CA', symbols: ['ENB.TO', 'TRP.TO', 'CNQ.TO', 'SU.TO', 'CVE.TO'] },
  { label: 'Telcos CA', symbols: ['T.TO', 'BCE.TO', 'RCI-B.TO'] },
  { label: 'Utilities CA', symbols: ['FTS.TO', 'EMA.TO', 'AQN.TO', 'H.TO'] },
  { label: 'Immobilier CA', symbols: ['REI-UN.TO', 'CAR-UN.TO', 'HR-UN.TO', 'AP-UN.TO'] },
] as const;

function StocksTab() {
  const { stocks, bySector, sectors, isLoading, mutate } = useStockUniverse();
  const { toast } = useToast();
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set(sectors));

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Pending add (single item — for sector picker or ETF) ──
  const [pending, setPending] = useState<{
    symbol: string; name: string; logo: string | null; type: string;
  } | null>(null);

  // ── Batch queue (multi-add) ──
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [addingQueue, setAddingQueue] = useState(false);

  // ── ETF sector breakdown ──
  const [etfSectors, setEtfSectors] = useState<ETFSector[] | null>(null);
  const [loadingEtfSectors, setLoadingEtfSectors] = useState(false);
  const [addingEtf, setAddingEtf] = useState(false);

  // ── Stock sector auto-detection (single pending) ──
  const [detectedSector, setDetectedSector] = useState<string | null>(null);
  const [detectedIndustry, setDetectedIndustry] = useState<string | null>(null);
  const [loadingSector, setLoadingSector] = useState(false);

  // When pending changes, fetch sector info (single mode)
  useEffect(() => {
    if (!pending) {
      setEtfSectors(null);
      setDetectedSector(null);
      setDetectedIndustry(null);
      return;
    }
    let cancelled = false;
    if (pending.type === 'ETF') {
      setDetectedSector(null);
      setDetectedIndustry(null);
      setLoadingEtfSectors(true);
      setEtfSectors(null);
      fetch(`/api/models/etf-sectors?symbol=${encodeURIComponent(pending.symbol)}`)
        .then(r => r.json())
        .then(data => { if (!cancelled) setEtfSectors(data.sectors || null); })
        .catch(() => { if (!cancelled) setEtfSectors(null); })
        .finally(() => { if (!cancelled) setLoadingEtfSectors(false); });
    } else {
      setEtfSectors(null);
      setLoadingSector(true);
      setDetectedSector(null);
      setDetectedIndustry(null);
      fetch(`/api/models/stock-sector?symbol=${encodeURIComponent(pending.symbol)}`)
        .then(r => r.json())
        .then(data => {
          if (!cancelled) {
            setDetectedSector(data.sector || null);
            setDetectedIndustry(data.industry || null);
          }
        })
        .catch(() => { if (!cancelled) setDetectedSector(null); })
        .finally(() => { if (!cancelled) setLoadingSector(false); });
    }
    return () => { cancelled = true; };
  }, [pending]);

  // ── Detect sector for a queue item ──
  async function detectSectorForItem(symbol: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/models/stock-sector?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      return data.sector || null;
    } catch { return null; }
  }

  // ── Add symbol to batch queue with auto-detect ──
  function addToQueue(symbol: string, name: string, logo: string | null, type: string) {
    // Skip if already in queue
    if (queue.some(q => q.symbol === symbol)) return;

    const item: QueueItem = { symbol, name, logo, type, sector: null, status: 'detecting' };
    setQueue(prev => [...prev, item]);

    // Auto-detect sector
    detectSectorForItem(symbol).then(sector => {
      setQueue(prev => prev.map(q =>
        q.symbol === symbol ? { ...q, sector, status: 'ready' } : q
      ));
    });
  }

  // ── Remove from queue ──
  function removeFromQueue(symbol: string) {
    setQueue(prev => prev.filter(q => q.symbol !== symbol));
  }

  // ── Change sector in queue ──
  function changeQueueSector(symbol: string, sector: string) {
    setQueue(prev => prev.map(q =>
      q.symbol === symbol ? { ...q, sector } : q
    ));
  }

  // ── Add all queue items ──
  async function addAllQueue() {
    const ready = queue.filter(q => q.status === 'ready' && q.sector);
    if (ready.length === 0) return;
    setAddingQueue(true);
    let added = 0;
    const addedSectors: string[] = [];
    for (const item of ready) {
      setQueue(prev => prev.map(q => q.symbol === item.symbol ? { ...q, status: 'adding' } : q));
      try {
        const res = await fetch('/api/models/universe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: item.symbol,
            name: item.name,
            sector: item.sector,
            stock_type: 'variable',
            logo_url: item.logo,
          }),
        });
        if (res.ok) {
          added++;
          if (item.sector) addedSectors.push(item.sector);
          setQueue(prev => prev.map(q => q.symbol === item.symbol ? { ...q, status: 'done' } : q));
        } else {
          setQueue(prev => prev.map(q => q.symbol === item.symbol ? { ...q, status: 'error' } : q));
        }
      } catch {
        setQueue(prev => prev.map(q => q.symbol === item.symbol ? { ...q, status: 'error' } : q));
      }
    }
    toast('success', `${added} titre${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}`);
    setExpandedSectors(prev => new Set([...prev, ...addedSectors]));
    // Clear done items after a short delay
    setTimeout(() => setQueue(prev => prev.filter(q => q.status !== 'done')), 800);
    setAddingQueue(false);
    mutate();
  }

  // ── Paste handler: detect "AAPL, MSFT, RY.TO" ──
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').trim();
    // Detect multiple symbols (comma, space, newline separated)
    const symbols = text.split(/[\s,;\n\t]+/).map(s => s.trim().toUpperCase()).filter(s => s.length >= 1 && s.length <= 15 && /^[A-Z0-9.\-]+$/.test(s));
    if (symbols.length >= 2) {
      e.preventDefault();
      setSearchQuery('');
      setSearchResults([]);
      setPending(null);
      // Resolve each symbol via search API and add to queue
      for (const sym of symbols) {
        // Quick resolve via search
        fetch(`/api/search?q=${encodeURIComponent(sym)}`)
          .then(r => r.json())
          .then((data: SearchResult[]) => {
            const match = Array.isArray(data) ? data.find(r => r.symbol.toUpperCase() === sym || r.symbol.toUpperCase() === `${sym}.TO`) : null;
            if (match) {
              addToQueue(match.symbol, match.name, match.logo, match.type);
            } else if (data.length > 0) {
              addToQueue(data[0].symbol, data[0].name, data[0].logo, data[0].type);
            }
          })
          .catch(() => {});
      }
      toast('info', `Resolution de ${symbols.length} symboles...`);
    }
  }

  // ── Quick pack handler ──
  function addPack(symbols: readonly string[]) {
    setPending(null);
    setSearchResults([]);
    setSearchQuery('');
    for (const sym of symbols) {
      fetch(`/api/search?q=${encodeURIComponent(sym)}`)
        .then(r => r.json())
        .then((data: SearchResult[]) => {
          const match = Array.isArray(data) ? data.find(r => r.symbol.toUpperCase() === sym.toUpperCase()) : null;
          if (match) {
            addToQueue(match.symbol, match.name, match.logo, match.type);
          } else if (data.length > 0) {
            addToQueue(data[0].symbol, data[0].name, data[0].logo, data[0].type);
          }
        })
        .catch(() => {});
    }
    toast('info', `Resolution de ${symbols.length} symboles...`);
  }

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

  // Select from search → single mode (sector picker) or add to queue if queue is active
  function selectResult(r: SearchResult) {
    if (queue.length > 0) {
      // Queue mode: add to batch
      addToQueue(r.symbol, r.name, r.logo, r.type);
      setSearchResults([]);
      setSearchQuery('');
    } else {
      // Single mode
      setPending({ symbol: r.symbol, name: r.name, logo: r.logo, type: r.type });
      setSearchResults([]);
      setSearchQuery('');
    }
  }

  // Add ETF to all detected sectors at once
  async function addEtfToAllSectors() {
    if (!pending || !etfSectors || etfSectors.length === 0) return;
    setAddingEtf(true);
    const addedSectors: string[] = [];
    try {
      for (const { sector } of etfSectors) {
        const res = await fetch('/api/models/universe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: pending.symbol, name: pending.name, sector,
            stock_type: 'variable', logo_url: pending.logo,
          }),
        });
        if (res.ok) addedSectors.push(sector);
      }
      toast('success', `${pending.symbol} ajouté dans ${addedSectors.length} secteurs`);
      setPending(null);
      setExpandedSectors(prev => new Set([...prev, ...addedSectors]));
      mutate();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setAddingEtf(false);
    }
  }

  // Pick sector → add immediately (for stocks or manual ETF fallback)
  async function addToSector(sectorValue: string) {
    if (!pending) return;
    try {
      const res = await fetch('/api/models/universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: pending.symbol, name: pending.name, sector: sectorValue,
          stock_type: 'variable', logo_url: pending.logo,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      const sectorLabel = SECTORS.find(s => s.value === sectorValue)?.label || sectorValue;
      toast('success', `${pending.symbol} ajouté dans ${sectorLabel}`);
      setPending(null);
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

      {/* ── Search bar + paste support ── */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onPaste={handlePaste}
            placeholder="Rechercher ou coller plusieurs symboles (AAPL, RY.TO, MSFT)"
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
                  {r.type === 'ETF' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px] font-bold">
                      <PieChart className="h-2.5 w-2.5" /> ETF
                    </span>
                  )}
                  <Badge variant="outline">{r.exchange}</Badge>
                  <Plus className="h-4 w-4 text-brand-primary" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick packs ── */}
      {!pending && queue.length === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted mr-1">Ajout rapide :</span>
          {QUICK_PACKS.map(pack => (
            <button
              key={pack.label}
              onClick={() => addPack(pack.symbols)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-text-main hover:border-brand-primary hover:text-brand-primary transition-colors"
            >
              <Package className="h-3 w-3" />
              {pack.label}
              <span className="text-text-muted">({pack.symbols.length})</span>
            </button>
          ))}
          <span className="text-[10px] text-text-muted ml-1 flex items-center gap-1">
            <ClipboardPaste className="h-3 w-3" /> ou collez une liste
          </span>
        </div>
      )}

      {/* ── Batch queue ── */}
      {queue.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-brand-primary/20 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-text-main">
              {queue.length} titre{queue.length > 1 ? 's' : ''} en attente
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQueue([])}
                className="text-xs text-text-muted hover:text-red-500 transition-colors"
              >
                Tout retirer
              </button>
              <button
                onClick={addAllQueue}
                disabled={addingQueue || queue.every(q => q.status !== 'ready' || !q.sector)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
              >
                {addingQueue ? <><Spinner size="sm" /> Ajout...</> : <><Check className="h-3.5 w-3.5" /> Tout ajouter</>}
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
            {queue.map(item => {
              const sectorLabel = item.sector ? (SECTORS.find(s => s.value === item.sector)?.label || item.sector) : null;
              const meta = item.sector ? SECTOR_META[item.sector] : null;
              const Icon = meta?.Icon || TrendingUp;
              return (
                <div key={item.symbol} className={`flex items-center gap-3 px-5 py-2.5 ${item.status === 'done' ? 'bg-emerald-50/50' : item.status === 'error' ? 'bg-red-50/50' : ''}`}>
                  {item.logo ? (
                    <img src={item.logo} alt="" className="h-8 w-8 rounded-full object-contain bg-white border border-gray-100 shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-mono font-semibold text-sm text-text-main">{item.symbol}</span>
                    <span className="text-xs text-text-muted ml-2 truncate">{item.name}</span>
                  </div>
                  {/* Sector */}
                  {item.status === 'detecting' ? (
                    <Spinner size="sm" />
                  ) : item.status === 'done' ? (
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : item.sector ? (
                    <select
                      value={item.sector}
                      onChange={(e) => changeQueueSector(item.symbol, e.target.value)}
                      className={`text-xs font-medium rounded-lg border px-2 py-1 ${meta?.border || 'border-gray-200'} ${meta?.bg || 'bg-gray-50'} ${meta?.color || 'text-text-main'} focus:outline-none`}
                    >
                      {SECTORS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value=""
                      onChange={(e) => changeQueueSector(item.symbol, e.target.value)}
                      className="text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-600 px-2 py-1 focus:outline-none"
                    >
                      <option value="" disabled>Choisir...</option>
                      {SECTORS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  )}
                  {/* Remove */}
                  {item.status !== 'done' && (
                    <button onClick={() => removeFromQueue(item.symbol)} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sector picker / ETF auto-breakdown (appears after selecting a search result) ── */}
      {pending && (
        <div className="bg-white rounded-2xl border-2 border-brand-primary/30 p-5 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Selected stock/ETF preview */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            {pending.logo ? (
              <img src={pending.logo} alt="" className="h-10 w-10 rounded-full object-contain bg-white border border-gray-100" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-text-main">{pending.symbol}</span>
                {pending.type === 'ETF' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-bold uppercase">
                    <PieChart className="h-3 w-3" /> ETF
                  </span>
                )}
              </div>
              <div className="text-sm text-text-muted">{pending.name}</div>
            </div>
            <button onClick={() => setPending(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ETF: auto sector breakdown */}
          {pending.type === 'ETF' ? (
            <div>
              {loadingEtfSectors ? (
                <div className="flex items-center justify-center gap-3 py-6">
                  <Spinner size="sm" />
                  <span className="text-sm text-text-muted">Analyse de la repartition sectorielle...</span>
                </div>
              ) : etfSectors && etfSectors.length > 0 ? (
                <>
                  <p className="text-sm font-medium text-text-main mb-3 flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-violet-500" />
                    Repartition sectorielle detectee
                  </p>
                  {/* Sector bars */}
                  <div className="space-y-2 mb-4">
                    {etfSectors.map(({ sector, weight }) => {
                      const meta = SECTOR_META[sector];
                      const sectorLabel = SECTORS.find(s => s.value === sector)?.label || sector;
                      const Icon = meta?.Icon || TrendingUp;
                      const pct = Math.round(weight * 100);
                      return (
                        <div key={sector} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg ${meta?.bg || 'bg-gray-100'} flex items-center justify-center shrink-0`}>
                            <Icon className={`h-4 w-4 ${meta?.color || 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-medium text-text-main">{sectorLabel}</span>
                              <span className="text-xs font-mono font-semibold text-text-muted">{pct}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${meta?.color?.replace('text-', 'bg-') || 'bg-gray-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Confirm button */}
                  <button
                    onClick={addEtfToAllSectors}
                    disabled={addingEtf}
                    className="w-full py-3 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:bg-brand-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {addingEtf ? (
                      <><Spinner size="sm" /> Ajout en cours...</>
                    ) : (
                      <><Check className="h-4 w-4" /> Ajouter dans {etfSectors.length} secteurs</>
                    )}
                  </button>
                </>
              ) : (
                /* ETF but no sector data found → fallback to manual picker */
                <>
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                    Repartition non disponible pour cet ETF. Choisissez le secteur manuellement.
                  </p>
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
                </>
              )}
            </div>
          ) : (
            /* Regular stock: sector picker with auto-detection */
            <>
              {loadingSector ? (
                <div className="flex items-center gap-2 mb-3">
                  <Spinner size="sm" />
                  <span className="text-sm text-text-muted">Detection du secteur...</span>
                </div>
              ) : detectedSector ? (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-text-main">Secteur detecte</p>
                    <span className="text-[10px] text-text-muted">(cliquez un autre pour modifier)</span>
                  </div>
                  {detectedIndustry && (
                    <p className="text-xs text-text-muted mb-2">Industrie : {detectedIndustry}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-text-main mb-3">Dans quel secteur?</p>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {SECTORS.map(s => {
                  const meta = SECTOR_META[s.value];
                  const Icon = meta?.Icon || TrendingUp;
                  const isDetected = detectedSector === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => addToSector(s.value)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 group hover:scale-[1.02] ${
                        isDetected
                          ? `${meta?.border || 'border-brand-primary'} ${meta?.bg || 'bg-gray-50'} shadow-md ring-2 ring-offset-1 ${meta?.border?.replace('border-', 'ring-') || 'ring-brand-primary'}`
                          : 'border-gray-100 hover:border-transparent hover:shadow-md'
                      } ${!isDetected ? (meta?.bg || 'bg-gray-50') : ''}`}
                    >
                      {isDetected && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <Icon className={`h-5 w-5 ${meta?.color || 'text-gray-500'} transition-transform group-hover:scale-110`} />
                      <span className={`text-xs font-medium text-center leading-tight ${isDetected ? 'text-text-main font-bold' : 'text-text-main'}`}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
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

// ── Bond Gains Analyzer ──
interface BondGainInfo {
  bond: UniverseBond;
  yearsToMaturity: number;
  annualCoupon: number;
  totalReturnPct: number;
  bucket: string;
}

const GAIN_BUCKETS = [
  { key: 'lt1',   label: '< 1 an',   min: -Infinity, max: 1,   color: 'bg-red-400',     text: 'text-red-600',    lightBg: 'bg-red-50',    border: 'border-red-200' },
  { key: '1to3',  label: '1-3 ans',  min: 1,         max: 3,   color: 'bg-amber-400',   text: 'text-amber-600',  lightBg: 'bg-amber-50',  border: 'border-amber-200' },
  { key: '3to5',  label: '3-5 ans',  min: 3,         max: 5,   color: 'bg-emerald-400', text: 'text-emerald-600', lightBg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: '5to7',  label: '5-7 ans',  min: 5,         max: 7,   color: 'bg-blue-400',    text: 'text-blue-600',   lightBg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: '7to10', label: '7-10 ans', min: 7,         max: 10,  color: 'bg-violet-400',  text: 'text-violet-600', lightBg: 'bg-violet-50', border: 'border-violet-200' },
  { key: 'gt10',  label: '10+ ans',  min: 10,        max: Infinity, color: 'bg-slate-400', text: 'text-slate-500', lightBg: 'bg-slate-50', border: 'border-slate-200' },
] as const;

function analyzeBondGains(bonds: UniverseBond[]): BondGainInfo[] {
  const now = new Date();
  const results: BondGainInfo[] = [];

  for (const bond of bonds) {
    if (!bond.coupon || !bond.maturity) continue;
    const desc = bond.description || '';
    if (/\/N'FRAC|\/FR|\/SF|ETF/i.test(desc)) continue;

    const matDate = new Date(bond.maturity);
    const yearsToMaturity = Math.max(0, (matDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (yearsToMaturity < 0.05) continue;

    const totalReturnPct = bond.coupon * yearsToMaturity;

    let bucket = 'gt10';
    for (const b of GAIN_BUCKETS) {
      if (yearsToMaturity >= b.min && yearsToMaturity < b.max) { bucket = b.key; break; }
    }

    results.push({ bond, yearsToMaturity, annualCoupon: bond.coupon, totalReturnPct, bucket });
  }

  return results.sort((a, b) => b.totalReturnPct - a.totalReturnPct);
}

function BondGainsAnalyzer({ bonds }: { bonds: UniverseBond[] }) {
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const gains = analyzeBondGains(bonds);
  if (gains.length === 0) return null;

  const bucketData = GAIN_BUCKETS.map(b => {
    const items = gains.filter(g => g.bucket === b.key);
    const count = items.length;
    const avgCoupon = count > 0 ? items.reduce((s, g) => s + g.annualCoupon, 0) / count : 0;
    const avgTotalReturn = count > 0 ? items.reduce((s, g) => s + g.totalReturnPct, 0) / count : 0;
    const sortedItems = [...items].sort((a, b) => b.totalReturnPct - a.totalReturnPct);
    return { ...b, count, avgCoupon, avgTotalReturn, items: sortedItems };
  });

  const totalBonds = gains.length;
  const avgCouponAll = gains.reduce((s, g) => s + g.annualCoupon, 0) / totalBonds;
  const avgReturnAll = gains.reduce((s, g) => s + g.totalReturnPct, 0) / totalBonds;
  const maxBucketCount = Math.max(1, ...bucketData.map(b => b.count));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-sm font-bold text-text-main block">Gains estimes</span>
            <span className="text-xs text-text-muted">{totalBonds} obligations — coupon x annees restantes</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-sm font-bold text-text-main">{avgCouponAll.toFixed(2)}%</span>
            <span className="text-[10px] text-text-muted block">coupon moy.</span>
          </div>
          <div>
            <span className="text-sm font-bold text-emerald-600">+{avgReturnAll.toFixed(1)}%</span>
            <span className="text-[10px] text-text-muted block">gain moy. total</span>
          </div>
        </div>
      </div>

      {/* Buckets */}
      <div className="divide-y divide-gray-50">
        {bucketData.map(b => {
          if (b.count === 0) return null;
          const barWidth = (b.count / maxBucketCount) * 100;
          const isExpanded = expandedBucket === b.key;

          return (
            <div key={b.key}>
              <button
                onClick={() => setExpandedBucket(isExpanded ? null : b.key)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors"
              >
                <span className={`w-3 h-3 rounded-full ${b.color} shrink-0`} />
                <span className="text-sm font-semibold text-text-main w-20 text-left shrink-0">{b.label}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${b.color} transition-all duration-500`} style={{ width: `${barWidth}%` }} />
                </div>
                <span className="text-xs text-text-muted w-8 text-right shrink-0">{b.count}</span>
                <div className="text-right shrink-0 w-24">
                  <span className="text-sm font-bold text-emerald-600 block leading-tight">+{b.avgTotalReturn.toFixed(1)}% <span className="text-[10px] font-medium text-emerald-500">total</span></span>
                  <span className="text-[11px] text-emerald-500">{b.avgCoupon.toFixed(2)}% <span className="text-[10px]">/ an</span></span>
                </div>
                {isExpanded
                  ? <ChevronUp className="h-3.5 w-3.5 text-text-muted shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0" />
                }
              </button>

              {isExpanded && (
                <div className={`${b.lightBg} border-t border-b ${b.border} divide-y divide-white/60`}>
                  {/* Column headers */}
                  <div className="flex items-center gap-3 px-5 py-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wide">
                    <span className="w-5 shrink-0" />
                    <span className="flex-1">Emetteur</span>
                    <span className="w-16 text-right">Echeance</span>
                    <span className="w-16 text-right">/ an</span>
                    <span className="w-16 text-right">Total</span>
                  </div>
                  {b.items.map((g, idx) => {
                    const name = g.bond.issuer || g.bond.description?.substring(0, 25) || '—';
                    return (
                      <div key={g.bond.id} className="flex items-center gap-3 px-5 py-2 hover:bg-white/50 transition-colors">
                        <span className="text-[10px] font-mono text-text-muted w-5 text-center shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-main truncate" title={g.bond.description || ''}>{name}</p>
                        </div>
                        <span className="text-xs text-text-muted w-16 text-right shrink-0">{g.yearsToMaturity.toFixed(1)} ans</span>
                        <span className="text-xs font-medium text-emerald-600 w-16 text-right shrink-0">{g.annualCoupon}%</span>
                        <span className="text-xs font-bold text-emerald-600 w-16 text-right shrink-0">+{g.totalReturnPct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: legend + note */}
      <div className="px-5 py-3 border-t border-gray-100 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-muted">
          {GAIN_BUCKETS.map(b => {
            const count = bucketData.find(d => d.key === b.key)?.count || 0;
            if (count === 0) return null;
            return (
              <span key={b.key} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${b.color} inline-block`} />
                {b.label} ({count})
              </span>
            );
          })}
        </div>
        <button
          onClick={() => setShowNote(!showNote)}
          className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-main transition-colors"
        >
          <Info className="h-3 w-3" />
          <span>Gain total = coupon x annees restantes, au pair, sans reinvestissement</span>
          {showNote ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showNote && (
          <p className="text-[10px] text-text-muted leading-relaxed pl-4">
            Le coupon et l&apos;echeance proviennent de la liste mensuelle importee. Le calcul suppose un achat au pair (100$) et ne tient pas compte du gain/perte en capital ni du reinvestissement des coupons. Utile pour comparer rapidement les obligations entre elles.
          </p>
        )}
      </div>
    </div>
  );
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

      {/* ── Bond Gains Analyzer ── */}
      {bonds.length > 0 && <BondGainsAnalyzer bonds={bonds} />}

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

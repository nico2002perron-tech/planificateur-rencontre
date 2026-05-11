'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, Plus, X, Trash2, Sparkles, BarChart3, AlertCircle,
  GripVertical, ChevronDown, PieChart, Loader2,
} from 'lucide-react';

// ── Duolingo palette ───────────────────────────────────────────────────────

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
  red: '#FF4B4B', redDark: '#ea2b2b',
  teal: '#00CD9C', tealDark: '#00b386',
} as const;

const ALLOC_COLORS = [
  DUO.blue, DUO.purple, DUO.green, DUO.orange, '#FF6B6B', DUO.teal,
  '#6C5CE7', '#FDCB6E', '#E17055', '#00CEC9', '#A29BFE', '#55A3F5',
  '#FF85A1', '#2ED573', '#FFA502', '#7BED9F', '#70A1FF', '#FF6348',
  '#5352ED', '#ECCC68',
];

// ── Types ──────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  symbol: string;
  name: string;
  weight: number; // percentage 0-100
  exchange?: string;
  type?: string;
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

interface BenchmarkOption {
  symbol: string;
  label: string;
}

const BENCHMARKS: BenchmarkOption[] = [
  { symbol: 'XIU.TO', label: 'S&P/TSX 60 (XIU)' },
  { symbol: 'XIC.TO', label: 'S&P/TSX Composite (XIC)' },
  { symbol: 'SPY', label: 'S&P 500 (SPY)' },
  { symbol: 'VTI', label: 'Total US Market (VTI)' },
  { symbol: 'VBAL.TO', label: 'Vanguard Balanced (VBAL)' },
  { symbol: 'XBAL.TO', label: 'iShares Balanced (XBAL)' },
];

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAnalysisComplete: (data: any) => void;
}

export function PortfolioBuilder({ onAnalysisComplete }: Props) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [portfolioName, setPortfolioName] = useState('Portefeuille Modèle');
  const [benchmark, setBenchmark] = useState('XIU.TO');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBenchmark, setShowBenchmark] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search FMP API
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fmp/search?q=${encodeURIComponent(query)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          const results: SearchResult[] = (data ?? []).map((r: Record<string, string>) => ({
            symbol: r.symbol,
            name: r.name,
            exchange: r.stockExchange ?? r.exchangeShortName ?? '',
            type: r.type ?? '',
          }));
          setSearchResults(results);
          setShowResults(true);
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Add holding
  const addHolding = useCallback((result: SearchResult) => {
    if (holdings.some(h => h.symbol === result.symbol)) {
      setSearchQuery('');
      setShowResults(false);
      return;
    }

    const remaining = Math.max(0, 100 - holdings.reduce((s, h) => s + h.weight, 0));
    const defaultWeight = holdings.length === 0 ? 100 : Math.round(remaining / 2 * 10) / 10 || 5;

    setHoldings(prev => [...prev, {
      id: crypto.randomUUID(),
      symbol: result.symbol,
      name: result.name,
      weight: defaultWeight,
      exchange: result.exchange,
      type: result.type,
    }]);
    setSearchQuery('');
    setShowResults(false);
  }, [holdings]);

  // Remove holding
  const removeHolding = useCallback((id: string) => {
    setHoldings(prev => prev.filter(h => h.id !== id));
  }, []);

  // Update weight
  const updateWeight = useCallback((id: string, weight: number) => {
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, weight: Math.max(0, Math.min(100, weight)) } : h));
  }, []);

  // Equalize weights
  const equalizeWeights = useCallback(() => {
    if (holdings.length === 0) return;
    const w = Math.round(100 / holdings.length * 10) / 10;
    setHoldings(prev => prev.map(h => ({ ...h, weight: w })));
  }, [holdings.length]);

  // Run analysis
  const runAnalysis = useCallback(async () => {
    if (holdings.length === 0) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch('/api/portfolio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings: holdings.map(h => ({ symbol: h.symbol, weight: h.weight, name: h.name })),
          benchmark,
          name: portfolioName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      const data = await res.json();
      onAnalysisComplete(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setIsAnalyzing(false);
    }
  }, [holdings, benchmark, portfolioName, onAnalysisComplete]);

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const isValid = holdings.length >= 2 && totalWeight > 0;
  const weightOk = Math.abs(totalWeight - 100) < 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Left: Search & Holdings List ─────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">
        {/* Portfolio name + benchmark */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={portfolioName}
            onChange={(e) => setPortfolioName(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/30 transition-all"
            style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
            placeholder="Nom du portefeuille..."
          />
          <div className="relative">
            <button
              onClick={() => setShowBenchmark(!showBenchmark)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white text-xs font-bold text-text-muted hover:text-text-main transition-all"
              style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {BENCHMARKS.find(b => b.symbol === benchmark)?.label ?? benchmark}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showBenchmark && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1">
                {BENCHMARKS.map((b) => (
                  <button
                    key={b.symbol}
                    onClick={() => { setBenchmark(b.symbol); setShowBenchmark(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      benchmark === b.symbol ? 'bg-[#1CB0F6]/10 text-[#1CB0F6]' : 'text-text-main hover:bg-gray-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div ref={searchRef} className="relative">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white transition-all"
            style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
          >
            {isSearching ? (
              <Loader2 className="h-5 w-5 text-[#1CB0F6] animate-spin flex-shrink-0" />
            ) : (
              <Search className="h-5 w-5 text-text-muted flex-shrink-0" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              className="flex-1 text-sm text-text-main placeholder:text-text-muted focus:outline-none bg-transparent"
              placeholder="Rechercher un titre (ex: RY, Apple, XIU, MSFT...)"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}>
                <X className="h-4 w-4 text-text-muted hover:text-text-main" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-72 overflow-y-auto">
              {searchResults.map((r) => {
                const alreadyAdded = holdings.some(h => h.symbol === r.symbol);
                return (
                  <button
                    key={r.symbol}
                    onClick={() => !alreadyAdded && addHolding(r)}
                    disabled={alreadyAdded}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${
                      alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#1CB0F6]/5'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
                      <span className="text-[10px] font-extrabold text-text-main">
                        {r.symbol.replace('.TO', '').slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-text-main truncate">{r.symbol}</div>
                      <div className="text-xs text-text-muted truncate">{r.name}</div>
                    </div>
                    <div className="text-[10px] text-text-muted">{r.exchange}</div>
                    {alreadyAdded ? (
                      <span className="text-[10px] font-bold text-[#58CC02]">Ajouté</span>
                    ) : (
                      <Plus className="h-4 w-4 text-[#1CB0F6]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Holdings list */}
        {holdings.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ border: '2px dashed #e5e7eb' }}
          >
            <Search className="h-10 w-10 text-text-muted/30 mx-auto mb-3" />
            <p className="text-sm font-bold text-text-muted">Aucune position</p>
            <p className="text-xs text-text-muted/70 mt-1">
              Utilisez la barre de recherche pour ajouter des titres à votre portefeuille modèle.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="w-6" />
              <span className="flex-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">Titre</span>
              <span className="w-24 text-[10px] font-bold text-text-muted uppercase tracking-wider text-center">Pondération</span>
              <span className="w-16 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">%</span>
              <span className="w-8" />
            </div>

            {holdings.map((h, idx) => (
              <div
                key={h.id}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white transition-all hover:shadow-sm group"
                style={{ border: '2px solid #f1f5f9', borderLeft: `4px solid ${ALLOC_COLORS[idx % ALLOC_COLORS.length]}` }}
              >
                <GripVertical className="h-4 w-4 text-text-muted/30 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-text-main">{h.symbol}</span>
                    <span className="text-xs text-text-muted truncate">{h.name}</span>
                  </div>
                </div>
                <div className="w-24">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={h.weight}
                    onChange={(e) => updateWeight(h.id, parseFloat(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${ALLOC_COLORS[idx % ALLOC_COLORS.length]} 0%, ${ALLOC_COLORS[idx % ALLOC_COLORS.length]} ${h.weight}%, #e5e7eb ${h.weight}%, #e5e7eb 100%)`,
                    }}
                  />
                </div>
                <div className="w-16 flex items-center justify-end gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={h.weight}
                    onChange={(e) => updateWeight(h.id, parseFloat(e.target.value) || 0)}
                    className="w-12 text-right text-sm font-bold text-text-main bg-transparent focus:outline-none focus:bg-gray-50 rounded px-1"
                  />
                  <span className="text-xs text-text-muted">%</span>
                </div>
                <button
                  onClick={() => removeHolding(h.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            ))}

            {/* Actions row */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={equalizeWeights}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-gray-50 transition-all"
              >
                <PieChart className="h-3.5 w-3.5" />
                Égaliser
              </button>
              <div className="flex-1" />
              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                weightOk ? 'bg-[#58CC02]/10 text-[#45a300]' : 'bg-[#FF9600]/10 text-[#e08600]'
              }`}>
                Total: {totalWeight.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-700">{error}</span>
          </div>
        )}

        {/* Analyze button */}
        <button
          onClick={runAnalysis}
          disabled={!isValid || isAnalyzing}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-[2px]"
          style={{
            backgroundColor: isValid ? DUO.green : '#cbd5e1',
            boxShadow: isValid ? `0 4px 0 0 ${DUO.greenDark}` : 'none',
          }}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours... (peut prendre 30-60 secondes)
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analyser le portefeuille ({holdings.length} titres)
            </>
          )}
        </button>

        {!isValid && holdings.length > 0 && holdings.length < 2 && (
          <p className="text-xs text-text-muted text-center">Ajoutez au moins 2 titres pour lancer l&apos;analyse.</p>
        )}
      </div>

      {/* ── Right: Live allocation preview ───────────────────────────── */}
      <div className="space-y-4">
        {/* Mini pie chart preview */}
        <div
          className="rounded-2xl bg-white p-5"
          style={{ border: '2px solid #f1f5f9' }}
        >
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Allocation</h3>

          {holdings.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <PieChart className="h-12 w-12 text-gray-200" />
            </div>
          ) : (
            <>
              {/* Visual allocation bar */}
              <div className="flex h-4 rounded-full overflow-hidden mb-4">
                {holdings.map((h, idx) => (
                  <div
                    key={h.id}
                    className="transition-all duration-300"
                    style={{
                      width: `${totalWeight > 0 ? (h.weight / totalWeight) * 100 : 0}%`,
                      backgroundColor: ALLOC_COLORS[idx % ALLOC_COLORS.length],
                    }}
                    title={`${h.symbol}: ${h.weight.toFixed(1)}%`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="space-y-2">
                {holdings.map((h, idx) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: ALLOC_COLORS[idx % ALLOC_COLORS.length] }}
                    />
                    <span className="text-xs font-bold text-text-main flex-1 truncate">{h.symbol}</span>
                    <span className="text-xs font-bold text-text-muted">{h.weight.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Info card */}
        <div
          className="rounded-2xl bg-gradient-to-br from-[#1CB0F6]/5 to-[#CE82FF]/5 p-5"
          style={{ border: '1px solid #1CB0F6/15' }}
        >
          <h3 className="text-xs font-bold text-text-main mb-3">Ce qui sera analysé</h3>
          <div className="space-y-2">
            {[
              'Rendements historiques (1 à 10 ans)',
              'Statistiques de risque complètes',
              'Style Matrix Morningstar (3×3)',
              'Répartition sectorielle & géographique',
              'Fondamentaux pondérés (P/E, P/B, ROE)',
              'Croissance de 10 000$ simulée',
              'Rendements annuels vs benchmark',
              'Cours cibles consensus',
              'Rapport PDF professionnel',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: DUO.blue }} />
                <span className="text-xs text-text-muted">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

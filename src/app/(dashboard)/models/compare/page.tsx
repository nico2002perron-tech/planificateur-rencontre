'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Line, ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useModels, type ModelPortfolio } from '@/lib/hooks/useModels';
import { useQuotes } from '@/lib/hooks/useQuotes';
import { usePriceTargetConsensus } from '@/lib/hooks/usePriceTargets';
import { useSymbolSearch } from '@/lib/hooks/useQuotes';
import {
  ArrowLeft, Search, Plus, Trash2, TrendingUp, TrendingDown,
  Target, DollarSign, BarChart3, Trophy, Briefcase, ChevronDown, ChevronUp, X,
  CalendarDays,
} from 'lucide-react';

// ── Duolingo Color hash ─────────────────────────────────────────────────
const DUO_COLORS = ['#58CC02', '#CE82FF', '#1CB0F6', '#FF9600', '#FF4B4B', '#FFC800', '#00CD9C'];
function duoColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return DUO_COLORS[Math.abs(hash) % DUO_COLORS.length];
}

// ── Stock Avatar (logo or colorful initials) ────────────────────────────
function StockAvatar({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const ticker = symbol.replace('.TO', '').replace('.V', '').replace('.CN', '');
  const color = duoColor(ticker);

  if (!imgError) {
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`}
          alt={ticker}
          width={size}
          height={size}
          className="rounded-xl border-[2px] object-contain bg-white"
          style={{ borderColor: color + '40' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border-[2px] flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: color + '18',
        borderColor: color + '50',
      }}
    >
      <span className="font-extrabold" style={{ color, fontSize: size * 0.32 }}>
        {ticker.slice(0, 3)}
      </span>
    </div>
  );
}

// ── Duolingo palette & constants ────────────────────────────────────────

const DUO = {
  green: '#58CC02', greenDark: '#46a302',
  blue: '#1CB0F6', blueDark: '#0a8fd4',
  purple: '#CE82FF', purpleDark: '#a855f7',
  orange: '#FF9600', orangeDark: '#d97706',
  red: '#FF4B4B', redDark: '#dc2626',
  yellow: '#FFC800',
  teal: '#00CD9C',
};

const BENCHMARK_LABELS: Record<string, string> = { '^GSPTSE': 'S&P/TSX', '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ' };
const BENCHMARK_COLORS: Record<string, string> = { '^GSPTSE': '#64748b', '^GSPC': '#03045e', '^IXIC': '#7c3aed' };

function fmtMoney(n: number, currency = 'CAD') {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }
function fmtDec(n: number, d = 2) { return n.toFixed(d); }
function fmtDateShort(d: string) {
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

// ── Types ───────────────────────────────────────────────────────────────

interface ClientHolding {
  symbol: string;
  name: string;
  quantity: number;
}

interface PortfolioHistoryData {
  dates: string[];
  portfolio: number[];
  benchmarks: Record<string, number[]>;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ── Symbol Search Inline ────────────────────────────────────────────────

function InlineSymbolSearch({ onSelect }: { onSelect: (symbol: string, name: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, isLoading } = useSymbolSearch(query);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border-[3px] border-dashed border-gray-200 bg-gray-50/50 hover:border-[#1CB0F6] transition-all">
        <Search className="h-4 w-4 text-text-muted flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          placeholder="Ajouter un titre (ex: AAPL, RY.TO)..."
          className="flex-1 bg-transparent text-sm font-semibold text-text-main placeholder:text-text-muted/50 focus:outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="text-text-muted hover:text-text-main">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && query.length >= 1 && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white rounded-2xl shadow-xl border-[3px] border-gray-100 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : results.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Aucun résultat</p>
          ) : (
            results.map((r: { symbol: string; name: string; exchangeShortName: string }) => (
              <button key={r.symbol}
                className="w-full text-left px-4 py-3 hover:bg-[#1CB0F6]/5 transition-colors flex items-center justify-between"
                onClick={() => { onSelect(r.symbol, r.name); setQuery(''); setOpen(false); }}
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-lg bg-[#1CB0F6]/10 text-[#1CB0F6] font-extrabold text-xs">{r.symbol}</span>
                  <span className="text-sm font-semibold text-text-main truncate max-w-[200px]">{r.name}</span>
                </div>
                <span className="text-[10px] font-bold text-text-muted bg-gray-100 px-2 py-0.5 rounded-lg">{r.exchangeShortName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Duo Stat Card ───────────────────────────────────────────────────────

function DuoStat({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border-[3px] p-3"
      style={{ borderColor: color + '30', boxShadow: `0 3px 0 0 ${color}20` }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-xl" style={{ backgroundColor: color + '15' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-extrabold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs font-semibold text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════

export default function ComparePage() {
  const { toast } = useToast();
  const { models, isLoading: modelsLoading } = useModels();

  // ── Client portfolio state ──
  const [clientHoldings, setClientHoldings] = useState<ClientHolding[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // ── Derived symbols ──
  const clientSymbols = useMemo(() => clientHoldings.map(h => h.symbol), [clientHoldings]);
  const selectedModel = useMemo(() => models?.find(m => m.id === selectedModelId) || null, [models, selectedModelId]);
  const modelSymbols = useMemo(() => selectedModel?.holdings.map(h => h.symbol) || [], [selectedModel]);
  const allSymbols = useMemo(() => [...new Set([...clientSymbols, ...modelSymbols])], [clientSymbols, modelSymbols]);

  // ── Data hooks ──
  const { quotesMap, isLoading: quotesLoading } = useQuotes(allSymbols);
  const { targets: allTargets, isLoading: targetsLoading } = usePriceTargetConsensus(allSymbols);

  // ── Portfolio history (client) ──
  const clientWeights = useMemo(() => {
    if (clientHoldings.length === 0) return [];
    const total = clientHoldings.reduce((s, h) => {
      const price = quotesMap.get(h.symbol)?.price || 0;
      return s + h.quantity * price;
    }, 0);
    if (total === 0) return [];
    return clientHoldings.map(h => {
      const price = quotesMap.get(h.symbol)?.price || 0;
      return { symbol: h.symbol, weight: total > 0 ? (h.quantity * price / total) * 100 : 0 };
    });
  }, [clientHoldings, quotesMap]);

  const modelWeights = useMemo(() => {
    if (!selectedModel) return [];
    return selectedModel.holdings.map(h => ({ symbol: h.symbol, weight: h.weight }));
  }, [selectedModel]);

  // SWR for portfolio history (client)
  const clientHistKey = clientWeights.length > 0
    ? JSON.stringify({ holdings: clientWeights, type: 'client', months: 12 })
    : null;
  const { data: clientHist, isLoading: clientHistLoading } = useSWR<PortfolioHistoryData>(
    clientHistKey,
    async () => {
      const res = await fetch('/api/portfolio-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: clientWeights, months: 12 }),
      });
      return res.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // SWR for portfolio history (model)
  const modelHistKey = modelWeights.length > 0
    ? JSON.stringify({ holdings: modelWeights, type: 'model', months: 12 })
    : null;
  const { data: modelHist, isLoading: modelHistLoading } = useSWR<PortfolioHistoryData>(
    modelHistKey,
    async () => {
      const res = await fetch('/api/portfolio-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: modelWeights, months: 12 }),
      });
      return res.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // ── Client portfolio calculations ──
  const clientStats = useMemo(() => {
    let totalValue = 0, projectedValue = 0, totalDivIncome = 0;
    for (const h of clientHoldings) {
      const q = quotesMap.get(h.symbol);
      const price = q?.price || 0;
      const mv = h.quantity * price;
      totalValue += mv;

      const t = allTargets[h.symbol];
      if (t?.targetConsensus > 0) {
        projectedValue += h.quantity * t.targetConsensus;
      } else {
        projectedValue += mv; // no target → flat
      }

      // Estimate dividend from yield (price × divYield)
      // We'll use the pe_ratio field as proxy if available, otherwise skip
      // Actually dividendYield isn't in QuoteData, so we'll compute from targets
    }
    const gainPct = totalValue > 0 ? ((projectedValue - totalValue) / totalValue) * 100 : 0;
    return { totalValue, projectedValue, gainPct, divIncome: totalDivIncome };
  }, [clientHoldings, quotesMap, allTargets]);

  // ── Model portfolio calculations (scaled to client value) ──
  const modelStats = useMemo(() => {
    if (!selectedModel || clientStats.totalValue === 0) return null;
    const scale = clientStats.totalValue;
    let totalValue = 0, projectedValue = 0;

    for (const h of selectedModel.holdings) {
      const q = quotesMap.get(h.symbol);
      const price = q?.price || 0;
      const alloc = (h.weight / 100) * scale;
      totalValue += alloc;

      const t = allTargets[h.symbol];
      if (t?.targetConsensus > 0 && price > 0) {
        const targetGain = (t.targetConsensus - price) / price;
        projectedValue += alloc * (1 + targetGain);
      } else {
        projectedValue += alloc;
      }
    }
    const gainPct = totalValue > 0 ? ((projectedValue - totalValue) / totalValue) * 100 : 0;
    return { totalValue, projectedValue, gainPct };
  }, [selectedModel, quotesMap, allTargets, clientStats.totalValue]);

  // ── Unified chart: past ($ values) + future projection ──
  const { unifiedChartData, todayIndex } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts: Record<string, any>[] = [];
    let todayIdx = 0;

    // PAST: convert normalised base-100 back to dollar values
    if (clientHist?.dates?.length && clientStats.totalValue > 0) {
      const lastPastClient = clientHist.portfolio[clientHist.portfolio.length - 1] || 100;
      const dollarPerUnit = clientStats.totalValue / lastPastClient;

      const lastPastModel = modelHist?.portfolio?.length
        ? modelHist.portfolio[modelHist.portfolio.length - 1] || 100
        : 100;
      const modelDollarPerUnit = modelStats ? modelStats.totalValue / lastPastModel : 0;

      // Benchmark: last value → same dollar scale
      const benchDollarPerUnit: Record<string, number> = {};
      for (const [sym, vals] of Object.entries(clientHist.benchmarks || {})) {
        const lastBench = vals[vals.length - 1] || 100;
        benchDollarPerUnit[sym] = clientStats.totalValue / lastBench;
      }

      for (let i = 0; i < clientHist.dates.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pt: Record<string, any> = {
          dateLabel: fmtDateShort(clientHist.dates[i]),
          zone: 'past',
          client: Math.round((clientHist.portfolio[i] ?? 100) * dollarPerUnit),
        };
        if (modelHist?.portfolio?.[i] !== undefined && modelDollarPerUnit > 0) {
          pt.model = Math.round(modelHist.portfolio[i] * modelDollarPerUnit);
        }
        for (const [sym, vals] of Object.entries(clientHist.benchmarks || {})) {
          if (vals[i] !== undefined) {
            pt[sym] = Math.round(vals[i] * (benchDollarPerUnit[sym] || 1));
          }
        }
        pts.push(pt);
      }
      todayIdx = pts.length - 1;
    }

    // FUTURE: linear interpolation from today to target (13 monthly points including today)
    if (clientStats.totalValue > 0) {
      const months = 12;
      // Derive annual return from actual history instead of hardcoded values
      const benchReturns: Record<string, number> = {};
      for (const [sym, vals] of Object.entries(clientHist?.benchmarks || {})) {
        if (vals.length >= 2) {
          const first = vals[0] || 100;
          const last = vals[vals.length - 1] || 100;
          benchReturns[sym] = ((last / first) - 1) * 100; // 1-year return as %
        } else {
          benchReturns[sym] = sym === '^GSPTSE' ? 8 : sym === '^GSPC' ? 10 : 12; // fallback
        }
      }

      for (let m = 1; m <= months; m++) {
        const date = new Date();
        date.setMonth(date.getMonth() + m);
        const label = date.toLocaleDateString('fr-CA', { month: 'short' }) + (m === 12 ? ` '${String(date.getFullYear()).slice(2)}` : '');
        const progress = m / months;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pt: Record<string, any> = {
          dateLabel: label,
          zone: 'future',
          client: Math.round(clientStats.totalValue + (clientStats.projectedValue - clientStats.totalValue) * progress),
        };
        if (modelStats) {
          pt.model = Math.round(modelStats.totalValue + (modelStats.projectedValue - modelStats.totalValue) * progress);
        }
        for (const [sym, annualPct] of Object.entries(benchReturns)) {
          pt[sym] = Math.round(clientStats.totalValue * (1 + (annualPct / 100) * progress));
        }
        pts.push(pt);
      }
    }

    return { unifiedChartData: pts, todayIndex: todayIdx };
  }, [clientHist, modelHist, clientStats, modelStats]);

  // ── Handlers ──
  const addHolding = useCallback((symbol: string, name: string) => {
    if (clientHoldings.find(h => h.symbol === symbol)) {
      toast('warning', `${symbol} est déjà dans la liste`);
      return;
    }
    setClientHoldings(prev => [...prev, { symbol, name, quantity: 1 }]);
  }, [clientHoldings, toast]);

  const updateQuantity = useCallback((symbol: string, qty: number) => {
    setClientHoldings(prev => prev.map(h => h.symbol === symbol ? { ...h, quantity: Math.max(0, qty) } : h));
  }, []);

  const removeHolding = useCallback((symbol: string) => {
    setClientHoldings(prev => prev.filter(h => h.symbol !== symbol));
  }, []);

  // ── Diff analysis between client and model ──
  const diffAnalysis = useMemo(() => {
    if (!selectedModel || clientHoldings.length === 0) return null;

    const clientSymSet = new Set(clientSymbols);
    const modelSymSet = new Set(modelSymbols);

    const onlyInClient = clientSymbols.filter(s => !modelSymSet.has(s));
    const onlyInModel = modelSymbols.filter(s => !clientSymSet.has(s));
    const inBoth = clientSymbols.filter(s => modelSymSet.has(s));

    // Weight diff for common holdings
    const weightDiffs = inBoth.map(sym => {
      const clientWeight = clientWeights.find(w => w.symbol === sym)?.weight ?? 0;
      const modelWeight = selectedModel.holdings.find(h => h.symbol === sym)?.weight ?? 0;
      const diff = modelWeight - clientWeight;
      return { symbol: sym, clientWeight, modelWeight, diff };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    // Rebalancing suggestions
    const suggestions: { symbol: string; action: 'acheter' | 'vendre' | 'augmenter' | 'reduire'; detail: string }[] = [];

    for (const sym of onlyInModel) {
      const weight = selectedModel.holdings.find(h => h.symbol === sym)?.weight ?? 0;
      suggestions.push({ symbol: sym, action: 'acheter', detail: `Ajouter au portefeuille (cible ${weight.toFixed(1)}%)` });
    }
    for (const sym of onlyInClient) {
      suggestions.push({ symbol: sym, action: 'vendre', detail: 'Absent du modèle — considérer la vente' });
    }
    for (const wd of weightDiffs) {
      if (Math.abs(wd.diff) >= 2) {
        if (wd.diff > 0) {
          suggestions.push({ symbol: wd.symbol, action: 'augmenter', detail: `Sous-pondéré de ${wd.diff.toFixed(1)}% vs modèle` });
        } else {
          suggestions.push({ symbol: wd.symbol, action: 'reduire', detail: `Surpondéré de ${Math.abs(wd.diff).toFixed(1)}% vs modèle` });
        }
      }
    }

    return { onlyInClient, onlyInModel, inBoth, weightDiffs, suggestions };
  }, [selectedModel, clientHoldings, clientSymbols, modelSymbols, clientWeights]);

  // ── Compare ready? ──
  const hasClient = clientHoldings.length > 0 && clientStats.totalValue > 0;
  const hasModel = !!selectedModel;
  const canCompare = hasClient && hasModel;
  const isLoadingData = quotesLoading || targetsLoading;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/models">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Modèles</Button>
          </Link>
          <span className="text-text-light">/</span>
          <h1 className="text-lg font-extrabold text-text-main flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#CE82FF]" />
            Comparer avec un client
          </h1>
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ════════ LEFT: Client Portfolio ════════ */}
        <div className="space-y-4">
          <div className="rounded-3xl border-[3px] border-[#1CB0F6]/30 bg-white overflow-hidden"
            style={{ boxShadow: '0 4px 0 0 #1CB0F620' }}>
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#1CB0F6]/5 to-transparent border-b-[3px] border-[#1CB0F6]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1CB0F6]/10 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-[#1CB0F6]" />
                </div>
                <div>
                  <h2 className="font-extrabold text-text-main">Portefeuille du client</h2>
                  <p className="text-xs font-semibold text-text-muted">Ajoutez les titres du relevé d&apos;investissement</p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 pt-4">
              <InlineSymbolSearch onSelect={addHolding} />
            </div>

            {/* Holdings list */}
            <div className="px-5 py-4 space-y-2">
              {clientHoldings.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 text-text-muted/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-text-muted">Aucun titre ajouté</p>
                  <p className="text-xs text-text-muted/70 mt-1">Recherchez et ajoutez les positions du client</p>
                </div>
              ) : (
                <>
                  {clientHoldings.map((h) => {
                    const q = quotesMap.get(h.symbol);
                    const price = q?.price || 0;
                    const mv = h.quantity * price;
                    const t = allTargets[h.symbol];
                    const targetGain = t?.targetConsensus && price > 0
                      ? ((t.targetConsensus - price) / price) * 100
                      : null;

                    return (
                      <div key={h.symbol}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border-[3px] border-gray-100 bg-white hover:border-[#1CB0F6]/30 transition-all"
                        style={{ boxShadow: '0 2px 0 0 #e5e7eb' }}>
                        <StockAvatar symbol={h.symbol} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-main truncate">{h.symbol} <span className="font-semibold text-text-muted">· {h.name}</span></p>
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-text-muted">
                            {price > 0 && <span>{fmtMoney(price)}</span>}
                            {targetGain !== null && (
                              <span className={`px-1.5 py-0.5 rounded-lg ${targetGain >= 0 ? 'bg-[#58CC02]/10 text-[#58CC02]' : 'bg-[#FF4B4B]/10 text-[#FF4B4B]'}`}>
                                Cible {fmtPct(targetGain)}
                              </span>
                            )}
                          </div>
                        </div>
                        <input type="number" min={0} value={h.quantity}
                          onChange={(e) => updateQuantity(h.symbol, parseInt(e.target.value) || 0)}
                          className="w-16 text-center text-sm font-extrabold text-text-main border-[2px] border-gray-200 rounded-xl py-1 focus:border-[#1CB0F6] focus:outline-none"
                        />
                        <span className="text-xs font-bold text-text-main w-20 text-right">
                          {mv > 0 ? fmtMoney(mv) : '—'}
                        </span>
                        <button onClick={() => removeHolding(h.symbol)}
                          className="text-text-muted/40 hover:text-[#FF4B4B] transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Client summary */}
            {hasClient && (
              <div className="px-5 pb-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#1CB0F6]/5 border-[2px] border-[#1CB0F6]/20 p-2.5 text-center">
                    <p className="text-[10px] font-bold text-text-muted uppercase">Valeur</p>
                    <p className="text-sm font-extrabold text-[#1CB0F6]">{fmtMoney(clientStats.totalValue)}</p>
                  </div>
                  <div className="rounded-xl bg-[#CE82FF]/5 border-[2px] border-[#CE82FF]/20 p-2.5 text-center">
                    <p className="text-[10px] font-bold text-text-muted uppercase">Cible 12m</p>
                    <p className="text-sm font-extrabold text-[#CE82FF]">{fmtMoney(clientStats.projectedValue)}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 text-center border-[2px] ${
                    clientStats.gainPct >= 0
                      ? 'bg-[#58CC02]/5 border-[#58CC02]/20'
                      : 'bg-[#FF4B4B]/5 border-[#FF4B4B]/20'
                  }`}>
                    <p className="text-[10px] font-bold text-text-muted uppercase">Gain estimé</p>
                    <p className={`text-sm font-extrabold ${clientStats.gainPct >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                      {fmtPct(clientStats.gainPct)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════════ RIGHT: Model Portfolio ════════ */}
        <div className="space-y-4">
          <div className="rounded-3xl border-[3px] border-[#58CC02]/30 bg-white overflow-hidden"
            style={{ boxShadow: '0 4px 0 0 #58CC0220' }}>
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#58CC02]/5 to-transparent border-b-[3px] border-[#58CC02]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#58CC02]/10 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-[#58CC02]" />
                </div>
                <div>
                  <h2 className="font-extrabold text-text-main">Portefeuille modèle</h2>
                  <p className="text-xs font-semibold text-text-muted">Sélectionnez un modèle pour comparer</p>
                </div>
              </div>
            </div>

            {/* Model selector */}
            <div className="px-5 pt-4">
              <button onClick={() => setShowModelPicker(!showModelPicker)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border-[3px] border-gray-200 bg-white text-sm font-bold text-text-main hover:border-[#58CC02] transition-all"
                style={{ boxShadow: '0 2px 0 0 #e5e7eb' }}>
                <span>{selectedModel ? selectedModel.name : 'Choisir un modèle...'}</span>
                {showModelPicker ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showModelPicker && (
                <div className="mt-2 rounded-2xl border-[3px] border-gray-100 bg-white overflow-hidden max-h-64 overflow-y-auto"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                  {modelsLoading ? (
                    <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                  ) : !models?.length ? (
                    <p className="text-sm text-text-muted text-center py-4">Aucun modèle disponible</p>
                  ) : (
                    models.map((m) => (
                      <button key={m.id}
                        onClick={() => { setSelectedModelId(m.id); setShowModelPicker(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-[#58CC02]/5 transition-colors flex items-center justify-between ${
                          selectedModelId === m.id ? 'bg-[#58CC02]/10' : ''
                        }`}>
                        <div>
                          <span className="font-bold text-sm text-text-main">{m.name}</span>
                          <span className="text-xs text-text-muted ml-2">{m.holdings.length} titres · {m.risk_level}</span>
                        </div>
                        {selectedModelId === m.id && (
                          <div className="w-5 h-5 rounded-full bg-[#58CC02] flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Model holdings */}
            <div className="px-5 py-4 space-y-2">
              {!selectedModel ? (
                <div className="text-center py-8">
                  <Trophy className="h-8 w-8 text-text-muted/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-text-muted">Aucun modèle sélectionné</p>
                </div>
              ) : (
                <>
                  {selectedModel.holdings.map((h) => {
                    const q = quotesMap.get(h.symbol);
                    const price = q?.price || 0;
                    const t = allTargets[h.symbol];
                    const targetGain = t?.targetConsensus && price > 0
                      ? ((t.targetConsensus - price) / price) * 100
                      : null;

                    return (
                      <div key={h.symbol}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border-[3px] border-gray-100 bg-white"
                        style={{ boxShadow: '0 2px 0 0 #e5e7eb' }}>
                        <StockAvatar symbol={h.symbol} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-main truncate">{h.symbol} <span className="font-semibold text-text-muted">· {h.name}</span></p>
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-text-muted">
                            <span>{fmtDec(h.weight)}%</span>
                            {price > 0 && <span>· {fmtMoney(price)}</span>}
                            {targetGain !== null && (
                              <span className={`px-1.5 py-0.5 rounded-lg ${targetGain >= 0 ? 'bg-[#58CC02]/10 text-[#58CC02]' : 'bg-[#FF4B4B]/10 text-[#FF4B4B]'}`}>
                                Cible {fmtPct(targetGain)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Model summary */}
            {modelStats && (
              <div className="px-5 pb-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#58CC02]/5 border-[2px] border-[#58CC02]/20 p-2.5 text-center">
                    <p className="text-[10px] font-bold text-text-muted uppercase">Valeur</p>
                    <p className="text-sm font-extrabold text-[#58CC02]">{fmtMoney(modelStats.totalValue)}</p>
                  </div>
                  <div className="rounded-xl bg-[#CE82FF]/5 border-[2px] border-[#CE82FF]/20 p-2.5 text-center">
                    <p className="text-[10px] font-bold text-text-muted uppercase">Cible 12m</p>
                    <p className="text-sm font-extrabold text-[#CE82FF]">{fmtMoney(modelStats.projectedValue)}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 text-center border-[2px] ${
                    modelStats.gainPct >= 0
                      ? 'bg-[#58CC02]/5 border-[#58CC02]/20'
                      : 'bg-[#FF4B4B]/5 border-[#FF4B4B]/20'
                  }`}>
                    <p className="text-[10px] font-bold text-text-muted uppercase">Gain estimé</p>
                    <p className={`text-sm font-extrabold ${modelStats.gainPct >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                      {fmtPct(modelStats.gainPct)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* COMPARISON SECTION */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {canCompare && (
        <>
          {/* ── Head-to-Head Stats ── */}
          <div className="rounded-3xl border-[3px] border-[#CE82FF]/30 bg-white p-5"
            style={{ boxShadow: '0 4px 0 0 #CE82FF20' }}>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              {/* Client col */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#1CB0F6]/10">
                  <Briefcase className="h-3.5 w-3.5 text-[#1CB0F6]" />
                  <span className="text-xs font-extrabold text-[#1CB0F6]">Client</span>
                </div>
                <p className="text-xs font-bold text-text-muted">Aujourd&apos;hui</p>
                <p className="text-xl font-extrabold text-text-main">{fmtMoney(clientStats.totalValue)}</p>
                <p className="text-xs font-bold text-text-muted">Cible 12m</p>
                <p className="text-lg font-extrabold text-[#CE82FF]">{fmtMoney(clientStats.projectedValue)}</p>
                <p className={`text-sm font-extrabold ${clientStats.gainPct >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                  {fmtPct(clientStats.gainPct)}
                </p>
              </div>
              {/* VS */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#CE82FF]/10 border-[3px] border-[#CE82FF]/30 flex items-center justify-center">
                  <span className="font-extrabold text-[#CE82FF]">VS</span>
                </div>
                {modelStats && (() => {
                  const diff = modelStats.gainPct - clientStats.gainPct;
                  const modelWins = diff > 0;
                  const dollarDiff = modelStats.projectedValue - clientStats.projectedValue;
                  return (
                    <div className={`px-3 py-1.5 rounded-xl border-[2px] text-[10px] font-extrabold text-center ${
                      modelWins
                        ? 'border-[#58CC02]/30 bg-[#58CC02]/5 text-[#58CC02]'
                        : 'border-[#1CB0F6]/30 bg-[#1CB0F6]/5 text-[#1CB0F6]'
                    }`}>
                      {modelWins ? '▲' : '▼'} {fmtDec(Math.abs(diff))}%
                      <br />{fmtMoney(Math.abs(dollarDiff))}
                    </div>
                  );
                })()}
              </div>
              {/* Model col */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#58CC02]/10">
                  <Trophy className="h-3.5 w-3.5 text-[#58CC02]" />
                  <span className="text-xs font-extrabold text-[#58CC02]">Modèle</span>
                </div>
                <p className="text-xs font-bold text-text-muted">Aujourd&apos;hui</p>
                <p className="text-xl font-extrabold text-text-main">{modelStats ? fmtMoney(modelStats.totalValue) : '—'}</p>
                <p className="text-xs font-bold text-text-muted">Cible 12m</p>
                <p className="text-lg font-extrabold text-[#CE82FF]">{modelStats ? fmtMoney(modelStats.projectedValue) : '—'}</p>
                <p className={`text-sm font-extrabold ${(modelStats?.gainPct ?? 0) >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                  {modelStats ? fmtPct(modelStats.gainPct) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Diff & Rebalancing Suggestions ── */}
          {diffAnalysis && diffAnalysis.suggestions.length > 0 && (
            <div className="rounded-3xl border-[3px] border-[#FF9600]/30 bg-white overflow-hidden"
              style={{ boxShadow: '0 4px 0 0 #FF960020' }}>
              <div className="px-6 py-4 bg-gradient-to-r from-[#FF9600]/5 to-transparent border-b-[3px] border-[#FF9600]/10">
                <h3 className="font-extrabold text-text-main flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#FF9600]" />
                  Écarts et suggestions de rééquilibrage
                </h3>
                <p className="text-xs font-semibold text-text-muted mt-1">
                  {diffAnalysis.onlyInClient.length > 0 && (
                    <span className="mr-3"><span className="inline-block w-2 h-2 rounded-full bg-[#1CB0F6] mr-1" />{diffAnalysis.onlyInClient.length} titre{diffAnalysis.onlyInClient.length > 1 ? 's' : ''} uniquement chez le client</span>
                  )}
                  {diffAnalysis.onlyInModel.length > 0 && (
                    <span className="mr-3"><span className="inline-block w-2 h-2 rounded-full bg-[#58CC02] mr-1" />{diffAnalysis.onlyInModel.length} titre{diffAnalysis.onlyInModel.length > 1 ? 's' : ''} uniquement dans le modèle</span>
                  )}
                  {diffAnalysis.inBoth.length > 0 && (
                    <span><span className="inline-block w-2 h-2 rounded-full bg-[#CE82FF] mr-1" />{diffAnalysis.inBoth.length} en commun</span>
                  )}
                </p>
              </div>

              <div className="px-6 py-4 space-y-2">
                {diffAnalysis.suggestions.map((s, i) => {
                  const actionStyles = {
                    acheter: { bg: 'bg-[#58CC02]/8', border: 'border-[#58CC02]/25', text: 'text-[#58CC02]', label: 'ACHETER' },
                    vendre: { bg: 'bg-[#FF4B4B]/8', border: 'border-[#FF4B4B]/25', text: 'text-[#FF4B4B]', label: 'VENDRE' },
                    augmenter: { bg: 'bg-[#1CB0F6]/8', border: 'border-[#1CB0F6]/25', text: 'text-[#1CB0F6]', label: 'AUGMENTER' },
                    reduire: { bg: 'bg-[#FF9600]/8', border: 'border-[#FF9600]/25', text: 'text-[#FF9600]', label: 'RÉDUIRE' },
                  }[s.action];

                  return (
                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-[2px] ${actionStyles.border} ${actionStyles.bg}`}>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${actionStyles.text} bg-white/80`}>
                        {actionStyles.label}
                      </span>
                      <StockAvatar symbol={s.symbol} size={28} />
                      <span className="font-extrabold text-xs text-text-main">{s.symbol}</span>
                      <span className="text-xs font-semibold text-text-muted flex-1">{s.detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── UNIFIED CHART: Past + Future ── */}
          <div className="rounded-3xl border-[3px] border-gray-200 bg-white overflow-hidden"
            style={{ boxShadow: '0 4px 0 0 #e5e7eb' }}>
            <div className="px-6 pt-5 pb-2">
              <h3 className="font-extrabold text-text-main flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#FF9600]" />
                Passé 1 an + Projection 12 mois
              </h3>
              <p className="text-xs font-semibold text-text-muted mt-1">
                Valeur en $ — la ligne verticale marque aujourd&apos;hui, à droite les cours cibles analystes
              </p>
            </div>

            {clientHistLoading || modelHistLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : unifiedChartData.length >= 2 ? (
              <div className="h-[340px] px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={unifiedChartData} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradClient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={DUO.blue} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={DUO.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradModel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={DUO.green} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={DUO.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => {
                        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                        if (v >= 1000) return `${Math.round(v / 1000)}k`;
                        return `${v}`;
                      }} />
                    {/* Vertical "TODAY" reference line */}
                    {todayIndex > 0 && (
                      <ReferenceLine x={unifiedChartData[todayIndex]?.dateLabel} stroke="#CE82FF" strokeWidth={2} strokeDasharray="4 4"
                        label={{ value: "Auj.", position: 'top', fill: '#CE82FF', fontSize: 11, fontWeight: 800 }} />
                    )}
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: 16, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => {
                        const labels: Record<string, string> = { client: 'Client', model: 'Modèle', ...BENCHMARK_LABELS };
                        return [fmtMoney(Number(value)), labels[name] || name];
                      }}
                    />
                    <Area type="monotone" dataKey="client" stroke={DUO.blue} strokeWidth={3}
                      fill="url(#gradClient)" dot={false}
                      activeDot={{ r: 5, fill: DUO.blue, stroke: '#fff', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="model" stroke={DUO.green} strokeWidth={3}
                      fill="url(#gradModel)" dot={false}
                      activeDot={{ r: 5, fill: DUO.green, stroke: '#fff', strokeWidth: 2 }} />
                    {Object.keys(BENCHMARK_LABELS).map(sym => (
                      <Line key={sym} type="monotone" dataKey={sym}
                        stroke={BENCHMARK_COLORS[sym] || '#94a3b8'} strokeWidth={1.5}
                        strokeDasharray="6 3" dot={false} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex justify-center py-12 text-sm text-text-muted">
                Chargement des données historiques...
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 px-6 pb-4 pt-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: DUO.blue }} /> Client
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: DUO.green }} /> Modèle
              </span>
              {Object.entries(BENCHMARK_LABELS).map(([sym, label]) => (
                <span key={sym} className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                  <div className="w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: BENCHMARK_COLORS[sym] }} /> {label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#CE82FF]">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-[#CE82FF]" /> Aujourd&apos;hui
              </span>
            </div>
          </div>

          {/* ── Detailed Holdings Comparison ── */}
          <div className="rounded-3xl border-[3px] border-gray-200 bg-white overflow-hidden"
            style={{ boxShadow: '0 4px 0 0 #e5e7eb' }}>
            <div className="px-6 py-4 border-b-[3px] border-gray-100">
              <h3 className="font-extrabold text-text-main">Détail par position — Cours cibles</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-gray-100 font-bold">
                    <th className="px-4 py-3">Titre</th>
                    <th className="px-3 py-3 text-right">Prix actuel</th>
                    <th className="px-3 py-3 text-right">Cible 12m</th>
                    <th className="px-3 py-3 text-right">Gain estimé</th>
                    <th className="px-3 py-3 text-center">Analystes</th>
                    <th className="px-3 py-3 text-center">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {allSymbols.map((sym) => {
                    const q = quotesMap.get(sym);
                    const price = q?.price || 0;
                    const t = allTargets[sym];
                    const target = t?.targetConsensus || 0;
                    const gain = price > 0 && target > 0 ? ((target - price) / price) * 100 : 0;
                    const inClient = clientHoldings.some(h => h.symbol === sym);
                    const inModel = selectedModel?.holdings.some(h => h.symbol === sym);
                    const onlyClient = inClient && !inModel;
                    const onlyModel = !inClient && inModel;

                    return (
                      <tr key={sym} className={`border-t border-gray-50 ${
                        onlyClient ? 'bg-[#1CB0F6]/[0.04]' : onlyModel ? 'bg-[#58CC02]/[0.04]' : 'hover:bg-gray-50/50'
                      }`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <StockAvatar symbol={sym} size={28} />
                            <span className="font-extrabold text-text-main text-xs">{sym}</span>
                            {inClient && inModel && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#CE82FF]/10 text-[#CE82FF]">C+M</span>
                            )}
                            {onlyClient && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#1CB0F6]/10 text-[#1CB0F6]">Client seul</span>
                            )}
                            {onlyModel && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#58CC02]/10 text-[#58CC02]">Modèle seul</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{price > 0 ? `$${fmtDec(price)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">{target > 0 ? `$${fmtDec(target)}` : '—'}</td>
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-extrabold ${gain >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                          {target > 0 ? fmtPct(gain) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-text-muted">
                          {t?.numberOfAnalysts || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {t?.source && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                              t.source === 'yahoo' ? 'bg-purple-100 text-purple-700'
                              : t.source === 'fmp' ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                            }`}>{t.source}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Loading overlay ── */}
      {isLoadingData && hasClient && (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  );
}

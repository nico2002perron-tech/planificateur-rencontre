'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Line, Legend,
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
} from 'lucide-react';

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
    ? JSON.stringify({ holdings: clientWeights, type: 'client' })
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
    ? JSON.stringify({ holdings: modelWeights, type: 'model' })
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

  // ── Chart data: Past performance ──
  const pastChartData = useMemo(() => {
    if (!clientHist?.dates?.length) return [];
    const dates = clientHist.dates;
    return dates.map((d, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pt: Record<string, any> = {
        date: d,
        dateLabel: fmtDateShort(d),
        client: clientHist.portfolio[i] ?? 100,
      };
      if (modelHist?.dates?.length && modelHist.portfolio[i] !== undefined) {
        pt.model = modelHist.portfolio[i];
      }
      // Benchmarks from client history
      for (const [sym, vals] of Object.entries(clientHist.benchmarks || {})) {
        if (vals[i] !== undefined) pt[sym] = vals[i];
      }
      return pt;
    });
  }, [clientHist, modelHist]);

  // ── Chart data: Future projection (12 months) ──
  const projectionChartData = useMemo(() => {
    if (clientStats.totalValue === 0) return [];
    const now = new Date();
    const points = [];
    const months = 12;

    for (let m = 0; m <= months; m++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + m);
      const label = date.toLocaleDateString('fr-CA', { month: 'short', year: m === 0 || m === 12 ? '2-digit' : undefined });
      const progress = m / months;

      // Linear interpolation: current → projected
      const clientVal = clientStats.totalValue + (clientStats.projectedValue - clientStats.totalValue) * progress;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pt: Record<string, any> = {
        dateLabel: label,
        client: Math.round(clientVal),
      };

      if (modelStats) {
        const modelVal = modelStats.totalValue + (modelStats.projectedValue - modelStats.totalValue) * progress;
        pt.model = Math.round(modelVal);
      }

      // Benchmark projections: use average historical ~10% annual
      const benchReturns: Record<string, number> = { '^GSPTSE': 8, '^GSPC': 10, '^IXIC': 12 };
      for (const [sym, annualPct] of Object.entries(benchReturns)) {
        const benchVal = clientStats.totalValue * (1 + (annualPct / 100) * progress);
        pt[sym] = Math.round(benchVal);
      }

      points.push(pt);
    }
    return points;
  }, [clientStats, modelStats]);

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
                        {/* Symbol badge */}
                        <div className="px-2 py-1 rounded-xl bg-[#1CB0F6]/10 text-[#1CB0F6] font-extrabold text-xs flex-shrink-0">
                          {h.symbol}
                        </div>
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-main truncate">{h.name}</p>
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-text-muted">
                            {price > 0 && <span>{fmtMoney(price)}</span>}
                            {targetGain !== null && (
                              <span className={`px-1.5 py-0.5 rounded-lg ${targetGain >= 0 ? 'bg-[#58CC02]/10 text-[#58CC02]' : 'bg-[#FF4B4B]/10 text-[#FF4B4B]'}`}>
                                Cible {fmtPct(targetGain)}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Quantity */}
                        <input type="number" min={0} value={h.quantity}
                          onChange={(e) => updateQuantity(h.symbol, parseInt(e.target.value) || 0)}
                          className="w-16 text-center text-sm font-extrabold text-text-main border-[2px] border-gray-200 rounded-xl py-1 focus:border-[#1CB0F6] focus:outline-none"
                        />
                        {/* Value */}
                        <span className="text-xs font-bold text-text-main w-20 text-right">
                          {mv > 0 ? fmtMoney(mv) : '—'}
                        </span>
                        {/* Remove */}
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
                        <div className="px-2 py-1 rounded-xl bg-[#58CC02]/10 text-[#58CC02] font-extrabold text-xs flex-shrink-0">
                          {h.symbol}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-main truncate">{h.name}</p>
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
          <div className="rounded-3xl border-[3px] border-[#CE82FF]/30 bg-white p-6"
            style={{ boxShadow: '0 4px 0 0 #CE82FF20' }}>
            <h3 className="font-extrabold text-text-main text-center mb-5 flex items-center justify-center gap-2">
              <Target className="h-5 w-5 text-[#CE82FF]" />
              Face à face — Projection 12 mois
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Client col */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1CB0F6]/10">
                  <Briefcase className="h-3.5 w-3.5 text-[#1CB0F6]" />
                  <span className="text-xs font-extrabold text-[#1CB0F6]">Client</span>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-text-main">{fmtMoney(clientStats.projectedValue)}</p>
                  <p className={`text-sm font-extrabold ${clientStats.gainPct >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                    {fmtPct(clientStats.gainPct)}
                  </p>
                </div>
              </div>
              {/* VS */}
              <div className="flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-[#CE82FF]/10 border-[3px] border-[#CE82FF]/30 flex items-center justify-center">
                  <span className="font-extrabold text-[#CE82FF] text-lg">VS</span>
                </div>
              </div>
              {/* Model col */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#58CC02]/10">
                  <Trophy className="h-3.5 w-3.5 text-[#58CC02]" />
                  <span className="text-xs font-extrabold text-[#58CC02]">Modèle</span>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-text-main">{modelStats ? fmtMoney(modelStats.projectedValue) : '—'}</p>
                  <p className={`text-sm font-extrabold ${(modelStats?.gainPct ?? 0) >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                    {modelStats ? fmtPct(modelStats.gainPct) : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Gain difference highlight */}
            {modelStats && (
              <div className="mt-5 text-center">
                {(() => {
                  const diff = modelStats.gainPct - clientStats.gainPct;
                  const absDiff = Math.abs(diff);
                  const dollarDiff = (modelStats.projectedValue) - clientStats.projectedValue;
                  const modelWins = diff > 0;
                  return (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border-[3px] font-extrabold text-sm ${
                      modelWins
                        ? 'border-[#58CC02]/30 bg-[#58CC02]/5 text-[#58CC02]'
                        : 'border-[#1CB0F6]/30 bg-[#1CB0F6]/5 text-[#1CB0F6]'
                    }`} style={{ boxShadow: modelWins ? '0 3px 0 0 #58CC0220' : '0 3px 0 0 #1CB0F620' }}>
                      {modelWins ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {modelWins ? 'Le modèle' : 'Le client'} surperforme de {fmtDec(absDiff)}% ({fmtMoney(Math.abs(dollarDiff))})
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── Past Performance Chart ── */}
          <div className="rounded-3xl border-[3px] border-gray-200 bg-white overflow-hidden"
            style={{ boxShadow: '0 4px 0 0 #e5e7eb' }}>
            <div className="px-6 pt-5 pb-2">
              <h3 className="font-extrabold text-text-main flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#FF9600]" />
                Rendement passé (12 mois)
              </h3>
              <p className="text-xs font-semibold text-text-muted mt-1">Performance normalisée (base 100)</p>
            </div>

            {clientHistLoading || modelHistLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : pastChartData.length >= 2 ? (
              <div className="h-[300px] px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pastChartData} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
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
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={['auto', 'auto']}
                      tickFormatter={(v: number) => `${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: 16, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => {
                        const labels: Record<string, string> = {
                          client: 'Client', model: 'Modèle',
                          ...BENCHMARK_LABELS,
                        };
                        return [`${Number(value).toFixed(1)}`, labels[name] || name];
                      }}
                    />
                    <Area type="monotone" dataKey="client" stroke={DUO.blue} strokeWidth={3}
                      fill="url(#gradClient)" dot={false}
                      activeDot={{ r: 5, fill: DUO.blue, stroke: '#fff', strokeWidth: 2 }} />
                    {modelHist && (
                      <Area type="monotone" dataKey="model" stroke={DUO.green} strokeWidth={3}
                        fill="url(#gradModel)" dot={false}
                        activeDot={{ r: 5, fill: DUO.green, stroke: '#fff', strokeWidth: 2 }} />
                    )}
                    {Object.keys(clientHist?.benchmarks || {}).map(sym => (
                      <Line key={sym} type="monotone" dataKey={sym}
                        stroke={BENCHMARK_COLORS[sym] || '#94a3b8'} strokeWidth={1.5}
                        strokeDasharray="6 3" dot={false} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex justify-center py-12 text-sm text-text-muted">
                Pas assez de données historiques
              </div>
            )}

            {/* Chart legend */}
            <div className="flex flex-wrap justify-center gap-3 px-6 pb-5 pt-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: DUO.blue }} /> Client
              </span>
              {selectedModel && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                  <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: DUO.green }} /> Modèle
                </span>
              )}
              {Object.entries(BENCHMARK_LABELS).map(([sym, label]) => (
                <span key={sym} className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                  <div className="w-3 h-0.5 rounded-full border-t-2 border-dashed" style={{ borderColor: BENCHMARK_COLORS[sym] }} /> {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Future Projection Chart ── */}
          <div className="rounded-3xl border-[3px] border-gray-200 bg-white overflow-hidden"
            style={{ boxShadow: '0 4px 0 0 #e5e7eb' }}>
            <div className="px-6 pt-5 pb-2">
              <h3 className="font-extrabold text-text-main flex items-center gap-2">
                <Target className="h-5 w-5 text-[#CE82FF]" />
                Projection 12 mois (cours cibles analystes)
              </h3>
              <p className="text-xs font-semibold text-text-muted mt-1">
                Interpolation linéaire vers les prix cibles consensus
              </p>
            </div>

            {projectionChartData.length > 0 ? (
              <div className="h-[280px] px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projectionChartData} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradProjClient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={DUO.blue} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={DUO.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradProjModel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={DUO.green} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={DUO.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => fmtMoney(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: 16, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => {
                        const labels: Record<string, string> = {
                          client: 'Client', model: 'Modèle',
                          ...BENCHMARK_LABELS,
                        };
                        return [fmtMoney(Number(value)), labels[name] || name];
                      }}
                    />
                    <Area type="monotone" dataKey="client" stroke={DUO.blue} strokeWidth={3}
                      fill="url(#gradProjClient)" dot={false}
                      activeDot={{ r: 5, fill: DUO.blue, stroke: '#fff', strokeWidth: 2 }} />
                    {modelStats && (
                      <Area type="monotone" dataKey="model" stroke={DUO.green} strokeWidth={3}
                        fill="url(#gradProjModel)" dot={false}
                        activeDot={{ r: 5, fill: DUO.green, stroke: '#fff', strokeWidth: 2 }} />
                    )}
                    {Object.keys(BENCHMARK_LABELS).map(sym => (
                      <Line key={sym} type="monotone" dataKey={sym}
                        stroke={BENCHMARK_COLORS[sym] || '#94a3b8'} strokeWidth={1.5}
                        strokeDasharray="6 3" dot={false} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {/* Chart legend */}
            <div className="flex flex-wrap justify-center gap-3 px-6 pb-5 pt-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: DUO.blue }} /> Client
              </span>
              {modelStats && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                  <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: DUO.green }} /> Modèle
                </span>
              )}
              {Object.entries(BENCHMARK_LABELS).map(([sym, label]) => (
                <span key={sym} className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                  <div className="w-3 h-0.5 rounded-full border-t-2 border-dashed" style={{ borderColor: BENCHMARK_COLORS[sym] }} /> {label}
                </span>
              ))}
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

                    return (
                      <tr key={sym} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-text-main text-xs">{sym}</span>
                            {inClient && <span className="w-2 h-2 rounded-full bg-[#1CB0F6]" title="Client" />}
                            {inModel && <span className="w-2 h-2 rounded-full bg-[#58CC02]" title="Modèle" />}
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

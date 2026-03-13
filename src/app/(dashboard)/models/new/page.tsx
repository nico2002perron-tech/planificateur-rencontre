'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { RISK_PROFILES, ASSET_CLASSES, REGIONS } from '@/lib/utils/constants';
import type { ModelHolding } from '@/lib/hooks/useModels';
import { Save, Trash2, Search, X, ArrowRight, ArrowLeft, Check, DollarSign, Percent } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  country: string;
  currency: string;
  logo: string | null;
}

// ── TradingView search hook ──────────────────────────────────────

function useTVSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query || query.length < 1) { setResults([]); setIsLoading(false); return; }
    setIsLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch { /* aborted */ }
      finally { if (!controller.signal.aborted) setIsLoading(false); }
    }, 200);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return { results, isLoading };
}

// ── Helpers ──────────────────────────────────────────────────────

function detectRegion(symbol: string): string {
  if (symbol.endsWith('.TO') || symbol.endsWith('.V') || symbol.endsWith('.NE') || symbol.endsWith('.CN')) return 'CA';
  if (symbol.includes('.')) return 'INTL';
  return 'US';
}

const exchangeColors: Record<string, string> = {
  TSX: 'bg-red-100 text-red-700', TSXV: 'bg-red-50 text-red-600', NEO: 'bg-orange-100 text-orange-700',
  NYSE: 'bg-blue-100 text-blue-700', 'NYSE Arca': 'bg-blue-50 text-blue-600',
  NASDAQ: 'bg-emerald-100 text-emerald-700', AMEX: 'bg-purple-100 text-purple-700',
};

const typeLabels: Record<string, string> = { Stock: 'Action', ETF: 'ETF', ADR: 'ADR' };

// ── Component ────────────────────────────────────────────────────

export default function NewModelPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Model info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState('EQUILIBRE');
  const [holdings, setHoldings] = useState<ModelHolding[]>([]);

  // Weighting mode
  const [weightMode, setWeightMode] = useState<'pct' | 'dollar'>('pct');
  const [dollarAmounts, setDollarAmounts] = useState<Record<string, number>>({});

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, isLoading: searchLoading } = useTVSearch(searchQuery);

  const totalDollar = Object.values(dollarAmounts).reduce((sum, v) => sum + (v || 0), 0);
  const totalWeight = weightMode === 'pct'
    ? holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0)
    : totalDollar > 0 ? 100 : 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const updateHolding = useCallback((index: number, field: keyof ModelHolding, value: string | number) => {
    setHoldings(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  }, []);

  function removeHolding(index: number) {
    setHoldings(prev => prev.filter((_, i) => i !== index));
  }

  function selectResult(result: SearchResult) {
    if (holdings.some(h => h.symbol === result.symbol)) {
      toast('warning', `${result.symbol} est déjà dans la liste`);
      return;
    }
    setHoldings(prev => [...prev, {
      symbol: result.symbol,
      name: result.name,
      weight: 0,
      asset_class: 'EQUITY',
      region: detectRegion(result.symbol),
    }]);
    setSearchQuery('');
    setSearchOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function goToStep2() {
    if (!name.trim()) { toast('error', 'Le nom du modèle est requis'); return; }
    if (holdings.length === 0) { toast('error', 'Ajoutez au moins un titre'); return; }
    setStep(2);
  }

  // Convert dollar amounts to percentage weights on holdings
  function getHoldingsWithWeights(): ModelHolding[] {
    if (weightMode === 'pct') return holdings;
    if (totalDollar <= 0) return holdings;
    return holdings.map(h => ({
      ...h,
      weight: Math.round(((dollarAmounts[h.symbol] || 0) / totalDollar) * 1000) / 10,
    }));
  }

  async function handleSubmit() {
    const finalHoldings = getHoldingsWithWeights();
    const finalTotalWeight = finalHoldings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0);

    const zeroWeight = finalHoldings.filter(h => !h.weight || h.weight <= 0);
    if (zeroWeight.length > 0) {
      toast('error', `Pondération manquante: ${zeroWeight.map(h => h.symbol).join(', ')}`);
      return;
    }
    if (Math.abs(finalTotalWeight - 100) > 0.5) {
      toast('warning', `Total: ${finalTotalWeight.toFixed(1)}% — doit être 100%`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description: description || null, risk_level: riskLevel,
          holdings: finalHoldings.map(h => ({ ...h, weight: Number(h.weight) })),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erreur'); }
      toast('success', 'Modèle créé avec succès');
      router.push('/models');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Nouveau portefeuille modèle" />

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6 max-w-4xl">
        <button onClick={() => setStep(1)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${step === 1 ? 'bg-brand-primary text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/20">
            {step > 1 ? <Check className="h-3.5 w-3.5" /> : '1'}
          </span>
          Sélection des titres
        </button>
        <div className="h-px w-8 bg-gray-200" />
        <button onClick={() => holdings.length > 0 && name.trim() && setStep(2)} disabled={holdings.length === 0 || !name.trim()} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${step === 2 ? 'bg-brand-primary text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/20">2</span>
          Configuration
        </button>
      </div>

      <div className="max-w-4xl">
        {/* ═══════════ STEP 1: Select titles ═══════════ */}
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <h3 className="font-semibold text-text-main mb-4">Informations générales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nom du modèle" placeholder="Ex: Croissance canadienne" value={name} onChange={e => setName(e.target.value)} required />
                <Select label="Niveau de risque" options={[...RISK_PROFILES]} value={riskLevel} onChange={e => setRiskLevel(e.target.value)} />
              </div>
              <div className="mt-4">
                <Input label="Description" placeholder="Description optionnelle..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-main">Sélection des titres</h3>
                {holdings.length > 0 && (
                  <span className="text-sm font-semibold px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary">
                    {holdings.length} titre{holdings.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* TradingView search */}
              <div ref={searchRef} className="relative mb-5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                  <input ref={inputRef} type="text"
                    className="w-full pl-12 pr-10 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-sm placeholder:text-text-light transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 focus:outline-none"
                    placeholder="Rechercher par ticker ou nom d'entreprise..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                    onFocus={() => searchQuery && setSearchOpen(true)}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100">
                      <X className="h-4 w-4 text-text-muted" />
                    </button>
                  )}
                </div>
                {searchOpen && searchQuery.length >= 1 && (
                  <div className="absolute z-30 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-200 max-h-[380px] overflow-y-auto">
                    {searchLoading ? (
                      <div className="flex items-center gap-3 px-5 py-6">
                        <div className="h-5 w-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-text-muted">Recherche en cours...</span>
                      </div>
                    ) : results.length === 0 ? (
                      <div className="px-5 py-6 text-sm text-text-muted text-center">Aucun résultat pour &ldquo;{searchQuery}&rdquo;</div>
                    ) : (
                      results.map((r) => {
                        const isAdded = holdings.some(h => h.symbol === r.symbol);
                        return (
                          <button key={`${r.symbol}-${r.exchange}`} type="button" disabled={isAdded}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${isAdded ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'hover:bg-brand-primary/5 cursor-pointer'}`}
                            onMouseDown={e => { e.preventDefault(); if (!isAdded) selectResult(r); }}>
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {r.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.logo} alt="" className="w-6 h-6 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <span className="text-xs font-bold text-text-muted">{r.symbol.slice(0, 2)}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-text-main font-mono">{r.symbol}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${exchangeColors[r.exchange] || 'bg-gray-100 text-gray-600'}`}>{r.exchange}</span>
                                {r.type !== 'Stock' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{typeLabels[r.type] || r.type}</span>}
                              </div>
                              <p className="text-xs text-text-muted truncate mt-0.5">{r.name}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs text-text-light">{r.currency}</span>
                              {isAdded && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Ajouté</span>}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Selected holdings with numbering */}
              {holdings.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <Search className="h-8 w-8 text-text-light mx-auto mb-3" />
                  <p className="text-sm text-text-muted">Recherchez des titres pour construire votre portefeuille</p>
                  <p className="text-xs text-text-light mt-1">Actions, ETFs — par ticker ou nom d&apos;entreprise</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {holdings.map((h, i) => (
                    <div key={h.symbol} className="flex items-center gap-3 bg-gray-50/80 rounded-xl px-4 py-3 group hover:bg-gray-50 transition-colors">
                      {/* Number */}
                      <span className="w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      {/* Symbol */}
                      <span className="font-mono font-bold text-sm text-brand-primary w-20 flex-shrink-0">{h.symbol}</span>
                      {/* Name */}
                      <p className="text-sm text-text-main truncate flex-1">{h.name}</p>
                      {/* Delete */}
                      <button type="button" onClick={() => removeHolding(i)}
                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="flex justify-end">
              <Button type="button" onClick={goToStep2} disabled={holdings.length === 0 || !name.trim()} icon={<ArrowRight className="h-4 w-4" />}>
                Configurer les pondérations
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 2: Configure weights ═══════════ */}
        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-text-main">Configuration — {name}</h3>
                {/* Mode toggle */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button type="button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${weightMode === 'pct' ? 'bg-white text-brand-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    onClick={() => setWeightMode('pct')}>
                    <Percent className="h-3.5 w-3.5" />
                    Pourcentage
                  </button>
                  <button type="button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${weightMode === 'dollar' ? 'bg-white text-brand-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    onClick={() => setWeightMode('dollar')}>
                    <DollarSign className="h-3.5 w-3.5" />
                    Montant $
                  </button>
                </div>
              </div>
              <p className="text-sm text-text-muted mb-5">
                {weightMode === 'pct'
                  ? 'Attribuez une pondération en % et une classe d\u2019actif à chaque titre.'
                  : 'Entrez un montant en $ pour chaque titre — les pondérations seront calculées automatiquement.'}
              </p>

              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-text-muted px-2">
                  <div className="col-span-1">#</div>
                  <div className="col-span-2">Symbole</div>
                  <div className="col-span-3">Nom</div>
                  <div className="col-span-2">{weightMode === 'pct' ? 'Pondération' : 'Montant $'}</div>
                  {weightMode === 'dollar' && <div className="col-span-1 text-right">Poids</div>}
                  <div className={weightMode === 'dollar' ? 'col-span-1' : 'col-span-2'}>Classe</div>
                  <div className="col-span-2">Région</div>
                </div>

                {holdings.map((h, i) => {
                  const dollarVal = dollarAmounts[h.symbol] || 0;
                  const calcPct = totalDollar > 0 ? (dollarVal / totalDollar) * 100 : 0;
                  return (
                    <div key={h.symbol} className="grid grid-cols-12 gap-2 items-center bg-gray-50/80 rounded-xl px-2 py-2.5">
                      {/* Number */}
                      <div className="col-span-1">
                        <span className="w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                      </div>
                      {/* Symbol */}
                      <div className="col-span-2">
                        <span className="font-mono font-bold text-sm text-brand-primary">{h.symbol}</span>
                      </div>
                      {/* Name */}
                      <div className="col-span-3">
                        <span className="text-sm text-text-main truncate block">{h.name}</span>
                      </div>
                      {/* Weight / Dollar input */}
                      <div className="col-span-2">
                        {weightMode === 'pct' ? (
                          <div className="relative">
                            <input type="number" min="0" max="100" step="0.1"
                              className="w-full px-3 py-2 pr-7 rounded-lg border border-gray-200 text-sm text-right font-semibold focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none bg-white"
                              placeholder="0" value={h.weight || ''}
                              onChange={e => updateHolding(i, 'weight', parseFloat(e.target.value) || 0)}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">%</span>
                          </div>
                        ) : (
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">$</span>
                            <input type="number" min="0" step="any"
                              className="w-full pl-6 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-right font-semibold focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none bg-white"
                              placeholder="0" value={dollarVal || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                setDollarAmounts(prev => ({ ...prev, [h.symbol]: isNaN(val) ? 0 : val }));
                              }}
                            />
                          </div>
                        )}
                      </div>
                      {/* Calculated weight in dollar mode */}
                      {weightMode === 'dollar' && (
                        <div className="col-span-1 text-right">
                          <span className={`text-xs font-semibold ${calcPct > 0 ? 'text-brand-primary' : 'text-text-light'}`}>
                            {calcPct > 0 ? `${calcPct.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      )}
                      {/* Asset class */}
                      <div className={weightMode === 'dollar' ? 'col-span-1' : 'col-span-2'}>
                        <select className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs focus:border-brand-primary focus:outline-none appearance-none bg-white"
                          value={h.asset_class} onChange={e => updateHolding(i, 'asset_class', e.target.value)}>
                          {ASSET_CLASSES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </div>
                      {/* Region */}
                      <div className="col-span-2">
                        <select className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs focus:border-brand-primary focus:outline-none appearance-none bg-white"
                          value={h.region || 'CA'} onChange={e => updateHolding(i, 'region', e.target.value)}>
                          {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {/* Weight bar / Dollar total */}
                <div className="pt-3 mt-1">
                  {weightMode === 'pct' ? (
                    <>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-text-muted font-medium">Total pondération</span>
                        <span className={`font-bold ${Math.abs(totalWeight - 100) < 0.5 ? 'text-emerald-600' : totalWeight > 100 ? 'text-red-500' : 'text-amber-600'}`}>
                          {holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0).toFixed(1)} / 100%
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ease-out ${
                          Math.abs(totalWeight - 100) < 0.5 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : totalWeight > 100 ? 'bg-gradient-to-r from-red-400 to-red-500'
                              : 'bg-gradient-to-r from-brand-primary to-brand-accent'
                        }`} style={{ width: `${Math.min(holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0), 100)}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted font-medium">Total investi</span>
                      <span className={`font-bold ${totalDollar > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(totalDollar)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(1)} icon={<ArrowLeft className="h-4 w-4" />}>
                Modifier les titres
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
                <Button type="button" loading={loading}
                  disabled={holdings.length === 0 || (weightMode === 'pct' ? Math.abs(totalWeight - 100) > 0.5 : totalDollar <= 0)}
                  onClick={handleSubmit} icon={<Save className="h-4 w-4" />}>
                  Créer le modèle
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

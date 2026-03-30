'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useModel, type ModelHolding } from '@/lib/hooks/useModels';
import { RISK_PROFILES, ASSET_CLASSES, REGIONS } from '@/lib/utils/constants';
import Link from 'next/link';
import { Save, Trash2, Search, X, ArrowLeft, Rocket, Activity } from 'lucide-react';

// ── Types & helpers ──────────────────────────────────────────────

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  country: string;
  currency: string;
  logo: string | null;
}

const riskLabels: Record<string, string> = {
  CONSERVATEUR: 'Conservateur',
  MODERE: 'Modéré',
  EQUILIBRE: 'Équilibré',
  CROISSANCE: 'Croissance',
  DYNAMIQUE: 'Dynamique',
};

const riskColors: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
  CONSERVATEUR: 'info',
  MODERE: 'success',
  EQUILIBRE: 'warning',
  CROISSANCE: 'danger',
  DYNAMIQUE: 'danger',
};

const exchangeColors: Record<string, string> = {
  TSX: 'bg-red-100 text-red-700',
  TSXV: 'bg-red-50 text-red-600',
  NEO: 'bg-orange-100 text-orange-700',
  NYSE: 'bg-blue-100 text-blue-700',
  'NYSE Arca': 'bg-blue-50 text-blue-600',
  NASDAQ: 'bg-emerald-100 text-emerald-700',
  AMEX: 'bg-purple-100 text-purple-700',
};

const typeLabels: Record<string, string> = {
  Stock: 'Action',
  ETF: 'ETF',
  ADR: 'ADR',
};

function detectRegion(symbol: string): string {
  if (symbol.endsWith('.TO') || symbol.endsWith('.V') || symbol.endsWith('.NE') || symbol.endsWith('.CN')) return 'CA';
  if (symbol.includes('.')) return 'INTL';
  return 'US';
}

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

// ── Component ────────────────────────────────────────────────────

export default function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { model, isLoading, mutate } = useModel(id);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState('EQUILIBRE');
  const [holdings, setHoldings] = useState<ModelHolding[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, isLoading: searchLoading } = useTVSearch(searchQuery);

  useEffect(() => {
    if (model) {
      setName(model.name);
      setDescription(model.description || '');
      setRiskLevel(model.risk_level);
      setHoldings(model.holdings.length > 0 ? [...model.holdings] : []);
    }
  }, [model]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0);

  const updateHolding = useCallback((index: number, field: keyof ModelHolding, value: string | number) => {
    setHoldings(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  }, []);

  function selectResult(result: SearchResult) {
    if (holdings.some(h => h.symbol === result.symbol)) {
      toast('warning', `${result.symbol} est déjà dans la composition`);
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

  function resetEditing() {
    setEditing(false);
    setSearchQuery('');
    if (model) {
      setName(model.name);
      setDescription(model.description || '');
      setRiskLevel(model.risk_level);
      setHoldings(model.holdings.length > 0 ? [...model.holdings] : []);
    }
  }

  async function handleSave() {
    if (holdings.length === 0) { toast('error', 'Ajoutez au moins un titre'); return; }

    const zeroWeight = holdings.filter(h => !h.weight || h.weight <= 0);
    if (zeroWeight.length > 0) {
      toast('error', `Pondération manquante: ${zeroWeight.map(h => h.symbol).join(', ')}`);
      return;
    }

    const weight = holdings.reduce((s, h) => s + Number(h.weight), 0);
    if (Math.abs(weight - 100) > 0.5) {
      toast('warning', `Total: ${weight.toFixed(1)}% — doit être 100%`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description: description || null, risk_level: riskLevel,
          holdings: holdings.map(h => ({ ...h, weight: Number(h.weight) })),
        }),
      });
      if (!res.ok) throw new Error();
      toast('success', 'Modèle mis à jour');
      mutate();
      setEditing(false);
    } catch {
      toast('error', 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!model) return <Card className="text-center py-16"><p className="text-text-muted">Modèle introuvable</p></Card>;

  // ── Search dropdown (shared between new + edit) ─────────────────

  const searchBar = (
    <div ref={searchRef} className="relative mb-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          className="w-full pl-12 pr-10 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light transition-all duration-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 focus:outline-none"
          placeholder="Rechercher un titre ou une entreprise..."
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
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${
                    isAdded ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'hover:bg-brand-primary/5 cursor-pointer'
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); if (!isAdded) selectResult(r); }}
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {r.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.logo} alt="" className="w-6 h-6 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-xs font-bold text-text-muted">{r.symbol.slice(0, 2)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-text-main font-mono">{r.symbol}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${exchangeColors[r.exchange] || 'bg-gray-100 text-gray-600'}`}>{r.exchange}</span>
                      {r.type !== 'Stock' && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{typeLabels[r.type] || r.type}</span>
                      )}
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
  );

  // ── Holdings list (shared between new + edit) ───────────────────

  const holdingsList = holdings.length === 0 ? (
    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
      <Search className="h-8 w-8 text-text-light mx-auto mb-3" />
      <p className="text-sm text-text-muted">Recherchez des titres pour construire votre portefeuille</p>
    </div>
  ) : (
    <div className="space-y-2">
      {holdings.map((h, i) => (
        <div key={h.symbol} className="flex items-center gap-3 bg-gray-50/80 rounded-xl px-4 py-3 group hover:bg-gray-50 transition-colors">
          {/* Number */}
          <span className="w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
            {i + 1}
          </span>
          <div className="w-16 flex-shrink-0">
            <span className="font-mono font-bold text-sm text-brand-primary">{h.symbol}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-main truncate">{h.name}</p>
          </div>
          <div className="w-24 flex-shrink-0">
            <div className="relative">
              <input type="number" min="0" max="100" step="0.1"
                className="w-full px-3 py-2 pr-7 rounded-lg border border-gray-200 text-sm text-right font-semibold focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none bg-white"
                placeholder="0" value={h.weight || ''}
                onChange={e => updateHolding(i, 'weight', parseFloat(e.target.value) || 0)}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted font-normal">%</span>
            </div>
          </div>
          <div className="w-28 flex-shrink-0">
            <select className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs focus:border-brand-primary focus:outline-none appearance-none bg-white"
              value={h.asset_class} onChange={e => updateHolding(i, 'asset_class', e.target.value)}>
              {ASSET_CLASSES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="w-28 flex-shrink-0">
            <select className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs focus:border-brand-primary focus:outline-none appearance-none bg-white"
              value={h.region || 'CA'} onChange={e => updateHolding(i, 'region', e.target.value)}>
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => setHoldings(prev => prev.filter((_, j) => j !== i))}
            className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* Weight bar */}
      <div className="pt-3 mt-1">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-text-muted font-medium">Total pondération</span>
          <span className={`font-bold ${Math.abs(totalWeight - 100) < 0.5 ? 'text-emerald-600' : totalWeight > 100 ? 'text-red-500' : 'text-amber-600'}`}>
            {totalWeight.toFixed(1)} / 100%
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ease-out ${
            Math.abs(totalWeight - 100) < 0.5 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              : totalWeight > 100 ? 'bg-gradient-to-r from-red-400 to-red-500'
                : 'bg-gradient-to-r from-brand-primary to-brand-accent'
          }`} style={{ width: `${Math.min(totalWeight, 100)}%` }} />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={model.name}
        description={`Profil ${riskLabels[model.risk_level] || model.risk_level}`}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/models')} icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
            {!editing ? (
              <>
                <Link href={`/models/${id}/simulation`}>
                  <Button variant="outline" icon={<Activity className="h-4 w-4" />}>Simulation</Button>
                </Link>
                <Link href={`/models/${id}/apply`}>
                  <Button variant="outline" icon={<Rocket className="h-4 w-4" />}>Appliquer à un client</Button>
                </Link>
                <Button variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={resetEditing}>Annuler</Button>
                <Button loading={saving} onClick={handleSave} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
              </>
            )}
          </div>
        }
      />

      {editing ? (
        <div className="space-y-6 max-w-4xl">
          <Card>
            <h3 className="font-semibold text-text-main mb-4">Informations générales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nom" value={name} onChange={e => setName(e.target.value)} />
              <Select label="Niveau de risque" options={[...RISK_PROFILES]} value={riskLevel} onChange={e => setRiskLevel(e.target.value)} />
            </div>
            <div className="mt-4">
              <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-main">Composition</h3>
              {holdings.length > 0 && (
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  Math.abs(totalWeight - 100) < 0.5 ? 'bg-emerald-50 text-emerald-700'
                    : totalWeight > 100 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                }`}>{totalWeight.toFixed(1)}%</span>
              )}
            </div>
            {searchBar}
            {holdingsList}
          </Card>
        </div>
      ) : (
        /* Read-only view */
        <div className="space-y-6 max-w-4xl">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-semibold text-text-main text-lg">{model.name}</h3>
              <Badge variant={riskColors[model.risk_level] || 'info'}>
                {riskLabels[model.risk_level] || model.risk_level}
              </Badge>
            </div>
            {model.description && <p className="text-sm text-text-muted mb-4">{model.description}</p>}
          </Card>

          <Card>
            <h3 className="font-semibold text-text-main mb-4">Composition ({model.holdings.length} positions)</h3>

            {model.holdings.length > 0 && (
              <div className="flex gap-1 mb-6 h-4 rounded-full overflow-hidden bg-gray-100">
                {model.holdings.map((h, i) => {
                  const colors = ['bg-brand-primary', 'bg-brand-accent', 'bg-brand-dark', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
                  return <div key={i} className={colors[i % colors.length]} style={{ width: `${h.weight}%` }} title={`${h.symbol} — ${h.weight}%`} />;
                })}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-text-muted">
                    <th className="text-left py-2 font-semibold">Symbole</th>
                    <th className="text-left py-2 font-semibold">Nom</th>
                    <th className="text-right py-2 font-semibold">Pondération</th>
                    <th className="text-left py-2 pl-4 font-semibold">Classe d&apos;actif</th>
                    <th className="text-left py-2 font-semibold">Région</th>
                  </tr>
                </thead>
                <tbody>
                  {model.holdings.map((h, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-bg-light/50">
                      <td className="py-2.5 font-mono font-semibold text-brand-primary">{h.symbol}</td>
                      <td className="py-2.5 text-text-main">{h.name}</td>
                      <td className="py-2.5 text-right font-semibold">{h.weight}%</td>
                      <td className="py-2.5 pl-4 text-text-muted">{ASSET_CLASSES.find(a => a.value === h.asset_class)?.label || h.asset_class}</td>
                      <td className="py-2.5 text-text-muted">{REGIONS.find(r => r.value === h.region)?.label || h.region}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td className="py-2.5 font-semibold" colSpan={2}>Total</td>
                    <td className="py-2.5 text-right font-bold">{model.holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)}%</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

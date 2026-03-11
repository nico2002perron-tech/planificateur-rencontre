'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useSymbolSearch } from '@/lib/hooks/useQuotes';
import { RISK_PROFILES, ASSET_CLASSES, REGIONS } from '@/lib/utils/constants';
import type { ModelHolding } from '@/lib/hooks/useModels';
import { Save, Trash2, Plus, Search } from 'lucide-react';

function detectRegion(symbol: string): string {
  if (symbol.endsWith('.TO') || symbol.endsWith('.V') || symbol.endsWith('.CN')) return 'CA';
  if (symbol.includes('.')) return 'INTL';
  return 'US';
}

function InlineSymbolSearch({ onSelect }: { onSelect: (symbol: string, name: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, isLoading } = useSymbolSearch(query);

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
          placeholder="Rechercher un titre (ex: RY.TO, AAPL, XBB.TO)..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
      </div>
      {open && query.length >= 1 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-text-muted text-center py-4">Recherche en cours...</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Aucun résultat</p>
          ) : (
            results.map((r: { symbol: string; name: string; exchangeShortName: string }) => (
              <button
                key={r.symbol}
                type="button"
                className="w-full text-left px-4 py-2.5 hover:bg-bg-light transition-colors flex items-center justify-between"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(r.symbol, r.name);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <div>
                  <span className="font-semibold text-sm text-brand-primary font-mono">{r.symbol}</span>
                  <span className="text-xs text-text-muted ml-2">{r.name}</span>
                </div>
                <span className="text-xs text-text-light">{r.exchangeShortName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function NewModelPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState('EQUILIBRE');
  const [holdings, setHoldings] = useState<ModelHolding[]>([]);

  const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0);

  function updateHolding(index: number, field: keyof ModelHolding, value: string | number) {
    setHoldings(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  }

  function removeHolding(index: number) {
    setHoldings(prev => prev.filter((_, i) => i !== index));
  }

  function handleSearchSelect(symbol: string, symbolName: string) {
    if (holdings.some(h => h.symbol.toUpperCase() === symbol.toUpperCase())) {
      toast('warning', `${symbol} est déjà dans la composition`);
      return;
    }
    setHoldings(prev => [...prev, {
      symbol,
      name: symbolName,
      weight: 0,
      asset_class: 'EQUITY',
      region: detectRegion(symbol),
    }]);
  }

  function addManualHolding() {
    setHoldings(prev => [...prev, { symbol: '', name: '', weight: 0, asset_class: 'EQUITY', region: 'CA' }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast('error', 'Le nom est requis');
      return;
    }

    const validHoldings = holdings.filter(h => h.symbol.trim());
    if (validHoldings.length === 0) {
      toast('error', 'Ajoutez au moins une position avec un symbole');
      return;
    }

    const zeroWeight = validHoldings.filter(h => !h.weight || h.weight <= 0);
    if (zeroWeight.length > 0) {
      toast('error', `${zeroWeight.map(h => h.symbol).join(', ')} — pondération manquante`);
      return;
    }

    const weight = validHoldings.reduce((s, h) => s + Number(h.weight), 0);
    if (Math.abs(weight - 100) > 0.5) {
      toast('warning', `Le total des pondérations est ${weight.toFixed(1)}% (devrait être 100%)`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          risk_level: riskLevel,
          holdings: validHoldings.map(h => ({
            ...h,
            weight: Number(h.weight),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }

      toast('success', 'Modèle créé');
      router.push('/models');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Nouveau portefeuille modèle" />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <Card>
          <h3 className="font-semibold text-text-main mb-4">Informations générales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nom du modèle"
              placeholder="Ex: Croissance canadienne"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            <Select
              label="Niveau de risque"
              options={[...RISK_PROFILES]}
              value={riskLevel}
              onChange={e => setRiskLevel(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Input
              label="Description"
              placeholder="Description optionnelle du modèle..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-main">
              Composition
              {holdings.length > 0 && (
                <span className={`ml-2 text-sm font-normal ${Math.abs(totalWeight - 100) < 0.5 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ({totalWeight.toFixed(1)}%)
                </span>
              )}
            </h3>
          </div>

          {/* Search + manual add */}
          <div className="flex gap-2 mb-4">
            <InlineSymbolSearch onSelect={handleSearchSelect} />
            <Button type="button" variant="outline" size="sm" onClick={addManualHolding} icon={<Plus className="h-3.5 w-3.5" />}>
              Manuel
            </Button>
          </div>

          {holdings.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm border border-dashed border-gray-200 rounded-lg">
              Recherchez un titre ci-dessus ou ajoutez-en un manuellement
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-text-muted px-1">
                <div className="col-span-2">Symbole</div>
                <div className="col-span-3">Nom</div>
                <div className="col-span-2">Pondération</div>
                <div className="col-span-2">Classe</div>
                <div className="col-span-2">Région</div>
                <div className="col-span-1"></div>
              </div>

              {holdings.map((h, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-bg-light/50 rounded-lg px-1 py-1.5">
                  <div className="col-span-2">
                    {h.symbol ? (
                      <span className="px-3 py-2 text-sm font-mono font-semibold text-brand-primary">{h.symbol}</span>
                    ) : (
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none bg-white"
                        placeholder="RY.TO"
                        value={h.symbol}
                        onChange={e => {
                          const sym = e.target.value.toUpperCase();
                          updateHolding(i, 'symbol', sym);
                          updateHolding(i, 'region', detectRegion(sym));
                        }}
                      />
                    )}
                  </div>
                  <div className="col-span-3">
                    {h.symbol && h.name ? (
                      <span className="px-3 py-2 text-sm text-text-main truncate block">{h.name}</span>
                    ) : (
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none bg-white"
                        placeholder="Nom du titre"
                        value={h.name}
                        onChange={e => updateHolding(i, 'name', e.target.value)}
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none bg-white"
                        placeholder="0"
                        value={h.weight || ''}
                        onChange={e => updateHolding(i, 'weight', parseFloat(e.target.value) || 0)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">%</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <select
                      className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:outline-none appearance-none bg-white"
                      value={h.asset_class}
                      onChange={e => updateHolding(i, 'asset_class', e.target.value)}
                    >
                      {ASSET_CLASSES.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <select
                      className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:outline-none appearance-none bg-white"
                      value={h.region || 'CA'}
                      onChange={e => updateHolding(i, 'region', e.target.value)}
                    >
                      {REGIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeHolding(i)}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Weight progress bar */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-text-muted">Total pondération</span>
                  <span className={`font-semibold ${Math.abs(totalWeight - 100) < 0.5 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {totalWeight.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      Math.abs(totalWeight - 100) < 0.5 ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-red-500' : 'bg-brand-primary'
                    }`}
                    style={{ width: `${Math.min(totalWeight, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
          <Button type="submit" loading={loading} disabled={holdings.length === 0} icon={<Save className="h-4 w-4" />}>
            Créer le modèle
          </Button>
        </div>
      </form>
    </div>
  );
}

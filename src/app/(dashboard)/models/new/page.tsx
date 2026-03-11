'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { SymbolSearch } from '@/components/portfolios/SymbolSearch';
import { RISK_PROFILES, ASSET_CLASSES, REGIONS } from '@/lib/utils/constants';
import type { ModelHolding } from '@/lib/hooks/useModels';
import { Save, Trash2 } from 'lucide-react';

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

  function handleSymbolSelect(symbol: string, symbolName: string) {
    // Don't add duplicates
    if (holdings.some(h => h.symbol === symbol)) {
      toast('warning', `${symbol} est déjà dans la composition`);
      return;
    }

    // Detect region from symbol suffix
    let region = 'US';
    if (symbol.endsWith('.TO') || symbol.endsWith('.V') || symbol.endsWith('.CN')) {
      region = 'CA';
    } else if (symbol.includes('.')) {
      region = 'INTL';
    }

    setHoldings(prev => [...prev, {
      symbol,
      name: symbolName,
      weight: 0,
      asset_class: 'EQUITY',
      region,
    }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast('error', 'Le nom est requis');
      return;
    }

    if (holdings.length === 0) {
      toast('error', 'Ajoutez au moins une position');
      return;
    }

    const zeroWeight = holdings.filter(h => !h.weight || h.weight <= 0);
    if (zeroWeight.length > 0) {
      toast('error', `${zeroWeight.map(h => h.symbol).join(', ')} — pondération manquante`);
      return;
    }

    if (Math.abs(totalWeight - 100) > 0.5) {
      toast('warning', `Le total des pondérations est ${totalWeight.toFixed(1)}% (devrait être 100%)`);
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
          holdings: holdings.map(h => ({
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

          {/* Search bar to add holdings */}
          <div className="mb-4">
            <SymbolSearch
              onSelect={handleSymbolSelect}
              placeholder="Rechercher un titre à ajouter (ex: RY.TO, AAPL, XBB.TO)..."
            />
          </div>

          {holdings.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">
              Utilisez la barre de recherche ci-dessus pour ajouter des titres
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
                <div key={h.symbol} className="grid grid-cols-12 gap-2 items-center bg-bg-light/50 rounded-lg px-1 py-1.5">
                  <div className="col-span-2">
                    <span className="px-3 py-2 text-sm font-mono font-semibold text-brand-primary">{h.symbol}</span>
                  </div>
                  <div className="col-span-3">
                    <span className="px-3 py-2 text-sm text-text-main truncate block">{h.name}</span>
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
              {holdings.length > 0 && (
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
              )}
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { RISK_PROFILES, ASSET_CLASSES, REGIONS } from '@/lib/utils/constants';
import type { ModelHolding } from '@/lib/hooks/useModels';
import { Save, Plus, Trash2 } from 'lucide-react';

const emptyHolding: ModelHolding = { symbol: '', name: '', weight: 0, asset_class: 'EQUITY', region: 'CA' };

export default function NewModelPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState('EQUILIBRE');
  const [holdings, setHoldings] = useState<ModelHolding[]>([{ ...emptyHolding }]);

  const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0);

  function updateHolding(index: number, field: keyof ModelHolding, value: string | number) {
    setHoldings(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  }

  function addHolding() {
    setHoldings(prev => [...prev, { ...emptyHolding }]);
  }

  function removeHolding(index: number) {
    if (holdings.length <= 1) return;
    setHoldings(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast('error', 'Le nom est requis');
      return;
    }

    const validHoldings = holdings.filter(h => h.symbol.trim());
    if (validHoldings.length === 0) {
      toast('error', 'Ajoutez au moins une position');
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
              <span className={`ml-2 text-sm font-normal ${Math.abs(totalWeight - 100) < 0.5 ? 'text-emerald-600' : 'text-red-500'}`}>
                ({totalWeight.toFixed(1)}%)
              </span>
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={addHolding} icon={<Plus className="h-3.5 w-3.5" />}>
              Ajouter
            </Button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-text-muted px-1">
              <div className="col-span-2">Symbole</div>
              <div className="col-span-3">Nom</div>
              <div className="col-span-2">Pondération</div>
              <div className="col-span-2">Classe</div>
              <div className="col-span-2">Région</div>
              <div className="col-span-1"></div>
            </div>

            {holdings.map((h, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2">
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
                    placeholder="RY.TO"
                    value={h.symbol}
                    onChange={e => updateHolding(i, 'symbol', e.target.value.toUpperCase())}
                  />
                </div>
                <div className="col-span-3">
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
                    placeholder="Banque Royale"
                    value={h.name}
                    onChange={e => updateHolding(i, 'name', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
                      placeholder="0"
                      value={h.weight || ''}
                      onChange={e => updateHolding(i, 'weight', parseFloat(e.target.value) || 0)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">%</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <select
                    className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:outline-none appearance-none"
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
                    className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:outline-none appearance-none"
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
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                    disabled={holdings.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
          <Button type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>
            Créer le modèle
          </Button>
        </div>
      </form>
    </div>
  );
}

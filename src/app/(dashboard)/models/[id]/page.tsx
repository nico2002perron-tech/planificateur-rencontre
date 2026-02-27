'use client';

import { useState, useEffect, use } from 'react';
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
import { Save, Plus, Trash2, ArrowLeft, Rocket } from 'lucide-react';

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

const emptyHolding: ModelHolding = { symbol: '', name: '', weight: 0, asset_class: 'EQUITY', region: 'CA' };

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
  const [holdings, setHoldings] = useState<ModelHolding[]>([{ ...emptyHolding }]);

  useEffect(() => {
    if (model) {
      setName(model.name);
      setDescription(model.description || '');
      setRiskLevel(model.risk_level);
      setHoldings(model.holdings.length > 0 ? model.holdings : [{ ...emptyHolding }]);
    }
  }, [model]);

  const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0);

  function updateHolding(index: number, field: keyof ModelHolding, value: string | number) {
    setHoldings(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  }

  async function handleSave() {
    const validHoldings = holdings.filter(h => h.symbol.trim());

    if (validHoldings.length > 0) {
      const weight = validHoldings.reduce((s, h) => s + Number(h.weight), 0);
      if (Math.abs(weight - 100) > 0.5) {
        toast('warning', `Le total des pondérations est ${weight.toFixed(1)}% (devrait être 100%)`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          risk_level: riskLevel,
          holdings: validHoldings.map(h => ({ ...h, weight: Number(h.weight) })),
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

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  if (!model) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-muted">Modèle introuvable</p>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title={model.name}
        description={`Profil ${riskLabels[model.risk_level] || model.risk_level}`}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/models')} icon={<ArrowLeft className="h-4 w-4" />}>
              Retour
            </Button>
            {!editing ? (
              <>
                <Link href={`/models/${id}/apply`}>
                  <Button variant="outline" icon={<Rocket className="h-4 w-4" />}>Appliquer à un client</Button>
                </Link>
                <Button variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => { setEditing(false); if (model) { setName(model.name); setDescription(model.description || ''); setRiskLevel(model.risk_level); setHoldings(model.holdings.length > 0 ? model.holdings : [{ ...emptyHolding }]); } }}>
                  Annuler
                </Button>
                <Button loading={saving} onClick={handleSave} icon={<Save className="h-4 w-4" />}>
                  Enregistrer
                </Button>
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
              <h3 className="font-semibold text-text-main">
                Composition
                <span className={`ml-2 text-sm font-normal ${Math.abs(totalWeight - 100) < 0.5 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ({totalWeight.toFixed(1)}%)
                </span>
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setHoldings(prev => [...prev, { ...emptyHolding }])} icon={<Plus className="h-3.5 w-3.5" />}>
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
                    <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none" value={h.symbol} onChange={e => updateHolding(i, 'symbol', e.target.value.toUpperCase())} />
                  </div>
                  <div className="col-span-3">
                    <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none" value={h.name} onChange={e => updateHolding(i, 'name', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <input type="number" min="0" max="100" step="0.1" className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none" value={h.weight || ''} onChange={e => updateHolding(i, 'weight', parseFloat(e.target.value) || 0)} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">%</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <select className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:outline-none appearance-none" value={h.asset_class} onChange={e => updateHolding(i, 'asset_class', e.target.value)}>
                      {ASSET_CLASSES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <select className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:outline-none appearance-none" value={h.region || 'CA'} onChange={e => updateHolding(i, 'region', e.target.value)}>
                      {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button type="button" onClick={() => holdings.length > 1 && setHoldings(prev => prev.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30" disabled={holdings.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-semibold text-text-main text-lg">{model.name}</h3>
              <Badge variant={riskColors[model.risk_level] || 'info'}>
                {riskLabels[model.risk_level] || model.risk_level}
              </Badge>
            </div>
            {model.description && (
              <p className="text-sm text-text-muted mb-4">{model.description}</p>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-text-main mb-4">Composition ({model.holdings.length} positions)</h3>

            {model.holdings.length > 0 && (
              <div className="flex gap-1 mb-6 h-4 rounded-full overflow-hidden bg-gray-100">
                {model.holdings.map((h, i) => {
                  const colors = ['bg-brand-primary', 'bg-brand-accent', 'bg-brand-dark', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
                  return (
                    <div key={i} className={`${colors[i % colors.length]}`} style={{ width: `${h.weight}%` }} title={`${h.symbol} — ${h.weight}%`} />
                  );
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
                  {model.holdings.map((h, i) => {
                    const assetLabel = ASSET_CLASSES.find(a => a.value === h.asset_class)?.label || h.asset_class;
                    const regionLabel = REGIONS.find(r => r.value === h.region)?.label || h.region;
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-bg-light/50">
                        <td className="py-2.5 font-mono font-semibold text-brand-primary">{h.symbol}</td>
                        <td className="py-2.5 text-text-main">{h.name}</td>
                        <td className="py-2.5 text-right font-semibold">{h.weight}%</td>
                        <td className="py-2.5 pl-4 text-text-muted">{assetLabel}</td>
                        <td className="py-2.5 text-text-muted">{regionLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td className="py-2.5 font-semibold" colSpan={2}>Total</td>
                    <td className="py-2.5 text-right font-bold">
                      {model.holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)}%
                    </td>
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, Target, Clock, CheckCircle2, TrendingUp, Trash2 } from 'lucide-react';

type Snapshot = {
  id: string;
  batch_id: string;
  source_kind: 'price_targets_pdf' | 'manual';
  client_name: string;
  account_type: string;
  account_label: string;
  symbol: string;
  name: string;
  asset_type: string;
  quantity: number | null;
  current_price: number | null;
  target_price: number | null;
  expected_gain_pct: number | null;
  horizon_months: number;
  target_source: string;
  conviction: number | null;
  predicted_at: string;
  resolved_at: string | null;
  actual_price: number | null;
  actual_gain_pct: number | null;
  hit: boolean | null;
  created_at: string;
};

const ACCOUNT_TYPES = ['', 'REER', 'CELI', 'REEE', 'NON_ENREGISTRE', 'FERR', 'CRI', 'FRV', 'REER_COLLECTIF'];

function fmtMoney(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(v);
}
function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} %`;
}
function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(s));
  } catch {
    return s;
  }
}

export default function JournalPage() {
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Formulaire de saisie manuelle
  const [clientName, setClientName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [conviction, setConviction] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/price-target-snapshots');
      if (!res.ok) throw new Error();
      setSnapshots(await res.json());
    } catch {
      toast('error', 'Impossible de charger le journal');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setClientName('');
    setAccountType('');
    setSymbol('');
    setName('');
    setCurrentPrice('');
    setTargetPrice('');
    setConviction(null);
  }

  async function handleSave() {
    if (!symbol.trim() || !targetPrice.trim()) {
      toast('error', 'Symbole et cours cible sont requis');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/price-target-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_kind: 'manual',
          clientName: clientName.trim() || undefined,
          conviction,
          rows: [{
            symbol: symbol.trim().toUpperCase(),
            name: name.trim(),
            assetType: 'EQUITY',
            currentPrice: currentPrice ? Number(currentPrice) : undefined,
            targetPrice: Number(targetPrice),
            accountType: accountType || undefined,
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur');
      }
      toast('success', 'Cible ajoutée au journal');
      resetForm();
      setShowForm(false);
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur lors de l’enregistrement');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette prédiction du journal? Cette action est irréversible.')) return;
    setDeleting(id);
    // Retrait optimiste : on enlève la ligne tout de suite, on recharge ensuite.
    setSnapshots(prev => prev.filter(s => s.id !== id));
    try {
      const res = await fetch(`/api/price-target-snapshots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('success', 'Prédiction supprimée');
    } catch {
      toast('error', 'Erreur lors de la suppression');
      load(); // resynchronise si l'optimiste était faux
    } finally {
      setDeleting(null);
    }
  }

  const stats = useMemo(() => {
    const total = snapshots.length;
    const resolved = snapshots.filter(s => s.resolved_at).length;
    const pending = total - resolved;
    const gains = snapshots.map(s => s.expected_gain_pct).filter((g): g is number => g != null && Number.isFinite(g));
    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;
    return { total, resolved, pending, avgGain };
  }, [snapshots]);

  return (
    <div>
      <PageHeader
        title="Journal des cours cibles"
        description="Chaque cible montrée à un client est enregistrée comme une prédiction datée. Le bilan se construit avec le temps."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(v => !v)}>
            Ajouter manuellement
          </Button>
        }
      />

      {/* Résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding="sm" className="flex items-center gap-3">
          <Target className="h-5 w-5 text-brand-primary" />
          <div>
            <div className="text-xl font-bold text-text-main">{stats.total}</div>
            <div className="text-xs text-text-muted">Prédictions</div>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-500" />
          <div>
            <div className="text-xl font-bold text-text-main">{stats.pending}</div>
            <div className="text-xs text-text-muted">En attente</div>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <div>
            <div className="text-xl font-bold text-text-main">{stats.resolved}</div>
            <div className="text-xs text-text-muted">Résolues</div>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-brand-primary" />
          <div>
            <div className="text-xl font-bold text-text-main">{fmtPct(stats.avgGain)}</div>
            <div className="text-xs text-text-muted">Gain espéré moyen</div>
          </div>
        </Card>
      </div>

      {/* Formulaire manuel */}
      {showForm && (
        <Card className="mb-6">
          <h2 className="text-sm font-bold text-text-main mb-4">Ajouter une cible manuellement</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-xs font-semibold text-text-muted">
              Client
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-text-main"
                placeholder="Nom du client (optionnel)" />
            </label>
            <label className="text-xs font-semibold text-text-muted">
              Type de compte
              <select value={accountType} onChange={e => setAccountType(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-text-main bg-white">
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t || '—'}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-text-muted">
              Symbole *
              <input value={symbol} onChange={e => setSymbol(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-text-main uppercase"
                placeholder="AAPL" />
            </label>
            <label className="text-xs font-semibold text-text-muted">
              Nom du titre
              <input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-text-main"
                placeholder="Apple Inc." />
            </label>
            <label className="text-xs font-semibold text-text-muted">
              Prix actuel
              <input type="number" step="0.01" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-text-main"
                placeholder="0.00" />
            </label>
            <label className="text-xs font-semibold text-text-muted">
              Cours cible *
              <input type="number" step="0.01" value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-text-main"
                placeholder="0.00" />
            </label>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-muted">Conviction</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setConviction(c => (c === n ? null : n))}
                  className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                    conviction === n ? 'bg-brand-primary text-white' : 'bg-white text-text-muted border border-gray-200'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => { resetForm(); setShowForm(false); }}>Annuler</Button>
              <Button loading={saving} onClick={handleSave}>Enregistrer</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Liste */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-16 text-text-muted text-sm">
            Aucune prédiction encore. Génère un PDF de cours cibles ou ajoute-en une manuellement —
            le journal commencera à se remplir.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted border-b border-gray-100">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Symbole</th>
                  <th className="px-4 py-3 font-semibold text-right">Prix</th>
                  <th className="px-4 py-3 font-semibold text-right">Cible</th>
                  <th className="px-4 py-3 font-semibold text-right">Gain espéré</th>
                  <th className="px-4 py-3 font-semibold text-center">Conv.</th>
                  <th className="px-4 py-3 font-semibold text-center">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">{fmtDate(s.predicted_at)}</td>
                    <td className="px-4 py-3 text-text-main">
                      {s.client_name || <span className="text-text-muted">—</span>}
                      {s.account_type && <span className="ml-1 text-xs text-text-muted">({s.account_type})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-text-main">{s.symbol}</span>
                      {s.name && <span className="ml-2 text-xs text-text-muted">{s.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-text-main">{fmtMoney(s.current_price)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-text-main">{fmtMoney(s.target_price)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      (s.expected_gain_pct ?? 0) > 0 ? 'text-emerald-600' : (s.expected_gain_pct ?? 0) < 0 ? 'text-red-600' : 'text-text-muted'
                    }`}>{fmtPct(s.expected_gain_pct)}</td>
                    <td className="px-4 py-3 text-center">
                      {s.conviction ? <Badge variant="info">{s.conviction}/5</Badge> : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.resolved_at
                        ? <Badge variant={s.hit ? 'success' : 'default'}>{s.hit ? 'Atteint' : 'Résolu'}</Badge>
                        : <Badge variant="warning">En attente</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        disabled={deleting === s.id}
                        title="Supprimer cette prédiction"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

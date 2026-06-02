'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, Target, TrendingUp, Trash2, Search, ChevronLeft, User, ChevronRight, ArrowRight } from 'lucide-react';

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
const NO_NAME = '(Sans nom)';

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(v);
}
function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} %`;
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(s));
  } catch { return s; }
}
function monthsElapsed(iso: string): number {
  const start = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, (now - start) / (1000 * 60 * 60 * 24 * 30.44));
}
function dueDate(iso: string, horizonMonths: number): Date {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + (horizonMonths || 12));
  return d;
}
function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}
function gainColor(v: number | null | undefined): string {
  if (v == null) return 'text-text-muted';
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-600' : 'text-text-muted';
}

/** Petite barre de progression. */
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${clamp(pct)}%`, backgroundColor: color }} />
    </div>
  );
}

export default function JournalPage() {
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  // Prix live (compteur) — symbole → prix actuel
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  // Formulaire de saisie manuelle
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [fClient, setFClient] = useState('');
  const [fAccount, setFAccount] = useState('');
  const [fSymbol, setFSymbol] = useState('');
  const [fName, setFName] = useState('');
  const [fCurrent, setFCurrent] = useState('');
  const [fTarget, setFTarget] = useState('');
  const [fConviction, setFConviction] = useState<number | null>(null);

  const load = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Regroupement par client
  const clients = useMemo(() => {
    const map = new Map<string, Snapshot[]>();
    for (const s of snapshots) {
      const key = (s.client_name || '').trim() || NO_NAME;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([name, rows]) => {
      const symbols = new Set(rows.map(r => r.symbol));
      const gains = rows.map(r => r.expected_gain_pct).filter((g): g is number => g != null && Number.isFinite(g));
      const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;
      const lastDate = rows.reduce((acc, r) => (r.predicted_at > acc ? r.predicted_at : acc), rows[0].predicted_at);
      return { name, positions: symbols.size, predictions: rows.length, avgGain, lastDate };
    }).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
  }, [snapshots]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? clients.filter(c => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, search]);

  // Lignes du client sélectionné, groupées par symbole (plus récent d'abord)
  const selectedRows = useMemo(
    () => snapshots.filter(s => ((s.client_name || '').trim() || NO_NAME) === selectedClient),
    [snapshots, selectedClient]
  );
  const bySymbol = useMemo(() => {
    const map = new Map<string, Snapshot[]>();
    for (const s of selectedRows) {
      if (!map.has(s.symbol)) map.set(s.symbol, []);
      map.get(s.symbol)!.push(s);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.predicted_at < b.predicted_at ? 1 : -1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [selectedRows]);

  // Prix live à l'ouverture d'un client
  useEffect(() => {
    if (!selectedClient) return;
    const syms = Array.from(new Set(selectedRows.map(r => r.symbol))).slice(0, 30);
    if (syms.length === 0) return;
    setPricesLoading(true);
    fetch(`/api/prices?symbols=${encodeURIComponent(syms.join(','))}`)
      .then(r => r.json())
      .then((arr: { symbol: string; price: number }[]) => {
        const m: Record<string, number> = {};
        for (const p of arr) if (p.price > 0) m[p.symbol] = p.price;
        setPrices(m);
      })
      .catch(() => {})
      .finally(() => setPricesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  function openForm(presetClient?: string) {
    setFClient(presetClient ?? (selectedClient && selectedClient !== NO_NAME ? selectedClient : ''));
    setFAccount(''); setFSymbol(''); setFName(''); setFCurrent(''); setFTarget(''); setFConviction(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!fClient.trim()) { toast('error', 'Le nom du client est requis'); return; }
    if (!fSymbol.trim() || !fTarget.trim()) { toast('error', 'Symbole et cours cible sont requis'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/price-target-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_kind: 'manual',
          clientName: fClient.trim(),
          conviction: fConviction,
          rows: [{
            symbol: fSymbol.trim().toUpperCase(),
            name: fName.trim(),
            assetType: 'EQUITY',
            currentPrice: fCurrent ? Number(fCurrent) : undefined,
            targetPrice: Number(fTarget),
            accountType: fAccount || undefined,
          }],
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Erreur'); }
      toast('success', 'Position ajoutée au journal');
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
    setSnapshots(prev => prev.filter(s => s.id !== id));
    try {
      const res = await fetch(`/api/price-target-snapshots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('success', 'Prédiction supprimée');
    } catch {
      toast('error', 'Erreur lors de la suppression');
      load();
    } finally {
      setDeleting(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Vue détail d'un client
  // ─────────────────────────────────────────────────────────────────────
  if (selectedClient) {
    return (
      <div>
        <button onClick={() => setSelectedClient(null)} className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-main mb-3">
          <ChevronLeft className="h-4 w-4" /> Tous les clients
        </button>
        <PageHeader
          title={selectedClient}
          description={`${bySymbol.length} position${bySymbol.length > 1 ? 's' : ''} suivie${bySymbol.length > 1 ? 's' : ''}${pricesLoading ? ' · chargement des prix…' : ''}`}
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm(selectedClient)}>Ajouter une position</Button>}
        />

        {showForm && <ManualForm
          fClient={fClient} setFClient={setFClient} fAccount={fAccount} setFAccount={setFAccount}
          fSymbol={fSymbol} setFSymbol={setFSymbol} fName={fName} setFName={setFName}
          fCurrent={fCurrent} setFCurrent={setFCurrent} fTarget={fTarget} setFTarget={setFTarget}
          fConviction={fConviction} setFConviction={setFConviction}
          saving={saving} onSave={handleSave} onCancel={() => setShowForm(false)}
        />}

        <div className="space-y-4">
          {bySymbol.map(([symbol, rows]) => {
            const latest = rows[0];
            const history = rows.slice(1);
            const pred = latest.current_price ?? null;
            const target = latest.target_price ?? null;
            const live = prices[symbol];
            const liveSincePred = live != null && pred && pred > 0 ? ((live - pred) / pred) * 100 : null;
            const toTarget = live != null && pred != null && target != null && target !== pred
              ? ((live - pred) / (target - pred)) * 100 : null;
            const elapsed = monthsElapsed(latest.predicted_at);
            const timePct = latest.horizon_months > 0 ? (elapsed / latest.horizon_months) * 100 : 0;
            const due = dueDate(latest.predicted_at, latest.horizon_months);
            return (
              <Card key={symbol} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-base font-bold text-text-main">{symbol}</span>
                    {latest.name && <span className="ml-2 text-sm text-text-muted">{latest.name}</span>}
                    <div className="text-xs text-text-muted mt-0.5">
                      Prédiction du {fmtDate(latest.predicted_at)}
                      {latest.conviction ? <> · <Badge variant="info">conviction {latest.conviction}/5</Badge></> : null}
                      {latest.account_type ? ` · ${latest.account_type}` : ''}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(latest.id)} disabled={deleting === latest.id}
                    title="Supprimer" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Le compteur : prix alors → prix actuel → cible */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-text-muted">Prix alors</div>
                    <div className="text-lg font-bold text-text-main">{fmtMoney(pred)}</div>
                    <div className="text-[10px] text-text-muted">{fmtDate(latest.predicted_at)}</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-blue-700">Prix actuel</div>
                    <div className="text-lg font-bold text-text-main">{fmtMoney(live)}</div>
                    <div className={`text-[10px] font-semibold ${gainColor(liveSincePred)}`}>{liveSincePred != null ? `${fmtPct(liveSincePred)} depuis` : 'prix indisponible'}</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-emerald-700">Cible {latest.horizon_months} mois</div>
                    <div className="text-lg font-bold text-text-main">{fmtMoney(target)}</div>
                    <div className={`text-[10px] font-semibold ${gainColor(latest.expected_gain_pct)}`}>{fmtPct(latest.expected_gain_pct)} visé</div>
                  </div>
                </div>

                {/* Progressions */}
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-text-muted mb-1">
                      <span>Vers la cible</span>
                      <span className="font-semibold">{toTarget != null ? `${Math.round(clamp(toTarget))} %` : '—'}</span>
                    </div>
                    <Bar pct={toTarget ?? 0} color="#10b981" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-text-muted mb-1">
                      <span>Temps écoulé</span>
                      <span className="font-semibold">{Math.round(clamp(timePct))} % · échéance {fmtDate(due.toISOString())}</span>
                    </div>
                    <Bar pct={timePct} color="#93c5fd" />
                  </div>
                </div>

                {/* Historique des prédictions précédentes pour ce titre */}
                {history.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs font-semibold text-text-muted cursor-pointer">Historique ({history.length})</summary>
                    <div className="mt-2 space-y-1">
                      {history.map(h => (
                        <div key={h.id} className="flex items-center justify-between text-xs text-text-muted border-t border-gray-50 pt-1">
                          <span>{fmtDate(h.predicted_at)}</span>
                          <span>{fmtMoney(h.current_price)} <ArrowRight className="inline h-3 w-3" /> {fmtMoney(h.target_price)} ({fmtPct(h.expected_gain_pct)})</span>
                          <button onClick={() => handleDelete(h.id)} disabled={deleting === h.id} className="text-gray-300 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Vue liste des clients
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Journal des cibles"
        description="Tes cours cibles classés par client. Clique un client pour suivre chaque position : prix d'alors → prix actuel → cible."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm()}>Ajouter manuellement</Button>}
      />

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client par nom…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-text-main"
        />
      </div>

      {showForm && <ManualForm
        fClient={fClient} setFClient={setFClient} fAccount={fAccount} setFAccount={setFAccount}
        fSymbol={fSymbol} setFSymbol={setFSymbol} fName={fName} setFName={setFName}
        fCurrent={fCurrent} setFCurrent={setFCurrent} fTarget={fTarget} setFTarget={setFTarget}
        fConviction={fConviction} setFConviction={setFConviction}
        saving={saving} onSave={handleSave} onCancel={() => setShowForm(false)}
      />}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          {search ? 'Aucun client ne correspond.' : 'Aucune prédiction encore. Génère un PDF de cours cibles (avec un nom de client) ou ajoute-en une manuellement.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(c => (
            <Card key={c.name} hover onClick={() => setSelectedClient(c.name)} className="cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-brand-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-text-main">{c.name}</div>
                    <div className="text-xs text-text-muted">{c.positions} position{c.positions > 1 ? 's' : ''} · {c.predictions} prédiction{c.predictions > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-text-muted mt-1" />
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-sm">
                  <TrendingUp className={`h-4 w-4 ${gainColor(c.avgGain)}`} />
                  <span className={`font-bold ${gainColor(c.avgGain)}`}>{fmtPct(c.avgGain)}</span>
                  <span className="text-xs text-text-muted">visé (moy.)</span>
                </div>
                <span className="text-xs text-text-muted">{fmtDate(c.lastDate)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Formulaire de saisie manuelle (partagé liste / détail) ──────────────
function ManualForm(props: {
  fClient: string; setFClient: (v: string) => void;
  fAccount: string; setFAccount: (v: string) => void;
  fSymbol: string; setFSymbol: (v: string) => void;
  fName: string; setFName: (v: string) => void;
  fCurrent: string; setFCurrent: (v: string) => void;
  fTarget: string; setFTarget: (v: string) => void;
  fConviction: number | null; setFConviction: (v: number | null) => void;
  saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  const { fClient, setFClient, fAccount, setFAccount, fSymbol, setFSymbol, fName, setFName, fCurrent, setFCurrent, fTarget, setFTarget, fConviction, setFConviction, saving, onSave, onCancel } = props;
  const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-text-main';
  return (
    <Card className="mb-6">
      <h2 className="text-sm font-bold text-text-main mb-4">Ajouter une position manuellement</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="text-xs font-semibold text-text-muted">
          Client *
          <input value={fClient} onChange={e => setFClient(e.target.value)} className={inputCls} placeholder="Nom du client" />
        </label>
        <label className="text-xs font-semibold text-text-muted">
          Type de compte
          <select value={fAccount} onChange={e => setFAccount(e.target.value)} className={`${inputCls} bg-white`}>
            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t || '—'}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-text-muted">
          Symbole *
          <input value={fSymbol} onChange={e => setFSymbol(e.target.value)} className={`${inputCls} uppercase`} placeholder="AAPL" />
        </label>
        <label className="text-xs font-semibold text-text-muted">
          Nom du titre
          <input value={fName} onChange={e => setFName(e.target.value)} className={inputCls} placeholder="Apple Inc." />
        </label>
        <label className="text-xs font-semibold text-text-muted">
          Prix actuel
          <input type="number" step="0.01" value={fCurrent} onChange={e => setFCurrent(e.target.value)} className={inputCls} placeholder="0.00" />
        </label>
        <label className="text-xs font-semibold text-text-muted">
          Cours cible *
          <input type="number" step="0.01" value={fTarget} onChange={e => setFTarget(e.target.value)} className={inputCls} placeholder="0.00" />
        </label>
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">Conviction</span>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setFConviction(fConviction === n ? null : n)}
              className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${fConviction === n ? 'bg-brand-primary text-white' : 'bg-white text-text-muted border border-gray-200'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>Annuler</Button>
          <Button loading={saving} onClick={onSave}>Enregistrer</Button>
        </div>
      </div>
    </Card>
  );
}

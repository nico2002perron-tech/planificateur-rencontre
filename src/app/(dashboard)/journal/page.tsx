'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { VaultGate } from '@/components/security/VaultGate';
import { useVault } from '@/components/security/VaultProvider';
import { Plus, TrendingUp, Trash2, Search, ChevronLeft, User, ChevronRight, ArrowRight, ShieldAlert, Lock, BarChart3, CheckCircle2, XCircle } from 'lucide-react';

type Snapshot = {
  id: string;
  batch_id: string;
  source_kind: 'price_targets_pdf' | 'manual';
  entry_type?: 'price_target' | 'model_portfolio' | null;
  client_name: string;
  name_enc: string | null;
  name_idx: string | null;
  account_type: string;
  account_label: string;
  symbol: string;
  name: string;
  asset_type: string;
  quantity: number | null;
  average_cost: number | null; // PBR (prix de base rajusté / prix payé)
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
  peak_price: number | null;
  peak_at: string | null;
  trough_price: number | null;
  trough_at: string | null;
  created_at: string;
};

const ACCOUNT_TYPES = ['', 'REER', 'CELI', 'REEE', 'NON_ENREGISTRE', 'FERR', 'CRI', 'FRV', 'REER_COLLECTIF'];
const NO_NAME = '(Sans nom)';
const PENDING = '⋯'; // affiché le temps que le nom soit déchiffré
const UNREADABLE = '🔒 illisible';

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

// Clé de regroupement : l'index aveugle (déterministe) regroupe toutes les
// captures d'un même client. Les anciennes lignes (avant chiffrement) sont
// regroupées par leur nom en clair, en attendant la migration.
function groupKeyOf(s: Snapshot): string {
  return s.name_idx && s.name_idx.trim() ? `idx:${s.name_idx}` : `legacy:${(s.client_name || '').trim()}`;
}
function isLegacy(s: Snapshot): boolean {
  return !(s.name_idx && s.name_idx.trim()) && Boolean((s.client_name || '').trim());
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
  return (
    <VaultGate>
      <JournalInner />
    </VaultGate>
  );
}

function JournalInner() {
  const { toast } = useToast();
  const vault = useVault();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Noms déchiffrés en mémoire : index aveugle → nom en clair (jamais persisté).
  const [nameByIdx, setNameByIdx] = useState<Record<string, string>>({});

  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

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
  const [fPbr, setFPbr] = useState(''); // PBR / prix payé (optionnel)
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

  // Déchiffrage des noms (une fois par client) dès que les captures changent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      const seen = new Set<string>();
      for (const s of snapshots) {
        if (s.name_idx && s.name_idx.trim() && s.name_enc && !seen.has(s.name_idx)) {
          seen.add(s.name_idx);
          try { next[s.name_idx] = await vault.decrypt(s.name_enc); }
          catch { next[s.name_idx] = UNREADABLE; }
        }
      }
      if (!cancelled) setNameByIdx(next);
    })();
    return () => { cancelled = true; };
  }, [snapshots, vault]);

  const displayNameOf = useCallback((s: Snapshot): string => {
    if (s.name_idx && s.name_idx.trim()) return nameByIdx[s.name_idx] ?? PENDING;
    return (s.client_name || '').trim() || NO_NAME;
  }, [nameByIdx]);

  // Anciennes captures à sécuriser (noms encore en clair).
  const legacyRows = useMemo(() => snapshots.filter(isLegacy), [snapshots]);

  async function handleMigrate() {
    if (legacyRows.length === 0) return;
    setMigrating(true);
    try {
      const updates = [];
      for (const s of legacyRows) {
        const name = (s.client_name || '').trim();
        const [nameEnc, nameIdx] = await Promise.all([vault.encrypt(name), vault.index(name)]);
        updates.push({ id: s.id, nameEnc, nameIdx });
      }
      const res = await fetch('/api/price-target-snapshots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error();
      const { updated } = await res.json();
      toast('success', `${updated} ancienne${updated > 1 ? 's' : ''} capture${updated > 1 ? 's' : ''} sécurisée${updated > 1 ? 's' : ''}`);
      load();
    } catch {
      toast('error', 'Erreur lors de la sécurisation des anciennes captures');
    } finally {
      setMigrating(false);
    }
  }

  // Regroupement par client
  const clients = useMemo(() => {
    const map = new Map<string, Snapshot[]>();
    for (const s of snapshots) {
      const key = groupKeyOf(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([key, rows]) => {
      const symbols = new Set(rows.map(r => r.symbol));
      const gains = rows.map(r => r.expected_gain_pct).filter((g): g is number => g != null && Number.isFinite(g));
      const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;
      const lastDate = rows.reduce((acc, r) => (r.predicted_at > acc ? r.predicted_at : acc), rows[0].predicted_at);
      const hasModel = rows.some(r => r.entry_type === 'model_portfolio');
      return { key, name: displayNameOf(rows[0]), legacy: isLegacy(rows[0]), positions: symbols.size, predictions: rows.length, avgGain, lastDate, hasModel };
    }).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
  }, [snapshots, displayNameOf]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? clients.filter(c => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, search]);

  // Lignes du client sélectionné, groupées par symbole (plus récent d'abord)
  const selectedRows = useMemo(
    () => snapshots.filter(s => groupKeyOf(s) === selectedKey),
    [snapshots, selectedKey]
  );
  const selectedName = useMemo(
    () => (selectedRows[0] ? displayNameOf(selectedRows[0]) : ''),
    [selectedRows, displayNameOf]
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
    if (!selectedKey) return;
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
  }, [selectedKey]);

  function openForm(presetClient?: string) {
    setFClient(presetClient && presetClient !== NO_NAME ? presetClient : '');
    setFAccount(''); setFSymbol(''); setFName(''); setFPbr(''); setFCurrent(''); setFTarget(''); setFConviction(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!fClient.trim()) { toast('error', 'Le nom du client est requis'); return; }
    if (!fSymbol.trim() || !fTarget.trim()) { toast('error', 'Symbole et cours cible sont requis'); return; }
    setSaving(true);
    try {
      // Le nom est chiffré DANS le navigateur avant l'envoi.
      const [nameEnc, nameIdx] = await Promise.all([vault.encrypt(fClient.trim()), vault.index(fClient.trim())]);
      const res = await fetch('/api/price-target-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_kind: 'manual',
          nameEnc,
          nameIdx,
          conviction: fConviction,
          rows: [{
            symbol: fSymbol.trim().toUpperCase(),
            name: fName.trim(),
            assetType: 'EQUITY',
            averageCost: fPbr ? Number(fPbr) : undefined,
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
  if (selectedKey) {
    return (
      <div>
        <button onClick={() => setSelectedKey(null)} className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-main mb-3">
          <ChevronLeft className="h-4 w-4" /> Tous les clients
        </button>
        <PageHeader
          title={selectedName || PENDING}
          description={`${bySymbol.length} position${bySymbol.length > 1 ? 's' : ''} suivie${bySymbol.length > 1 ? 's' : ''}${pricesLoading ? ' · chargement des prix…' : ''}`}
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm(selectedName)}>Ajouter une position</Button>}
        />

        {showForm && <ManualForm
          fClient={fClient} setFClient={setFClient} fAccount={fAccount} setFAccount={setFAccount}
          fSymbol={fSymbol} setFSymbol={setFSymbol} fName={fName} setFName={setFName}
          fPbr={fPbr} setFPbr={setFPbr}
          fCurrent={fCurrent} setFCurrent={setFCurrent} fTarget={fTarget} setFTarget={setFTarget}
          fConviction={fConviction} setFConviction={setFConviction}
          saving={saving} onSave={handleSave} onCancel={() => setShowForm(false)}
        />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {bySymbol.map(([symbol, rows]) => {
            const latest = rows[0];
            const history = rows.slice(1);
            const pbr = latest.average_cost != null && latest.average_cost > 0 ? latest.average_cost : null;
            const pred = latest.current_price ?? null;
            const target = latest.target_price ?? null;
            const live = prices[symbol];
            const liveSincePred = live != null && pred && pred > 0 ? ((live - pred) / pred) * 100 : null;
            // Gain au marché : depuis le PBR (prix payé) si connu, sinon depuis le prix de prédiction.
            const marketGain = live != null && pbr ? ((live - pbr) / pbr) * 100 : liveSincePred;
            const marketGainLabel = pbr != null ? 'depuis achat' : 'depuis pred.';
            // Potentiel restant : du prix au marché vers la cible.
            const upside = live != null && live > 0 && target != null ? ((target - live) / live) * 100 : null;
            const toTarget = live != null && pred != null && target != null && target !== pred
              ? ((live - pred) / (target - pred)) * 100 : null;
            const due = dueDate(latest.predicted_at, latest.horizon_months);
            return (
              <Card key={symbol} className="p-3">
                {/* En-tête compacte : titre + meta + suppr */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-text-main">{symbol}</span>
                    {latest.name && <span className="text-xs text-text-muted truncate max-w-[160px]">{latest.name}</span>}
                    <span className="text-[10px] text-text-muted">
                      {latest.account_type ? `${latest.account_type} · ` : ''}cible {latest.horizon_months} mois · {fmtDate(latest.predicted_at)}
                      {latest.conviction ? ` · conv. ${latest.conviction}/5` : ''}
                    </span>
                  </div>
                  <button onClick={() => handleDelete(latest.id)} disabled={deleting === latest.id}
                    title="Supprimer" className="p-1 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* PBR payé → prix au marché → cours cible */}
                <div className="flex items-stretch gap-1 text-center">
                  <div className="flex-1 rounded-lg bg-gray-50 py-1.5 px-1">
                    <div className="text-[9px] uppercase tracking-wide text-text-muted">PBR payé</div>
                    <div className="text-sm font-bold text-text-main leading-tight">{fmtMoney(pbr)}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 self-center shrink-0" />
                  <div className="flex-1 rounded-lg bg-blue-50 py-1.5 px-1">
                    <div className="text-[9px] uppercase tracking-wide text-blue-700">Marché</div>
                    <div className="text-sm font-bold text-text-main leading-tight">{fmtMoney(live)}</div>
                    {marketGain != null
                      ? <div className={`text-[9px] font-semibold ${gainColor(marketGain)}`}>{fmtPct(marketGain)} {marketGainLabel}</div>
                      : <div className="text-[9px] text-text-muted">{pricesLoading ? '…' : '—'}</div>}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 self-center shrink-0" />
                  <div className="flex-1 rounded-lg bg-emerald-50 py-1.5 px-1">
                    <div className="text-[9px] uppercase tracking-wide text-emerald-700">Cible</div>
                    <div className="text-sm font-bold text-text-main leading-tight">{fmtMoney(target)}</div>
                    {upside != null
                      ? <div className={`text-[9px] font-semibold ${gainColor(upside)}`}>{fmtPct(upside)} à venir</div>
                      : <div className={`text-[9px] font-semibold ${gainColor(latest.expected_gain_pct)}`}>{fmtPct(latest.expected_gain_pct)} visé</div>}
                  </div>
                </div>

                {/* Progression vers la cible + échéance (compact) */}
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-text-muted mb-0.5">
                    <span>Vers la cible{toTarget != null ? ` · ${Math.round(clamp(toTarget))} %` : ''}</span>
                    <span>échéance {fmtDate(due.toISOString())}</span>
                  </div>
                  <Bar pct={toTarget ?? 0} color="#10b981" />
                </div>

                {/* Verdict : prédiction résolue, ou cible déjà touchée en attendant l'échéance */}
                {latest.resolved_at ? (
                  <div className={`mt-3 rounded-xl border p-3 ${latest.hit ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {latest.hit ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
                        <span className={`text-sm font-bold ${latest.hit ? 'text-emerald-700' : 'text-red-700'}`}>
                          {latest.hit ? 'Cible atteinte' : 'Cible manquée'}
                        </span>
                        <span className="text-xs text-text-muted">· résolu le {fmtDate(latest.resolved_at)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-text-main">{fmtMoney(latest.actual_price)}</div>
                        <div className={`text-[11px] font-semibold ${gainColor(latest.actual_gain_pct)}`}>{fmtPct(latest.actual_gain_pct)} réalisé</div>
                      </div>
                    </div>
                    {latest.peak_price != null && (
                      <div className="text-[11px] text-text-muted mt-1.5 pt-1.5 border-t border-black/5">
                        Sommet pendant l&apos;horizon : <span className="font-semibold text-text-main">{fmtMoney(latest.peak_price)}</span>
                        {latest.peak_at ? ` (${fmtDate(latest.peak_at)})` : ''}
                      </div>
                    )}
                  </div>
                ) : latest.peak_price != null && target != null && pred != null && latest.peak_price >= target && target >= pred ? (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Sommet a déjà touché la cible ({fmtMoney(latest.peak_price)}{latest.peak_at ? `, ${fmtDate(latest.peak_at)}` : ''}) — en attente de l&apos;échéance.
                  </div>
                ) : null}

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
        action={
          <div className="flex items-center gap-2">
            <Link href="/journal/bilan">
              <Button variant="ghost" icon={<BarChart3 className="h-4 w-4" />}>Bilan</Button>
            </Link>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm()}>Ajouter manuellement</Button>
          </div>
        }
      />

      {/* Bandeau confidentialité : les noms sont chiffrés côté navigateur */}
      <div className="flex items-center gap-2 mb-4 text-xs text-text-muted">
        <Lock className="h-3.5 w-3.5 text-emerald-600" />
        Noms de clients chiffrés sur cet appareil — la base ne stocke que des données illisibles sans ta phrase de passe.
      </div>

      {/* Bandeau migration : anciennes captures encore en clair */}
      {legacyRows.length > 0 && (
        <Card className="mb-5 p-4 border border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-amber-900">{legacyRows.length} ancienne{legacyRows.length > 1 ? 's' : ''} capture{legacyRows.length > 1 ? 's' : ''} avec nom en clair</div>
                <div className="text-xs text-amber-800">Sécurise-les : leurs noms seront chiffrés et retirés de la base, comme les nouvelles.</div>
              </div>
            </div>
            <Button variant="primary" loading={migrating} onClick={handleMigrate}>Sécuriser maintenant</Button>
          </div>
        </Card>
      )}

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
        fPbr={fPbr} setFPbr={setFPbr}
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
            <Card key={c.key} hover onClick={() => setSelectedKey(c.key)} className="cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-brand-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-text-main flex items-center gap-1.5 flex-wrap">
                      {c.name}
                      {c.legacy && <span title="Nom encore en clair — à sécuriser"><ShieldAlert className="h-3.5 w-3.5 text-amber-500" /></span>}
                      {c.hasModel && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#58CC02]/10 text-[#45a300]">Portefeuille modèle</span>}
                    </div>
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
  fPbr: string; setFPbr: (v: string) => void;
  fCurrent: string; setFCurrent: (v: string) => void;
  fTarget: string; setFTarget: (v: string) => void;
  fConviction: number | null; setFConviction: (v: number | null) => void;
  saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  const { fClient, setFClient, fAccount, setFAccount, fSymbol, setFSymbol, fName, setFName, fPbr, setFPbr, fCurrent, setFCurrent, fTarget, setFTarget, fConviction, setFConviction, saving, onSave, onCancel } = props;
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
          PBR / Prix payé
          <input type="number" step="0.01" value={fPbr} onChange={e => setFPbr(e.target.value)} className={inputCls} placeholder="0.00" />
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

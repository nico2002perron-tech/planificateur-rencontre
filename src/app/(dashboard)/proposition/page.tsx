'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useQuotes, useSymbolSearch } from '@/lib/hooks/useQuotes';
import { usePriceTargetConsensus } from '@/lib/hooks/usePriceTargets';
import { useUsdCadRate } from '@/lib/hooks/useUsdCadRate';
import { useVault } from '@/components/security/VaultProvider';
import { VaultGate } from '@/components/security/VaultGate';
import {
  Briefcase, User, DollarSign, TrendingUp, TrendingDown, BookmarkPlus,
  Sparkles, MapPin, Search, X, Scale, Trash2, History, ArrowRight, PiggyBank,
  CheckCircle2, RotateCcw, AlertTriangle,
} from 'lucide-react';

// ── Formatage ───────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
const fmtDec = (n: number) => n.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)} %`);

function parseMoney(value: string): number {
  const cleaned = value.replace(/ /g, ' ').replace(/\s/g, '').replace(/[$]/g, '').replace(/[^0-9,.]/g, '');
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let t = cleaned;
  if (lastComma >= 0 && lastDot >= 0) {
    t = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else if (lastComma >= 0) {
    t = ((cleaned.match(/,/g) || []).length > 1 || /,\d{3}$/.test(cleaned)) ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    t = cleaned.replace(/\./g, '');
  }
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

type Position = { symbol: string; name: string; weight: number; currency: 'CAD' | 'USD' };
type ClientContext = 'new' | 'elsewhere';

// Bourses canadiennes (résultats de /api/fmp/search) — tout le reste = USD.
const CA_EXCHANGES = new Set(['TSX', 'TSXV', 'CSE', 'NEO']);
function detectCurrency(symbol: string, exchangeShortName?: string): 'CAD' | 'USD' {
  if (exchangeShortName && CA_EXCHANGES.has(exchangeShortName.toUpperCase())) return 'CAD';
  if (/\.(TO|V|CN|NE)$/i.test(symbol)) return 'CAD';
  return 'USD';
}

// Brouillon local (survit à la navigation). JAMAIS le nom du client : la
// posture du coffre = aucun nom en clair au repos, il se retape.
const DRAFT_KEY = 'proposition-draft-v1';

// ── Recherche de titre en ligne ──────────────────────────────────────────────
function InlineSymbolSearch({ onSelect }: { onSelect: (symbol: string, name: string, exchangeShortName?: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, isLoading } = useSymbolSearch(query);
  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 hover:border-brand-primary transition">
        <Search className="h-4 w-4 text-text-muted flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          placeholder="Cherche un titre à ajouter (ex. AAPL, RY.TO, Enbridge)…"
          className="flex-1 bg-transparent text-sm font-semibold text-text-main placeholder:text-text-muted/60 focus:outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="text-text-muted hover:text-text-main">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && query.length >= 1 && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white rounded-2xl shadow-xl border-2 border-gray-100 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : results.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Aucun résultat</p>
          ) : (
            results.map((r: { symbol: string; name: string; exchangeShortName: string }) => (
              <button key={r.symbol}
                className="w-full text-left px-4 py-3 hover:bg-brand-primary/5 transition flex items-center justify-between"
                onClick={() => { onSelect(r.symbol, r.name, r.exchangeShortName); setQuery(''); setOpen(false); }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="px-2 py-0.5 rounded-lg bg-brand-primary/10 text-brand-primary font-extrabold text-xs flex-shrink-0">{r.symbol}</span>
                  <span className="text-sm font-semibold text-text-main truncate">{r.name}</span>
                </div>
                <span className="text-[10px] font-bold text-text-muted bg-gray-100 px-2 py-0.5 rounded-lg flex-shrink-0 ml-2">{r.exchangeShortName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PropositionPage() {
  const { toast } = useToast();
  const vault = useVault();

  const [context, setContext] = useState<ClientContext>('new');
  const [clientName, setClientName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [positions, setPositions] = useState<Position[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  // Non-null = la proposition courante est enregistrée au Journal (état « ✓ »).
  // Toute modification du formulaire le remet à null (voir l'effet plus bas).
  const [savedAt, setSavedAt] = useState<{ when: string; count: number } | null>(null);

  // ── Brouillon local : restaure au montage, sauvegarde (débouncé) ensuite ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { context?: ClientContext; amountStr?: string; positions?: Position[] };
      if (draft.context === 'new' || draft.context === 'elsewhere') setContext(draft.context);
      if (typeof draft.amountStr === 'string') setAmountStr(draft.amountStr);
      if (Array.isArray(draft.positions)) {
        setPositions(
          draft.positions
            .filter((p) => p && typeof p.symbol === 'string' && p.symbol)
            .map((p) => ({
              symbol: p.symbol,
              name: typeof p.name === 'string' ? p.name : p.symbol,
              weight: Number.isFinite(p.weight) ? p.weight : 0,
              // Brouillons d'anciennes versions sans devise : re-détecter.
              currency: p.currency === 'USD' || p.currency === 'CAD' ? p.currency : detectCurrency(p.symbol),
            }))
        );
      }
    } catch { /* brouillon corrompu → on repart à neuf */ }
    // Au montage seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (positions.length === 0 && !amountStr.trim()) localStorage.removeItem(DRAFT_KEY);
        else localStorage.setItem(DRAFT_KEY, JSON.stringify({ context, amountStr, positions }));
      } catch { /* stockage plein/indisponible : tant pis, best-effort */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [context, amountStr, positions]);

  // Toute modification invalide l'état « Enregistré ✓ » (le formulaire ne
  // correspond plus à ce qui est au Journal).
  useEffect(() => { setSavedAt(null); }, [context, clientName, amountStr, positions]);

  const amount = useMemo(() => parseMoney(amountStr), [amountStr]);
  const symbols = useMemo(() => positions.map((p) => p.symbol), [positions]);
  const { quotesMap, isLoading: quotesLoading } = useQuotes(symbols);
  const { targets, isLoading: targetsLoading } = usePriceTargetConsensus(symbols);
  const { rate: usdCadRate } = useUsdCadRate();
  const enriching = positions.length > 0 && (quotesLoading || targetsLoading);
  // Des titres US sans taux de change chargé : on ne peut ni afficher ni
  // enregistrer leurs montants honnêtement (jamais de USD compté 1:1 en CAD).
  const usdRateMissing = positions.some((p) => p.currency === 'USD') && !usdCadRate;

  // Ajout : si les poids actuels sont tous égaux (non personnalisés), on répartit
  // également ; sinon on ajoute à 0 pour ne pas écraser des poids ajustés à la main.
  const addPosition = useCallback((symbol: string, name: string, exchangeShortName?: string) => {
    setPositions((prev) => {
      if (prev.some((p) => p.symbol === symbol)) return prev;
      const wasEqual = prev.length === 0 || prev.every((p) => Math.abs(p.weight - prev[0].weight) < 0.01);
      const added: Position = { symbol, name, weight: 0, currency: detectCurrency(symbol, exchangeShortName) };
      const next = [...prev, added];
      if (wasEqual) {
        const eq = Math.round((100 / next.length) * 10) / 10;
        return next.map((p) => ({ ...p, weight: eq }));
      }
      return next;
    });
  }, []);

  const removePosition = useCallback((symbol: string) => {
    setPositions((prev) => prev.filter((p) => p.symbol !== symbol));
  }, []);

  const setWeight = useCallback((symbol: string, value: number) => {
    setPositions((prev) => prev.map((p) => (p.symbol === symbol ? { ...p, weight: Number.isFinite(value) ? Math.max(0, value) : 0 } : p)));
  }, []);

  const equalize = useCallback(() => {
    setPositions((prev) => {
      if (prev.length === 0) return prev;
      const eq = Math.round((100 / prev.length) * 10) / 10;
      return prev.map((p) => ({ ...p, weight: eq }));
    });
  }, []);

  const rows = useMemo(() => {
    return positions.map((p) => {
      const rawPrice = quotesMap.get(p.symbol)?.price || 0;
      const t = targets[p.symbol];
      const rawTarget = t?.targetConsensus || 0;
      // Tout le tableau vit en CAD. Titre US sans taux chargé → prix/cible à 0
      // (affiché « — », exclu de l'enregistrement) plutôt qu'un USD compté 1:1.
      const fx = p.currency === 'USD' ? (usdCadRate ?? 0) : 1;
      const price = rawPrice * fx;
      const target = rawTarget * fx;
      const alloc = (p.weight / 100) * amount;
      const qty = price > 0 ? alloc / price : 0;
      const gainPct = price > 0 && target > 0 ? ((target - price) / price) * 100 : null;
      return { ...p, price, target, alloc, qty, gainPct, source: t?.source as string | undefined };
    });
  }, [positions, quotesMap, targets, amount, usdCadRate]);

  const stats = useMemo(() => {
    const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
    const invested = rows.reduce((s, r) => s + r.alloc, 0);
    const cash = Math.max(0, amount - invested);
    let projected = cash;
    for (const r of rows) projected += r.gainPct != null ? r.alloc * (1 + r.gainPct / 100) : r.alloc;
    const gainPct = amount > 0 ? ((projected - amount) / amount) * 100 : 0;
    const uncovered = rows.filter((r) => r.gainPct == null && r.weight > 0).length;
    return { totalWeight, invested, cash, projected, gainPct, uncovered };
  }, [rows, amount]);

  const snapshotRows = useMemo(
    () => rows.flatMap((r) =>
      r.price > 0 && r.target > 0 && r.weight > 0
        ? [{ symbol: r.symbol, name: r.name, assetType: 'EQUITY', quantity: r.qty, currentPrice: r.price, targetPrice: r.target, gainPct: r.gainPct ?? 0, targetSource: r.source || 'consensus', accountType: '', accountLabel: '' }]
        : []
    ),
    [rows]
  );

  const overAllocated = stats.totalWeight > 100.5;
  const canSave = clientName.trim().length > 0 && amount > 0 && snapshotRows.length > 0 && !overAllocated;

  const handleSave = useCallback(async () => {
    const name = clientName.trim();
    if (!name || snapshotRows.length === 0 || vault.status !== 'unlocked') return;
    setSaving(true);
    try {
      const [nameEnc, nameIdx] = await Promise.all([vault.encrypt(name), vault.index(name)]);
      const res = await fetch('/api/price-target-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_kind: 'manual', entry_type: 'model_portfolio', nameEnc, nameIdx, horizonMonths: 12, rows: snapshotRows }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Erreur d’enregistrement');
      }
      const data = await res.json();
      toast('success', `Portefeuille enregistré au Journal (${data.inserted} titres) — ${name}`);
      setShowSave(false);
      // État « ✓ » persistant (le toast est éphémère). L'effet « modification →
      // savedAt=null » ne le touche pas : l'enregistrement ne change aucune dep.
      setSavedAt({
        when: new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }),
        count: data.inserted,
      });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* best-effort */ }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  }, [clientName, snapshotRows, vault, toast]);

  const resetAll = useCallback(() => {
    setPositions([]);
    setAmountStr('');
    setClientName('');
    setContext('new');
    setShowSave(false);
    setSavedAt(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* best-effort */ }
  }, []);

  const amountLabel = context === 'new' ? 'Montant à investir' : 'Valeur du portefeuille à transférer';
  const weightColor = Math.abs(stats.totalWeight - 100) < 0.5 ? 'text-[#45a300]' : overAllocated ? 'text-[#FF4B4B]' : 'text-amber-600';

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <Briefcase className="h-6 w-6 text-brand-primary" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-text-main">Proposition de portefeuille</h1>
          <p className="text-sm text-text-muted">Bâtis un portefeuille sur mesure pour un client, vois le gain projeté, et enregistre-le au Journal des cibles.</p>
        </div>
      </div>

      {/* 1. Le client */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="h-6 w-6 rounded-lg bg-brand-primary text-white text-xs font-extrabold flex items-center justify-center">1</span>
          <h2 className="font-extrabold text-text-main">Le client</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {([
            { v: 'new' as const, icon: Sparkles, label: 'Nouvel investisseur', hint: 'Premier placement' },
            { v: 'elsewhere' as const, icon: MapPin, label: 'Client venant d’ailleurs', hint: 'Transfert d’une autre institution' },
          ]).map((opt) => {
            const Icon = opt.icon; const active = context === opt.v;
            return (
              <button key={opt.v} type="button" onClick={() => setContext(opt.v)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${active ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-500'}`}><Icon className="h-4 w-4" /></div>
                <div><div className={`text-sm font-bold ${active ? 'text-brand-primary' : 'text-text-main'}`}>{opt.label}</div><div className="text-[11px] text-text-muted">{opt.hint}</div></div>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted mb-1"><User className="h-3.5 w-3.5" /> Nom du client (prénom et nom)</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex. Jean Tremblay"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-text-main outline-none focus:border-brand-primary" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted mb-1"><DollarSign className="h-3.5 w-3.5" /> {amountLabel}</label>
            <input value={amountStr} onChange={(e) => setAmountStr(e.target.value)} inputMode="decimal" placeholder="Ex. 250 000"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-text-main outline-none focus:border-brand-primary" />
          </div>
        </div>
      </div>

      {/* 2. Bâtir le portefeuille */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-brand-primary text-white text-xs font-extrabold flex items-center justify-center">2</span>
            <h2 className="font-extrabold text-text-main">Bâtir le portefeuille</h2>
          </div>
          {positions.length > 1 && (
            <button type="button" onClick={equalize}
              className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline">
              <Scale className="h-3.5 w-3.5" /> Répartir également
            </button>
          )}
        </div>

        <InlineSymbolSearch onSelect={addPosition} />

        {usdRateMissing && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              Taux USD/CAD indisponible pour l’instant — les titres américains affichent « — » et
              seront exclus de l’enregistrement tant que le taux n’est pas chargé.
            </p>
          </div>
        )}

        {positions.length === 0 ? (
          <p className="text-center text-sm text-text-muted py-6">Ajoute des titres pour bâtir le portefeuille. Le prix, le cours cible et le gain se calculent tout seuls.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-100 mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-gray-100 font-bold bg-gray-50/60">
                    <th className="px-3 py-2.5">Titre</th>
                    <th className="px-3 py-2.5 text-right">Prix</th>
                    <th className="px-3 py-2.5 text-right">Cible 12m</th>
                    <th className="px-3 py-2.5 text-right">Gain</th>
                    <th className="px-3 py-2.5 text-center">Poids</th>
                    <th className="px-3 py-2.5 text-right">Montant</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.symbol} className="border-t border-gray-50">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-text-main text-xs">{r.symbol}</span>
                          {r.currency === 'USD' && (
                            <span
                              className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-blue-50 text-blue-600"
                              title={usdCadRate ? `Converti en CAD au taux ${usdCadRate.toFixed(4)}` : 'Taux USD/CAD en chargement'}
                            >
                              US$→CA$
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-text-muted truncate max-w-[160px]">{r.name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">{r.price > 0 ? `$${fmtDec(r.price)}` : <span className="text-text-muted">…</span>}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">{r.target > 0 ? `$${fmtDec(r.target)}` : '—'}</td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs font-extrabold ${r.gainPct == null ? 'text-text-muted' : r.gainPct >= 0 ? 'text-[#45a300]' : 'text-[#FF4B4B]'}`}>{fmtPct(r.gainPct)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <input type="number" min={0} max={100} step={0.5} value={r.weight === 0 ? '' : r.weight}
                            onChange={(e) => setWeight(r.symbol, parseFloat(e.target.value))}
                            placeholder="0"
                            className="w-14 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right font-bold text-text-main outline-none focus:border-brand-primary" />
                          <span className="text-[10px] text-text-muted">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtMoney(r.alloc)}</td>
                      <td className="px-2 py-2.5 text-right">
                        <button onClick={() => removePosition(r.symbol)} className="text-text-muted hover:text-[#FF4B4B] transition" title="Retirer"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barre de poids total + liquidités */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 px-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted">Total pondération :</span>
                <span className={`font-extrabold ${weightColor}`}>{stats.totalWeight.toFixed(1)} %</span>
                {overAllocated && <span className="text-[#FF4B4B] font-semibold">(dépasse 100 %)</span>}
              </div>
              {stats.cash > 0 && amount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <PiggyBank className="h-3.5 w-3.5" /> Liquidités : <span className="font-bold text-text-main">{fmtMoney(stats.cash)}</span> ({(100 - stats.totalWeight).toFixed(0)} %)
                </div>
              )}
              {enriching && <Spinner size="sm" />}
            </div>
          </>
        )}
      </div>

      {/* 3. Gain projeté + enregistrement */}
      {positions.length > 0 && amount > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <div className="text-[10px] font-semibold uppercase text-text-muted">Investi</div>
              <div className="mt-1 text-lg font-extrabold text-text-main">{fmtMoney(stats.invested)}</div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <div className="text-[10px] font-semibold uppercase text-text-muted">Valeur projetée 12 m</div>
              <div className="mt-1 text-lg font-extrabold text-text-main">{fmtMoney(stats.projected)}</div>
            </div>
            <div className={`rounded-xl border p-3 ${stats.gainPct >= 0 ? 'bg-[#58CC02]/5 border-[#58CC02]/20' : 'bg-[#FF4B4B]/5 border-[#FF4B4B]/20'}`}>
              <div className="text-[10px] font-semibold uppercase text-text-muted">Gain projeté (consensus)</div>
              <div className={`mt-1 text-lg font-extrabold flex items-center gap-1 ${stats.gainPct >= 0 ? 'text-[#45a300]' : 'text-[#FF4B4B]'}`}>
                {stats.gainPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{fmtPct(stats.gainPct)}
              </div>
            </div>
          </div>

          {stats.uncovered > 0 && (
            <p className="text-[11px] text-text-muted">{stats.uncovered} titre{stats.uncovered > 1 ? 's' : ''} sans cours cible ne ser{stats.uncovered > 1 ? 'ont' : 'a'} pas enregistré{stats.uncovered > 1 ? 's' : ''} au Journal.</p>
          )}

          {savedAt ? (
            /* État « fait » persistant : le seul endroit qui offre le lien vers le
               Journal (jamais AVANT l'enregistrement — perte de brouillon garantie). */
            <div className="rounded-xl bg-[#58CC02]/[0.08] border border-[#58CC02]/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-[#58CC02]/15 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-[#45a300]" /></div>
                  <div>
                    <h3 className="font-extrabold text-text-main text-sm">Enregistré au Journal ✓</h3>
                    <p className="text-xs text-text-muted">
                      {savedAt.count} titres pour <strong className="text-text-main">{clientName.trim()}</strong> à {savedAt.when} — badge « Portefeuille modèle »
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/journal" className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm font-extrabold text-white bg-brand-primary hover:brightness-105 transition">
                    Ouvrir le Journal <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button type="button" onClick={resetAll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-text-muted border border-gray-200 hover:text-text-main hover:border-gray-300 transition">
                    <RotateCcw className="h-3.5 w-3.5" /> Nouvelle proposition
                  </button>
                </div>
              </div>
            </div>
          ) : (
          <div className="rounded-xl bg-[#58CC02]/[0.04] border border-[#58CC02]/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-[#58CC02]/10 flex items-center justify-center"><BookmarkPlus className="h-5 w-5 text-[#58CC02]" /></div>
                <div>
                  <h3 className="font-extrabold text-text-main text-sm">Enregistrer au Journal des cibles</h3>
                  <p className="text-xs text-text-muted">{snapshotRows.length} titres · gain projeté <span className="font-bold text-[#45a300]">{fmtPct(stats.gainPct)}</span> · sous « Portefeuille modèle »</p>
                </div>
              </div>
              <button type="button" disabled={!canSave} onClick={() => setShowSave((v) => !v)}
                className="px-4 py-2 rounded-xl text-sm font-extrabold text-white bg-[#58CC02] hover:brightness-105 transition flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
                {showSave ? 'Fermer' : 'Enregistrer'}
              </button>
            </div>
            {!canSave && (
              <p className="mt-2 text-[11px] text-amber-700">
                {overAllocated ? 'La pondération dépasse 100 % — ajuste les poids.'
                  : !clientName.trim() ? 'Entre le nom du client (étape 1) pour enregistrer.'
                  : snapshotRows.length === 0 ? 'Ajoute au moins un titre avec un cours cible et un poids.'
                  : 'Entre le montant à investir (étape 1).'}
              </p>
            )}
            {showSave && canSave && (
              <div className="mt-4 border-t border-[#58CC02]/15 pt-4">
                <VaultGate>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <p className="text-sm text-text-main flex-1">Enregistrer <strong>{snapshotRows.length} prédictions</strong> pour <strong>{clientName.trim()}</strong> (nom chiffré dans le coffre) ?</p>
                    <Button onClick={handleSave} loading={saving} disabled={saving}>Confirmer l’enregistrement</Button>
                  </div>
                  <p className="mt-2 text-[11px] text-text-muted flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    Retrouvable ensuite dans le Journal avec le badge « Portefeuille modèle ». Ré-enregistrer le même jour remplace la proposition du jour (pas de doublons).
                  </p>
                </VaultGate>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

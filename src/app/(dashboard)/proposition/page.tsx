'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useQuotes } from '@/lib/hooks/useQuotes';
import { usePriceTargetConsensus } from '@/lib/hooks/usePriceTargets';
import { useUsdCadRate } from '@/lib/hooks/useUsdCadRate';
import { useClients } from '@/lib/hooks/useClients';
import { useVault } from '@/components/security/VaultProvider';
import { VaultGate } from '@/components/security/VaultGate';
import { SymbolSearchInline } from '@/components/models/SymbolSearchInline';
import { StockAvatar } from '@/components/models/simulation/StockAvatar';
import { parseMoneyLoose } from '@/lib/money/parse-loose';
import {
  Briefcase, User, DollarSign, TrendingUp, TrendingDown, BookmarkPlus,
  Sparkles, MapPin, Scale, Trash2, History, ArrowRight, PiggyBank,
  CheckCircle2, RotateCcw, AlertTriangle, Search, Download,
} from 'lucide-react';

// ── Formatage — fr-CA partout (virgule décimale, $ suffixe, % insécable) ──
const fmtMoney = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
const fmtCad = (n: number) =>
  `${n.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

// Couleurs d'identité des étapes (langage « candy » des pages Modèles) + verts
// établis de l'app (PretAColler DUO.green/greenDark).
const STEP = {
  un: '#1CB0F6',
  deux: '#CE82FF',
  trois: '#58CC02',
} as const;
const GREEN = '#58CC02';
const GREEN_DARK = '#45a300';

// Montant saisi à la main → nombre positif (0 si vide/invalide).
function parseMoney(value: string): number {
  const n = parseMoneyLoose(value);
  return n != null && n > 0 ? n : 0;
}

// Poids saisi à la main : virgule française acceptée (« 12,5 » → 12.5).
// PAS de plafond ici : un « 150 » doit gonfler le total et déclencher
// « dépasse 100 % » (le plafonner cacherait l'erreur de saisie).
function parseWeight(value: string): number {
  const n = Number.parseFloat(value.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
// Nombre → chaîne de poids affichée (virgule, sans zéro inutile : 6.3 → « 6,3 », 25 → « 25 »).
function fmtWeightStr(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}
// Répartition égale qui somme EXACTEMENT 100,0 : base au dixième, résidu
// distribué aux premiers titres (16 titres → 6,3 × 12 + 6,2 × 4 = 100,0).
function equalWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(1000 / count);
  const extra = 1000 - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / 10);
}

type Position = { symbol: string; name: string; weightStr: string; currency: 'CAD' | 'USD' };
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

export default function PropositionPage() {
  const { toast } = useToast();
  const vault = useVault();
  const { clients } = useClients();

  const [context, setContext] = useState<ClientContext>('new');
  const [clientName, setClientName] = useState('');
  const [clientFocus, setClientFocus] = useState(false);
  // Fermeture des suggestions au clic extérieur (même patron que la recherche
  // de titres) — un onBlur différé perdrait le clic sur une suggestion.
  const clientBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (clientBoxRef.current && !clientBoxRef.current.contains(e.target as Node)) setClientFocus(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);
  const [amountStr, setAmountStr] = useState('');
  const [positions, setPositions] = useState<Position[]>([]);
  // Vrai dès qu'un poids a été ajusté à la main : l'ajout d'un titre cesse
  // alors de ré-égaliser (les poids voulus ne sont jamais écrasés).
  const [customWeights, setCustomWeights] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  // Non-null = la proposition courante est enregistrée au Journal (état « ✓ »).
  const [savedAt, setSavedAt] = useState<{ when: string; count: number } | null>(null);

  // ── Brouillon local : restaure au montage, sauvegarde (débouncé) ensuite ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        context?: ClientContext; amountStr?: string; customWeights?: boolean;
        positions?: Array<Position & { weight?: number }>;
      };
      if (draft.context === 'new' || draft.context === 'elsewhere') setContext(draft.context);
      if (typeof draft.amountStr === 'string') setAmountStr(draft.amountStr);
      if (Array.isArray(draft.positions)) {
        const restored = draft.positions
          .filter((p) => p && typeof p.symbol === 'string' && p.symbol)
          .map((p) => ({
            symbol: p.symbol,
            name: typeof p.name === 'string' ? p.name : p.symbol,
            // Brouillons d'anciennes versions : weight numérique → chaîne.
            weightStr: typeof p.weightStr === 'string'
              ? p.weightStr
              : Number.isFinite(p.weight) && (p.weight as number) > 0 ? fmtWeightStr(p.weight as number) : '',
            currency: p.currency === 'USD' || p.currency === 'CAD' ? p.currency : detectCurrency(p.symbol),
          }));
        setPositions(restored);
        if (typeof draft.customWeights === 'boolean') {
          setCustomWeights(draft.customWeights);
        } else if (restored.length > 1) {
          // Vieux brouillon sans le drapeau : des poids inégaux = ajustés à la
          // main → à protéger (sinon le premier ajout les écraserait).
          const ws = restored.map((p) => parseWeight(p.weightStr));
          setCustomWeights(ws.some((w) => Math.abs(w - ws[0]) > 0.01));
        }
      } else if (typeof draft.customWeights === 'boolean') {
        setCustomWeights(draft.customWeights);
      }
    } catch { /* brouillon corrompu → on repart à neuf */ }
    // Au montage seulement.
     
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (positions.length === 0 && !amountStr.trim()) localStorage.removeItem(DRAFT_KEY);
        else localStorage.setItem(DRAFT_KEY, JSON.stringify({ context, amountStr, positions, customWeights }));
      } catch { /* stockage plein/indisponible : best-effort */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [context, amountStr, positions, customWeights]);

  // Toute modification invalide l'état « Enregistré ✓ ».
  useEffect(() => { setSavedAt(null); }, [context, clientName, amountStr, positions]);

  const amount = useMemo(() => parseMoney(amountStr), [amountStr]);
  const symbols = useMemo(() => positions.map((p) => p.symbol), [positions]);
  const { quotesMap, isLoading: quotesLoading, error: quotesError } = useQuotes(symbols);
  const { targets, isLoading: targetsLoading, error: targetsError } = usePriceTargetConsensus(symbols);
  const { rate: usdCadRate, isLoading: rateLoading } = useUsdCadRate();
  const enriching = positions.length > 0 && (quotesLoading || targetsLoading || (rateLoading && positions.some((p) => p.currency === 'USD')));
  const dataError = positions.length > 0 && Boolean(quotesError || targetsError);
  // Bannière seulement quand le taux a VRAIMENT échoué (pas pendant son chargement).
  const usdRateMissing = positions.some((p) => p.currency === 'USD') && !usdCadRate && !rateLoading;

  // ── Suggestions de clients (module Clients) — texte libre toujours permis ──
  const clientSuggestions = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (q.length < 2) return [];
    return clients
      .map((c) => `${c.first_name} ${c.last_name}`.trim())
      .filter((full) => full && full.toLowerCase().includes(q) && full.toLowerCase() !== q)
      .slice(0, 6);
  }, [clients, clientName]);

  const addPosition = useCallback((symbol: string, name: string, exchangeShortName?: string) => {
    if (positions.some((p) => p.symbol === symbol)) {
      toast('info', `${symbol} est déjà dans le portefeuille`);
      return;
    }
    setPositions((prev) => {
      if (prev.some((p) => p.symbol === symbol)) return prev;
      const added: Position = { symbol, name, weightStr: '', currency: detectCurrency(symbol, exchangeShortName) };
      const next = [...prev, added];
      if (!customWeights) {
        const weights = equalWeights(next.length);
        return next.map((p, i) => ({ ...p, weightStr: fmtWeightStr(weights[i]) }));
      }
      return next;
    });
  }, [customWeights, positions, toast]);

  const removePosition = useCallback((symbol: string) => {
    const next = positions.filter((p) => p.symbol !== symbol);
    // Tableau vidé = plus de « poids voulus » à protéger : le prochain ajout
    // repart en répartition égale.
    if (next.length === 0) setCustomWeights(false);
    if (!customWeights && next.length > 0) {
      const weights = equalWeights(next.length);
      setPositions(next.map((p, i) => ({ ...p, weightStr: fmtWeightStr(weights[i]) })));
    } else {
      setPositions(next);
    }
  }, [customWeights, positions]);

  const setWeightStr = useCallback((symbol: string, value: string) => {
    setCustomWeights(true);
    setPositions((prev) => prev.map((p) => (p.symbol === symbol ? { ...p, weightStr: value } : p)));
  }, []);

  const equalize = useCallback(() => {
    setCustomWeights(false);
    setPositions((prev) => {
      if (prev.length === 0) return prev;
      const weights = equalWeights(prev.length);
      return prev.map((p, i) => ({ ...p, weightStr: fmtWeightStr(weights[i]) }));
    });
  }, []);

  const rows = useMemo(() => {
    return positions.map((p) => {
      const weight = parseWeight(p.weightStr);
      const rawPrice = quotesMap.get(p.symbol)?.price || 0;
      const t = targets[p.symbol];
      const rawTarget = t?.targetConsensus || 0;
      // Tout le tableau vit en CAD. Titre US sans taux chargé → prix/cible à 0
      // (affiché « — », exclu de l'enregistrement) plutôt qu'un USD compté 1:1.
      const fx = p.currency === 'USD' ? (usdCadRate ?? 0) : 1;
      const price = rawPrice * fx;
      const target = rawTarget * fx;
      // Cibles basse/haute des analystes (pour l'éventail Prudent/Optimiste du PDF).
      const targetLow = (t?.targetLow || 0) * fx;
      const targetHigh = (t?.targetHigh || 0) * fx;
      const alloc = (weight / 100) * amount;
      const qty = price > 0 ? alloc / price : 0;
      const gainPct = price > 0 && target > 0 ? ((target - price) / price) * 100 : null;
      return { ...p, weight, price, target, targetLow, targetHigh, alloc, qty, gainPct, source: t?.source as string | undefined };
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
    const zeroWeight = rows.filter((r) => r.weight === 0).length;
    return { totalWeight, invested, cash, projected, gainPct, uncovered, zeroWeight };
  }, [rows, amount]);

  const snapshotRows = useMemo(
    () => rows.flatMap((r) =>
      r.price > 0 && r.target > 0 && r.weight > 0
        ? [{
            symbol: r.symbol, name: r.name, assetType: 'EQUITY',
            quantity: r.qty, currentPrice: r.price, targetPrice: r.target,
            gainPct: r.gainPct ?? 0, targetSource: r.source || 'consensus',
            // Contexte persisté : le Journal affiche account_type en préfixe de
            // la ligne méta (« Proposition · cible 12 mois · date »).
            accountType: 'Proposition',
            accountLabel: context === 'new' ? 'Nouvel investisseur' : 'Transfert',
          }]
        : []
    ),
    [rows, context]
  );

  const overAllocated = stats.totalWeight > 100.5;
  const canSave = clientName.trim().length > 0 && amount > 0 && snapshotRows.length > 0 && !overAllocated;

  // Le panneau de confirmation ne survit pas à une condition d'enregistrement
  // devenue fausse (sinon « Fermer » désactivé + réouverture surprise).
  useEffect(() => { if (!canSave) setShowSave(false); }, [canSave]);

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

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const canDownloadPdf = clientName.trim().length > 0 && amount > 0 && rows.length > 0;
  const handleDownloadPdf = useCallback(async () => {
    if (!clientName.trim() || amount <= 0 || rows.length === 0) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch('/api/proposition/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: clientName.trim(),
          context,
          amount,
          generatedAt: new Date().toISOString(),
          rows: rows.map((r) => ({
            symbol: r.symbol, name: r.name, currency: r.currency, weight: r.weight,
            price: r.price, target: r.target, targetLow: r.targetLow, targetHigh: r.targetHigh,
            alloc: r.alloc, gainPct: r.gainPct, source: r.source,
            pe: quotesMap.get(r.symbol)?.pe_ratio,
          })),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Erreur lors de la génération du PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Proposition-${clientName.trim().replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Échec de la génération du PDF');
    } finally {
      setDownloadingPdf(false);
    }
  }, [clientName, context, amount, rows, quotesMap, toast]);

  const resetAll = useCallback(() => {
    setPositions([]);
    setAmountStr('');
    setClientName('');
    setContext('new');
    setCustomWeights(false);
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
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-text-main">Proposition de portefeuille</h1>
          <p className="mt-1 text-sm text-text-muted">Bâtis un portefeuille sur mesure pour un client, vois le gain projeté, et enregistre-le au Journal des cibles.</p>
        </div>
      </div>

      {/* 1. Le client */}
      <div className="rounded-3xl border-[3px] bg-white p-5" style={{ borderColor: `${STEP.un}30`, boxShadow: `0 3px 0 0 ${STEP.un}20` }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="h-6 w-6 rounded-lg text-white text-xs font-extrabold flex items-center justify-center" style={{ backgroundColor: STEP.un }}>1</span>
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
          <div className="relative" ref={clientBoxRef}>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted mb-1"><User className="h-3.5 w-3.5" /> Nom du client (prénom et nom)</label>
            <input
              value={clientName}
              onChange={(e) => { setClientName(e.target.value); setClientFocus(true); }}
              onFocus={() => setClientFocus(true)}
              placeholder="Ex. Jean Tremblay"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-text-main outline-none focus:border-brand-primary"
            />
            {clientFocus && clientSuggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                {clientSuggestions.map((full) => (
                  <button key={full} type="button"
                    onClick={() => { setClientName(full); setClientFocus(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-text-main hover:bg-brand-primary/5 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-text-muted" /> {full}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted mb-1"><DollarSign className="h-3.5 w-3.5" /> {amountLabel}</label>
            <input value={amountStr} onChange={(e) => setAmountStr(e.target.value)} inputMode="decimal" placeholder="Ex. 250 000"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-text-main outline-none focus:border-brand-primary" />
          </div>
        </div>
      </div>

      {/* 2. Bâtir le portefeuille */}
      <div className="rounded-3xl border-[3px] bg-white p-5" style={{ borderColor: `${STEP.deux}30`, boxShadow: `0 3px 0 0 ${STEP.deux}20` }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg text-white text-xs font-extrabold flex items-center justify-center" style={{ backgroundColor: STEP.deux }}>2</span>
            <h2 className="font-extrabold text-text-main">Bâtir le portefeuille</h2>
          </div>
          {positions.length >= 1 && (
            <button type="button" onClick={equalize}
              className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline">
              <Scale className="h-3.5 w-3.5" /> Répartir également
            </button>
          )}
        </div>

        <SymbolSearchInline onSelect={addPosition} placeholder="Cherche un titre à ajouter (ex. AAPL, RY.TO, Enbridge)…" />

        {dataError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              Données de marché indisponibles pour l’instant — les prix et cours cibles réessaient automatiquement dans une minute.
            </p>
          </div>
        )}
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
          <div className="text-center py-8">
            <Search className="h-8 w-8 text-text-muted/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-text-main">Bâtis le portefeuille titre par titre</p>
            <p className="text-xs text-text-muted mt-1">Ajoute des titres avec la recherche — le prix, le cours cible et le gain se calculent tout seuls.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-100 mt-4">
              <table className="w-full text-sm min-w-[640px]">
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
                        <div className="flex items-center gap-2.5">
                          <StockAvatar symbol={r.symbol} size={28} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-text-main text-xs">{r.symbol}</span>
                              {r.currency === 'USD' && (
                                <span
                                  className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-blue-50 text-blue-600 whitespace-nowrap"
                                  title={usdCadRate ? `Converti en CAD au taux ${usdCadRate.toFixed(4)}` : 'Taux USD/CAD en chargement'}
                                >
                                  US$→CA$
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-text-muted truncate max-w-[150px]">{r.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                        {r.price > 0 ? fmtCad(r.price) : <span className="text-text-muted">{quotesLoading || (r.currency === 'USD' && rateLoading) ? '…' : '—'}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold whitespace-nowrap">
                        {r.target > 0 ? fmtCad(r.target) : <span className="text-text-muted font-normal">{targetsLoading || (r.currency === 'USD' && rateLoading) ? '…' : '—'}</span>}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs font-extrabold whitespace-nowrap ${r.gainPct == null ? 'text-text-muted' : r.gainPct >= 0 ? 'text-[#45a300]' : 'text-[#FF4B4B]'}`}>{fmtPct(r.gainPct)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.weightStr}
                            onChange={(e) => setWeightStr(r.symbol, e.target.value)}
                            placeholder="0"
                            className={`w-[4.5rem] px-2 py-2 rounded-lg border text-xs text-right font-bold outline-none focus:border-brand-primary ${
                              r.weight === 0 ? 'border-amber-300 bg-amber-50/50 text-amber-700' : 'border-gray-200 text-text-main'
                            }`}
                          />
                          <span className="text-[10px] text-text-muted">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">{fmtMoney(r.alloc)}</td>
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
                <span className={`font-extrabold ${weightColor}`}>{stats.totalWeight.toFixed(1).replace('.', ',')} %</span>
                {overAllocated && <span className="text-[#FF4B4B] font-semibold">(dépasse 100 %)</span>}
              </div>
              {/* Masquée quand le « reste » n'est qu'un artefact d'arrondi (< 0,25 %) */}
              {stats.cash > 0 && amount > 0 && (100 - stats.totalWeight) >= 0.25 && (
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <PiggyBank className="h-3.5 w-3.5" /> Liquidités : <span className="font-bold text-text-main">{fmtMoney(stats.cash)}</span> ({(100 - stats.totalWeight).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %)
                </div>
              )}
              {enriching && <Spinner size="sm" />}
            </div>
          </>
        )}
      </div>

      {/* 3. Gain projeté + enregistrement — visible dès qu'il y a des titres */}
      {positions.length > 0 && (
        <div className="rounded-3xl border-[3px] bg-white p-5 space-y-5" style={{ borderColor: `${STEP.trois}30`, boxShadow: `0 3px 0 0 ${STEP.trois}20` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg text-white text-xs font-extrabold flex items-center justify-center" style={{ backgroundColor: STEP.trois }}>3</span>
              <h2 className="font-extrabold text-text-main">Le résultat</h2>
            </div>
            <button type="button" onClick={handleDownloadPdf} disabled={!canDownloadPdf || downloadingPdf}
              title={canDownloadPdf ? 'Proposition client en PDF (3 pages)' : 'Nom du client, montant et au moins un titre requis'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: STEP.un, borderColor: `${STEP.un}40`, backgroundColor: `${STEP.un}0d` }}>
              {downloadingPdf ? <Spinner size="sm" /> : <Download className="h-3.5 w-3.5" />} Proposition PDF
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 flex flex-col justify-between min-h-[72px]">
              <div className="text-[10px] font-semibold uppercase text-text-muted leading-tight">Investi</div>
              <div className="text-lg font-extrabold text-text-main whitespace-nowrap">{amount > 0 ? fmtMoney(stats.invested) : '—'}</div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 flex flex-col justify-between min-h-[72px]">
              <div className="text-[10px] font-semibold uppercase text-text-muted leading-tight">Valeur projetée 12 m</div>
              <div className="text-lg font-extrabold text-text-main whitespace-nowrap">{amount > 0 ? fmtMoney(stats.projected) : '—'}</div>
            </div>
            <div className={`rounded-xl border p-3 flex flex-col justify-between min-h-[72px] ${stats.gainPct >= 0 ? 'bg-[#58CC02]/5 border-[#58CC02]/20' : 'bg-[#FF4B4B]/5 border-[#FF4B4B]/20'}`}>
              <div className="text-[10px] font-semibold uppercase text-text-muted leading-tight">Gain projeté (consensus)</div>
              <div>
                <div className={`text-lg font-extrabold flex items-center gap-1 whitespace-nowrap ${stats.gainPct >= 0 ? 'text-[#45a300]' : 'text-[#FF4B4B]'}`}>
                  {stats.gainPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{amount > 0 ? fmtPct(stats.gainPct) : '—'}
                </div>
                {(stats.cash > 0 || stats.uncovered > 0) && amount > 0 && (
                  <div className="text-[9px] text-text-muted mt-0.5">liquidités et titres sans cible comptés à 0 %</div>
                )}
              </div>
            </div>
          </div>

          {(stats.uncovered > 0 || stats.zeroWeight > 0) && (
            <div className="space-y-1">
              {stats.uncovered > 0 && (
                <p className="text-[11px] text-text-muted">{stats.uncovered} titre{stats.uncovered > 1 ? 's' : ''} sans cours cible ne ser{stats.uncovered > 1 ? 'ont' : 'a'} pas enregistré{stats.uncovered > 1 ? 's' : ''} au Journal.</p>
              )}
              {stats.zeroWeight > 0 && (
                <p className="text-[11px] text-amber-700">{stats.zeroWeight} titre{stats.zeroWeight > 1 ? 's' : ''} à 0 % ne ser{stats.zeroWeight > 1 ? 'ont' : 'a'} pas enregistré{stats.zeroWeight > 1 ? 's' : ''} — donne-leur un poids ou retire-les.</p>
              )}
            </div>
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
                  <Link href="/journal"
                    className="inline-flex items-center gap-1 px-4 py-2.5 rounded-2xl text-sm font-extrabold text-white transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
                    style={{ backgroundColor: '#1CB0F6', boxShadow: '0 4px 0 0 #0a8fd4' }}>
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
                  <p className="text-xs text-text-muted">
                    {enriching && snapshotRows.length === 0
                      ? 'Chargement des prix et cours cibles…'
                      : <>{snapshotRows.length} titres · gain projeté <span className="font-bold text-[#45a300]">{fmtPct(stats.gainPct)}</span> · sous « Portefeuille modèle »</>}
                  </p>
                </div>
              </div>
              <button type="button" disabled={!canSave} onClick={() => setShowSave((v) => !v)}
                className="px-5 py-2.5 rounded-2xl text-sm font-extrabold text-white transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                style={{ backgroundColor: GREEN, boxShadow: canSave ? `0 4px 0 0 ${GREEN_DARK}` : 'none' }}>
                {showSave ? 'Fermer' : 'Enregistrer'}
              </button>
            </div>
            {!canSave && (
              <p className="mt-2 text-[11px] text-amber-700">
                {overAllocated ? 'La pondération dépasse 100 % — ajuste les poids.'
                  : !clientName.trim() ? 'Entre le nom du client (étape 1) pour enregistrer.'
                  : amount <= 0 ? 'Entre le montant à investir (étape 1).'
                  : enriching ? 'Chargement des prix et cours cibles — un instant…'
                  : usdRateMissing ? 'Taux USD/CAD indisponible — les titres américains sont exclus pour l’instant.'
                  : 'Ajoute au moins un titre avec un cours cible et un poids.'}
              </p>
            )}
            {showSave && canSave && (
              <div className="mt-4 border-t border-[#58CC02]/15 pt-4">
                <VaultGate inline>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <p className="text-sm text-text-main flex-1">Enregistrer <strong>{snapshotRows.length} prédictions</strong> pour <strong>{clientName.trim()}</strong> (nom chiffré dans le coffre) ?</p>
                    <button type="button" onClick={handleSave} disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-extrabold text-white transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: GREEN, boxShadow: `0 4px 0 0 ${GREEN_DARK}` }}>
                      {saving && <Spinner size="sm" />}
                      {saving ? 'Enregistrement…' : 'Confirmer l’enregistrement'}
                    </button>
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

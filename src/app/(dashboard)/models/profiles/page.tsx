'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  useInvestmentProfiles,
  type InvestmentProfile,
  type SectorConfig,
} from '@/lib/hooks/useInvestmentProfiles';
import { SECTORS, INVESTMENT_PROFILES } from '@/lib/utils/constants';
import { StepNav } from '@/components/models/StepNav';
import {
  ArrowLeft, ArrowRight, Save, Plus, Check, ChevronLeft,
  Monitor, Heart, Landmark, Zap, Gem, Factory,
  ShoppingBag, Coffee, Lightbulb, Building2, Wifi, Shield,
  TrendingUp, Sparkles, AlertCircle, Settings2,
} from 'lucide-react';

// ── Sector visual config ──
const SECTOR_META: Record<string, {
  Icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string; ring: string;
}> = {
  TECHNOLOGY:       { Icon: Monitor,     color: 'text-blue-500',    bg: 'bg-blue-50',    ring: 'ring-blue-400' },
  HEALTHCARE:       { Icon: Heart,       color: 'text-rose-500',    bg: 'bg-rose-50',    ring: 'ring-rose-400' },
  FINANCIALS:       { Icon: Landmark,    color: 'text-emerald-500', bg: 'bg-emerald-50', ring: 'ring-emerald-400' },
  ENERGY:           { Icon: Zap,         color: 'text-orange-500',  bg: 'bg-orange-50',  ring: 'ring-orange-400' },
  MATERIALS:        { Icon: Gem,         color: 'text-slate-500',   bg: 'bg-slate-100',  ring: 'ring-slate-400' },
  INDUSTRIALS:      { Icon: Factory,     color: 'text-violet-500',  bg: 'bg-violet-50',  ring: 'ring-violet-400' },
  CONSUMER_DISC:    { Icon: ShoppingBag, color: 'text-pink-500',    bg: 'bg-pink-50',    ring: 'ring-pink-400' },
  CONSUMER_STAPLES: { Icon: Coffee,      color: 'text-amber-600',   bg: 'bg-amber-50',   ring: 'ring-amber-400' },
  UTILITIES:        { Icon: Lightbulb,   color: 'text-cyan-600',    bg: 'bg-cyan-50',    ring: 'ring-cyan-400' },
  REAL_ESTATE:      { Icon: Building2,   color: 'text-teal-500',    bg: 'bg-teal-50',    ring: 'ring-teal-400' },
  TELECOM:          { Icon: Wifi,        color: 'text-indigo-500',  bg: 'bg-indigo-50',  ring: 'ring-indigo-400' },
  MILITARY:         { Icon: Shield,      color: 'text-red-500',     bg: 'bg-red-50',     ring: 'ring-red-400' },
};

const PROFILE_ICONS = ['\u{1F6E1}\u{FE0F}', '\u{1F3DB}\u{FE0F}', '\u{2696}\u{FE0F}', '\u{1F4C8}', '\u{1F680}', '\u{1F48E}'];
const STEP_LABELS = ['Profil', 'Allocation', 'Secteurs', 'Ponderation', 'Obligations'];

// ── Seed helper ──
async function seedProfiles() {
  const res = await fetch('/api/models/profiles');
  const { profiles } = (await res.json()) as { profiles: InvestmentProfile[] };
  const existingSlugs = new Set(profiles.map((p) => p.slug));
  const toCreate = INVESTMENT_PROFILES.filter((p) => !existingSlugs.has(p.value));
  for (const p of toCreate) {
    await fetch('/api/models/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: p.label,
        equity_pct: p.equityPct,
        bond_pct: p.bondPct,
        nb_bonds: p.nbBonds,
        description: `Profil ${p.label} — ${p.equityPct}% actions / ${p.bondPct}% obligations`,
      }),
    });
  }
  return toCreate.length;
}

export default function ProfilesPage() {
  const { profiles, isLoading, mutate } = useInvestmentProfiles();
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);

  // Wizard
  const [step, setStep] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [equityPct, setEquityPct] = useState(60);
  const [bondPct, setBondPct] = useState(40);
  const [nbBonds, setNbBonds] = useState(15);
  const [sectors, setSectors] = useState<SectorConfig[]>([]);
  const [priceMin, setPriceMin] = useState(90);
  const [priceMax, setPriceMax] = useState(105);
  const [saving, setSaving] = useState(false);

  function selectProfile(p: InvestmentProfile) {
    setSelectedId(p.id);
    setName(p.name);
    setDescription(p.description || '');
    setEquityPct(p.equity_pct);
    setBondPct(p.bond_pct);
    setNbBonds(p.nb_bonds);
    setSectors(p.sectors || []);
    setPriceMin(p.bond_config?.price_min ?? 90);
    setPriceMax(p.bond_config?.price_max ?? 105);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const count = await seedProfiles();
      if (count > 0) {
        toast('success', `${count} profil${count > 1 ? 's' : ''} cree${count > 1 ? 's' : ''}`);
        mutate();
      } else {
        toast('info', 'Tous les profils existent deja');
      }
    } catch {
      toast('error', 'Erreur lors de la creation des profils');
    } finally {
      setSeeding(false);
    }
  }

  function handleEquityChange(val: number) {
    const clamped = Math.min(100, Math.max(0, val));
    setEquityPct(clamped);
    setBondPct(100 - clamped);
  }

  function toggleSector(value: string) {
    setSectors((prev) => {
      if (prev.some((s) => s.sector === value)) return prev.filter((s) => s.sector !== value);
      return [...prev, { id: `new-${Date.now()}`, profile_id: selectedId || '', sector: value, weight_pct: 0, nb_titles: 3 }];
    });
  }

  function updateWeight(sector: string, w: number) {
    setSectors((prev) => prev.map((s) => (s.sector === sector ? { ...s, weight_pct: w } : s)));
  }

  function updateTitles(sector: string, n: number) {
    setSectors((prev) => prev.map((s) => (s.sector === sector ? { ...s, nb_titles: n } : s)));
  }

  function distributeEqual() {
    if (!sectors.length) return;
    const w = parseFloat((100 / sectors.length).toFixed(1));
    setSectors((prev) => prev.map((s) => ({ ...s, weight_pct: w })));
  }

  async function handleSave() {
    if (equityPct + bondPct !== 100) {
      toast('warning', 'Les allocations doivent totaliser 100%');
      return;
    }
    const tw = sectors.reduce((s, c) => s + c.weight_pct, 0);
    if (sectors.length > 0 && Math.abs(tw - 100) > 0.5) {
      toast('warning', `Poids sectoriels: ${tw.toFixed(1)}% au lieu de 100%`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/models/profiles/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          equity_pct: equityPct,
          bond_pct: bondPct,
          nb_bonds: nbBonds,
          description: description || null,
          sectors: sectors.map((s) => ({ sector: s.sector, weight_pct: s.weight_pct, nb_titles: s.nb_titles })),
          price_min_bonds: priceMin,
          price_max_bonds: priceMax,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast('success', `Profil "${name}" sauvegarde!`);
      mutate();
      setStep(1);
      setSelectedId(null);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  function goStep(s: number) {
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const totalW = sectors.reduce((s, c) => s + c.weight_pct, 0);

  // ── Loading / Empty ──
  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  if (profiles.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <Link href="/models" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-main mb-8">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="text-6xl mb-4">{'\u{1F3AF}'}</div>
        <h2 className="text-xl font-bold text-text-main mb-2">Commencez ici!</h2>
        <p className="text-text-muted mb-6">Initialisez vos 6 profils pour demarrer.</p>
        <Button loading={seeding} onClick={handleSeed} icon={<Plus className="h-4 w-4" />}>
          Creer les profils
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-2">
        {step > 1 ? (
          <button
            onClick={() => { if (step === 2) { setSelectedId(null); goStep(1); } else goStep(step - 1); }}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-text-muted" />
          </button>
        ) : (
          <Link href="/models" className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-5 w-5 text-text-muted" />
          </Link>
        )}
        <div>
          <h1 className="text-lg font-bold text-text-main">Definir ma strategie</h1>
          <p className="text-sm text-text-muted">
            {step === 1 && 'Choisissez un profil de risque'}
            {step === 2 && 'Ajustez la repartition actions / obligations'}
            {step === 3 && 'Selectionnez vos secteurs d\'investissement'}
            {step === 4 && 'Repartissez les poids entre secteurs'}
            {step === 5 && 'Parametres obligations + sauvegarde'}
          </p>
        </div>
      </div>

      {/* ── Progress dots ── */}
      {step > 1 && (
        <div className="flex items-center gap-1 mb-8 mt-4">
          {STEP_LABELS.map((label, i) => {
            const s = i + 1;
            const active = s === step;
            const done = s < step;
            return (
              <div key={s} className="flex items-center gap-1">
                <button
                  onClick={() => { if (done) { if (s === 1) setSelectedId(null); goStep(s); } }}
                  disabled={s > step}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    active ? 'bg-brand-primary text-white scale-110 shadow-md' :
                    done ? 'bg-green-100 text-green-600 hover:bg-green-200 cursor-pointer' :
                    'bg-gray-100 text-gray-400'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s}
                </button>
                <span className={`text-xs hidden sm:inline mr-1 ${
                  active ? 'text-brand-primary font-semibold' : done ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {label}
                </span>
                {i < 4 && <div className={`w-4 h-0.5 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ STEP 1 — Choose Profile ═══════════ */}
      {step === 1 && (
        <div className="space-y-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {profiles.sort((a, b) => a.profile_number - b.profile_number).map((p, i) => (
            <button
              key={p.id}
              onClick={() => selectProfile(p)}
              className="text-left rounded-2xl p-5 border-2 border-gray-100 bg-white hover:border-brand-primary hover:shadow-lg transition-all duration-300 group"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{PROFILE_ICONS[i] || '\u{1F4CB}'}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                    Profil {p.profile_number}
                  </span>
                  <h3 className="font-bold text-text-main mt-1 group-hover:text-brand-primary transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    {p.equity_pct}% actions · {p.bond_pct}% obligations
                  </p>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 mt-3">
                    <div className="bg-brand-primary rounded-l-full transition-all" style={{ width: `${p.equity_pct}%` }} />
                    <div className="bg-amber-400 rounded-r-full transition-all" style={{ width: `${p.bond_pct}%` }} />
                  </div>
                  {p.sectors && p.sectors.length > 0 && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {p.sectors.length} secteurs configures
                    </p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand-primary transition-colors shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
        <StepNav current={1} />
        </div>
      )}

      {/* ═══════════ STEP 2 — Allocation ═══════════ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            {/* Big visual bar */}
            <div className="flex h-16 rounded-2xl overflow-hidden mb-6 shadow-inner">
              <div
                className="bg-gradient-to-r from-brand-primary to-blue-400 flex items-center justify-center text-white font-bold text-lg transition-all duration-300"
                style={{ width: `${equityPct}%` }}
              >
                {equityPct >= 20 && <><TrendingUp className="h-5 w-5 mr-2" />{equityPct}%</>}
              </div>
              <div
                className="bg-gradient-to-r from-amber-300 to-amber-500 flex items-center justify-center text-amber-900 font-bold text-lg transition-all duration-300"
                style={{ width: `${bondPct}%` }}
              >
                {bondPct >= 20 && `${bondPct}%`}
              </div>
            </div>

            <div className="flex justify-center gap-6 mb-6 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-brand-primary" /> Actions
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> Obligations
              </span>
            </div>

            {/* Single slider */}
            <div className="max-w-md mx-auto">
              <input
                type="range" min={0} max={100} step={5} value={equityPct}
                onChange={(e) => handleEquityChange(parseInt(e.target.value))}
                className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
              <div className="flex justify-between text-xs text-text-muted mt-2">
                <span>100% Obligations</span>
                <span>100% Actions</span>
              </div>
            </div>
          </div>

          {/* Name / Description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Nom du profil</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Description (optionnel)</label>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => goStep(3)} icon={<ArrowRight className="h-4 w-4" />}>
              Choisir les secteurs
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 3 — Sector Toggle Cards ═══════════ */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">Tapez pour activer / desactiver</p>
            <Badge variant={sectors.length > 0 ? 'success' : 'default'}>
              {sectors.length} selectionne{sectors.length > 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SECTORS.map((s) => {
              const meta = SECTOR_META[s.value];
              const on = sectors.some((sc) => sc.sector === s.value);
              const Icon = meta?.Icon || Settings2;
              return (
                <button
                  key={s.value}
                  onClick={() => toggleSector(s.value)}
                  className={`relative rounded-2xl p-5 border-2 transition-all duration-200 text-center group ${
                    on
                      ? `${meta?.bg || 'bg-gray-50'} border-transparent shadow-md ring-2 ${meta?.ring || 'ring-gray-400'} ring-offset-2`
                      : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  {on && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <Icon className={`h-7 w-7 mx-auto mb-2 transition-colors ${
                    on ? (meta?.color || 'text-gray-500') : 'text-gray-300 group-hover:text-gray-400'
                  }`} />
                  <p className={`text-sm font-semibold transition-colors ${
                    on ? 'text-text-main' : 'text-gray-400 group-hover:text-gray-500'
                  }`}>
                    {s.label}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => goStep(2)} icon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
            <Button onClick={() => goStep(4)} disabled={sectors.length === 0} icon={<ArrowRight className="h-4 w-4" />}>
              Ponderer
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 4 — Sector Weights ═══════════ */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">Total:</span>
              <Badge variant={Math.abs(totalW - 100) < 0.5 ? 'success' : 'warning'}>
                {totalW.toFixed(1)}%
              </Badge>
            </div>
            <button
              onClick={distributeEqual}
              className="text-sm text-brand-primary hover:underline font-medium flex items-center gap-1"
            >
              <Sparkles className="h-4 w-4" /> Repartir egalement
            </button>
          </div>

          {Math.abs(totalW - 100) > 0.5 && sectors.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-xl text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> Les poids doivent totaliser 100%
            </div>
          )}

          <div className="space-y-3">
            {sectors.map((s) => {
              const label = SECTORS.find((x) => x.value === s.sector)?.label || s.sector;
              const meta = SECTOR_META[s.sector];
              const Icon = meta?.Icon || Settings2;
              return (
                <div key={s.sector} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Icon className={`h-5 w-5 ${meta?.color || 'text-gray-500'}`} />
                    <span className="font-semibold text-text-main text-sm flex-1">{label}</span>
                    <span className="text-lg font-bold text-text-main font-mono w-16 text-right">
                      {s.weight_pct}%
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={50} step={0.5} value={s.weight_pct}
                    onChange={(e) => updateWeight(s.sector, parseFloat(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-brand-primary mb-3"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap">
                    <span className="mr-1">Titres:</span>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => updateTitles(s.sector, n)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                          s.nb_titles === n
                            ? 'bg-brand-primary text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => goStep(3)} icon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
            <Button
              onClick={() => goStep(5)}
              disabled={sectors.length > 0 && Math.abs(totalW - 100) > 0.5}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Obligations
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 5 — Bonds + Summary + Save ═══════════ */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-main mb-3">
                Nombre d&apos;obligations
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={40} value={nbBonds}
                  onChange={(e) => setNbBonds(parseInt(e.target.value))}
                  className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-xl font-bold font-mono w-10 text-center text-text-main">{nbBonds}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-3">Fourchette de prix</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Min</label>
                  <input
                    type="number" step="0.5" value={priceMin}
                    onChange={(e) => setPriceMin(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Max</label>
                  <input
                    type="number" step="0.5" value={priceMax}
                    onChange={(e) => setPriceMax(parseFloat(e.target.value) || 100)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-gradient-to-br from-brand-primary/5 to-blue-50 rounded-2xl border border-brand-primary/20 p-6">
            <h3 className="font-bold text-text-main mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-primary" /> Recapitulatif
            </h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-text-muted">Profil</span>
              <span className="font-semibold text-text-main">{name}</span>
              <span className="text-text-muted">Actions</span>
              <span className="font-semibold text-brand-primary">{equityPct}%</span>
              <span className="text-text-muted">Obligations</span>
              <span className="font-semibold text-amber-500">{bondPct}%</span>
              <span className="text-text-muted">Secteurs</span>
              <span className="font-semibold text-text-main">{sectors.length}</span>
              <span className="text-text-muted">Nb obligations</span>
              <span className="font-semibold text-text-main">{nbBonds}</span>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => goStep(4)} icon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
            <Button loading={saving} onClick={handleSave} icon={<Save className="h-4 w-4" />}>
              Sauvegarder
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

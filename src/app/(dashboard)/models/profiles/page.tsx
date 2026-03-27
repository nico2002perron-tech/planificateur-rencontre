'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  useInvestmentProfiles,
  type InvestmentProfile,
  type SectorConfig,
} from '@/lib/hooks/useInvestmentProfiles';
import { SECTORS, INVESTMENT_PROFILES } from '@/lib/utils/constants';
import {
  ArrowLeft, Save, Plus, Trash2, RotateCcw, Settings2,
  ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';

// ── Seed helper ──
// Appeler POST /api/models/profiles pour chaque profil manquant
async function seedProfiles() {
  const res = await fetch('/api/models/profiles');
  const { profiles } = await res.json() as { profiles: InvestmentProfile[] };
  const existingSlugs = new Set(profiles.map(p => p.slug));

  const toCreate = INVESTMENT_PROFILES.filter(p => !existingSlugs.has(p.value));
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
  const [selected, setSelected] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Sélectionner le premier profil automatiquement
  useEffect(() => {
    if (!selected && profiles.length > 0) {
      setSelected(profiles[0].id);
    }
  }, [profiles, selected]);

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

  const selectedProfile = profiles.find(p => p.id === selected) || null;

  return (
    <div>
      <PageHeader
        title="Profils d'investissement"
        description="Allocations et configurations sectorielles par profil de risque"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : profiles.length === 0 ? (
        <Card className="text-center py-12">
          <Settings2 className="h-12 w-12 text-text-light mx-auto mb-3" />
          <h3 className="font-semibold text-text-main mb-1">Aucun profil configure</h3>
          <p className="text-sm text-text-muted mb-4 max-w-md mx-auto">
            Initialisez les 6 profils predefinies (Prudent a Croissance Maximum) avec leurs allocations par defaut.
          </p>
          <Button loading={seeding} onClick={handleSeed} icon={<Plus className="h-4 w-4" />}>
            Initialiser les profils
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Cartes de profils */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {profiles.map(p => {
              const isActive = p.id === selected;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`text-left rounded-xl p-4 border-2 transition-all duration-200 ${
                    isActive
                      ? 'border-brand-primary bg-brand-primary/5 shadow-md'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  <p className={`text-xs font-medium mb-1 ${isActive ? 'text-brand-primary' : 'text-text-muted'}`}>
                    Profil {p.profile_number}
                  </p>
                  <p className="font-semibold text-text-main text-sm mb-2 leading-tight">{p.name}</p>

                  {/* Barre allocation visuelle */}
                  <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mb-2">
                    <div
                      className="bg-brand-primary rounded-l-full transition-all"
                      style={{ width: `${p.equity_pct}%` }}
                    />
                    <div
                      className="bg-amber-400 rounded-r-full transition-all"
                      style={{ width: `${p.bond_pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>{p.equity_pct}% act.</span>
                    <span>{p.bond_pct}% obl.</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail du profil selectionne */}
          {selectedProfile && (
            <ProfileEditor
              key={selectedProfile.id}
              profile={selectedProfile}
              onSaved={() => mutate()}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// EDITEUR DE PROFIL
// ════════════════════════════════════════════════

interface ProfileEditorProps {
  profile: InvestmentProfile;
  onSaved: () => void;
}

function ProfileEditor({ profile, onSaved }: ProfileEditorProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Champs editables
  const [name, setName] = useState(profile.name);
  const [equityPct, setEquityPct] = useState(profile.equity_pct);
  const [bondPct, setBondPct] = useState(profile.bond_pct);
  const [nbBonds, setNbBonds] = useState(profile.nb_bonds);
  const [description, setDescription] = useState(profile.description || '');

  // Secteurs
  const [sectors, setSectors] = useState<SectorConfig[]>(profile.sectors || []);
  const [showAddSector, setShowAddSector] = useState(false);
  const [sectorsExpanded, setSectorsExpanded] = useState(true);

  // Bond config
  const [priceMin, setPriceMin] = useState(profile.bond_config?.price_min ?? 90);
  const [priceMax, setPriceMax] = useState(profile.bond_config?.price_max ?? 105);

  // Detect changes
  const hasChanges = useCallback(() => {
    if (name !== profile.name) return true;
    if (equityPct !== profile.equity_pct) return true;
    if (bondPct !== profile.bond_pct) return true;
    if (nbBonds !== profile.nb_bonds) return true;
    if (description !== (profile.description || '')) return true;
    if (priceMin !== (profile.bond_config?.price_min ?? 90)) return true;
    if (priceMax !== (profile.bond_config?.price_max ?? 105)) return true;
    const origSectors = profile.sectors || [];
    if (sectors.length !== origSectors.length) return true;
    for (let i = 0; i < sectors.length; i++) {
      const s = sectors[i];
      const o = origSectors.find(os => os.sector === s.sector);
      if (!o || o.weight_pct !== s.weight_pct || o.nb_titles !== s.nb_titles) return true;
    }
    return false;
  }, [name, equityPct, bondPct, nbBonds, description, priceMin, priceMax, sectors, profile]);

  // Synchroniser equity/bond quand on modifie l'un
  function handleEquityChange(val: number) {
    const clamped = Math.min(100, Math.max(0, val));
    setEquityPct(clamped);
    setBondPct(100 - clamped);
  }

  function handleBondChange(val: number) {
    const clamped = Math.min(100, Math.max(0, val));
    setBondPct(clamped);
    setEquityPct(100 - clamped);
  }

  // Secteurs
  function updateSector(index: number, field: 'weight_pct' | 'nb_titles', value: number) {
    setSectors(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function removeSector(index: number) {
    setSectors(prev => prev.filter((_, i) => i !== index));
  }

  function addSector(sectorValue: string) {
    if (sectors.some(s => s.sector === sectorValue)) {
      toast('warning', 'Ce secteur est deja configure');
      return;
    }
    setSectors(prev => [...prev, {
      id: `new-${Date.now()}`,
      profile_id: profile.id,
      sector: sectorValue,
      weight_pct: 0,
      nb_titles: 3,
    }]);
    setShowAddSector(false);
  }

  // Sauvegarder
  async function handleSave() {
    if (equityPct + bondPct !== 100) {
      toast('warning', 'Les allocations doivent totaliser 100%');
      return;
    }
    const totalWeight = sectors.reduce((sum, s) => sum + s.weight_pct, 0);
    if (sectors.length > 0 && Math.abs(totalWeight - 100) > 0.5) {
      toast('warning', `Les poids sectoriels totalisent ${totalWeight.toFixed(1)}% au lieu de 100%`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/models/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          equity_pct: equityPct,
          bond_pct: bondPct,
          nb_bonds: nbBonds,
          description: description || null,
          sectors: sectors.map(s => ({
            sector: s.sector,
            weight_pct: s.weight_pct,
            nb_titles: s.nb_titles,
          })),
          price_min_bonds: priceMin,
          price_max_bonds: priceMax,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      toast('success', `Profil "${name}" sauvegarde`);
      onSaved();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  // Reinitialiser aux valeurs par defaut
  function handleReset() {
    const defaults = INVESTMENT_PROFILES.find(p => p.label === profile.name || p.value === profile.slug);
    if (defaults) {
      setEquityPct(defaults.equityPct);
      setBondPct(defaults.bondPct);
      setNbBonds(defaults.nbBonds);
      toast('info', 'Allocations reinitialisees aux valeurs par defaut');
    }
  }

  const totalSectorWeight = sectors.reduce((sum, s) => sum + s.weight_pct, 0);
  const availableSectors = SECTORS.filter(s => !sectors.some(sc => sc.sector === s.value));

  return (
    <Card>
      {/* En-tete */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-text-main">
            Profil {profile.profile_number} — {profile.name}
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Modifiez les allocations, secteurs et parametres de ce profil
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Reinitialiser
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!hasChanges()}
            onClick={handleSave}
            icon={<Save className="h-3.5 w-3.5" />}
          >
            Sauvegarder
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Colonne gauche: Allocations ── */}
        <div className="space-y-5">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Nom du profil</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none"
            />
          </div>

          {/* Allocations */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-3">Allocation cible</label>

            {/* Barre visuelle large */}
            <div className="flex h-8 rounded-lg overflow-hidden mb-3">
              <div
                className="bg-brand-primary flex items-center justify-center text-white text-xs font-semibold transition-all"
                style={{ width: `${equityPct}%` }}
              >
                {equityPct >= 15 && `${equityPct}%`}
              </div>
              <div
                className="bg-amber-400 flex items-center justify-center text-amber-900 text-xs font-semibold transition-all"
                style={{ width: `${bondPct}%` }}
              >
                {bondPct >= 15 && `${bondPct}%`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Actions (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={equityPct}
                    onChange={(e) => handleEquityChange(parseInt(e.target.value))}
                    className="flex-1 accent-brand-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={equityPct}
                    onChange={(e) => handleEquityChange(parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Obligations (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={bondPct}
                    onChange={(e) => handleBondChange(parseInt(e.target.value))}
                    className="flex-1 accent-amber-400"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bondPct}
                    onChange={(e) => handleBondChange(parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Nombre d'obligations */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Nombre d'obligations dans le portefeuille</label>
            <input
              type="number"
              min={1}
              max={50}
              value={nbBonds}
              onChange={(e) => setNbBonds(parseInt(e.target.value) || 10)}
              className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>

          {/* Config prix obligations */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">Fourchette de prix des obligations</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Prix minimum</label>
                <input
                  type="number"
                  step="0.5"
                  value={priceMin}
                  onChange={(e) => setPriceMin(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Prix maximum</label>
                <input
                  type="number"
                  step="0.5"
                  value={priceMax}
                  onChange={(e) => setPriceMax(parseFloat(e.target.value) || 100)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Colonne droite: Configuration sectorielle ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setSectorsExpanded(!sectorsExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-text-main"
            >
              {sectorsExpanded
                ? <ChevronDown className="h-4 w-4 text-text-muted" />
                : <ChevronRight className="h-4 w-4 text-text-muted" />
              }
              Configuration sectorielle
              {sectors.length > 0 && (
                <Badge variant={Math.abs(totalSectorWeight - 100) < 0.5 ? 'success' : 'warning'}>
                  {totalSectorWeight.toFixed(1)}%
                </Badge>
              )}
            </button>
            {sectorsExpanded && availableSectors.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddSector(true)}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Ajouter
              </Button>
            )}
          </div>

          {sectorsExpanded && (
            <>
              {sectors.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <p className="text-sm text-text-muted mb-3">
                    Aucun secteur configure. Ajoutez des secteurs pour definir la repartition sectorielle de ce profil.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddSector(true)}
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Ajouter un secteur
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Avertissement si total != 100% */}
                  {sectors.length > 0 && Math.abs(totalSectorWeight - 100) > 0.5 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Les poids totalisent {totalSectorWeight.toFixed(1)}% — ils doivent totaliser 100%
                    </div>
                  )}

                  {/* En-tete tableau */}
                  <div className="grid grid-cols-[1fr_80px_80px_36px] gap-2 px-3 py-1.5 text-xs text-text-muted uppercase tracking-wider">
                    <span>Secteur</span>
                    <span className="text-center">Poids %</span>
                    <span className="text-center">Titres</span>
                    <span></span>
                  </div>

                  {/* Lignes secteurs */}
                  {sectors.map((s, i) => {
                    const label = SECTORS.find(sec => sec.value === s.sector)?.label || s.sector;
                    return (
                      <div
                        key={s.sector}
                        className="grid grid-cols-[1fr_80px_80px_36px] gap-2 items-center px-3 py-2 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm text-text-main font-medium">{label}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={s.weight_pct}
                          onChange={(e) => updateSector(i, 'weight_pct', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={s.nb_titles}
                          onChange={(e) => updateSector(i, 'nb_titles', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                        <button
                          onClick={() => removeSector(i)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Raccourci repartition egale */}
                  {sectors.length > 1 && (
                    <button
                      onClick={() => {
                        const equal = parseFloat((100 / sectors.length).toFixed(1));
                        setSectors(prev => prev.map(s => ({ ...s, weight_pct: equal })));
                      }}
                      className="text-xs text-brand-primary hover:underline px-3 pt-1"
                    >
                      Repartir egalement ({(100 / sectors.length).toFixed(1)}% chacun)
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal ajout secteur */}
      <Modal open={showAddSector} onClose={() => setShowAddSector(false)} title="Ajouter un secteur" size="sm">
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {availableSectors.map(s => (
            <button
              key={s.value}
              onClick={() => addSector(s.value)}
              className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 text-sm text-text-main transition-colors"
            >
              {s.label}
            </button>
          ))}
          {availableSectors.length === 0 && (
            <p className="text-sm text-text-muted text-center py-4">Tous les secteurs sont deja configures</p>
          )}
        </div>
      </Modal>
    </Card>
  );
}

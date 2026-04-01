'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useModels, type ModelPortfolio } from '@/lib/hooks/useModels';
import {
  PieChart, Trash2, Star, Rocket, Clock, Edit3, Copy,
  SlidersHorizontal, Globe, Zap, ArrowRightLeft, Activity,
  Target, Mail, Scale, ChevronRight, CheckCircle2, Lock,
  Sparkles, BarChart3, TrendingUp, Search, ArrowUpDown, Eye, X,
} from 'lucide-react';

// ── Constantes ──

const riskColors: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
  CONSERVATEUR: 'info',
  MODERE: 'success',
  EQUILIBRE: 'warning',
  CROISSANCE: 'danger',
  DYNAMIQUE: 'danger',
};

const riskLabels: Record<string, string> = {
  CONSERVATEUR: 'Conservateur',
  MODERE: 'Modéré',
  EQUILIBRE: 'Équilibré',
  CROISSANCE: 'Croissance',
  DYNAMIQUE: 'Dynamique',
};

type SortKey = 'name' | 'date' | 'risk' | 'holdings';
const RISK_ORDER: Record<string, number> = { CONSERVATEUR: 0, MODERE: 1, EQUILIBRE: 2, CROISSANCE: 3, DYNAMIQUE: 4 };
const RISK_FILTER_OPTIONS = [
  { value: '', label: 'Tous les profils' },
  { value: 'CONSERVATEUR', label: 'Conservateur' },
  { value: 'MODERE', label: 'Modéré' },
  { value: 'EQUILIBRE', label: 'Équilibré' },
  { value: 'CROISSANCE', label: 'Croissance' },
  { value: 'DYNAMIQUE', label: 'Dynamique' },
];

// ── Types du parcours guide ──

interface JourneyStep {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
  category: 'build' | 'analyze' | 'act';
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    number: 1,
    title: 'Definir ma strategie',
    description: 'Configurez les profils de risque et les poids sectoriels',
    icon: <SlidersHorizontal className="h-5 w-5" />,
    href: '/models/profiles',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    category: 'build',
  },
  {
    number: 2,
    title: 'Choisir mes titres',
    description: 'Ajoutez les actions et obligations disponibles par secteur',
    icon: <Globe className="h-5 w-5" />,
    href: '/models/universe',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    category: 'build',
  },
  {
    number: 3,
    title: 'Construire mon portefeuille',
    description: 'Generez automatiquement et sauvegardez votre modele',
    icon: <Zap className="h-5 w-5" />,
    href: '/models/generate',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    category: 'build',
  },
  {
    number: 4,
    title: 'Evaluer la qualite',
    description: 'Analysez le score de chaque titre et du portefeuille global',
    icon: <Target className="h-5 w-5" />,
    href: '/models/scoring',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    category: 'analyze',
  },
  {
    number: 5,
    title: 'Tester la performance',
    description: 'Backtestez sur 1 a 10 ans avec comparaison aux indices',
    icon: <Activity className="h-5 w-5" />,
    href: '/models/backtest',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    category: 'analyze',
  },
  {
    number: 6,
    title: 'Simuler en temps reel',
    description: 'Suivez votre modele comme un vrai portefeuille avec les prix du marche',
    icon: <TrendingUp className="h-5 w-5" />,
    href: '/models/simulation',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    category: 'analyze',
  },
  {
    number: 7,
    title: 'Comparer avec un client',
    description: 'Collez les positions Croesus et voyez les ecarts',
    icon: <ArrowRightLeft className="h-5 w-5" />,
    href: '/models/compare',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    category: 'act',
  },
  {
    number: 8,
    title: 'Reequilibrer',
    description: 'Detectez les derives et generez un plan de transactions',
    icon: <Scale className="h-5 w-5" />,
    href: '/models/rebalance',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    category: 'act',
  },
  {
    number: 9,
    title: 'Communiquer au client',
    description: 'Generez un email professionnel resume par IA',
    icon: <Mail className="h-5 w-5" />,
    href: '/models/email',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    category: 'act',
  },
];

const CATEGORY_LABELS: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  build: {
    label: 'Construire',
    description: 'Mettez en place votre portefeuille modele',
    icon: <Sparkles className="h-4 w-4" />,
  },
  analyze: {
    label: 'Analyser',
    description: 'Evaluez et testez votre portefeuille',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  act: {
    label: 'Agir',
    description: 'Appliquez et communiquez les resultats',
    icon: <TrendingUp className="h-4 w-4" />,
  },
};

// ════════════════════════════════════════
// PAGE
// ════════════════════════════════════════

export default function ModelsPage() {
  const { models, isLoading, mutate } = useModels();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ModelPortfolio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [previewModel, setPreviewModel] = useState<ModelPortfolio | null>(null);

  const filteredModels = useMemo(() => {
    if (!models) return [];
    let list = [...models];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.holdings.some(h => h.symbol.toLowerCase().includes(q))
      );
    }

    // Risk filter
    if (riskFilter) {
      list = list.filter(m => m.risk_level === riskFilter);
    }

    // Sort
    list.sort((a, b) => {
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name, 'fr-CA');
        case 'date': return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'risk': return (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9);
        case 'holdings': return b.holdings.length - a.holdings.length;
        default: return 0;
      }
    });

    return list;
  }, [models, searchQuery, riskFilter, sortKey]);

  const hasModels = models && models.length > 0;

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/models/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('success', 'Modele supprime');
      mutate();
    } catch {
      toast('error', 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleDuplicate(model: ModelPortfolio) {
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${model.name} (copie)`,
          description: model.description,
          risk_level: model.risk_level,
          holdings: model.holdings,
        }),
      });
      if (!res.ok) throw new Error();
      toast('success', 'Modele duplique');
      mutate();
    } catch {
      toast('error', 'Erreur lors de la duplication');
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'A l\'instant';
    if (mins < 60) return `Il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Il y a ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `Il y a ${days}j`;
    return new Date(dateStr).toLocaleDateString('fr-CA');
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-main">Portefeuilles modeles</h1>
        <p className="text-sm text-text-muted mt-1">
          Suivez les etapes pour construire, analyser et appliquer vos modeles
        </p>
      </div>

      {/* ── Parcours guide ── */}
      <div className="space-y-8 mb-10">
        {(['build', 'analyze', 'act'] as const).map((category) => {
          const cat = CATEGORY_LABELS[category];
          const steps = JOURNEY_STEPS.filter(s => s.category === category);

          return (
            <div key={category}>
              {/* Category header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`p-1.5 rounded-lg ${
                  category === 'build' ? 'bg-violet-100 text-violet-600'
                  : category === 'analyze' ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-orange-100 text-orange-600'
                }`}>
                  {cat.icon}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">{cat.label}</h2>
                  <p className="text-xs text-text-muted">{cat.description}</p>
                </div>
              </div>

              {/* Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {steps.map((step) => (
                  <Link key={step.number} href={step.href}>
                    <div className={`group relative rounded-xl border-2 ${step.borderColor} ${step.bgColor} p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-pointer`}>
                      {/* Step number badge */}
                      <div className={`absolute -top-2.5 -left-2 w-6 h-6 rounded-full ${step.bgColor} border-2 ${step.borderColor} flex items-center justify-center`}>
                        <span className={`text-xs font-bold ${step.color}`}>{step.number}</span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white/70 ${step.color} flex-shrink-0`}>
                          {step.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-text-main group-hover:text-brand-primary transition-colors">
                            {step.title}
                          </h3>
                          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-text-light group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mes modeles sauvegardes ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary">
              <PieChart className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">Mes modeles</h2>
            {hasModels && (
              <Badge variant="default">{models.length}</Badge>
            )}
          </div>
          <Link href="/models/generate">
            <Button size="sm" icon={<Zap className="h-3.5 w-3.5" />}>Nouveau modele</Button>
          </Link>
        </div>

        {/* ── Barre de recherche, filtre et tri ── */}
        {hasModels && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-light" />
              <input
                type="text"
                placeholder="Rechercher un modele ou symbole..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none bg-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-light hover:text-text-main">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none bg-white"
            >
              {RISK_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <ArrowUpDown className="h-3 w-3" />
              {(['date', 'name', 'risk', 'holdings'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`px-2 py-1 rounded-md transition-colors ${sortKey === key ? 'bg-brand-primary/10 text-brand-primary font-semibold' : 'hover:bg-gray-100'}`}
                >
                  {{ date: 'Date', name: 'Nom', risk: 'Risque', holdings: 'Positions' }[key]}
                </button>
              ))}
            </div>
            {(searchQuery || riskFilter) && (
              <span className="text-xs text-text-muted ml-auto">{filteredModels.length} / {models.length} modeles</span>
            )}
          </div>
        )}

        {!hasModels ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <PieChart className="h-7 w-7 text-text-light" />
            </div>
            <h3 className="text-base font-semibold text-text-main mb-2">Aucun modele sauvegarde</h3>
            <p className="text-sm text-text-muted max-w-sm mx-auto mb-5">
              Commencez par l'etape 1 pour definir votre strategie, puis construisez et sauvegardez votre premier portefeuille modele.
            </p>
            <Link href="/models/profiles">
              <Button icon={<Sparkles className="h-4 w-4" />}>Commencer</Button>
            </Link>
          </div>
        ) : (
          filteredModels.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-8 text-center">
              <p className="text-sm text-text-muted">Aucun modele ne correspond a votre recherche.</p>
              <button onClick={() => { setSearchQuery(''); setRiskFilter(''); }} className="text-sm text-brand-primary hover:underline mt-2">
                Effacer les filtres
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModels.map((model) => (
              <Card key={model.id} className="flex flex-col group hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-text-main truncate">{model.name}</h3>
                    {model.is_default && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                  </div>
                  <Badge variant={riskColors[model.risk_level] || 'info'}>
                    {riskLabels[model.risk_level] || model.risk_level}
                  </Badge>
                </div>

                {model.description && (
                  <p className="text-xs text-text-muted mb-2 line-clamp-2">{model.description}</p>
                )}

                <div className="flex items-center gap-2 text-xs text-text-muted mb-2.5">
                  <span className="font-medium">{model.holdings.length} position{model.holdings.length !== 1 ? 's' : ''}</span>
                  {model.holdings.length > 0 && (
                    <span className="text-text-light truncate">
                      {model.holdings.slice(0, 3).map(h => h.symbol).join(', ')}
                      {model.holdings.length > 3 && ` +${model.holdings.length - 3}`}
                    </span>
                  )}
                </div>

                {model.holdings.length > 0 && (
                  <div className="flex gap-0.5 mb-2.5 h-2 rounded-full overflow-hidden bg-gray-100">
                    {model.holdings.map((h, i) => {
                      const colors = ['bg-brand-primary', 'bg-brand-accent', 'bg-brand-dark', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
                      return (
                        <div
                          key={i}
                          className={colors[i % colors.length]}
                          style={{ width: `${h.weight}%` }}
                          title={`${h.symbol} — ${h.weight}%`}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-text-light mb-3">
                  <Clock className="h-3 w-3" />
                  <span>Mis a jour {timeAgo(model.updated_at)}</span>
                </div>

                <div className="flex gap-1.5 mt-auto pt-3 border-t border-gray-100">
                  <Link href={`/models/${model.id}`} className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full" icon={<Edit3 className="h-3.5 w-3.5" />}>
                      Ouvrir
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewModel(model)}
                    title="Apercu rapide"
                    icon={<Eye className="h-3.5 w-3.5" />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(model)}
                    title="Dupliquer"
                    icon={<Copy className="h-3.5 w-3.5" />}
                  />
                  <Link href={`/models/${model.id}/apply`}>
                    <Button variant="ghost" size="sm" className="text-brand-primary" icon={<Rocket className="h-3.5 w-3.5" />} title="Appliquer" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(model)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    title="Supprimer"
                  />
                </div>
              </Card>
            ))}
          </div>
          )
        )}
      </div>

      {/* ── Modal suppression ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer le modele" size="sm">
        <p className="text-sm text-text-muted mb-6">
          Etes-vous sur de vouloir supprimer le modele <strong>{deleteTarget?.name}</strong> ?
          Cette action est irreversible.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>

      {/* ── Modal apercu rapide ── */}
      <Modal open={!!previewModel} onClose={() => setPreviewModel(null)} title={previewModel?.name || ''} size="md">
        {previewModel && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={riskColors[previewModel.risk_level] || 'info'}>
                {riskLabels[previewModel.risk_level] || previewModel.risk_level}
              </Badge>
              <span className="text-xs text-text-muted">{previewModel.holdings.length} positions</span>
              <span className="text-xs text-text-light ml-auto">Mis a jour {timeAgo(previewModel.updated_at)}</span>
            </div>

            {previewModel.description && (
              <p className="text-sm text-text-muted">{previewModel.description}</p>
            )}

            {/* Holdings table */}
            {previewModel.holdings.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-text-muted">
                      <th className="text-left py-1.5 font-semibold">Symbole</th>
                      <th className="text-left py-1.5 font-semibold">Nom</th>
                      <th className="text-right py-1.5 font-semibold">Poids</th>
                      <th className="text-left py-1.5 font-semibold pl-3">Classe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewModel.holdings.map((h, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 font-mono font-semibold text-brand-primary text-xs">{h.symbol}</td>
                        <td className="py-1.5 text-text-main text-xs truncate max-w-[160px]">{h.name}</td>
                        <td className="py-1.5 text-right">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${Math.max(h.weight * 0.6, 4)}px` }} />
                            <span className="text-xs font-medium">{h.weight}%</span>
                          </span>
                        </td>
                        <td className="py-1.5 text-xs text-text-muted pl-3">{h.asset_class || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td colSpan={2} className="py-1.5 text-xs font-semibold">Total</td>
                      <td className="py-1.5 text-right text-xs font-bold">{previewModel.holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)}%</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Weight bar */}
            {previewModel.holdings.length > 0 && (
              <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-gray-100">
                {previewModel.holdings.map((h, i) => {
                  const colors = ['bg-brand-primary', 'bg-brand-accent', 'bg-brand-dark', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
                  return (
                    <div key={i} className={colors[i % colors.length]} style={{ width: `${h.weight}%` }} title={`${h.symbol} — ${h.weight}%`} />
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPreviewModel(null)}>Fermer</Button>
              <Link href={`/models/${previewModel.id}`}>
                <Button size="sm" icon={<Edit3 className="h-3.5 w-3.5" />}>Ouvrir le modele</Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

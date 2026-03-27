'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useModels, type ModelPortfolio } from '@/lib/hooks/useModels';
import { Plus, PieChart, Trash2, Eye, Star, Rocket, Globe, SlidersHorizontal, Zap, ArrowRightLeft, Activity, Target, Mail, Scale, Clock, Edit3, Copy } from 'lucide-react';

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

export default function ModelsPage() {
  const { models, isLoading, mutate } = useModels();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ModelPortfolio | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <div>
      <PageHeader
        title="Portefeuilles modèles"
        description="Modèles de répartition prédéfinis par profil de risque"
        action={
          <div className="flex gap-2 flex-wrap">
            <Link href="/models/profiles">
              <Button variant="outline" size="sm" icon={<SlidersHorizontal className="h-3.5 w-3.5" />}>Profils</Button>
            </Link>
            <Link href="/models/universe">
              <Button variant="outline" size="sm" icon={<Globe className="h-3.5 w-3.5" />}>Univers</Button>
            </Link>
            <Link href="/models/compare">
              <Button variant="outline" size="sm" icon={<ArrowRightLeft className="h-3.5 w-3.5" />}>Comparer</Button>
            </Link>
            <Link href="/models/backtest">
              <Button variant="outline" size="sm" icon={<Activity className="h-3.5 w-3.5" />}>Backtest</Button>
            </Link>
            <Link href="/models/scoring">
              <Button variant="outline" size="sm" icon={<Target className="h-3.5 w-3.5" />}>Scoring</Button>
            </Link>
            <Link href="/models/email">
              <Button variant="outline" size="sm" icon={<Mail className="h-3.5 w-3.5" />}>Email IA</Button>
            </Link>
            <Link href="/models/rebalance">
              <Button variant="outline" size="sm" icon={<Scale className="h-3.5 w-3.5" />}>Reequilibrage</Button>
            </Link>
            <Link href="/models/generate">
              <Button size="sm" icon={<Zap className="h-3.5 w-3.5" />}>Generer</Button>
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !models || models.length === 0 ? (
        <Card className="text-center py-16">
          <PieChart className="h-16 w-16 text-text-light mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-main mb-2">Aucun modèle</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
            Créez vos portefeuilles modèles (Conservateur, Équilibré, Croissance, etc.)
            pour les appliquer rapidement aux nouveaux clients.
          </p>
          <Link href="/models/new">
            <Button icon={<Plus className="h-4 w-4" />}>Créer un modèle</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {models.map((model) => (
            <Card key={model.id} className="flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-text-main">{model.name}</h3>
                  {model.is_default && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                </div>
                <Badge variant={riskColors[model.risk_level] || 'info'}>
                  {riskLabels[model.risk_level] || model.risk_level}
                </Badge>
              </div>

              {model.description && (
                <p className="text-xs text-text-muted mb-2 line-clamp-2">{model.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
                <span className="font-medium">{model.holdings.length} position{model.holdings.length !== 1 ? 's' : ''}</span>
                {model.holdings.length > 0 && (
                  <span className="text-text-light">
                    {model.holdings.slice(0, 4).map(h => h.symbol).join(', ')}
                    {model.holdings.length > 4 && ` +${model.holdings.length - 4}`}
                  </span>
                )}
              </div>

              {model.holdings.length > 0 && (
                <div className="flex gap-0.5 mb-3 h-2.5 rounded-full overflow-hidden bg-gray-100">
                  {model.holdings.map((h, i) => {
                    const colors = ['bg-brand-primary', 'bg-brand-accent', 'bg-brand-dark', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
                    return (
                      <div
                        key={i}
                        className={`${colors[i % colors.length]}`}
                        style={{ width: `${h.weight}%` }}
                        title={`${h.symbol} — ${h.weight}%`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Date de mise a jour */}
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
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer le modèle" size="sm">
        <p className="text-sm text-text-muted mb-6">
          Êtes-vous sûr de vouloir supprimer le modèle <strong>{deleteTarget?.name}</strong> ?
          Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </div>
  );
}

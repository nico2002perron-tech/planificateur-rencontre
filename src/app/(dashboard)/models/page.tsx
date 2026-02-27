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
import { Plus, PieChart, Trash2, Eye, Star, Rocket } from 'lucide-react';

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
      toast('success', 'Modèle supprimé');
      mutate();
    } catch {
      toast('error', 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Portefeuilles modèles"
        description="Modèles de répartition prédéfinis par profil de risque"
        action={
          <Link href="/models/new">
            <Button icon={<Plus className="h-4 w-4" />}>Nouveau modèle</Button>
          </Link>
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
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-text-main">{model.name}</h3>
                  {model.is_default && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                </div>
                <Badge variant={riskColors[model.risk_level] || 'info'}>
                  {riskLabels[model.risk_level] || model.risk_level}
                </Badge>
              </div>

              {model.description && (
                <p className="text-sm text-text-muted mb-3">{model.description}</p>
              )}

              <div className="text-sm text-text-muted mb-4">
                {model.holdings.length} position{model.holdings.length !== 1 ? 's' : ''}
                {model.holdings.length > 0 && (
                  <span className="ml-1">
                    — {model.holdings.slice(0, 3).map(h => h.symbol).join(', ')}
                    {model.holdings.length > 3 && `, +${model.holdings.length - 3}`}
                  </span>
                )}
              </div>

              {model.holdings.length > 0 && (
                <div className="flex gap-1 mb-4 h-3 rounded-full overflow-hidden bg-gray-100">
                  {model.holdings.map((h, i) => {
                    const colors = ['bg-brand-primary', 'bg-brand-accent', 'bg-brand-dark', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
                    return (
                      <div
                        key={i}
                        className={`${colors[i % colors.length]} rounded-full`}
                        style={{ width: `${h.weight}%` }}
                        title={`${h.symbol} — ${h.weight}%`}
                      />
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                <Link href={`/models/${model.id}`} className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full" icon={<Eye className="h-3.5 w-3.5" />}>
                    Voir
                  </Button>
                </Link>
                <Link href={`/models/${model.id}/apply`} className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full text-brand-primary" icon={<Rocket className="h-3.5 w-3.5" />}>
                    Appliquer
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(model)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Supprimer
                </Button>
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

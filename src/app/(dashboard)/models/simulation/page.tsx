'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useModels, type ModelPortfolio } from '@/lib/hooks/useModels';
import {
  ArrowLeft, Activity, TrendingUp, PieChart, Zap, ChevronRight, Clock,
} from 'lucide-react';

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-CA');
}

export default function SimulationSelectPage() {
  const { models, isLoading } = useModels();

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  const hasModels = models && models.length > 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/models">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Modèles
          </Button>
        </Link>
        <span className="text-text-light">/</span>
        <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand-primary" />
          Simuler en temps réel
        </h1>
      </div>

      {/* Intro */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-100 to-brand-primary/20 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="h-8 w-8 text-brand-primary" />
        </div>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          Choisissez un portefeuille modèle pour le suivre comme un vrai compte d&apos;investissement avec les prix du marché en temps réel.
        </p>
      </div>

      {!hasModels ? (
        /* No models */
        <Card className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <PieChart className="h-7 w-7 text-text-light" />
          </div>
          <h3 className="text-base font-semibold text-text-main mb-2">Aucun modèle sauvegardé</h3>
          <p className="text-sm text-text-muted max-w-sm mx-auto mb-5">
            Vous devez d&apos;abord construire et sauvegarder un portefeuille modèle avant de lancer une simulation.
          </p>
          <Link href="/models/generate">
            <Button icon={<Zap className="h-4 w-4" />}>Construire un modèle</Button>
          </Link>
        </Card>
      ) : (
        /* Model list */
        <div className="space-y-3">
          {models.map((model: ModelPortfolio) => (
            <Link key={model.id} href={`/models/${model.id}/simulation`}>
              <div className="group flex items-center gap-4 rounded-xl border-2 border-gray-200 bg-white p-4 transition-all hover:border-brand-primary/40 hover:shadow-md cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary/10 to-brand-accent/10 flex items-center justify-center flex-shrink-0">
                  <PieChart className="h-6 w-6 text-brand-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-text-main truncate group-hover:text-brand-primary transition-colors">
                      {model.name}
                    </h3>
                    <Badge variant={riskColors[model.risk_level] || 'info'}>
                      {riskLabels[model.risk_level] || model.risk_level}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="font-medium">{model.holdings.length} position{model.holdings.length !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(model.updated_at)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-text-light group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { useModels } from '@/lib/hooks/useModels';
import { useClients } from '@/lib/hooks/useClients';
import { ACCOUNT_TYPES, ASSET_CLASSES, REGIONS } from '@/lib/utils/constants';
import { Save, Rocket } from 'lucide-react';

const currencies = [
  { value: 'CAD', label: 'CAD — Dollar canadien' },
  { value: 'USD', label: 'USD — Dollar américain' },
];

function NewPortfolioForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { models } = useModels();
  const { clients } = useClients();
  const [loading, setLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');
  const clientId = searchParams.get('client') || '';

  const selectedModel = models?.find((m) => m.id === selectedModelId);

  const modelOptions = [
    { value: '', label: 'Aucun (portefeuille vide)' },
    ...(models || []).map((m) => ({ value: m.id, label: `${m.name} (${m.holdings.length} positions)` })),
  ];

  const clientOptions = [
    { value: '', label: 'Entrer l\'ID manuellement' },
    ...(clients || []).map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })),
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          client_id: form.get('client_id'),
          account_type: form.get('account_type'),
          currency: form.get('currency'),
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      toast('success', 'Portefeuille créé');

      // If a model was selected, suggest applying it
      if (selectedModelId) {
        router.push(`/models/${selectedModelId}/apply`);
      } else {
        router.push(`/portfolios/${data.id}`);
      }
    } catch {
      toast('error', 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Model selector */}
      <Card>
        <h3 className="font-semibold text-text-main mb-3 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-brand-primary" />
          Partir d&apos;un modèle
        </h3>
        <Select
          label="Modèle de portefeuille"
          options={modelOptions}
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
        />

        {selectedModel && (
          <div className="mt-4 p-3 bg-bg-light rounded-lg">
            <p className="text-xs font-semibold text-text-muted mb-2">
              Composition du modèle ({selectedModel.holdings.length} positions)
            </p>
            <div className="space-y-1">
              {selectedModel.holdings.map((h, i) => {
                const assetLabel = ASSET_CLASSES.find(a => a.value === h.asset_class)?.label || h.asset_class;
                const regionLabel = REGIONS.find(r => r.value === h.region)?.label || h.region;
                return (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-mono text-brand-primary">{h.symbol}</span>
                    <span className="text-text-muted">{h.name}</span>
                    <span className="font-semibold">{h.weight}%</span>
                    <span className="text-text-muted">{assetLabel}</span>
                    <span className="text-text-muted">{regionLabel}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-muted mt-3">
              Après la création du portefeuille, vous serez redirigé vers la page d&apos;application du modèle pour définir les montants.
            </p>
          </div>
        )}
      </Card>

      {/* Portfolio form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input name="name" label="Nom du portefeuille" placeholder="Ex: REER — Croissance" required />

          <Select
            label="Client"
            options={clientOptions}
            value={clientId}
            onChange={() => {}}
            name="client_select"
          />
          <Input name="client_id" label="ID Client" defaultValue={clientId} required hint="Sélectionnez un client ci-dessus ou entrez l'ID" />

          <div className="grid grid-cols-2 gap-4">
            <Select name="account_type" label="Type de compte" options={ACCOUNT_TYPES} />
            <Select name="currency" label="Devise" options={currencies} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
            {selectedModelId ? (
              <Link href={`/models/${selectedModelId}/apply`}>
                <Button type="button" icon={<Rocket className="h-4 w-4" />}>
                  Appliquer le modèle directement
                </Button>
              </Link>
            ) : null}
            <Button type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>Créer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function NewPortfolioPage() {
  return (
    <div>
      <PageHeader title="Nouveau portefeuille" />
      <Suspense fallback={<div className="flex justify-center py-12"><Spinner size="lg" /></div>}>
        <NewPortfolioForm />
      </Suspense>
    </div>
  );
}

'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { ACCOUNT_TYPES } from '@/lib/utils/constants';
import { Save } from 'lucide-react';

const currencies = [
  { value: 'CAD', label: 'CAD — Dollar canadien' },
  { value: 'USD', label: 'USD — Dollar américain' },
];

function NewPortfolioForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const clientId = searchParams.get('client') || '';

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
      router.push(`/portfolios/${data.id}`);
    } catch {
      toast('error', 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input name="name" label="Nom du portefeuille" placeholder="Ex: REER — Croissance" required />
        <Input name="client_id" label="ID Client" defaultValue={clientId} required hint="Sélectionnez un client" />
        <div className="grid grid-cols-2 gap-4">
          <Select name="account_type" label="Type de compte" options={ACCOUNT_TYPES} />
          <Select name="currency" label="Devise" options={currencies} />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
          <Button type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>Créer</Button>
        </div>
      </form>
    </Card>
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

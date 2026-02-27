'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { RISK_PROFILES } from '@/lib/utils/constants';
import { Save } from 'lucide-react';

const clientTypes = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
];

export default function NewClientPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.get('first_name'),
          last_name: form.get('last_name'),
          email: form.get('email'),
          phone: form.get('phone'),
          type: form.get('type'),
          risk_profile: form.get('risk_profile'),
          objectives: form.get('objectives'),
          investment_horizon: form.get('investment_horizon'),
        }),
      });

      if (!res.ok) throw new Error('Erreur lors de la création');

      toast('success', 'Client créé avec succès');
      router.push('/clients');
    } catch {
      toast('error', 'Erreur lors de la création du client');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Nouveau client" description="Ajoutez un nouveau client ou prospect" />

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input name="first_name" label="Prénom" required />
            <Input name="last_name" label="Nom" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="email" type="email" label="Courriel" />
            <Input name="phone" label="Téléphone" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select name="type" label="Type" options={clientTypes} />
            <Select name="risk_profile" label="Profil de risque" options={RISK_PROFILES} />
          </div>
          <Input name="objectives" label="Objectifs" placeholder="Ex: Retraite dans 15 ans, accumulation" />
          <Input name="investment_horizon" label="Horizon de placement" placeholder="Ex: 15 ans" />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

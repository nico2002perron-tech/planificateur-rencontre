'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { useClient } from '@/lib/hooks/useClients';
import { RISK_PROFILES } from '@/lib/utils/constants';
import { Save } from 'lucide-react';

const clientTypes = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
];

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { client, isLoading } = useClient(id);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    type: 'prospect',
    risk_profile: 'EQUILIBRE',
    objectives: '',
    investment_horizon: '',
  });

  useEffect(() => {
    if (client) {
      setForm({
        first_name: client.first_name || '',
        last_name: client.last_name || '',
        email: client.email || '',
        phone: client.phone || '',
        type: client.type || 'prospect',
        risk_profile: client.risk_profile || 'EQUILIBRE',
        objectives: client.objectives || '',
        investment_horizon: client.investment_horizon || '',
      });
    }
  }, [client]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast('success', 'Client mis à jour');
      router.push(`/clients/${id}`);
    } catch {
      toast('error', 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader title="Modifier le client" />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Prénom" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            <Input label="Nom" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Courriel" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" options={clientTypes} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
            <Select label="Profil de risque" options={RISK_PROFILES} value={form.risk_profile} onChange={(e) => setForm({ ...form, risk_profile: e.target.value })} />
          </div>
          <Input label="Objectifs" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} />
          <Input label="Horizon de placement" value={form.investment_horizon} onChange={(e) => setForm({ ...form, investment_horizon: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
            <Button type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

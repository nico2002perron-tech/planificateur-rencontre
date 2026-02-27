'use client';

import { use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useClient } from '@/lib/hooks/useClients';
import { Pencil, Briefcase, FileText } from 'lucide-react';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { client, isLoading } = useClient(id);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!client) return <p className="text-text-muted p-6">Client introuvable</p>;

  return (
    <div>
      <PageHeader
        title={`${client.first_name} ${client.last_name}`}
        description={`${client.type} — ${client.risk_profile}`}
        action={
          <div className="flex gap-2">
            <Link href={`/clients/${id}/edit`}>
              <Button variant="outline" icon={<Pencil className="h-4 w-4" />}>Modifier</Button>
            </Link>
            <Link href={`/portfolios/new?client=${id}`}>
              <Button icon={<Briefcase className="h-4 w-4" />}>Nouveau portefeuille</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardTitle>Informations</CardTitle>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <p className="text-text-muted">Courriel</p>
                <p className="font-medium">{client.email || '—'}</p>
              </div>
              <div>
                <p className="text-text-muted">Téléphone</p>
                <p className="font-medium">{client.phone || '—'}</p>
              </div>
              <div>
                <p className="text-text-muted">Objectifs</p>
                <p className="font-medium">{client.objectives || '—'}</p>
              </div>
              <div>
                <p className="text-text-muted">Horizon</p>
                <p className="font-medium">{client.investment_horizon || '—'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Portefeuilles</CardTitle>
              <Link href={`/portfolios/new?client=${id}`}>
                <Button variant="ghost" size="sm">+ Ajouter</Button>
              </Link>
            </div>
            <p className="text-sm text-text-muted">Les portefeuilles de ce client apparaîtront ici.</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Profil</CardTitle>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-muted">Type</span>
                <Badge>{client.type}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-muted">Risque</span>
                <Badge variant="info">{client.risk_profile}</Badge>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Actions</CardTitle>
            <div className="mt-4 space-y-2">
              <Link href={`/reports/new?client=${id}`} className="block">
                <Button variant="outline" className="w-full justify-start" icon={<FileText className="h-4 w-4" />}>
                  Générer un rapport
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

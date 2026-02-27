'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Plus, Users, Phone, Mail } from 'lucide-react';
import { useClients } from '@/lib/hooks/useClients';
import { Spinner } from '@/components/ui/Spinner';

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const { clients, isLoading } = useClients();

  const filtered = clients?.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Gérez vos clients et prospects"
        action={
          <Link href="/clients/new">
            <Button icon={<Plus className="h-4 w-4" />}>Nouveau client</Button>
          </Link>
        }
      />

      <div className="mb-6">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Rechercher un client..."
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="h-12 w-12 text-text-light mx-auto mb-3" />
          <p className="text-text-muted">
            {search ? 'Aucun client trouvé' : 'Aucun client pour le moment'}
          </p>
          {!search && (
            <Link href="/clients/new" className="mt-4 inline-block">
              <Button variant="outline" size="sm">Ajouter un premier client</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-text-main">
                      {client.first_name} {client.last_name}
                    </h3>
                    <p className="text-xs text-text-muted capitalize">{client.type}</p>
                  </div>
                  <Badge variant={client.risk_profile === 'DYNAMIQUE' ? 'danger' : client.risk_profile === 'CONSERVATEUR' ? 'success' : 'info'}>
                    {client.risk_profile}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-sm text-text-muted">
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> {client.email}
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" /> {client.phone}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

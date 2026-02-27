'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { Spinner } from '@/components/ui/Spinner';
import { usePortfolios } from '@/lib/hooks/usePortfolio';
import { Plus, Briefcase } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export default function PortfoliosPage() {
  const [search, setSearch] = useState('');
  const { portfolios, isLoading } = usePortfolios();

  const filtered = portfolios?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div>
      <PageHeader
        title="Portefeuilles"
        description="Gérez les portefeuilles de vos clients"
        action={
          <Link href="/portfolios/new">
            <Button icon={<Plus className="h-4 w-4" />}>Nouveau portefeuille</Button>
          </Link>
        }
      />

      <div className="mb-6">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Rechercher un portefeuille..."
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <Briefcase className="h-12 w-12 text-text-light mx-auto mb-3" />
          <p className="text-text-muted">
            {search ? 'Aucun portefeuille trouvé' : 'Aucun portefeuille pour le moment'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((portfolio) => (
            <Link key={portfolio.id} href={`/portfolios/${portfolio.id}`}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-text-main">{portfolio.name}</h3>
                  <Badge>{portfolio.account_type}</Badge>
                </div>
                <p className="text-xs text-text-muted mb-2">{portfolio.client_name}</p>
                <p className="text-lg font-bold text-text-main">
                  {formatCurrency(portfolio.total_value || 0, portfolio.currency)}
                </p>
                <p className="text-xs text-text-muted mt-1">{portfolio.holdings_count} positions</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

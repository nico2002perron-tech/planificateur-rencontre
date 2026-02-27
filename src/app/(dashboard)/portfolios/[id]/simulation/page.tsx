'use client';

import { use } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { TrendingUp } from 'lucide-react';

export default function SimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div>
      <PageHeader
        title="Simulation de scénarios"
        description="Projections bull / base / bear et stress tests"
      />
      <Card className="text-center py-16">
        <TrendingUp className="h-16 w-16 text-text-light mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-main mb-2">Simulateur de scénarios</h3>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          Le simulateur de scénarios (bull, base, bear) et les stress tests
          (2008, 2020, 2022) apparaîtront ici.
        </p>
        <p className="text-xs text-text-light mt-4">Portefeuille: {id}</p>
      </Card>
    </div>
  );
}

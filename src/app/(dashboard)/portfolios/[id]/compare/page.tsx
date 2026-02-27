'use client';

import { use } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { BarChart3 } from 'lucide-react';

export default function ComparePortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div>
      <PageHeader
        title="Comparaison de performance"
        description="Portefeuille vs indices de référence"
      />
      <Card className="text-center py-16">
        <BarChart3 className="h-16 w-16 text-text-light mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-main mb-2">Comparaison avec benchmarks</h3>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          Les graphiques de performance comparée (S&amp;P/TSX, S&amp;P 500, MSCI World)
          apparaîtront ici une fois les données historiques chargées.
        </p>
        <p className="text-xs text-text-light mt-4">Portefeuille: {id}</p>
      </Card>
    </div>
  );
}

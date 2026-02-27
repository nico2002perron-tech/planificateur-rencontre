'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Plus } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Rapports"
        description="Rapports PDF générés pour les rencontres clients"
        action={
          <Link href="/reports/new">
            <Button icon={<Plus className="h-4 w-4" />}>Nouveau rapport</Button>
          </Link>
        }
      />
      <Card className="text-center py-16">
        <FileText className="h-16 w-16 text-text-light mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-main mb-2">Rapports de rencontre</h3>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          Générez des rapports PDF professionnels avec la composition du portefeuille,
          la performance, les cibles analystes et les scénarios.
        </p>
      </Card>
    </div>
  );
}

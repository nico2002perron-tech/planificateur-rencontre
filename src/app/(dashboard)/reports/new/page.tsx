'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText } from 'lucide-react';

export default function NewReportPage() {
  return (
    <div>
      <PageHeader title="Nouveau rapport" description="Configurez et générez un rapport PDF" />
      <Card className="text-center py-16">
        <FileText className="h-16 w-16 text-text-light mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-main mb-2">Assistant de rapport</h3>
        <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
          Sélectionnez un client et un portefeuille, personnalisez les sections du rapport,
          puis générez le PDF professionnel.
        </p>
        <Button disabled>Générer le rapport (bientôt disponible)</Button>
      </Card>
    </div>
  );
}

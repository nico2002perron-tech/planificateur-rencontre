import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Settings } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div>
      <PageHeader title="Paramètres" description="Configuration de l'application" />
      <Card className="text-center py-16">
        <Settings className="h-16 w-16 text-text-light mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-main mb-2">Paramètres système</h3>
        <p className="text-sm text-text-muted">La configuration système sera disponible dans la phase 2.</p>
      </Card>
    </div>
  );
}

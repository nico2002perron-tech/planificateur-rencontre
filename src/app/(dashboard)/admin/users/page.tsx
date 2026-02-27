import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Users } from 'lucide-react';

export default function AdminUsersPage() {
  return (
    <div>
      <PageHeader title="Gestion des utilisateurs" description="Ajouter, modifier ou désactiver des comptes conseillers" />
      <Card className="text-center py-16">
        <Users className="h-16 w-16 text-text-light mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-main mb-2">Utilisateurs</h3>
        <p className="text-sm text-text-muted">La gestion des utilisateurs sera disponible dans la phase 2.</p>
      </Card>
    </div>
  );
}

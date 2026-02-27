import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Settings, Users, Shield } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Administration"
        description="Gestion des utilisateurs et paramètres système"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/users">
          <Card hover className="text-center py-8">
            <Users className="h-10 w-10 text-brand-primary mx-auto mb-3" />
            <h3 className="font-semibold">Utilisateurs</h3>
            <p className="text-sm text-text-muted mt-1">Gérer les conseillers et accès</p>
          </Card>
        </Link>
        <Link href="/admin/settings">
          <Card hover className="text-center py-8">
            <Settings className="h-10 w-10 text-brand-primary mx-auto mb-3" />
            <h3 className="font-semibold">Paramètres</h3>
            <p className="text-sm text-text-muted mt-1">Configuration de l&apos;application</p>
          </Card>
        </Link>
        <Card className="text-center py-8">
          <Shield className="h-10 w-10 text-brand-primary mx-auto mb-3" />
          <h3 className="font-semibold">Sécurité</h3>
          <p className="text-sm text-text-muted mt-1">Logs et audit</p>
        </Card>
      </div>
    </div>
  );
}

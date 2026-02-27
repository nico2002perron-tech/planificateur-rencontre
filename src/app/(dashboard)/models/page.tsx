import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { PieChart } from 'lucide-react';

export default function ModelsPage() {
  return (
    <div>
      <PageHeader
        title="Portefeuilles modèles"
        description="Modèles de répartition prédéfinis par profil de risque"
      />
      <Card className="text-center py-16">
        <PieChart className="h-16 w-16 text-text-light mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-main mb-2">Modèles de portefeuille</h3>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          Créez et gérez vos portefeuilles modèles (Conservateur, Équilibré, Croissance, etc.)
          pour les appliquer rapidement aux nouveaux clients.
        </p>
      </Card>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { estLocal } from '@/lib/base-locale/mode';
import { racineBaseLocale } from '@/lib/base-locale/chemins';
import { EcranFiscal } from './EcranFiscal';

// LOCAL SEULEMENT : cette page manipule des profils fiscaux et la table de
// correspondance pseudonyme → nom. 404 hors du poste du planificateur.
export const dynamic = 'force-dynamic';

export default async function PageFiscale() {
  if (!estLocal()) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Optimisations fiscales</h1>
        <p className="mt-1 text-sm text-text-muted">
          Détecter ce qu’il y a à aller chercher pour un client, et en sortir un document daté.
          Les dossiers vivent sur ce poste uniquement ; le fichier de profil ne contient jamais de
          nom — la table de correspondance fait le lien, et seulement en local.
        </p>
      </div>
      <EcranFiscal racine={racineBaseLocale() + String.fromCharCode(92) + 'profils'} />
    </div>
  );
}

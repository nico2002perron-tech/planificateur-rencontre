import { notFound } from 'next/navigation';
import { UserCog, HardDrive } from 'lucide-react';
import { estLocal } from '@/lib/base-locale/mode';
import { racineBaseLocale } from '@/lib/base-locale/chemins';
import { listerProfils } from '@/lib/profils/stockage';
import { EcranProfils } from './EcranProfils';

// LOCAL SEULEMENT : cette page manipule des profils fiscaux et la table de
// correspondance pseudonyme → nom. 404 hors du poste du planificateur.
export const dynamic = 'force-dynamic';

export default async function PageProfils() {
  if (!estLocal()) notFound();
  // La page ne sert qu'a l'ossature : le resume derive de chaque profil arrive
  // par l'API au montage, pour ne pas bloquer le rendu sur la lecture de tous
  // les grands livres.
  const profils = (await listerProfils()).map((p) => ({ ...p, celi: null }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Profils fiscaux</h1>
        <p className="mt-1 text-sm text-text-muted">
          Les profils vivent sur ce poste uniquement. Le fichier de profil ne contient
          jamais de nom : la table de correspondance fait le lien, et seulement en local.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <HardDrive className="h-4 w-4 shrink-0 text-text-muted" />
        <code className="font-mono text-text-main">{racineBaseLocale()}\profils</code>
        <span className="ml-auto text-text-muted">
          {profils.length} profil{profils.length > 1 ? 's' : ''}
        </span>
      </div>

      {profils.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <UserCog className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            Aucun profil pour l&apos;instant. Créez-en un en important l&apos;historique
            complet d&apos;un client ci-dessous.
          </p>
        </div>
      ) : null}

      <EcranProfils profilsInitiaux={profils} />
    </div>
  );
}

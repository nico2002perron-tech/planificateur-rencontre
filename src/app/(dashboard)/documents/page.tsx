import { notFound } from 'next/navigation';
import { FolderOpen, FileText, HardDrive } from 'lucide-react';
import { estLocal } from '@/lib/base-locale/mode';
import { racineBaseLocale } from '@/lib/base-locale/chemins';
import { inventorierDocuments } from '@/lib/base-locale/inventaire';

// ÉCRAN LOCAL SEULEMENT. Il liste des dossiers portant des NOMS DE CLIENTS :
// sur Vercel il n'existe pas du tout (404), et le rendu est fait côté serveur
// pour qu'aucun de ces noms ne transite par une API publique.
export const dynamic = 'force-dynamic';

function taille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

const ETIQUETTES: Record<string, string> = {
  'cours-cibles': 'Cours cibles',
  'rencontre-complete': 'Rencontre complète',
  proposition: 'Proposition',
};

export default async function PageDocuments() {
  if (!estLocal()) notFound();

  const clients = await inventorierDocuments();
  const racine = racineBaseLocale();
  const total = clients.reduce((s, c) => s + c.documents.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Documents</h1>
        <p className="mt-1 text-sm text-text-muted">
          Les documents générés sur ce poste, classés par client. Cette page n&apos;existe
          qu&apos;en exécution locale — rien de tout ceci ne quitte la machine.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
        <HardDrive className="h-4 w-4 shrink-0 text-text-muted" />
        <span className="text-text-muted">Base locale :</span>
        <code className="font-mono text-text-main">{racine}</code>
        <span className="ml-auto text-text-muted">
          {clients.length} client{clients.length > 1 ? 's' : ''} · {total} document{total > 1 ? 's' : ''}
        </span>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-6 py-12 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            Aucun document archivé pour l&apos;instant. Générez un rapport de cours cibles :
            il sera rangé ici automatiquement.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <section key={client.dossier} className="rounded-lg border border-gray-200 bg-white">
              <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
                <FolderOpen className="h-4 w-4 text-brand-primary" />
                <h2 className="font-semibold text-text-main">{client.dossier}</h2>
                <span className="ml-auto text-xs text-text-muted">
                  {client.documents.length} document{client.documents.length > 1 ? 's' : ''}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {client.documents.map((doc) => (
                  <li key={doc.chemin} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                    <span className="font-medium text-text-main">
                      {ETIQUETTES[doc.type] ?? doc.type}
                    </span>
                    <span className="text-text-muted">{doc.date}</span>
                    <span className="ml-auto tabular-nums text-xs text-text-muted">
                      {taille(doc.octets)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

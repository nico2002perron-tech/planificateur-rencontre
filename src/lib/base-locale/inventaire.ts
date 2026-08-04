// L'INVENTAIRE DE LA BASE LOCALE — ce qui est sur le disque, par client.
//
// Lecture seule. Sert l'écran « Documents » et, plus tard, la sélection d'un
// client pour son profil fiscal.
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { estLocal } from './mode';
import { racineBaseLocale } from './chemins';

export type DocumentLocal = {
  nom: string;
  chemin: string;
  octets: number;
  date: string;          // AAAA-MM-JJ tiré du nom de fichier, sinon date du fichier
  type: string;          // « cours-cibles », « rencontre-complete »…
};

export type ClientLocal = {
  dossier: string;       // « Tremblay-Marc »
  chemin: string;
  documents: DocumentLocal[];
};

/** Découpe « 2026-08-04_cours-cibles_2.pdf » en sa date et son type. */
function lireNomFichier(nom: string): { date: string | null; type: string } {
  const m = /^(\d{4}-\d{2}-\d{2})_(.+?)(?:_\d+)?\.pdf$/i.exec(nom);
  if (!m) return { date: null, type: 'document' };
  return { date: m[1], type: m[2] };
}

/**
 * Liste les clients et leurs documents, du plus récemment modifié au plus
 * ancien. Retourne une liste vide hors exécution locale ou si la base n'existe
 * pas encore — jamais d'erreur : un dossier absent n'est pas une panne.
 */
export async function inventorierDocuments(): Promise<ClientLocal[]> {
  if (!estLocal()) return [];

  const racineDocs = path.join(racineBaseLocale(), 'documents');
  let dossiers: string[];
  try {
    const entrees = await fs.readdir(racineDocs, { withFileTypes: true });
    dossiers = entrees.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }

  const clients: ClientLocal[] = [];
  for (const dossier of dossiers) {
    const cheminClient = path.join(racineDocs, dossier);
    let fichiers: string[];
    try {
      fichiers = (await fs.readdir(cheminClient)).filter((f) => f.toLowerCase().endsWith('.pdf'));
    } catch {
      continue;
    }

    const documents: DocumentLocal[] = [];
    for (const nom of fichiers) {
      const chemin = path.join(cheminClient, nom);
      try {
        const st = await fs.stat(chemin);
        const { date, type } = lireNomFichier(nom);
        documents.push({
          nom,
          chemin,
          octets: st.size,
          date: date || st.mtime.toISOString().slice(0, 10),
          type,
        });
      } catch {
        // Fichier disparu entre le readdir et le stat : on l'ignore.
      }
    }
    if (!documents.length) continue;
    documents.sort((a, b) => b.date.localeCompare(a.date) || b.nom.localeCompare(a.nom));
    clients.push({ dossier, chemin: cheminClient, documents });
  }

  clients.sort((a, b) => {
    const da = a.documents[0]?.date ?? '';
    const db = b.documents[0]?.date ?? '';
    return db.localeCompare(da) || a.dossier.localeCompare(b.dossier);
  });
  return clients;
}

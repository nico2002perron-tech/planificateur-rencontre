// L'ARCHIVAGE DES DOCUMENTS SUR LE DISQUE LOCAL.
//
// Appelé depuis les routes de génération PDF, APRÈS que les octets du document
// soient prêts. Le PDF est déjà complet en mémoire (rendu 100 % serveur) : il
// n'y a qu'à l'écrire au bon endroit.
//
// RÈGLE ABSOLUE : l'archivage ne doit JAMAIS faire échouer une génération.
// Disque plein, dossier en lecture seule, chemin invalide — le document part
// quand même vers le navigateur. Un archivage raté se signale, il ne bloque pas
// une rencontre client.
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { estLocal } from './mode';
import {
  dossierDocuments,
  nomFichierDocument,
  racineBaseLocale,
  SOUS_DOSSIERS,
  type TypeDocument,
} from './chemins';

export type ResultatArchivage =
  | { archive: true; chemin: string }
  | { archive: false; raison: 'hors-local' | 'sans-nom-client' | 'erreur'; details?: string };

/** Crée l'arborescence de la base locale si elle n'existe pas encore. */
export async function preparerBaseLocale(): Promise<void> {
  const racine = racineBaseLocale();
  await fs.mkdir(racine, { recursive: true });
  for (const sous of SOUS_DOSSIERS) {
    await fs.mkdir(path.join(racine, sous), { recursive: true });
  }
}

/** Vrai si le chemin existe déjà sur le disque. */
async function existe(chemin: string): Promise<boolean> {
  try {
    await fs.access(chemin);
    return true;
  } catch {
    return false;
  }
}

/**
 * Écrit un document dans donnees-locales/documents/<Nom-Client>/.
 *
 * Ne fait rien hors exécution locale (sur Vercel, un serveur ne peut pas écrire
 * sur le disque de l'utilisateur — et ne doit pas essayer).
 *
 * Si un document du même type existe déjà pour la même date, suffixe _2, _3…
 * plutôt que d'écraser : deux versions produites le même jour sont deux
 * livrables distincts, pas une erreur.
 */
export async function archiverDocument(params: {
  octets: Uint8Array;
  nomClient: string | undefined | null;
  type: TypeDocument;
  date?: string;
}): Promise<ResultatArchivage> {
  if (!estLocal()) return { archive: false, raison: 'hors-local' };

  const nomClient = params.nomClient?.trim();
  if (!nomClient) return { archive: false, raison: 'sans-nom-client' };

  try {
    await preparerBaseLocale();
    const dossier = dossierDocuments(nomClient);
    await fs.mkdir(dossier, { recursive: true });

    const date = params.date || new Date().toISOString().slice(0, 10);
    let suffixe = 0;
    let chemin = path.join(dossier, nomFichierDocument(params.type, date, suffixe));
    while (await existe(chemin)) {
      suffixe += 1;
      if (suffixe > 50) break;          // garde-fou : jamais de boucle infinie
      chemin = path.join(dossier, nomFichierDocument(params.type, date, suffixe));
    }

    // DÉFENSE EN PROFONDEUR CONTRE LA TRAVERSÉE DE CHEMIN. `nomDossierClient`
    // retire déjà les barres obliques et les points, donc « ../.. » ne survit
    // pas au nettoyage — mais on ne se fie pas à un nettoyage pour une écriture
    // disque. On vérifie que la cible est RÉELLEMENT sous la racine avant
    // d'écrire ; si un jour la normalisation change, cette garde tient encore.
    const racine = path.resolve(racineBaseLocale());
    const cible = path.resolve(chemin);
    if (cible !== racine && !cible.startsWith(racine + path.sep)) {
      console.error('[base-locale] chemin hors racine, écriture refusée :', cible);
      return { archive: false, raison: 'erreur', details: 'chemin hors racine' };
    }

    await fs.writeFile(chemin, params.octets);
    return { archive: true, chemin };
  } catch (err) {
    // On avale l'erreur À DESSEIN : voir la règle absolue en tête de fichier.
    const details = err instanceof Error ? err.message : String(err);
    console.error('[base-locale] archivage impossible :', details);
    return { archive: false, raison: 'erreur', details };
  }
}

/**
 * Les en-têtes de réponse qui disent au navigateur où le document a été rangé.
 *
 * Le CHEMIN contient le nom du client. On ne l'expose donc que si l'archivage a
 * réellement eu lieu — ce qui n'arrive qu'en local, où la réponse va du serveur
 * Node au navigateur de la même machine, sans proxy ni journal intermédiaire.
 * Hors local, aucun en-tête n'est ajouté : le comportement est identique à
 * aujourd'hui, au bit près.
 */
export function entetesArchivage(r: ResultatArchivage): Record<string, string> {
  if (r.archive) {
    return {
      'X-Archive-Local': 'ok',
      // encodeURIComponent : un en-tête HTTP n'accepte que de l'ASCII, et les
      // chemins portent des accents (« Bélanger »). Le client décode.
      'X-Archive-Chemin': encodeURIComponent(r.chemin),
    };
  }
  if (r.raison === 'hors-local') return {};
  return { 'X-Archive-Local': r.raison };
}

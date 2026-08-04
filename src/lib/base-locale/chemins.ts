// LES CHEMINS DE LA BASE LOCALE — et la normalisation des noms de clients.
//
// Aucune écriture ici : ce module ne fait que CALCULER des chemins et nettoyer
// des noms. Il est testable sans toucher au disque.
import 'server-only';
import path from 'node:path';

/**
 * La racine de la base locale.
 *
 * DÉFAUT HORS DU PROJET, ET C'EST VOULU : le dépôt vit sous « OneDrive - IA
 * Private Wealth ». Écrire les profils fiscaux et les documents clients dans le
 * dossier du projet les enverrait se synchroniser chez Microsoft — exactement
 * ce que ce chantier cherche à éviter. Le défaut est donc un chemin neutre,
 * hors de toute synchronisation.
 *
 * Surchargeable par BASE_LOCALE_RACINE dans .env.local (non commité).
 */
export function racineBaseLocale(): string {
  const surcharge = process.env.BASE_LOCALE_RACINE?.trim();
  if (surcharge) return path.resolve(surcharge);
  return process.platform === 'win32'
    ? 'C:\\planificateur-donnees'
    : path.join(process.env.HOME || '.', 'planificateur-donnees');
}

export const SOUS_DOSSIERS = ['documents', 'profils', 'historiques'] as const;

export type TypeDocument = 'cours-cibles' | 'rencontre-complete' | 'proposition';

/**
 * Rend un nom de client utilisable comme nom de dossier, SANS le rendre
 * illisible : « Bélanger-D'Amour, Jean » devient « Belanger-DAmour-Jean », pas
 * un identifiant opaque. Le planificateur doit pouvoir reconnaître ses dossiers
 * d'un coup d'œil dans l'explorateur.
 *
 * Traitements, dans l'ordre : accents retirés (NFD + suppression des diacri-
 * tiques), caractères interdits par Windows (\ / : * ? " < > |) retirés, points
 * et espaces de fin retirés (Windows les refuse en fin de nom), séparateurs
 * réduits à un seul tiret.
 */
export function nomDossierClient(nom: string): string {
  const sansAccents = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const nettoye = sansAccents
    .replace(/[\\/:*?"<>|]/g, '')     // interdits Windows
    .replace(/['’.,]/g, '')            // apostrophes et ponctuation
    .replace(/[\s_]+/g, '-')           // espaces → tiret
    .replace(/-+/g, '-')               // tirets multiples → un seul
    .replace(/^-|-$/g, '')             // pas de tiret en bordure
    .trim();
  // Noms réservés de Windows (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
  const reserve = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  const sur = reserve.test(nettoye) ? `${nettoye}-client` : nettoye;
  return sur.slice(0, 120) || 'Client-sans-nom';
}

/** Le dossier des documents d'un client. */
export function dossierDocuments(nomClient: string): string {
  return path.join(racineBaseLocale(), 'documents', nomDossierClient(nomClient));
}

/**
 * Le nom de fichier d'un document : AAAA-MM-JJ_<type>.pdf.
 * Le suffixe (_2, _3…) est ajouté par l'archiveur, qui seul connaît l'état
 * du disque.
 */
export function nomFichierDocument(type: TypeDocument, date: string, suffixe = 0): string {
  const n = suffixe > 0 ? `_${suffixe + 1}` : '';
  return `${date}_${type}${n}.pdf`;
}

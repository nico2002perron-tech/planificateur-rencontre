// LES LOGOS, MÉMORISÉS SUR LE POSTE — pour que le volet fiscal reste muet.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI UN CACHE PLUTÔT QU'UN APPEL.
//
// Mettre le logo des titres sur le plan de récolte demandait de les chercher
// chez le fournisseur (FMP). Le faire depuis le document fiscal aurait ouvert
// une sortie réseau dans le seul volet de l'application qui n'en a aucune — et
// cette sortie aurait transporté les SYMBOLES des positions d'un client, c'est-
// à-dire la composition de son portefeuille. La règle du dépôt est explicite :
// « une nouvelle catégorie de données sur un vieux tuyau est un nouvel usage,
// pas un usage couvert ».
//
// Donc : les cours cibles vont déjà chercher ces logos (ce flux-là sort déjà,
// et il est inventorié). On les GARDE en passant, et le document fiscal ne lit
// que ce qui est déjà sur le disque. Zéro appel depuis le volet fiscal.
//
// C'est le principe du 12 août appliqué à autre chose que des transactions :
// le geste quotidien nourrit la base, et la base sert le reste.
//
// UN LOGO ABSENT N'EST PAS UNE ERREUR : le plan s'affiche sans, comme avant.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { estLocal } from './mode';
import { racineBaseLocale } from './chemins';

function dossierLogos(): string {
  return path.join(racineBaseLocale(), 'logos');
}

/**
 * Le nom de fichier d'un symbole.
 *
 * Un symbole vient d'un fichier tiers : il ne devient JAMAIS un chemin tel
 * quel. On ne garde que les caractères d'un symbole boursier — sans quoi un
 * « ../ » sortirait du dossier. Rend `null` si rien ne survit.
 */
function fichierPour(symbole: string): string | null {
  const propre = (symbole ?? '').trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
  if (propre.length === 0 || propre.length > 24) return null;
  // Retirer les séparateurs ne suffit pas : « ../../evade » devient
  // « ....EVADE », qui ne sort d'aucun dossier mais n'est plus un symbole. On
  // exige au moins une lettre ou un chiffre, et on refuse toute suite de deux
  // points — un nom de fichier qui ressemble à un chemin n'a rien à faire ici.
  if (!/[A-Z0-9]/.test(propre) || propre.includes('..')) return null;
  return `${propre}.txt`;
}

/**
 * Garde les logos rapportés par un flux qui sortait DÉJÀ (les cours cibles).
 *
 * N'échoue jamais : un cache est un confort, pas une dépendance. Rend le
 * nombre de logos nouvellement écrits, pour que l'appelant puisse le dire.
 */
export async function memoriserLogos(logos: Record<string, string> | undefined): Promise<number> {
  if (!estLocal() || !logos) return 0;
  let ecrits = 0;
  try {
    await fs.mkdir(dossierLogos(), { recursive: true });
    for (const [symbole, uri] of Object.entries(logos)) {
      const fichier = fichierPour(symbole);
      if (!fichier || !uri.startsWith('data:image/')) continue;
      const chemin = path.join(dossierLogos(), fichier);
      try {
        // Déjà connu : on ne réécrit pas pour rien.
        await fs.access(chemin);
        continue;
      } catch { /* absent : on l'écrit */ }
      await fs.writeFile(chemin, uri, 'utf8');
      ecrits += 1;
    }
  } catch (e) {
    console.warn('[logos] mémorisation impossible :', e);
  }
  return ecrits;
}

/**
 * Les logos déjà sur le disque, pour les symboles demandés.
 *
 * Ne va JAMAIS les chercher : ce qui manque manque, et le document s'affiche
 * sans. C'est ce qui garde le volet fiscal sans aucune sortie réseau.
 */
export async function logosMemorises(symboles: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!estLocal()) return out;
  for (const symbole of new Set(symboles)) {
    const fichier = fichierPour(symbole);
    if (!fichier) continue;
    try {
      const uri = await fs.readFile(path.join(dossierLogos(), fichier), 'utf8');
      if (uri.startsWith('data:image/')) out[symbole] = uri;
    } catch { /* pas de logo pour ce titre : très bien */ }
  }
  return out;
}

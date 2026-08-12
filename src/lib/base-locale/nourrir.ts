// NOURRIR LA BASE LOCALE DEPUIS LES COURS CIBLES — le principe de Nicolas.
//
// « Ma base de données se fera nourrir au fur et à mesure que je vais faire
// des cours cibles — c'est le fonctionnement que je veux, et ce sera la seule
// façon. Tout sur mon ordi seulement. » (12 août 2026)
//
// ─────────────────────────────────────────────────────────────────────────────
// LE PRINCIPE : le collage des cours cibles est le geste quotidien du
// planificateur. La base fiscale s'en nourrit EN PASSANT — aucun deuxième
// collage, aucun geste de plus. Chaque génération de cours cibles pour un
// client nommé archive ses textes bruts et fusionne l'inédit au grand livre.
//
// CE QUE ÇA NE REMPLACE PAS : les cours cibles portent l'année en cours. Les
// droits CELI exigent l'historique DEPUIS L'OUVERTURE — ce collage profond
// reste un geste unique par client, dans l'écran fiscal. Le fil quotidien
// nourrit l'avenir ; le passé s'importe une fois.
//
// GARDES : ne tourne qu'en exécution locale (`estLocal()`), n'échoue JAMAIS la
// génération du document (même doctrine que l'archivage), et le brut est
// archivé TEL QUEL même quand le parseur n'en tire rien — il restera
// re-parsable le jour où le parseur s'améliorera.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { estLocal } from './mode';
import { importerCollage, archiverReleve, lireDernierReleve } from '@/lib/profils/historique';
import { parserPositions } from '@/lib/parseur-croesus/positions';

export type BilanNourrissage = {
  /** Lignes de transactions inédites fusionnées au grand livre. */
  transactionsNouvelles: number | null;
  /** Vrai si un relevé de positions a été archivé. */
  releveArchive: boolean;
};

/**
 * Nourrit la base locale avec les textes bruts d'un cours cibles.
 *
 * Le dédoublonnage du grand livre fait le reste : deux cours cibles qui se
 * chevauchent n'ajoutent que l'inédit. Rend un bilan pour l'en-tête de
 * réponse ; rend des `null`/`false` silencieux hors local ou sur erreur.
 */
export async function nourrirBaseLocale(params: {
  nomClient: string;
  transactions?: string | null;
  positions?: string | null;
  /** AAAA-MM-JJ — nomme les archives brutes ET devient la date du relevé. */
  horodatage: string;
}): Promise<BilanNourrissage> {
  const bilan: BilanNourrissage = { transactionsNouvelles: null, releveArchive: false };
  if (!estLocal() || !params.nomClient?.trim()) return bilan;

  if (params.transactions?.trim()) {
    try {
      const r = await importerCollage({
        nomClient: params.nomClient,
        texte: params.transactions,
        horodatage: params.horodatage,
      });
      bilan.transactionsNouvelles = r.nouvelles;
    } catch (e) {
      console.warn('[nourrir] transactions non importées :', e);
    }
  }

  if (params.positions?.trim()) {
    try {
      // GARDE-FOU CONTRE L'OMBRAGE. « Le relevé le plus récent fait foi »
      // (lireDernierReleve) — or le collage des cours cibles accepte des
      // formats que le parseur de relevés ne lit pas (vue verticale, exports à
      // en-têtes). Archiver un tel texte comme relevé masquerait un bon relevé
      // antérieur derrière un fichier illisible : le profil fiscal se viderait
      // en silence, chaque ligne prise isolément restant « exacte ». On
      // n'archive donc comme relevé que ce qui livre au moins une position ou
      // une encaisse au parseur de relevés.
      const lu = parserPositions(params.positions);
      if (lu.positions.length + lu.encaisses.length > 0) {
        // Regénérer le même PDF ne doit pas empiler des copies : un relevé
        // identique au dernier est déjà en place, on le dit sans réécrire.
        const dernier = await lireDernierReleve(params.nomClient);
        if (dernier?.texte === params.positions) {
          bilan.releveArchive = true;
        } else {
          await archiverReleve({
            nomClient: params.nomClient,
            texte: params.positions,
            horodatage: params.horodatage,
          });
          bilan.releveArchive = true;
        }
      }
    } catch (e) {
      console.warn('[nourrir] relevé non archivé :', e);
    }
  }

  return bilan;
}

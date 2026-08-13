// LE RÉSUMÉ D'UN PROFIL — ce que le planificateur voit à l'écran.
//
// Assemble ce que les autres modules ont dérivé : cotisations d'argent neuf,
// retraits des années passées, date d'ouverture, et le verdict des droits CELI
// (montant calculé, ou borne avec son motif).
import 'server-only';
import { lireHistorique } from './historique';
import { verdictCeliDuLivre } from './verdict-celi';
import type { ProfilClient, StatutConstat, Portee } from './types';

export type ResumeCeli = {
  /** Cotisations en ARGENT NEUF seulement — jambes appariées exclues (règle 2). */
  cotisationsTotales: number | null;
  /** Ce qui n'est PAS de l'argent neuf : apports en nature, transferts de régime. */
  apportsEnNature: number | null;
  retraitsAnneesPassees: number | null;
  dateOuverture: string | null;
  dateImport: string | null;
  /** Le plafond théorique retenu, et comment il a été obtenu. */
  plafond: number | null;
  plafondDepuis: number | null;
  plafondMaximalFauteDage: boolean;
  /** Le verdict. */
  statut: StatutConstat;
  portee: Portee;
  montant: number | null;
  borne: number | null;
  motifs: string[];
  transfertsATrancher: number;
  transfertsApparies: number;
  nbLignes: number;
};

/**
 * Le résumé CELI d'un client, prêt à afficher.
 *
 * Rien n'est deviné : un champ inconnu reste `null` et le verdict porte son
 * motif. Le montant n'apparaît QUE si les trois conditions du schéma sont
 * réunies ; sinon c'est une borne, étiquetée comme telle.
 */
export async function resumeCeli(
  profil: ProfilClient,
  nomClient: string,
  anneeCourante: number
): Promise<ResumeCeli> {
  const livre = await lireHistorique(nomClient);

  // LA CHAÎNE UNIQUE — l'écran et le moteur passent par le MÊME calcul depuis
  // le 13 août 2026. Avant, ce fichier calculait le verdict sur l'historique
  // FIGÉ à l'import puis dérivait un historique frais qui n'alimentait que
  // l'affichage : deux montants « calculés » différents pouvaient sortir dans
  // la même réponse. Voir l'en-tête de verdict-celi.ts.
  const { historique: h, observes, plafond, droits } = verdictCeliDuLivre(profil, livre, anneeCourante);

  // Les apports en nature ne sont pas dans historiqueVie : on les recalcule
  // ici pour que le planificateur voie CE QUI A ÉTÉ ÉCARTÉ, pas seulement ce
  // qui a été retenu. C'est le chiffre qui explique un écart avec son souvenir.
  const { separerCotisations } = await import('@/lib/parseur-croesus/regles');
  const { typeDeCompte } = await import('@/lib/parseur-croesus/types');
  const lignesCeli = livre.filter((l) => typeDeCompte(l.noCompte) === 'celi');
  const parCompte = new Map<string, typeof lignesCeli>();
  for (const l of lignesCeli) {
    if (!parCompte.has(l.noCompte)) parCompte.set(l.noCompte, []);
    parCompte.get(l.noCompte)!.push(l);
  }
  let apportsEnNature = 0;
  for (const [, ls] of parCompte) apportsEnNature += separerCotisations(ls).apportsEnNature;

  return {
    cotisationsTotales: h.cotisationsTotales,
    apportsEnNature: lignesCeli.length ? apportsEnNature : null,
    retraitsAnneesPassees: h.retraitsAnneesPassees,
    dateOuverture: h.dateOuverture,
    dateImport: profil.historiqueVie.celi.dateImport,
    plafond: plafond.montant,
    plafondDepuis: plafond.depuis,
    plafondMaximalFauteDage: plafond.parDefautMaximal,
    statut: droits.statut,
    portee: droits.portee,
    montant: droits.montant,
    borne: droits.borne,
    motifs: droits.conditionsManquantes,
    transfertsATrancher: droits.transfertsATrancher,
    transfertsApparies: observes.filter((t) => t.apparie).length,
    nbLignes: lignesCeli.length,
  };
}

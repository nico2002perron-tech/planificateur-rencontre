// LE RÉSUMÉ D'UN PROFIL — ce que le planificateur voit à l'écran.
//
// Assemble ce que les autres modules ont dérivé : cotisations d'argent neuf,
// retraits des années passées, date d'ouverture, et le verdict des droits CELI
// (montant calculé, ou borne avec son motif).
import 'server-only';
import { lireHistorique } from './historique';
import { observerTransferts } from './deriver';
import { croiserTransferts, calculerDroitsCeli, type TransfertDouteux } from './droits-celi';
import { plafondCeliCumulatif } from './parametres-fiscaux';
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
  const observes = observerTransferts(livre, 'celi');
  const douteux: TransfertDouteux[] = croiserTransferts(observes, profil.consolidation.transfertsResolus);

  const plafond = plafondCeliCumulatif(profil.demographie.age, anneeCourante);
  const droits = calculerDroitsCeli(profil, douteux, plafond.montant);

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

  // ON RECALCULE, on ne lit pas le profil figé.
  //
  // `historiqueVie` a été écrit au moment de l'import, avec les règles de ce
  // jour-là. Quand une règle change — et elles changent, la 5e est née le
  // 4 août — un profil importé la veille porterait un chiffre périmé sans
  // que rien ne le signale. C'est la leçon du grand livre : recalculer depuis
  // la source, toujours.
  const { deriverHistoriqueRegime } = await import('./deriver');
  const h = lignesCeli.length
    ? deriverHistoriqueRegime(livre, 'celi', anneeCourante,
        profil.historiqueVie.celi.dateImport ?? '')
    : profil.historiqueVie.celi;

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

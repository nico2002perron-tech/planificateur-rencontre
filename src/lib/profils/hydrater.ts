// L'HYDRATATION D'UN PROFIL — brancher le moteur sur ce qu'on sait déjà.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE MODULE CORRIGE (5 août 2026).
//
// `analyser()` lit `profil.comptes`, `profil.transactionsAnnee` et
// `profil.cotisationsAnnee`. Les trois étaient TOUJOURS VIDES :
//
//   · `comptes` — `deriverComptes()` existait et fonctionnait, mais son
//     résultat ne servait qu'à l'AFFICHAGE. Il n'a jamais atteint le moteur.
//     Conséquence mesurée : un client dont le relevé était importé sortait
//     quand même « indisponible » sur les 5 stratégies, parce que le moteur ne
//     voyait aucune position.
//   · `transactionsAnnee` — `deriverTransactionsAnnee()` n'était appelée que
//     dans ses propres tests. La cristallisation calculait donc toujours avec
//     0 $ de gains réalisés, c'est-à-dire jamais rien à absorber.
//   · `cotisationsAnnee` — jamais dérivée non plus, et pire : `badges.ts`
//     l'affichait en badge VERT « REER 0 $ · CELI 0 $ », un faux positif qui
//     laissait croire à une donnée établie.
//
// Le moteur était complet, testé, verrouillé — et affamé.
// ─────────────────────────────────────────────────────────────────────────────
//
// POURQUOI HYDRATER PLUTÔT QU'ÉCRIRE DANS LE PROFIL.
//
// La tentation serait de persister ces champs au moment de l'import. C'est
// exactement ce que ce dépôt refuse deux fois déjà : `historique.ts` archive le
// brut « parce qu'un parseur qui jette sa matière première condamne ses propres
// erreurs à être définitives », et `resume.ts` recalcule au lieu de lire le
// profil figé. Un profil écrit la veille d'un changement de règle porterait un
// chiffre périmé sans que rien ne le signale.
//
// Donc : le profil sur disque garde ce que le PLANIFICATEUR a saisi ou tranché ;
// tout ce qui se dérive du livre et des relevés se dérive À LA LECTURE, ici,
// juste avant que le moteur ne travaille.

import 'server-only';
import { lireHistorique, lireDernierReleve } from './historique';
import { deriverComptes } from './comptes';
import { deriverTransactionsAnnee, deriverCotisationsAnnee } from './deriver';
import type { ProfilClient } from './types';

/**
 * Le profil, augmenté de tout ce que le livre et le dernier relevé savent.
 *
 * Ne touche AUCUN champ de saisie : âge, revenus, droits, intentions et
 * résolutions manuelles ressortent tels quels. Seuls les trois champs dérivés
 * sont remplacés — et ils l'étaient déjà par des valeurs vides.
 *
 * Rend le profil INCHANGÉ quand il n'y a ni livre ni relevé : un client sans
 * données importées doit sortir « indisponible », et il le doit pour la bonne
 * raison — pas parce qu'on a oublié de brancher quelque chose.
 */
export async function hydraterProfil(
  profil: ProfilClient,
  nomClient: string | null,
  annee: number
): Promise<ProfilClient> {
  if (!nomClient?.trim()) return profil;

  const livre = await lireHistorique(nomClient);
  if (livre.length === 0) return profil;

  const releve = await lireDernierReleve(nomClient);
  const comptes = releve
    ? deriverComptes(releve.texte, livre, { dateReleve: releve.dateReleve }).comptes
    : profil.comptes;

  return {
    ...profil,
    comptes,
    transactionsAnnee: deriverTransactionsAnnee(livre, annee),
    cotisationsAnnee: deriverCotisationsAnnee(livre, annee),
  };
}

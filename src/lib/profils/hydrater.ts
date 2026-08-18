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
import {
  deriverTransactionsAnnee, deriverCotisationsAnnee, deriverCeliParAnnee,
} from './deriver';
import { plafondsCeliParAnnee } from './parametres-fiscaux';
import { analyserMaximisation, type SignauxLivre } from './signaux-livre';
import { verdictCeliDuLivre, ageALaDate } from './verdict-celi';
import type { ProfilClient } from './types';

// `ageALaDate` vit désormais dans verdict-celi.ts, avec le calcul dont il
// commande le plafond. Réexporté ici : c'est de ce module qu'on l'importe
// depuis le 12 août, et une signature stable ne se casse pas pour un
// déménagement.
export { ageALaDate };

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
  const releve = await lireDernierReleve(nomClient);
  if (livre.length === 0 && releve === null) return profil;

  // LE RELEVÉ SEUL SUFFIT À DÉRIVER LES COMPTES — défaut trouvé le 6 août en
  // éprouvant le parcours « nouveau client ». La première version sortait dès
  // que le livre était vide, et perdait donc les positions d'un client dont on
  // n'a collé que le relevé. Or c'est justement le cas le plus courant à la
  // première rencontre : le relevé est sous la main, l'historique complet non.
  //
  // Sans livre, la jointure vers le numéro complet échoue — le compte sort
  // « absent », ce qui est exact — mais les positions, les PBR et donc les
  // gains latents sont là. La cristallisation devient calculable.
  const comptes = releve
    ? deriverComptes(releve.texte, livre, { dateReleve: releve.dateReleve }).comptes
    : profil.comptes;

  // L'ÂGE SE DÉRIVE de la date de naissance quand elle existe : un âge saisi
  // il y a deux ans est faux aujourd'hui, une date de naissance jamais.
  const jour = `${annee}-12-31`;
  const ageDerive = ageALaDate(profil.demographie.dateNaissance, jour);

  return {
    ...profil,
    demographie: ageDerive === null
      ? profil.demographie
      : { ...profil.demographie, age: ageDerive },
    comptes,
    transactionsAnnee: deriverTransactionsAnnee(livre, annee),
    cotisationsAnnee: deriverCotisationsAnnee(livre, annee),
  };
}

/**
 * LES SIGNAUX DU LIVRE — le verdict des droits CELI par la MÊME chaîne que
 * l'écran, et l'heuristique de maximisation. Rendus à part du profil parce
 * qu'ils ne sont PAS des champs du schéma : ils se recalculent à chaque
 * lecture et n'existent que le temps d'une analyse.
 */
export async function signauxDuLivre(
  profil: ProfilClient,
  nomClient: string | null,
  annee: number
): Promise<SignauxLivre> {
  const vide: SignauxLivre = { droitsCeli: null, maximisation: null, plafondParDefautMaximal: false };
  if (!nomClient?.trim()) return vide;
  const livre = await lireHistorique(nomClient);
  if (livre.length === 0) return vide;

  // LA CHAÎNE UNIQUE — exactement le même calcul que l'écran (resumeCeli).
  // Voir l'en-tête de verdict-celi.ts : ces deux surfaces divergeaient.
  const { droits: droitsCeli, plafond } = verdictCeliDuLivre(profil, livre, annee);

  // LE PLAFOND CUMULATIF EST LE COMPARATEUR DE LA PREUVE (17 août 2026) : il
  // était calculé ici même et jamais passé, si bien que le signal comparait
  // les cotisations à la seule période vue dans nos livres. Voir signaux-livre.
  const parAnnee = deriverCeliParAnnee(livre);
  const maximisation = analyserMaximisation(
    parAnnee.cotisations, parAnnee.retraits, plafondsCeliParAnnee(), annee,
    plafond.montant
  );
  return { droitsCeli, maximisation, plafondParDefautMaximal: plafond.parDefautMaximal };
}

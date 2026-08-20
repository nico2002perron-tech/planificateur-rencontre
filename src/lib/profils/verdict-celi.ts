// LA CHAÎNE UNIQUE DU VERDICT CELI — un seul calcul, deux surfaces.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE MODULE SUPPRIME (13 août 2026).
//
// Deux chaînes calculaient le même verdict, et elles divergeaient :
//
//   · `resume.ts` (l'ÉCRAN) appelait `calculerDroitsCeli(profil, …)` avec
//     l'`historiqueVie` FIGÉ à l'import — écrit avec l'année du collage — puis
//     dérivait un historique frais qui n'alimentait QUE les champs d'affichage.
//     Le verdict, lui, restait celui du figé.
//   · `hydrater.ts` (le MOTEUR, via `signauxDuLivre`) dérivait l'historique
//     frais AVANT de calculer, avec l'année d'ANALYSE.
//
// Mesuré : un historique collé le 15 décembre 2025 gèle les retraits de 2025
// (à raison ce jour-là : un retrait ne redonne des droits que l'année
// suivante). Relu en février 2026, l'écran affirmait toujours 0 $ de retraits
// passés pendant que le moteur en comptait 10 000 $ — deux montants « calculés »
// pour le même client, le même jour, dans la MÊME réponse d'API. L'un des deux
// était forcément faux, et rien ne disait lequel.
//
// Le commentaire de `resume.ts` disait pourtant la bonne chose (« ON RECALCULE,
// on ne lit pas le profil figé ») : l'intention était juste, le branchement à
// moitié fait. Et `strategies.ts` promettait « le verdict vient de la MÊME
// chaîne que l'écran » — une promesse que rien ne tenait.
//
// LA LEÇON, la même que pour le grand livre : deux copies d'une règle finissent
// toujours par diverger. La seule protection durable n'est pas un test qui
// compare les deux chaînes, c'est de n'en avoir qu'UNE.
// ─────────────────────────────────────────────────────────────────────────────

import { deriverHistoriqueRegime, observerTransferts } from './deriver';
import {
  croiserTransferts, calculerDroitsCeli,
  type TransfertObserve, type TransfertDouteux, type ResultatDroitsCeli,
} from './droits-celi';
import { plafondCeliCumulatif } from './parametres-fiscaux';
import { construireLigneDuTemps } from './ligne-du-temps';
import { vueFiscaleCeli } from './vue-fiscale-celi';
import { deriverHistoriqueCeliFiscal, comparerDroitsCeli, type HistoriqueCeliFiscal, type Divergence } from './droits-celi-fiscal';
import { comparerVerdictsCeli, type RapportTemoin } from './temoin-celi';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';
import type { ProfilClient, HistoriqueRegime } from './types';

/** L'âge au jour dit, dérivé de la date de naissance. */
export function ageALaDate(dateNaissance: string | null, jour: string): number | null {
  if (!dateNaissance) return null;
  const n = new Date(`${dateNaissance}T12:00:00`);
  const j = new Date(`${jour}T12:00:00`);
  if (Number.isNaN(n.getTime()) || Number.isNaN(j.getTime())) return null;
  let age = j.getFullYear() - n.getFullYear();
  if (j.getMonth() < n.getMonth() || (j.getMonth() === n.getMonth() && j.getDate() < n.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export type ChaineCeli = {
  /** L'historique RECALCULÉ depuis le livre, avec l'année d'analyse. */
  historique: HistoriqueRegime;
  observes: TransfertObserve[];
  douteux: TransfertDouteux[];
  /** L'âge retenu : dérivé de la date de naissance, sinon celui saisi. */
  age: number | null;
  plafond: ReturnType<typeof plafondCeliCumulatif>;
  droits: ResultatDroitsCeli;
  /**
   * LA NOUVELLE CHAÎNE, EN PARALLÈLE (20 août 2026, §23 de la migration).
   * Elle ne décide encore RIEN : `droits` ci-dessus vient toujours de
   * l'ancienne. Elle est calculée ici, au POINT UNIQUE où le verdict se fait,
   * pour que la comparaison porte sur les mêmes entrées — et pour qu'il n'y ait
   * jamais qu'un seul endroit à basculer le jour venu.
   */
  fiscal: HistoriqueCeliFiscal | null;
  /** Chaque écart ancien ↔ nouveau, CLASSÉ. Aucune divergence silencieuse (§15). */
  divergences: Divergence[];
  /**
   * LE RAPPORT DE PHASE TÉMOIN — la comparaison COMPLÈTE (statut, droit,
   * bornes, portée, questions), classée en six familles. `null` sans livre.
   *
   * ⚠ IL N'INFLUENCE RIEN. `droits` reste l'ancien verdict, et c'est lui que
   * l'écran et le PDF montrent. Ce rapport n'existe que pour être observé.
   */
  temoin: RapportTemoin | null;
};

/**
 * Le verdict CELI, calculé depuis le livre — l'unique chemin.
 *
 * `livre` est passé par l'appelant plutôt que lu ici : ses deux appelants l'ont
 * déjà en main, et ce module reste ainsi PUR (aucun accès disque), donc
 * testable sans dossier temporaire.
 *
 * L'ÂGE SE DÉRIVE de la date de naissance quand elle existe — un âge saisi il y
 * a deux ans est faux aujourd'hui, une date de naissance jamais. C'est le
 * plafond cumulatif qui en dépend, donc le montant lui-même.
 *
 * REPLI SUR LE FIGÉ : quand le livre ne porte AUCUNE ligne CELI, on garde
 * `profil.historiqueVie.celi` tel quel. C'est le seul cas où le figé est la
 * meilleure information disponible — et les deux surfaces le font ensemble.
 */
export function verdictCeliDuLivre(
  profil: ProfilClient,
  livre: LigneTransaction[],
  anneeCourante: number,
  /** Le NOM DU DOSSIER — condensé aussitôt en identifiant anonyme, jamais conservé. */
  nomDossierPourTemoin = ''
): ChaineCeli {
  const historique = deriverHistoriqueRegime(
    livre, 'celi', anneeCourante, profil.historiqueVie.celi.dateImport ?? ''
  );
  // `deriverHistoriqueRegime` rend un historique tout en `null` quand aucune
  // ligne CELI n'existe : c'est le signal du repli.
  const retenu = historique.cotisationsTotales === null ? profil.historiqueVie.celi : historique;

  const observes = observerTransferts(livre, 'celi');
  const douteux = croiserTransferts(observes, profil.consolidation.transfertsResolus);

  // TROIS SOURCES, DANS CET ORDRE : la date exacte, puis l'année seule (la
  // voie rapide — elle rend le MÊME plafond, puisque `plafondCeliCumulatif`
  // ne se sert de l'âge que pour retrouver l'année de naissance), puis l'âge
  // saisi à la main, qui vieillit mal.
  const age = ageALaDate(profil.demographie.dateNaissance, `${anneeCourante}-12-31`)
    ?? (profil.demographie.anneeNaissance !== null
      ? anneeCourante - profil.demographie.anneeNaissance
      : null)
    ?? profil.demographie.age;
  const plafond = plafondCeliCumulatif(age, anneeCourante);

  // Le profil vu par le calcul porte l'historique FRAIS — jamais le figé.
  const frais: ProfilClient = {
    ...profil,
    historiqueVie: { ...profil.historiqueVie, celi: retenu },
  };
  const droits = calculerDroitsCeli(frais, douteux, plafond.montant);

  // ── LA NOUVELLE CHAÎNE, EN PARALLÈLE — elle ne décide rien encore ──────────
  // historique Croesus → LigneDuTemps → vueFiscaleCeli → historique fiscal.
  // On la calcule au MÊME endroit et sur les MÊMES entrées que l'ancienne :
  // c'est ce qui rend la comparaison honnête, et ce qui fera de la bascule un
  // changement d'une seule ligne au lieu de branches dispersées.
  const fiscal = livre.length === 0 ? null : deriverHistoriqueCeliFiscal(
    vueFiscaleCeli(construireLigneDuTemps(livre)),
    {
      anneeCourante,
      plafondCumulatif: plafond.montant,
      historiqueExterne: profil.consolidation.historiqueExterne === 'jamais' ? 'jamais'
        : profil.consolidation.historiqueExterne === 'deja-eu' ? 'deja-eu' : 'inconnu',
      comptesExternes: profil.consolidation.comptesExternes,
      dateImport: profil.historiqueVie.celi.dateImport,
      dateOuverture: retenu.dateOuverture,
    }
  );
  const divergences = fiscal === null ? [] : comparerDroitsCeli(retenu, fiscal);

  // ── LA PHASE TÉMOIN — observer, jamais décider ─────────────────────────────
  // Le contexte est fait de COMPTAGES : ils expliquent une divergence sans
  // jamais nommer ce qui l'a causée dans le dossier du client.
  const timeline = livre.length === 0 ? null : construireLigneDuTemps(livre);
  const temoin = fiscal === null || timeline === null ? null : comparerVerdictsCeli(
    nomDossierPourTemoin, retenu, droits, fiscal,
    {
      evenementsBloquants: fiscal.completude.evenementsBloquants,
      devisesNonResolues: fiscal.completude.devisesNonResolues,
      virementsOrphelins: timeline.relationsVirements.filter((r) => r.jambeContrepartieId === null).length,
      inconnusAImpact: timeline.evenements.filter((e) => e.regime === 'celi' && e.nature === 'inconnu' && e.impactCompletude !== 'aucun').length,
      anneesCouvertes: Object.keys(fiscal.parAnnee).length,
    }
  );

  return { historique: retenu, observes, douteux, age, plafond, droits, fiscal, divergences, temoin };
}

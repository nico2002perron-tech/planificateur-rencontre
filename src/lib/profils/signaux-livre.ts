// LES SIGNAUX DU LIVRE — ce que l'historique complet révèle sans qu'on demande.
//
// Idée de Nicolas (12 août 2026) : « si c'est maximisé d'année en année,
// probablement que le client est seulement ici ». Le motif des cotisations
// CELI, comparé au plafond de CHAQUE année, porte un signal sur l'existence de
// comptes ailleurs.
//
// ─────────────────────────────────────────────────────────────────────────────
// RÈGLE ABSOLUE : UN SIGNAL N'EST PAS UNE RÉPONSE.
//
// Ce module INFORME la question de rencontre n° 1 (« des comptes ailleurs ? »),
// il n'y répond jamais à la place du client. `consolidation.comptesExternes`
// ne s'écrit que par la main du planificateur, après la conversation. Un
// moteur qui déduirait « seulement ici » d'un motif de cotisations fabriquerait
// exactement le genre de certitude fausse que tout ce projet refuse.
//
// TROIS ÉTATS, du plus fort au plus faible :
//
//   depasse-cumul   Les cotisations vues ici DÉPASSENT ce que le plafond
//                   cumulatif permet (retraits d'ici inclus). Ce n'est pas une
//                   probabilité, c'est une PREUVE : des droits ont été créés
//                   ailleurs (retraits dans un CELI externe). Même famille que
//                   `transfertEntrantDetecte`, par un chemin indépendant.
//   maximise        Chaque année depuis la première cotisation ici, le client
//                   a versé au moins ~le plafond annuel. Probablement seulement
//                   ici — à confirmer d'un mot en rencontre.
//   sous-plafond    Des années sous le plafond : place libre, OU cotisations
//                   faites ailleurs. Indécidable d'ici — c'est LA question.
//
// ⚠ HEURISTIQUE, sous verrou fiscaliste comme le reste : la tolérance, le
// traitement des retraits et la lecture des plafonds doivent être validés.
// ─────────────────────────────────────────────────────────────────────────────

import type { ResultatDroitsCeli } from './droits-celi';

export type EtatMaximisation = 'maximise' | 'sous-plafond' | 'depasse-cumul' | 'indetermine';

export type SignalMaximisation = {
  etat: EtatMaximisation;
  /** Première année d'activité CELI vue ici. */
  depuis: number | null;
  /** Total cotisé (argent neuf) vu ici, toutes années. */
  totalCotise: number;
  /** La somme des plafonds annuels sur la période d'activité ici. */
  plafondPeriode: number;
  /** Les années sous le plafond, pour que l'écran puisse les montrer. */
  anneesSousPlafond: number[];
};

/**
 * Le CELI seulement : c'est le régime où le plafond est public et universel.
 * Le REER dépend du revenu gagné de chacun — aucun motif comparable n'existe.
 *
 * Une année tolère un léger manque (95 % du plafond) : les arrondis de
 * versements automatiques ne doivent pas casser un motif clairement maximisé.
 * L'année suivant un RETRAIT est exclue du verdict « sous-plafond » : le
 * client peut y recotiser plus que le plafond annuel sans rien prouver.
 */
export function analyserMaximisation(
  cotisationsParAnnee: Record<string, number>,
  retraitsParAnnee: Record<string, number>,
  plafondsParAnnee: Record<string, number>,
  anneeCourante: number
): SignalMaximisation {
  const annees = Object.keys(cotisationsParAnnee)
    .map((a) => Number.parseInt(a, 10))
    .filter((a) => Number.isFinite(a))
    .sort();
  const vide = {
    etat: 'indetermine' as const, depuis: null, totalCotise: 0,
    plafondPeriode: 0, anneesSousPlafond: [],
  };
  if (annees.length === 0) return vide;

  const depuis = annees[0];
  let totalCotise = 0;
  let totalRetraits = 0;
  let plafondPeriode = 0;
  const anneesSousPlafond: number[] = [];

  for (let a = depuis; a <= anneeCourante; a++) {
    const cle = String(a);
    const cotise = cotisationsParAnnee[cle] ?? 0;
    const plafond = plafondsParAnnee[cle] ?? 0;
    totalCotise += cotise;
    totalRetraits += retraitsParAnnee[cle] ?? 0;
    plafondPeriode += plafond;

    // L'année courante n'est pas finie : ne jamais la compter « sous-plafond ».
    if (a === anneeCourante) continue;
    if (plafond <= 0) continue;
    const retraitAnneePrecedente = retraitsParAnnee[String(a - 1)] ?? 0;
    if (cotise < plafond * 0.95 && retraitAnneePrecedente < plafond) {
      anneesSousPlafond.push(a);
    }
  }

  // LA PREUVE d'abord : cotiser plus que la période ne le permet, retraits
  // d'ici compris, exige des droits créés ailleurs.
  if (totalCotise > plafondPeriode + totalRetraits + 1) {
    return { etat: 'depasse-cumul', depuis, totalCotise, plafondPeriode, anneesSousPlafond };
  }
  // « MAXIMISÉ » EXIGE AU MOINS UNE ANNÉE COMPLÈTE — vu le 12 août sur un
  // dossier réel : un client dont la première cotisation date de l'année
  // courante sortait « au plafond chaque année depuis 2026 », un motif bâti
  // sur zéro année terminée. Un signal vide de sens présenté comme un signal
  // est pire que le silence.
  if (anneesSousPlafond.length === 0) {
    if (anneeCourante - depuis < 1) {
      return { etat: 'indetermine', depuis, totalCotise, plafondPeriode, anneesSousPlafond };
    }
    return { etat: 'maximise', depuis, totalCotise, plafondPeriode, anneesSousPlafond };
  }
  return { etat: 'sous-plafond', depuis, totalCotise, plafondPeriode, anneesSousPlafond };
}

/** Ce que le serveur dérive du livre et passe au moteur — jamais deviné. */
export type SignauxLivre = {
  /** Le verdict des droits CELI, calculé par la MÊME chaîne que l'écran. */
  droitsCeli: ResultatDroitsCeli | null;
  maximisation: SignalMaximisation | null;
};

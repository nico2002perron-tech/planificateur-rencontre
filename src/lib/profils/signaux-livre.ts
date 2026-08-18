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
//
//                   ⚠ LE COMPARATEUR EST LE PLAFOND DEPUIS LES 18 ANS, jamais
//                   depuis la première cotisation vue ici — corrigé le 17 août
//                   2026. L'ancienne version sommait les plafonds à partir de la
//                   première année d'activité DANS NOS LIVRES. Or les droits
//                   CELI s'accumulent sans qu'aucun compte n'existe nulle part :
//                   un client de 40 ans qui ouvre son premier CELI ici et y
//                   verse ses 95 000 $ de droits accumulés depuis 2009 —
//                   le cas d'accueil le plus banal — déclenchait « la PREUVE
//                   d'un historique externe ». Le document accusait d'avoir un
//                   compte ailleurs un client qui n'en a jamais eu.
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
  /**
   * TOUT ce que le client a pu accumuler depuis ses 18 ans (ou 2009) — le seul
   * comparateur qui autorise à parler de PREUVE. `null` quand il n'a pas pu
   * être établi : on ne prouve alors rien, et on ne l'affirme pas.
   */
  plafondCumulatif: number | null;
  /** Les années sous le plafond, pour que l'écran puisse les montrer. */
  anneesSousPlafond: number[];
};

/**
 * Le CELI seulement : c'est le régime où le plafond est public et universel.
 * Le REER dépend du revenu gagné de chacun — aucun motif comparable n'existe.
 *
 * Une année tolère un léger manque (95 % du plafond) : les arrondis de
 * versements automatiques ne doivent pas casser un motif clairement maximisé.
 *
 * `plafondCumulatif` = tout ce que le client a pu accumuler depuis ses 18 ans
 * (`plafondCeliCumulatif`). C'est le SEUL comparateur qui autorise à parler de
 * preuve ; `null` quand il n'est pas établi, et alors rien n'est prouvé.
 */
export function analyserMaximisation(
  cotisationsParAnnee: Record<string, number>,
  retraitsParAnnee: Record<string, number>,
  plafondsParAnnee: Record<string, number>,
  anneeCourante: number,
  plafondCumulatif: number | null = null
): SignalMaximisation {
  const annees = Object.keys(cotisationsParAnnee)
    .map((a) => Number.parseInt(a, 10))
    .filter((a) => Number.isFinite(a))
    .sort();
  const vide = {
    etat: 'indetermine' as const, depuis: null, totalCotise: 0,
    plafondPeriode: 0, plafondCumulatif, anneesSousPlafond: [],
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
    // UN RETRAIT N'EXCUSE PAS DE NE RIEN VERSER — corrigé le 17 août 2026.
    // Une exemption suspendait le verdict « sous-plafond » l'année suivant un
    // retrait. Elle avait la logique à l'envers : un retrait REND de la place,
    // il n'en consomme pas. Un client qui retire 20 000 $ puis ne verse rien
    // l'année suivante a plus d'espace libre que jamais — et le signal disait
    // « au plafond chaque année ». L'exemption ne servait qu'aux années où le
    // client verse PLUS que le plafond annuel, ce que ce test ne regarde pas.
    if (cotise < plafond * 0.95) {
      anneesSousPlafond.push(a);
    }
  }

  // LA PREUVE : cotiser plus que TOUT ce que le client a pu accumuler depuis
  // ses 18 ans, retraits d'ici compris, exige des droits créés ailleurs.
  //
  // Sans `plafondCumulatif`, rien n'est prouvable : on se tait plutôt que
  // d'accuser. Le comparateur de période (`plafondPeriode`) reste calculé pour
  // l'affichage, mais il ne décide plus — il condamnait le cas d'accueil le
  // plus banal (voir l'en-tête).
  if (plafondCumulatif !== null && totalCotise > plafondCumulatif + totalRetraits + 1) {
    return { etat: 'depasse-cumul', depuis, totalCotise, plafondPeriode, plafondCumulatif, anneesSousPlafond };
  }
  // « MAXIMISÉ » EXIGE AU MOINS UNE ANNÉE COMPLÈTE — vu le 12 août sur un
  // dossier réel : un client dont la première cotisation date de l'année
  // courante sortait « au plafond chaque année depuis 2026 », un motif bâti
  // sur zéro année terminée. Un signal vide de sens présenté comme un signal
  // est pire que le silence.
  if (anneesSousPlafond.length === 0) {
    if (anneeCourante - depuis < 1) {
      return { etat: 'indetermine', depuis, totalCotise, plafondPeriode, plafondCumulatif, anneesSousPlafond };
    }
    return { etat: 'maximise', depuis, totalCotise, plafondPeriode, plafondCumulatif, anneesSousPlafond };
  }
  return { etat: 'sous-plafond', depuis, totalCotise, plafondPeriode, plafondCumulatif, anneesSousPlafond };
}

/** Ce que le serveur dérive du livre et passe au moteur — jamais deviné. */
export type SignauxLivre = {
  /** Le verdict des droits CELI, calculé par la MÊME chaîne que l'écran. */
  droitsCeli: ResultatDroitsCeli | null;
  maximisation: SignalMaximisation | null;
  /**
   * Vrai quand le plafond cumulatif a été pris AU MAXIMUM faute de connaître
   * l'année de naissance — ajouté le 18 août 2026.
   *
   * Ce n'est pas un détail : sans l'année, le moteur suppose que le client
   * avait 18 ans en 2009, ce qui SURESTIME son espace CELI. Le dire permet de
   * demander les quatre chiffres qui rendent le chiffre exact.
   */
  plafondParDefautMaximal: boolean;
};

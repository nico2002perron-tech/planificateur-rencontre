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
// DEPUIS LE 20 AOÛT 2026, LE SIGNAL DIT AUSSI SES LIMITES. La vue de la
// timeline (`vueCeliParAnnee`) déclare ce qu'elle n'a PAS pu compter : devise
// étrangère jamais convertie, sorties à confirmer, événements ambigus, portée.
// Le signal les consomme — un état fort qui dépendrait d'un montant non compté
// est RÉTROGRADÉ à « indetermine » (voir LA MATRICE DE PRUDENCE dans le code) —
// et les limites voyagent avec l'état pour que l'écran nomme la CAUSE au lieu
// de rendre un « sous-plafond » muet quand la vraie raison est ailleurs.
//
// ⚠ HEURISTIQUE, sous verrou fiscaliste comme le reste : la tolérance, le
// traitement des retraits et la lecture des plafonds doivent être validés.
// ─────────────────────────────────────────────────────────────────────────────

import type { ResultatDroitsCeli } from './droits-celi';
import type { VueCeliParAnnee } from './ligne-du-temps';
import type { Portee } from './types';

export type EtatMaximisation = 'maximise' | 'sous-plafond' | 'depasse-cumul' | 'indetermine';

/**
 * Les raisons pour lesquelles le motif ne peut pas (ou pas fermement) conclure.
 * Structurées pour que le texte d'écran se GÉNÈRE au lieu de s'improviser —
 * et TOUTES les raisons vraies sont conservées, jamais une seule quand
 * plusieurs le sont.
 */
export type LimitationMaximisation =
  | 'devise-etrangere'      // des flux CELI hors CAD existent, jamais convertis
  | 'retraits-a-confirmer'  // des sorties D1/D2 — virement interne ou vrai retrait ?
  | 'evenements-ambigus'    // des événements CELI comptés nulle part
  | 'portee-incomplete';    // le motif est lu sur les seules transactions d'ici

export type LimitesMaximisation = {
  /** Ordre FIXE : devise, retraits à confirmer, ambigus, portée. */
  limitations: LimitationMaximisation[];
  /** Les devises vues hors CAD (triées) — jamais converties, jamais additionnées aux nombres CAD. */
  devisesEtrangeres: string[];
  cotisationsEtrangeresPresentes: boolean;
  retraitsEtrangersPresents: boolean;
  /**
   * Total CAD des sorties À CONFIRMER — DÉJÀ compté dans la borne des
   * retraits : un calcul interne prudent, PAS un montant fiscal confirmé.
   * Jamais transformé en droits disponibles.
   */
  totalRetraitsAConfirmer: number;
  /**
   * LES ÉVÉNEMENTS QUI PEUVENT ENCORE CHANGER UN CHIFFRE — ambigus, inconnus
   * porteurs d'un montant, virements non résolus (§13 du 20 août 2026).
   *
   * ⚠ CE N'EST PLUS « les ambigus » : le signal lisait le nom de la catégorie,
   * si bien qu'une ligne à moitié comprise (un « Frais » de +57,33 $) faisait
   * tomber un verdict fort pendant que 59 lignes INCOMPRISES — dont un net
   * inexpliqué de −9 000 $ — le laissaient intact. Le blocage suit désormais
   * ce qui pourrait modifier le chiffre.
   */
  evenementsAmbigus: number;
  portee: Portee;
};

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
  /**
   * Ce que la vue N'A PAS pu compter — l'écran doit le dire AVEC l'état.
   * Les champs chiffrés ci-dessus restent des faits exacts sur le périmètre
   * CAD déclaré ; `limites` dit précisément en quoi ce périmètre est partiel.
   */
  limites: LimitesMaximisation;
};

/** Les limites, lues UNIQUEMENT de ce que la vue déclare — jamais re-dérivées des transactions. */
function limitesDeLaVue(vue: VueCeliParAnnee): LimitesMaximisation {
  // La présence se lit dans les MONTANTS déclarés, pas dans un drapeau : une
  // vue de test incohérente ne peut pas faire mentir la limite.
  const devises = new Set<string>();
  let cotisationsEtrangeresPresentes = false;
  let retraitsEtrangersPresents = false;
  for (const parDevise of Object.values(vue.completude.deviseEtrangere.cotisations)) {
    for (const d of Object.keys(parDevise)) { devises.add(d); cotisationsEtrangeresPresentes = true; }
  }
  for (const parDevise of Object.values(vue.completude.deviseEtrangere.retraits)) {
    for (const d of Object.keys(parDevise)) { devises.add(d); retraitsEtrangersPresents = true; }
  }
  const totalRetraitsAConfirmer = Math.round(
    Object.values(vue.detail.retraitsAConfirmer).reduce((s, x) => s + x, 0) * 100
  ) / 100;

  const limitations: LimitationMaximisation[] = [];
  if (cotisationsEtrangeresPresentes || retraitsEtrangersPresents) limitations.push('devise-etrangere');
  if (totalRetraitsAConfirmer > 0) limitations.push('retraits-a-confirmer');
  if (vue.completude.evenementsAImpact > 0) limitations.push('evenements-ambigus');
  if (vue.completude.portee !== 'complete') limitations.push('portee-incomplete');

  return {
    limitations,
    devisesEtrangeres: [...devises].sort(),
    cotisationsEtrangeresPresentes,
    retraitsEtrangersPresents,
    totalRetraitsAConfirmer,
    evenementsAmbigus: vue.completude.evenementsAImpact,
    portee: vue.completude.portee,
  };
}

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
 *
 * L'ENTRÉE EST LA VUE ENTIÈRE (20 août 2026), plus deux dictionnaires nus :
 * impossible de passer les cotisations sans la complétude qui les qualifie.
 * Un appelant qui pouvait « oublier » la complétude fabriquait des verts —
 * un dossier 100 % USD sortait « indetermine » sans un mot sur la devise.
 */
export function analyserMaximisation(
  vue: VueCeliParAnnee,
  plafondsParAnnee: Record<string, number>,
  anneeCourante: number,
  plafondCumulatif: number | null = null
): SignalMaximisation {
  const limites = limitesDeLaVue(vue);
  const cotisationsParAnnee = vue.cotisations;
  const retraitsParAnnee = vue.retraits;
  const annees = Object.keys(cotisationsParAnnee)
    .map((a) => Number.parseInt(a, 10))
    .filter((a) => Number.isFinite(a))
    .sort();
  // « Vide » ne veut PAS dire « rien » : un dossier 100 % USD n'a aucune année
  // CAD et sort ici — mais ses limites déclarent la devise. Le zéro de
  // `totalCotise` est un zéro DE PÉRIMÈTRE, jamais « aucune cotisation ».
  const vide = {
    etat: 'indetermine' as const, depuis: null, totalCotise: 0,
    plafondPeriode: 0, plafondCumulatif, anneesSousPlafond: [], limites,
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
  let etat: EtatMaximisation;
  if (plafondCumulatif !== null && totalCotise > plafondCumulatif + totalRetraits + 1) {
    etat = 'depasse-cumul';
  } else if (anneesSousPlafond.length === 0) {
    // « MAXIMISÉ » EXIGE AU MOINS UNE ANNÉE COMPLÈTE — vu le 12 août sur un
    // dossier réel : un client dont la première cotisation date de l'année
    // courante sortait « au plafond chaque année depuis 2026 », un motif bâti
    // sur zéro année terminée. Un signal vide de sens présenté comme un signal
    // est pire que le silence.
    etat = anneeCourante - depuis < 1 ? 'indetermine' : 'maximise';
  } else {
    etat = 'sous-plafond';
  }

  // ── LA MATRICE DE PRUDENCE — quel état survit à quelle limite (20 août) ─────
  // Chaque case est un argument de DIRECTION, pas un réflexe de prudence :
  //
  //   COTISATIONS ÉTRANGÈRES   maximise / sous-plafond → INDÉTERMINÉ. Des
  //       cotisations non comptées peuvent remplir les années « sous le
  //       plafond » — et un « au plafond » pourrait en réalité être un
  //       depasse-cumul, la conclusion INVERSE (« seulement ici » quand la
  //       preuve d'un ailleurs existe). depasse-cumul TIENT : exclure des
  //       cotisations ne fait que RÉDUIRE le total vu ; une preuve qui tombe
  //       sur le sous-ensemble CAD tient a fortiori avec le reste.
  //   RETRAITS ÉTRANGERS       depasse-cumul → INDÉTERMINÉ. Des retraits non
  //       comptés abaissent artificiellement le seuil d'accusation : la
  //       « preuve » pourrait être fausse — exactement le défaut du 12 août.
  //       maximise / sous-plafond tiennent : aucun test par année ne lit les
  //       retraits.
  //   ÉVÉNEMENTS AMBIGUS       tout état fort → INDÉTERMINÉ. Un ambigu peut
  //       cacher une cotisation non comptée (fausse année sous-plafond, faux
  //       maximise) comme un RENVERSEMENT d'une cotisation comptée (total
  //       surévalué, fausse preuve). Direction inconnue : rien ne survit.
  //   RETRAITS À CONFIRMER     AUCUNE rétrogradation. Ils sont DANS la borne,
  //       qui GONFLE le seuil d'accusation : une preuve qui tombe malgré le
  //       seuil gonflé tient quelle que soit leur résolution. Mais l'écran le
  //       dit : calcul interne prudent ≠ montant fiscal confirmé.
  //   PORTÉE                   AUCUNE rétrogradation. « Vu d'ici » a toujours
  //       été la condition du signal — désormais déclarée au lieu d'implicite.
  //
  // Les champs chiffrés (depuis, totalCotise, anneesSousPlafond…) restent tels
  // que calculés sur le périmètre CAD : des faits exacts sur un périmètre
  // déclaré partiel — jamais effacés, jamais extrapolés.
  const ambigus = limites.evenementsAmbigus > 0;
  if ((etat === 'maximise' || etat === 'sous-plafond') && (limites.cotisationsEtrangeresPresentes || ambigus)) {
    etat = 'indetermine';
  } else if (etat === 'depasse-cumul' && (limites.retraitsEtrangersPresents || ambigus)) {
    etat = 'indetermine';
  }

  return { etat, depuis, totalCotise, plafondPeriode, plafondCumulatif, anneesSousPlafond, limites };
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

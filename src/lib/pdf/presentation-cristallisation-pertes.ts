// LA FRONTIÈRE ENTRE LE MOTEUR FISCAL ET LE DOCUMENT.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE MODULE NE CALCULE RIEN, ET C'EST TOUT SON INTÉRÊT.
//
// Il sélectionne, organise, nomme. Il ne dérive aucun montant — pas même quand
// c'est mathématiquement tentant. Si une donnée manque au moteur, elle vaut
// `null` ici et le document ne l'affiche pas : jamais une reconstruction.
//
// POURQUOI CETTE DISCIPLINE. Un adaptateur qui recalcule « juste ce petit
// écart » devient, en trois lots, un second moteur fiscal — avec ses propres
// arrondis, ses propres hypothèses, et aucun des garde-fous du premier. Le test
// A8 existe pour empêcher exactement cette dérive : il injecte des valeurs
// volontairement incohérentes et exige qu'elles ressortent telles quelles.
//
// LA SÉCURITÉ EST DANS LE TYPE, PAS DANS LA VIGILANCE DU JSX. L'action est une
// union discriminée : sous un statut dégradé, il n'existe littéralement pas de
// champ « quantité » à afficher par mégarde.
// ─────────────────────────────────────────────────────────────────────────────
import type { Constat } from '@/lib/profils/strategies';
import type { StatutConstat } from '@/lib/profils/types';
import type { PlanExecution, LigneExecution } from '@/lib/profils/plan-execution';

// ⚠ LE TYPE VIT DÉSORMAIS DANS `langage-fiscal`, à côté du composant qui le
// consomme. Réexporté ici pour les appelants existants — et surtout pour que
// l'adaptateur des gains cesse d'importer depuis celui des pertes.
export type { ValidationAvantExecution } from './langage-fiscal';
import type { ValidationAvantExecution } from './langage-fiscal';

/** La ligne du plan, telle quelle — aucun type miroir dans la présentation. */
export type { LigneExecution };

/**
 * L'ACTION — union discriminée, et c'est délibéré (§6).
 *
 * Sous un statut dégradé, la variante `a-confirmer` n'a AUCUN champ de
 * quantité ni aucune ligne. Le composant ne peut donc pas « oublier » de la
 * masquer : elle n'existe pas. C'est la sécurité posée avant le JSX plutôt
 * qu'à l'intérieur — et elle vaut aussi pour la forme multi.
 *
 * ⚠ LE SINGULIER ÉTAIT UNE HYPOTHÈSE, PAS UNE PROPRIÉTÉ DU PROBLÈME. La mesure
 * l'a montré : dès que la cible dépasse la plus grosse perte latente d'un
 * titre, il en faut deux — et c'est le cas courant. L'adaptateur devait alors
 * choisir un titre, donc DÉCIDER, ce qui n'est pas son rôle.
 */
export type ActionPresentee =
  | {
      type: 'ferme';
      /** Une ligne = un ordre exécutable. Jamais un montant théorique. */
      lignes: LigneExecution[];
      valeurVenteTotaleCad: number;
      montantRealiseTotalCad: number;
      cibleGlobaleCad: number;
      ecartCad: number;
      cibleRestanteCad: number;
      capaciteCouvreCible: boolean;
      executionCouvreEntierementCible: boolean;
      dateValeurs: string | null;
    }
  | { type: 'a-confirmer'; raisons: string[] };

export type PresentationCristallisationPertes = {
  statut: StatutConstat;
  etape1: {
    symbole: string | null;
    description: string | null;
    gainNetAvantCad: number | null;
    perteLatenteDisponibleCad: number | null;
    compte: string | null;
    deviseNegociation: string | null;
    uniteValeursRapport: string | null;
  };
  etape2: {
    symbole: string | null;
    couvreSeuleLaCible: boolean | null;
    raisonSelection: string | null;
  };
  etape3: { action: ActionPresentee };
  etape4: {
    gainNetAvantCad: number | null;
    perteRealiseeEstimeeCad: number | null;
    gainNetApresCad: number | null;
    ecartCad: number | null;
    /** ⚠ Le document n'a JAMAIS à décider si `null` veut dire zéro. */
    apresAffichable: boolean;
  };
  etape5: {
    reductionGainCapitalNetCad: number | null;
    gainNetApresCad: number | null;
    textePrincipal: string;
    texteSecondaire: string | null;
  };
  validationsAvantExecution: ValidationAvantExecution[];
};

const VIDE = {
  symbole: null, description: null, gainNetAvantCad: null,
  perteLatenteDisponibleCad: null, compte: null,
  deviseNegociation: null, uniteValeursRapport: null,
};

export function construirePresentationCristallisationPertes(
  constat: Constat,
  /** LE PLAN CANONIQUE — la seule source de « combien vendre ». */
  plan: PlanExecution | null,
  /** Le gain net AVANT, quand la stratégie le connaît. Jamais déduit ici. */
  gainNetAvantCad: number | null = null
): PresentationCristallisationPertes {
  const ferme = constat.statut === 'calcule' && plan !== null && plan.lignes.length > 0;
  // ⚠ « MONO » VIENT DU PLAN, pas d'un comptage refait ici. Le plan sait s'il a
  // trouvé un titre suffisant ; l'adaptateur ne le redécide pas.
  const monoTitre = ferme && plan!.monoTitre && plan!.lignes.length === 1;
  /**
   * ⚠ `seule` NE DÉPEND PAS DU STATUT, ET C'EST UN TEST QUI L'A ÉTABLI.
   *
   * L'avoir liée à `ferme` faisait disparaître le CONTEXTE du titre sous un
   * statut dégradé — symbole, devise, perte latente — alors que seule la
   * QUANTITÉ doit être retenue. La page dégradée cessait de dire
   * « Négociation : USD », et V12 l'a vu.
   *
   * Ce que le statut interdit, c'est l'action ferme ; ce que le multi interdit,
   * c'est de nommer un titre qui n'a pas été choisi. Deux questions distinctes.
   */
  const planMonoTitre = plan !== null && plan.monoTitre && plan.lignes.length === 1;
  const seule: LigneExecution | null = planMonoTitre ? plan!.lignes[0] : null;

  // ── ÉTAPE 1 — les faits, pas un roman ────────────────────────────────────
  // Quand aucune position n'est retenue, on ne nomme personne : présenter un
  // titre « au cas où » laisserait croire qu'il a été choisi.
  // ⚠ ET SUR UN PLAN À PLUSIEURS TITRES, CES CHAMPS N'EN ONT PAS DAVANTAGE.
  // Nommer un titre « principal » ou sommer les pertes latentes fabriquerait
  // une sélection qui n'existe pas. Ils valent `null` — `EnTeteSociete`
  // dégrade déjà proprement, et la carte garde ses chiffres.
  const etape1 = seule === null ? { ...VIDE, gainNetAvantCad } : {
    symbole: seule.symbole,
    description: seule.description,
    gainNetAvantCad,
    perteLatenteDisponibleCad: seule.montantLatentDisponibleCad,
    compte: seule.compteId,
    deviseNegociation: seule.devise,
    uniteValeursRapport: seule.uniteValeursRapport,
  };

  // ── ÉTAPE 2 — une raison FISCALE, et seulement si elle est démontrée ─────
  // ⚠ Aucun jugement d'investissement : ni « meilleur titre », ni
  // « perspectives », ni « à vendre ». Le moteur démontre une seule chose —
  // que cette position suffit à elle seule — et c'est tout ce qu'on dit.
  const couvreSeule = plan === null ? null : plan.monoTitre;
  const etape2 = {
    symbole: seule?.symbole ?? null,
    couvreSeuleLaCible: couvreSeule,
    // ⚠ DEUX SITUATIONS FERMES, DONC DEUX PHRASES — et le défaut était visible
    // sur PDF. Sans la branche multi, un plan CALCULÉ de cinq transactions
    // tombait dans le repli dégradé et affichait « Le titre à retenir sera
    // déterminé une fois les données du dossier confirmées » : le document
    // réclamait des données qu'il venait d'utiliser.
    //
    // La phrase multi ne nomme aucun titre et n'avance aucun chiffre — elle dit
    // la seule chose que le plan démontre : qu'aucune position ne suffisait.
    raisonSelection: !ferme ? null
      : monoTitre
        ? 'Cette position est retenue parce que sa perte latente permet d’atteindre '
          + 'l’objectif avec une seule transaction.'
        : 'Aucune position ne porte seule l’objectif : il est atteint en combinant '
          + 'plusieurs ventes, en commençant par les pertes latentes les plus importantes.',
  };

  // ── ÉTAPE 3 — l'action, ou son absence, dans le TYPE ─────────────────────
  const action: ActionPresentee = ferme
    ? {
        type: 'ferme',
        // ⚠ LES LIGNES DU PLAN, TELLES QUELLES. Aucun tri, aucun filtre, aucune
        // sélection : l'adaptateur organise, il ne décide pas.
        lignes: plan!.lignes,
        valeurVenteTotaleCad: plan!.valeurVenteTotaleCad,
        montantRealiseTotalCad: plan!.montantRealiseTotalCad,
        cibleGlobaleCad: plan!.cibleCad,
        ecartCad: plan!.ecartCad,
        cibleRestanteCad: plan!.cibleRestanteCad,
        capaciteCouvreCible: plan!.capaciteCouvreCible,
        executionCouvreEntierementCible: plan!.executionCouvreEntierementCible,
        dateValeurs: plan!.lignes[0]?.dateValeurs ?? null,
      }
    : { type: 'a-confirmer', raisons: [...constat.donneesManquantes] };

  // ── ÉTAPE 4 — les trois barres, reprises telles quelles ──────────────────
  // ⚠ AUCUN `avant − perte` ICI. `gainNetApresCad` vient du moteur ou vaut
  // `null`, et `apresAffichable` dispense le document de trancher.
  // ⚠ LU SUR LE PLAN, JAMAIS RECALCULÉ. `max(0, avant − total)` écrit dans la
  // couche document serait une règle fiscale, donc une seconde source de vérité.
  const gainNetApresCad = ferme ? plan!.gainNetApresCad : null;
  const etape4 = {
    gainNetAvantCad,
    // Le TOTAL du plan — la première ligne seule mentirait sur un plan multi.
    perteRealiseeEstimeeCad: ferme ? plan!.montantRealiseTotalCad : null,
    gainNetApresCad,
    ecartCad: ferme ? plan!.ecartCad : null,
    apresAffichable: gainNetApresCad !== null,
  };

  // ── ÉTAPE 5 — ce que le moteur SAIT, et rien de plus ─────────────────────
  // `montantEstime` EST la grandeur métier « perte à cristalliser », donc la
  // réduction du gain net visée. On la LIT ; on ne la reconstruit pas par
  // `avant − après`, si tentant que ce soit.
  const reduction = constat.statut === 'calcule' ? constat.montantEstime : null;
  const etape5 = {
    reductionGainCapitalNetCad: reduction,
    gainNetApresCad,
    textePrincipal: ferme
      ? 'La perte réalisée viendrait réduire le gain en capital net visé pour l’année.'
      : 'Le montant de perte à réaliser reste à confirmer avant de mesurer l’effet sur la déclaration.',
    texteSecondaire:
      gainNetApresCad === null ? null
        : gainNetApresCad === 0
          ? 'Selon les données disponibles, le gain net restant après la stratégie serait d’environ 0 $.'
          : 'Selon les données disponibles, un gain en capital net demeurerait après la stratégie.',
  };

  // ── LES VALIDATIONS — « confirmé » exige une donnée affirmative ──────────
  // Une case cochée parce qu'aucun motif n'est apparu serait un faux vert : la
  // perte apparente ne se prouve pas par l'absence d'un drapeau.
  const validations: ValidationAvantExecution[] = [
    { libelle: 'Actualiser le prix avant la transaction', statut: 'a-confirmer' },
    { libelle: 'Vérifier la règle de la perte apparente', statut: 'a-confirmer' },
    { libelle: 'Confirmer les positions identiques dans les comptes pertinents', statut: 'a-confirmer' },
  ];

  return { statut: constat.statut, etape1, etape2, etape3: { action }, etape4, etape5,
    validationsAvantExecution: validations };
}

/**
 * Le nom de la société, ajouté après coup depuis la position source.
 *
 * ⚠ PRÉSENTATION SEULEMENT, et volontairement séparé : l'adaptateur ne va
 * chercher aucune donnée lui-même. L'appelant, qui tient les positions, la lui
 * remet.
 */
export function avecDescription(
  p: PresentationCristallisationPertes, description: string | null
): PresentationCristallisationPertes {
  return { ...p, etape1: { ...p.etape1, description } };
}

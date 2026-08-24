// LA FRONTIÈRE MOTEUR → DOCUMENT, côté cristallisation de gains.
//
// ─────────────────────────────────────────────────────────────────────────────
// MÊME DOCTRINE QUE SON JUMEAU DES PERTES : sélectionner, organiser, nommer.
// Aucun calcul. En particulier, JAMAIS `min(gainsLatentsCad,
// pertesDisponiblesCad)` : cette décision appartient à la stratégie, avec
// toutes ses conditions d'admissibilité — unité des pertes reportées, portée,
// perte apparente — dont rien n'est visible d'ici. La refaire créerait une
// seconde vérité qui divergerait au premier raffinement.
//
// ⚠ ET CE N'EST PAS LA MÊME HISTOIRE. Les pertes racontent une soustraction ;
// les gains racontent l'emploi d'une capacité qui dort. Le vocabulaire suit :
// « pertes disponibles » n'est pas un problème à réduire, c'est une ressource.
// ─────────────────────────────────────────────────────────────────────────────
import type { Constat } from '@/lib/profils/strategies';
import type { StatutConstat } from '@/lib/profils/types';
import type { PlanExecution, LigneExecution } from '@/lib/profils/plan-execution';
import type { ValidationAvantExecution } from './langage-fiscal';
// ⚠ LE FORMATEUR VIENT DE `rendu-constat`, QUI IGNORE LE MOTEUR DE RENDU.
// L'adaptateur compose des phrases ; il ne doit pas dépendre du PDF.
import { argent } from './rendu-constat';
import { TITRE_CLIENT_CRISTALLISATION_GAINS } from '@/lib/profils/titres-strategies';

/**
 * ⚠ LE TITRE DE PRÉSENTATION EST DÉSORMAIS CELUI DU CATALOGUE, ET C'EST LE
 * CATALOGUE QUI A CHANGÉ.
 *
 * Ce module portait un titre À LUI parce que le catalogue promettait
 * « Récolter des gains sans payer d'impôt » — une promesse que le contrat ne
 * démontre pas : sur le cas de référence il reste de la capacité inutilisée, et
 * rien ne garantit que l'absorption soit totale. La page refusait donc de
 * reprendre le titre du constat.
 *
 * Le refus a tenu, mais il laissait le document porter DEUX noms : la carte de
 * synthèse annonçait la promesse, la page renvoyait à autre chose. Nicolas a
 * tranché à la source le 24 août 2026 — le titre client du catalogue ne promet
 * plus l'absence d'impôt. Il n'y a donc plus rien à refuser, et surtout plus
 * deux chaînes à tenir d'accord.
 */
export const TITRE_PRESENTATION = TITRE_CLIENT_CRISTALLISATION_GAINS;

/**
 * ⚠ PLUS DE SOUS-TITRE, ET C'EST UN REFUS EXPLICITE.
 *
 * Le sous-titre disait « Réaliser des gains en utilisant vos pertes fiscales
 * disponibles » — c'est-à-dire exactement ce que le titre client dit maintenant.
 * Le garder ferait lire deux fois la même phrase sous le filet de couleur.
 * Le type accepte `null` pour qu'on puisse REFUSER sans OUBLIER.
 */
export const SOUS_TITRE_PRESENTATION: string | null = null;

/** La ligne du plan, telle quelle — aucun type miroir dans la présentation. */
export type { LigneExecution };

/**
 * L'ACTION — même contrat que côté pertes, même union discriminée.
 *
 * ⚠ SOUS `a-confirmer`, AUCUNE LIGNE N'EXISTE. C'est ce qui rend impossible
 * d'afficher une quantité ferme sur un statut dégradé, multi compris.
 */
export type ActionGainPresentee =
  | {
      type: 'ferme';
      /** Une ligne = un ordre exécutable. Jamais un montant théorique. */
      lignes: LigneExecution[];
      valeurVenteTotaleCad: number;
      montantRealiseTotalCad: number;
      cibleGainCad: number;
      ecartCad: number;
      cibleRestanteCad: number;
      /** La capacité DISPONIBLE suffit-elle, indépendamment de l'arrondi ? */
      capaciteCouvreCible: boolean;
      executionCouvreEntierementCible: boolean;
      dateValeurs: string | null;
    }
  | { type: 'a-confirmer'; raisons: string[] };

export type PresentationCristallisationGains = {
  statut: StatutConstat;
  titre: string;
  /** `null` quand la stratégie refuse un sous-titre — jamais quand elle l'oublie. */
  sousTitre: string | null;
  etape1: {
    pertesDisponiblesCad: number | null;
    gainsLatentsCad: number | null;
    texte: string;
  };
  etape2: { cibleGainCad: number | null; texte: string };
  etape3: {
    symbole: string | null;
    description: string | null;
    deviseNegociation: string | null;
    uniteValeursRapport: string | null;
    action: ActionGainPresentee;
    /** La phrase qui rend `capacité ≠ exécution` compréhensible, ou `null`. */
    precisionGranularite: string | null;
  };
  etape4: {
    gainRealiseEstimeCad: number | null;
    pertesDisponiblesCad: number | null;
    cibleRestanteCad: number | null;
  };
  etape5: {
    pertesDisponiblesCad: number | null;
    gainRealiseEstimeCad: number | null;
    /** Le reste de `cibleRestanteCad`, dit en vocabulaire client. */
    capaciteEncoreDisponibleCad: number | null;
    texte: string;
  };
  validationsAvantExecution: ValidationAvantExecution[];
};

export function construirePresentationCristallisationGains(
  constat: Constat,
  /** LE PLAN CANONIQUE — la seule source de « combien vendre ». */
  plan: PlanExecution | null
): PresentationCristallisationGains {
  const ferme = constat.statut === 'calcule' && plan !== null && plan.lignes.length > 0;
  // ⚠ « MONO » VIENT DU PLAN, pas d'un comptage refait ici.
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

  const action: ActionGainPresentee = ferme
    ? {
        type: 'ferme',
        // ⚠ LES LIGNES DU PLAN, TELLES QUELLES. L'adaptateur organise, il ne
        // décide pas — aucun tri, aucun filtre, aucune sélection de titre.
        lignes: plan!.lignes,
        valeurVenteTotaleCad: plan!.valeurVenteTotaleCad,
        montantRealiseTotalCad: plan!.montantRealiseTotalCad,
        cibleGainCad: plan!.cibleCad,
        ecartCad: plan!.ecartCad,
        cibleRestanteCad: plan!.cibleRestanteCad,
        capaciteCouvreCible: plan!.capaciteCouvreCible,
        executionCouvreEntierementCible: plan!.executionCouvreEntierementCible,
        dateValeurs: plan!.lignes[0]?.dateValeurs ?? null,
      }
    : { type: 'a-confirmer', raisons: [...constat.donneesManquantes] };

  // ── LA PHRASE QUI EXPLIQUE LES 15 $ ──────────────────────────────────────
  // `capaciteCouvreCible && !executionCouvreEntierementCible` est un état
  // parfaitement normal avec des titres entiers, mais illisible tel quel. On le
  // dit en français plutôt que de laisser deux booléens au composant.
  // ⚠ ELLE DIT « CE TITRE » : elle n'a donc de sens qu'en MONO. Sur un plan à
  // plusieurs transactions, la phrase désignerait un titre qui n'a pas été
  // choisi — un test la verrouille à `null`.
  const precisionGranularite =
    ferme && monoTitre && plan!.capaciteCouvreCible && !plan!.executionCouvreEntierementCible
      ? `Ce titre possède assez de gain latent pour porter la cible. La quantité `
        + `entière la plus proche laisse ${argent(plan!.cibleRestanteCad)} de capacité inutilisée.`
      : null;

  return {
    statut: constat.statut,
    titre: TITRE_PRESENTATION,
    sousTitre: SOUS_TITRE_PRESENTATION,

    etape1: {
      pertesDisponiblesCad: constat.pertesDisponiblesCad ?? null,
      gainsLatentsCad: constat.gainsLatentsCad ?? null,
      texte:
        'Des pertes fiscales déjà disponibles peuvent être utilisées pour absorber '
        + 'des gains en capital réalisés.',
    },

    // ⚠ `montantEstime` TEL QUEL. Aucun `min()` ici.
    etape2: {
      cibleGainCad: constat.statut === 'calcule' ? constat.montantEstime : null,
      texte: ferme
        ? 'Voici le gain qui pourrait être réalisé en utilisant ces pertes.'
        : 'Le gain réalisable sera chiffré une fois les données du dossier confirmées.',
    },

    etape3: {
      // ⚠ NULL SUR UN PLAN MULTI : nommer un titre « principal » fabriquerait
      // une sélection qui n'existe pas.
      symbole: seule?.symbole ?? null,
      description: seule?.description ?? null,
      deviseNegociation: seule?.devise ?? null,
      uniteValeursRapport: seule?.uniteValeursRapport ?? null,
      action,
      precisionGranularite,
    },

    etape4: {
      // Le TOTAL du plan — jamais la première ligne seule.
      gainRealiseEstimeCad: ferme ? plan!.montantRealiseTotalCad : null,
      pertesDisponiblesCad: ferme ? (constat.pertesDisponiblesCad ?? null) : null,
      cibleRestanteCad: ferme ? plan!.cibleRestanteCad : null,
    },

    // « Capacité encore disponible » dit exactement ce que `cibleRestanteCad`
    // signifie ici : la part de la cible qu'aucune quantité entière n'atteint.
    etape5: {
      pertesDisponiblesCad: constat.pertesDisponiblesCad ?? null,
      gainRealiseEstimeCad: ferme ? plan!.montantRealiseTotalCad : null,
      capaciteEncoreDisponibleCad: ferme ? plan!.cibleRestanteCad : null,
      texte: ferme
        ? 'Le gain réalisé viendrait être absorbé par les pertes fiscales déjà disponibles.'
        : 'L’effet fiscal sera chiffré une fois les données du dossier confirmées.',
    },

    validationsAvantExecution: [
      { libelle: 'Actualiser le prix avant la transaction', statut: 'a-confirmer' },
      { libelle: 'Confirmer les pertes fiscales disponibles', statut: 'a-confirmer' },
      { libelle: 'Vérifier les positions identiques dans les comptes pertinents', statut: 'a-confirmer' },
    ],
  };
}

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
import type {
  PropositionCristallisationPosition, MeilleurMono,
} from '@/lib/profils/quantite-a-vendre';

// ⚠ LE TYPE VIT DÉSORMAIS DANS `langage-fiscal`, à côté du composant qui le
// consomme. Réexporté ici pour les appelants existants — et surtout pour que
// l'adaptateur des gains cesse d'importer depuis celui des pertes.
export type { ValidationAvantExecution } from './langage-fiscal';
import type { ValidationAvantExecution } from './langage-fiscal';

/**
 * L'ACTION — union discriminée, et c'est délibéré (§6).
 *
 * Sous un statut dégradé, la variante `a-confirmer` n'a AUCUN champ de
 * quantité. Le composant ne peut donc pas « oublier » de la masquer : elle
 * n'existe pas. C'est la sécurité posée avant le JSX plutôt qu'à l'intérieur.
 */
export type ActionPresentee =
  | {
      type: 'ferme';
      quantiteEstimeeAVendre: number;
      uniteQuantite: 'unite' | 'part';
      valeurVenteEstimeeCad: number;
      perteRealiseeEstimeeCad: number;
      cibleGlobaleCad: number;
      ecartCad: number;
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
  mono: MeilleurMono | null,
  /** Le gain net AVANT, quand la stratégie le connaît. Jamais déduit ici. */
  gainNetAvantCad: number | null = null
): PresentationCristallisationPertes {
  const retenue: PropositionCristallisationPosition | null = mono?.proposition ?? null;
  const ferme = constat.statut === 'calcule' && retenue !== null;

  // ── ÉTAPE 1 — les faits, pas un roman ────────────────────────────────────
  // Quand aucune position n'est retenue, on ne nomme personne : présenter un
  // titre « au cas où » laisserait croire qu'il a été choisi.
  const etape1 = retenue === null ? { ...VIDE, gainNetAvantCad } : {
    symbole: retenue.symbole,
    description: null as string | null,      // rempli par l'appelant (voir plus bas)
    gainNetAvantCad,
    perteLatenteDisponibleCad: retenue.perteLatenteDisponibleCad,
    compte: retenue.compteId,
    deviseNegociation: retenue.devise,
    uniteValeursRapport: retenue.uniteValeursRapport,
  };

  // ── ÉTAPE 2 — une raison FISCALE, et seulement si elle est démontrée ─────
  // ⚠ Aucun jugement d'investissement : ni « meilleur titre », ni
  // « perspectives », ni « à vendre ». Le moteur démontre une seule chose —
  // que cette position suffit à elle seule — et c'est tout ce qu'on dit.
  const couvreSeule = mono === null ? null : !mono.aucunePositionNeCouvreSeule;
  const etape2 = {
    symbole: retenue?.symbole ?? null,
    couvreSeuleLaCible: couvreSeule,
    raisonSelection: ferme && couvreSeule === true
      ? 'Cette position est retenue parce que sa perte latente permet d’atteindre '
        + 'l’objectif avec une seule transaction.'
      : null,
  };

  // ── ÉTAPE 3 — l'action, ou son absence, dans le TYPE ─────────────────────
  const action: ActionPresentee = ferme
    ? {
        type: 'ferme',
        quantiteEstimeeAVendre: retenue!.quantiteEstimeeAVendre,
        uniteQuantite: retenue!.uniteQuantite,
        valeurVenteEstimeeCad: retenue!.valeurVenteEstimeeCad,
        perteRealiseeEstimeeCad: retenue!.perteRealiseeEstimeeCad,
        cibleGlobaleCad: retenue!.cibleGlobaleCad,
        ecartCad: retenue!.ecartCad,
        dateValeurs: retenue!.dateValeurs,
      }
    : { type: 'a-confirmer', raisons: [...constat.donneesManquantes] };

  // ── ÉTAPE 4 — les trois barres, reprises telles quelles ──────────────────
  // ⚠ AUCUN `avant − perte` ICI. `gainNetApresCad` vient du moteur ou vaut
  // `null`, et `apresAffichable` dispense le document de trancher.
  const gainNetApresCad = ferme ? (retenue!.gainNetApresCad ?? null) : null;
  const etape4 = {
    gainNetAvantCad,
    perteRealiseeEstimeeCad: ferme ? retenue!.perteRealiseeEstimeeCad : null,
    gainNetApresCad,
    ecartCad: ferme ? retenue!.ecartCad : null,
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

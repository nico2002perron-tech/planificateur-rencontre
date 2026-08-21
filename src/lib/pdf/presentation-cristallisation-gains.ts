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
import type {
  MeilleurMonoGain, PropositionCristallisationGain,
} from '@/lib/profils/quantite-a-vendre-gains';
import type { ValidationAvantExecution } from './presentation-cristallisation-pertes';

/**
 * ⚠ LE TITRE DE PRÉSENTATION N'EST PAS CELUI DU CATALOGUE.
 *
 * Le catalogue porte « Récolter des gains sans payer d'impôt ». C'est une
 * PROMESSE que le contrat ne démontre pas : sur le cas de référence il reste
 * 15 $ de capacité inutilisée, et rien ne garantit que l'absorption soit
 * totale. Le champ historique reste intact — il sert ailleurs — mais le
 * document remis au client dit ce que le moteur sait réellement.
 */
export const TITRE_PRESENTATION = 'Cristallisation de gains';
export const SOUS_TITRE_PRESENTATION =
  'Réaliser des gains en utilisant vos pertes fiscales disponibles';

export type ActionGainPresentee =
  | {
      type: 'ferme';
      quantiteEstimeeAVendre: number;
      uniteQuantite: 'unite' | 'part';
      gainRealiseEstimeCad: number;
      valeurVenteEstimeeCad: number;
      cibleGainCad: number;
      ecartCad: number;
      /** La capacité du titre suffit-elle, indépendamment de l'arrondi ? */
      capaciteCouvreCible: boolean;
      executionCouvreEntierementCible: boolean;
      dateValeurs: string | null;
    }
  | { type: 'a-confirmer'; raisons: string[] };

export type PresentationCristallisationGains = {
  statut: StatutConstat;
  titre: string;
  sousTitre: string;
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

const argent = (n: number) => `${n.toLocaleString('fr-CA', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})} $`;

export function construirePresentationCristallisationGains(
  constat: Constat,
  mono: MeilleurMonoGain | null
): PresentationCristallisationGains {
  const retenue: PropositionCristallisationGain | null = mono?.proposition ?? null;
  const ferme = constat.statut === 'calcule' && retenue !== null;

  const action: ActionGainPresentee = ferme
    ? {
        type: 'ferme',
        quantiteEstimeeAVendre: retenue!.quantiteEstimeeAVendre,
        uniteQuantite: retenue!.uniteQuantite,
        gainRealiseEstimeCad: retenue!.gainRealiseEstimeCad,
        valeurVenteEstimeeCad: retenue!.valeurVenteEstimeeCad,
        cibleGainCad: retenue!.cibleGainCad,
        ecartCad: retenue!.ecartCad,
        capaciteCouvreCible: retenue!.capaciteCouvreCible,
        executionCouvreEntierementCible: retenue!.executionCouvreEntierementCible,
        dateValeurs: retenue!.dateValeurs,
      }
    : { type: 'a-confirmer', raisons: [...constat.donneesManquantes] };

  // ── LA PHRASE QUI EXPLIQUE LES 15 $ ──────────────────────────────────────
  // `capaciteCouvreCible && !executionCouvreEntierementCible` est un état
  // parfaitement normal avec des titres entiers, mais illisible tel quel. On le
  // dit en français plutôt que de laisser deux booléens au composant.
  const precisionGranularite =
    ferme && retenue!.capaciteCouvreCible && !retenue!.executionCouvreEntierementCible
      ? `Ce titre possède assez de gain latent pour porter la cible. La quantité `
        + `entière la plus proche laisse ${argent(retenue!.cibleRestanteCad)} de capacité inutilisée.`
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
      symbole: retenue?.symbole ?? null,
      description: retenue?.description ?? null,
      deviseNegociation: retenue?.devise ?? null,
      uniteValeursRapport: retenue?.uniteValeursRapport ?? null,
      action,
      precisionGranularite,
    },

    etape4: {
      gainRealiseEstimeCad: ferme ? retenue!.gainRealiseEstimeCad : null,
      pertesDisponiblesCad: ferme ? (constat.pertesDisponiblesCad ?? null) : null,
      cibleRestanteCad: ferme ? retenue!.cibleRestanteCad : null,
    },

    // « Capacité encore disponible » dit exactement ce que `cibleRestanteCad`
    // signifie ici : la part de la cible qu'aucune quantité entière n'atteint.
    etape5: {
      pertesDisponiblesCad: constat.pertesDisponiblesCad ?? null,
      gainRealiseEstimeCad: ferme ? retenue!.gainRealiseEstimeCad : null,
      capaciteEncoreDisponibleCad: ferme ? retenue!.cibleRestanteCad : null,
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

// LES FIXTURES DE PRÉSENTATION — chiffres du cas réel, société inventée.
//
// Les montants viennent de la mesure du 21 août 2026 sur les exports locaux, ce
// qui rend la page visuellement réaliste : c'est le seul moyen de juger si
// « 118 actions » saute aux yeux et si deux bandes à 0,4 % d'écart se lisent.
//
// ⚠ LA SOCIÉTÉ EST FICTIVE. Aucun symbole réel, aucun nom réel — la doctrine du
// dépôt interdit qu'un titre de client apparaisse dans une fixture.
import type {
  PresentationCristallisationPertes,
} from '../presentation-cristallisation-pertes';

/** Le cas nominal : tout est fiable, la cible est couverte par un seul titre. */
export const PRESENTATION_CALCULEE: PresentationCristallisationPertes = {
  statut: 'calcule',
  etape1: {
    symbole: 'FICT',
    description: 'Compagnie Fictive Ltée',
    gainNetAvantCad: 8997.81,
    perteLatenteDisponibleCad: 15537.41,
    compte: 'Non enregistré',
    deviseNegociation: 'CAD',
    uniteValeursRapport: 'CAD',
  },
  etape2: {
    symbole: 'FICT',
    couvreSeuleLaCible: true,
    raisonSelection:
      'Cette position est retenue parce que sa perte latente permet d’atteindre '
      + 'l’objectif avec une seule transaction.',
  },
  etape3: {
    action: {
      type: 'ferme',
      quantiteEstimeeAVendre: 118,
      uniteQuantite: 'unite',
      valeurVenteEstimeeCad: 4898.18,
      perteRealiseeEstimeeCad: 9031.6,
      cibleGlobaleCad: 8997.81,
      ecartCad: 33.79,
      dateValeurs: '2026-08-21',
    },
  },
  etape4: {
    gainNetAvantCad: 8997.81,
    perteRealiseeEstimeeCad: 9031.6,
    gainNetApresCad: 0,
    ecartCad: 33.79,
    apresAffichable: true,
  },
  etape5: {
    reductionGainCapitalNetCad: 8997.81,
    gainNetApresCad: 0,
    textePrincipal:
      'La perte réalisée viendrait réduire le gain en capital net visé pour l’année.',
    texteSecondaire:
      'Selon les données disponibles, le gain net restant après la stratégie serait d’environ 0 $.',
  },
  validationsAvantExecution: [
    { libelle: 'Actualiser le prix avant la transaction', statut: 'a-confirmer' },
    { libelle: 'Vérifier la règle de la perte apparente', statut: 'a-confirmer' },
    { libelle: 'Confirmer les positions identiques dans les comptes pertinents', statut: 'a-confirmer' },
  ],
};

/**
 * LE CAS DÉGRADÉ — la page doit rester belle ET manifestement non exécutable.
 *
 * Aucune quantité ferme, aucun « après » fabriqué. C'est le rendu qu'un
 * conseiller verra le plus souvent tant que les fiches ne sont pas remplies.
 */
export const PRESENTATION_DEGRADEE: PresentationCristallisationPertes = {
  statut: 'montant-a-confirmer',
  etape1: {
    symbole: 'FICT',
    description: 'Compagnie Fictive Ltée',
    gainNetAvantCad: 8997.81,
    perteLatenteDisponibleCad: 15537.41,
    compte: 'Non enregistré',
    deviseNegociation: 'USD',            // titre américain, montants canadiens
    uniteValeursRapport: 'CAD',
  },
  etape2: { symbole: 'FICT', couvreSeuleLaCible: null, raisonSelection: null },
  etape3: {
    action: {
      type: 'a-confirmer',
      raisons: [
        'la liste des positions détenues ailleurs qu’ici',
        'la confirmation qu’aucune perte de l’année n’est une perte apparente',
      ],
    },
  },
  etape4: {
    gainNetAvantCad: 8997.81,
    perteRealiseeEstimeeCad: null,
    gainNetApresCad: null,
    ecartCad: null,
    apresAffichable: false,
  },
  etape5: {
    reductionGainCapitalNetCad: null,
    gainNetApresCad: null,
    textePrincipal:
      'Le montant de perte à réaliser reste à confirmer avant de mesurer l’effet sur la déclaration.',
    texteSecondaire: null,
  },
  validationsAvantExecution: PRESENTATION_CALCULEE.validationsAvantExecution,
};

// LES FIXTURES DE PRÉSENTATION DES PERTES — société inventée, chiffres mesurés.
//
// Les montants viennent de la mesure du 21 août 2026 sur les exports locaux, ce
// qui rend la page visuellement réaliste : c'est le seul moyen de juger si
// « 118 actions » saute aux yeux et si deux bandes à 0,4 % d'écart se lisent.
//
// ⚠ CONSTRUITES PAR L'ADAPTATEUR, à partir d'un `PlanExecution`. Une fixture
// écrite à la main directement au format de présentation ne prouverait rien du
// passage plan → adaptateur → action — or c'est justement ce passage que les
// batteries doivent surveiller, et il porte maintenant plusieurs lignes.
//
// ⚠ LE PLAN EST UN LITTÉRAL, PAS UNE SORTIE DU MOTEUR. Le moteur a sa propre
// batterie ; ici on veut des chiffres STABLES — ceux qui ont été inspectés sur
// PDF réel — pour que les assertions visuelles restent comparables d'un lot à
// l'autre.
//
// ⚠ LA SOCIÉTÉ EST FICTIVE. Aucun symbole réel, aucun nom réel — la doctrine du
// dépôt interdit qu'un titre de client apparaisse dans une fixture.
import type { PlanExecution, LigneExecution } from '@/lib/profils/plan-execution';
import type { Constat } from '@/lib/profils/strategies';
import {
  construirePresentationCristallisationPertes, avecDescription,
  type PresentationCristallisationPertes,
} from '../presentation-cristallisation-pertes';

const DATE = '2026-08-21';

function ligne(o: Partial<LigneExecution> & { symbole: string }): LigneExecution {
  return {
    positionId: `FICT-A|${o.symbole}`, compteId: 'FICT-A',
    description: null, typeInstrument: 'Action',
    devise: 'CAD', uniteValeursRapport: 'CAD',
    quantiteDetenue: 203, quantiteAVendre: 118, uniteQuantite: 'unite',
    valeurVenteEstimeeCad: 4898.18, montantRealiseEstimeCad: 9031.6,
    montantLatentDisponibleCad: 15537.41, dateValeurs: DATE, ...o,
  };
}

const sou = (x: number) => Math.round(x * 100) / 100;

function plan(o: Partial<PlanExecution> & { lignes: LigneExecution[] }): PlanExecution {
  const realise = sou(o.lignes.reduce((s, l) => s + l.montantRealiseEstimeCad, 0));
  const cible = o.cibleCad ?? 8997.81;
  return {
    sens: 'perte',
    // ⚠ `...o` VIENT EN DERNIER, donc `lignes` doit être posé AVANT lui, sinon
    // il est écrasé par lui-même — TypeScript le dit, et il a raison.
    valeurVenteTotaleCad: sou(o.lignes.reduce((s, l) => s + l.valeurVenteEstimeeCad, 0)),
    montantRealiseTotalCad: realise,
    ecartCad: sou(realise - cible),
    cibleRestanteCad: sou(Math.max(0, cible - realise)),
    capaciteCouvreCible: true,
    executionCouvreEntierementCible: realise >= cible,
    monoTitre: o.lignes.length === 1,
    gainNetApresCad: 0,
    rechercheTronquee: false, refus: [], ...o,
    cibleCad: cible, lignes: o.lignes,
  };
}

function constat(o: Partial<Constat> = {}): Constat {
  return {
    strategie: 'cristallisation-pertes', titre: 'T', titreClient: 'TC',
    statut: 'calcule', portee: 'declaree', montantEstime: 8997.81,
    libelleMontant: 'de perte à cristalliser', recurrence: 'annuel',
    explication: '', donneesManquantes: [], sources: [],
    limiteVisibilite: null, dejaEnOrdre: false, ...o,
  } as Constat;
}

/** Le cas nominal : tout est fiable, la cible est couverte par UN SEUL titre. */
export const PRESENTATION_CALCULEE: PresentationCristallisationPertes = avecDescription(
  construirePresentationCristallisationPertes(
    constat(),
    plan({ lignes: [ligne({ symbole: 'FICT' })] }),
    8997.81
  ),
  'Compagnie Fictive Ltée'
);

/**
 * LE CAS MULTI — deux transactions pour une seule cible.
 *
 * ⚠ CE N'EST PAS L'EXCEPTION, C'EST LE CAS COURANT : dès que la cible dépasse
 * la plus grosse perte latente d'un titre, il en faut deux. La fixture existe
 * pour que les batteries voient réellement passer `lignes.length > 1` de bout
 * en bout — et pour qu'aucune ligne ne se perde en chemin.
 */
export const PRESENTATION_MULTI: PresentationCristallisationPertes =
  construirePresentationCristallisationPertes(
    constat({ montantEstime: 12000 }),
    plan({
      cibleCad: 12000,
      lignes: [
        ligne({
          symbole: 'AAA', description: 'Alpha Fictive Ltée',
          quantiteDetenue: 310, quantiteAVendre: 310,
          valeurVenteEstimeeCad: 12400, montantRealiseEstimeCad: 8600,
          montantLatentDisponibleCad: 8600,
        }),
        ligne({
          symbole: 'BBB', description: 'Beta Fictive Ltée',
          quantiteDetenue: 163, quantiteAVendre: 176,
          valeurVenteEstimeeCad: 8798.53, montantRealiseEstimeCad: 3401.23,
          montantLatentDisponibleCad: 3150,
        }),
      ],
      monoTitre: false,
    }),
    12000
  );

/**
 * LE CAS DÉGRADÉ — la page doit rester belle ET manifestement non exécutable.
 *
 * ⚠ LE PLAN EST FOURNI QUAND MÊME : c'est le STATUT qui interdit d'en tirer un
 * chiffre ferme. Si l'adaptateur lisait le plan par-dessus le statut, ce rendu
 * afficherait « 118 actions » — et les batteries le verraient.
 */
export const PRESENTATION_DEGRADEE: PresentationCristallisationPertes = avecDescription(
  construirePresentationCristallisationPertes(
    constat({
      statut: 'montant-a-confirmer', montantEstime: null,
      donneesManquantes: [
        'la liste des positions détenues ailleurs qu’ici',
        'la confirmation qu’aucune perte de l’année n’est une perte apparente',
      ],
    }),
    plan({ lignes: [ligne({ symbole: 'FICT', devise: 'USD' })] }),
    8997.81
  ),
  'Compagnie Fictive Ltée'
);

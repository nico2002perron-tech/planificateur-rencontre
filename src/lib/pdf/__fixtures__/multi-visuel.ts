// LES HUIT CAS À REGARDER — mono, multi 2, multi 5, dégradé, des deux côtés.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE.
//
// Le rendu multi ne se juge pas sur un cas : à deux lignes tout tient, à cinq
// la page respire mal, et c'est précisément le seuil qu'on veut connaître. Ces
// fixtures existent pour être RENDUES et REGARDÉES, pas seulement assertées.
//
// ⚠ TOUT PASSE PAR L'ADAPTATEUR. Construire un `ActionPresentee` à la main
// contournerait la seule chose qui compte ici — que les lignes traversent
// `PlanExecution → adaptateur → page` sans se perdre ni se réordonner.
//
// ⚠ SOCIÉTÉS ENTIÈREMENT FICTIVES. Les symboles sont inventés, les noms aussi.
// ─────────────────────────────────────────────────────────────────────────────
import type { PlanExecution, LigneExecution } from '@/lib/profils/plan-execution';
import { TITRE_CLIENT_CRISTALLISATION_GAINS } from '@/lib/profils/titres-strategies';
import type { Constat } from '@/lib/profils/strategies';
import {
  construirePresentationCristallisationPertes,
  type PresentationCristallisationPertes,
} from '../presentation-cristallisation-pertes';
import {
  construirePresentationCristallisationGains,
  type PresentationCristallisationGains,
} from '../presentation-cristallisation-gains';

const DATE = '2026-08-24';
const sou = (x: number) => Math.round(x * 100) / 100;

/**
 * SIX SOCIÉTÉS FICTIVES, de tailles et de densités différentes — pour que la
 * liste ne soit pas une répétition du même gabarit. Les descriptions sont
 * volontairement de longueurs variées : c'est là qu'un alignement casse.
 */
const TITRES = [
  { symbole: 'ALFA', description: 'Alfa Ressources Ltée', prix: 40 },
  { symbole: 'BRAVO', description: 'Bravo Technologies du Nord inc.', prix: 137.5 },
  { symbole: 'CHARLI', description: 'Charlie Fiducie', prix: 12.75 },
  { symbole: 'DELTA', description: 'Delta Industries', prix: 88 },
  { symbole: 'ECHO', description: 'Écho Gestion privée du Saint-Laurent', prix: 5.4 },
  { symbole: 'FOXTRO', description: 'Foxtrot Minéraux', prix: 61.2 },
  { symbole: 'GOLF', description: 'Golf Immobilier du Québec société en commandite', prix: 23.85 },
  { symbole: 'HOTEL', description: 'Hôtel Capital', prix: 149.9 },
];

function ligne(i: number, quantite: number, realise: number): LigneExecution {
  const t = TITRES[i % TITRES.length];
  // ⚠ AU-DELÀ DE HUIT LIGNES, on repasse sur les mêmes titres mais dans un
  // SECOND COMPTE. C'est le cas réel — un même titre détenu deux fois — et
  // surtout deux `positionId` distincts : une clé React en double laisserait
  // une ligne disparaître sans que rien ne rougisse.
  const compteId = i < TITRES.length ? 'FICT-A' : 'FICT-B';
  return {
    positionId: `${compteId}|${t.symbole}`, compteId,
    symbole: t.symbole, description: t.description,
    typeInstrument: 'Action', devise: 'CAD', uniteValeursRapport: 'CAD',
    quantiteDetenue: quantite * 3, quantiteAVendre: quantite, uniteQuantite: 'unite',
    valeurVenteEstimeeCad: sou(quantite * t.prix),
    montantRealiseEstimeCad: sou(realise),
    montantLatentDisponibleCad: sou(realise * 1.4),
    dateValeurs: DATE,
  };
}

function plan(
  sens: 'perte' | 'gain', lignes: LigneExecution[], cibleCad: number,
  o: Partial<PlanExecution> = {}
): PlanExecution {
  const realise = sou(lignes.reduce((s, l) => s + l.montantRealiseEstimeCad, 0));
  return {
    sens, cibleCad, lignes,
    valeurVenteTotaleCad: sou(lignes.reduce((s, l) => s + l.valeurVenteEstimeeCad, 0)),
    montantRealiseTotalCad: realise,
    ecartCad: sou(realise - cibleCad),
    cibleRestanteCad: sou(Math.max(0, cibleCad - realise)),
    capaciteCouvreCible: true,
    executionCouvreEntierementCible: realise >= cibleCad,
    monoTitre: lignes.length === 1,
    // ⚠ CALCULÉ, PAS POSÉ À ZÉRO. Le zéro en dur affichait « Objectif
    // atteint » sur un plan qui restait 149,56 $ SOUS la cible : la fixture
    // masquait exactement le genre de défaut qu'elle sert à révéler.
    gainNetApresCad: sens === 'perte' ? sou(Math.max(0, cibleCad - realise)) : null,
    rechercheTronquee: false, refus: [], ...o,
  };
}

const constatPertes = (montant: number | null, o: Partial<Constat> = {}): Constat => ({
  strategie: 'cristallisation-pertes', titre: 'T',
  titreClient: 'Réduire l’impôt sur vos gains de l’année',
  statut: montant === null ? 'montant-a-confirmer' : 'calcule',
  portee: 'declaree', montantEstime: montant,
  libelleMontant: 'de perte à cristalliser', recurrence: 'annuel',
  explication: '', donneesManquantes: [], sources: [],
  limiteVisibilite: null, dejaEnOrdre: false, ...o,
} as Constat);

const constatGains = (montant: number | null, o: Partial<Constat> = {}): Constat => ({
  strategie: 'cristallisation-gains', titre: 'T',
  titreClient: TITRE_CLIENT_CRISTALLISATION_GAINS,
  statut: montant === null ? 'montant-a-confirmer' : 'calcule',
  portee: 'declaree', montantEstime: montant,
  libelleMontant: 'de gain cristallisable', recurrence: 'annuel',
  explication: '', donneesManquantes: [], sources: [],
  limiteVisibilite: null, dejaEnOrdre: false,
  gainsLatentsCad: 64000, pertesDisponiblesCad: montant ?? 32000, ...o,
} as Constat);

// ── LES QUANTITÉS, choisies pour que les totaux ne tombent JAMAIS pile ──────
// Un plan qui atterrit exactement sur la cible cacherait l'écart, c'est-à-dire
// la chose même que le document doit savoir dire.
const L1 = [ligne(0, 118, 9031.6)];
const L2 = [ligne(0, 310, 8600), ligne(1, 176, 3401.23)];
const L3 = [ligne(0, 310, 8600), ligne(1, 176, 3401.23), ligne(2, 1240, 7746.4)];
const L5 = [
  ligne(0, 310, 8600), ligne(1, 176, 3401.23), ligne(2, 1240, 7746.4),
  ligne(3, 64, 2118.75), ligne(4, 2035, 984.06),
];
// ⚠ HUIT LIGNES N'EST PAS UN CAS ATTENDU — c'est la SONDE. La consigne demande
// de dire à partir de combien la page respire mal ; on ne peut pas répondre en
// ne regardant que des cas confortables.
const L8 = [
  ...L5, ligne(5, 88, 1502.9), ligne(6, 412, 2740.55), ligne(7, 31, 806.4),
];
// ⚠ QUATORZE LIGNES : LE CAS QUI NE DOIT PAS SILENCIEUSEMENT PERDRE UN ORDRE.
// Personne n'attend un plan pareil ; c'est précisément pour ça qu'il faut le
// rendre au moins une fois. Un document qui ROGNE la quatorzième transaction
// est pire qu'un document laid.
const L14 = [
  ...L8,
  ligne(8, 205, 1902.4), ligne(9, 74, 1188.05), ligne(10, 930, 2044.7),
  ligne(11, 52, 1613.3), ligne(12, 168, 977.85), ligne(13, 26, 1355.6),
];

// ── PERTES ─────────────────────────────────────────────────────────────────
export const PERTE_MONO: PresentationCristallisationPertes =
  construirePresentationCristallisationPertes(
    constatPertes(8997.81), plan('perte', L1, 8997.81), 8997.81);

export const PERTE_MULTI_2: PresentationCristallisationPertes =
  construirePresentationCristallisationPertes(
    constatPertes(12000), plan('perte', L2, 12000, { monoTitre: false }), 12000);

export const PERTE_MULTI_5: PresentationCristallisationPertes =
  construirePresentationCristallisationPertes(
    constatPertes(23000), plan('perte', L5, 23000, { monoTitre: false }), 23000);

export const PERTE_MULTI_3: PresentationCristallisationPertes =
  construirePresentationCristallisationPertes(
    constatPertes(19500), plan('perte', L3, 19500, { monoTitre: false }), 19500);

export const PERTE_MULTI_8: PresentationCristallisationPertes =
  construirePresentationCristallisationPertes(
    constatPertes(28000), plan('perte', L8, 28000, { monoTitre: false }), 28000);

export const PERTE_MULTI_14: PresentationCristallisationPertes =
  construirePresentationCristallisationPertes(
    constatPertes(37000), plan('perte', L14, 37000, { monoTitre: false }), 37000);

export const PERTE_DEGRADEE: PresentationCristallisationPertes =
  construirePresentationCristallisationPertes(
    constatPertes(null, {
      donneesManquantes: [
        'la liste des positions détenues ailleurs qu’ici',
        'la confirmation qu’aucune perte de l’année n’est une perte apparente',
      ],
    }),
    plan('perte', L1, 8997.81), 8997.81);

// ── GAINS ──────────────────────────────────────────────────────────────────
export const GAIN_MONO: PresentationCristallisationGains =
  construirePresentationCristallisationGains(
    constatGains(12000), plan('gain', [ligne(0, 141, 11985)], 12000));

export const GAIN_MULTI_2: PresentationCristallisationGains =
  construirePresentationCristallisationGains(
    constatGains(20000), plan('gain', L2, 20000, { monoTitre: false }));

export const GAIN_MULTI_5: PresentationCristallisationGains =
  construirePresentationCristallisationGains(
    constatGains(23000), plan('gain', L5, 23000, { monoTitre: false }));

export const GAIN_DEGRADEE: PresentationCristallisationGains =
  construirePresentationCristallisationGains(
    constatGains(null, {
      donneesManquantes: ['la liste des positions détenues ailleurs'],
    }),
    plan('gain', [ligne(0, 141, 11985)], 12000));

/** Les huit cas, nommés — l'aperçu et les tests parcourent la même liste. */
export const CAS_VISUELS = [
  { nom: 'perte-mono', p: PERTE_MONO, sens: 'perte' as const },
  { nom: 'perte-multi-2', p: PERTE_MULTI_2, sens: 'perte' as const },
  { nom: 'perte-multi-3', p: PERTE_MULTI_3, sens: 'perte' as const },
  { nom: 'perte-multi-5', p: PERTE_MULTI_5, sens: 'perte' as const },
  { nom: 'perte-multi-8', p: PERTE_MULTI_8, sens: 'perte' as const },
  { nom: 'perte-multi-14', p: PERTE_MULTI_14, sens: 'perte' as const },
  { nom: 'perte-degradee', p: PERTE_DEGRADEE, sens: 'perte' as const },
];
export const CAS_VISUELS_GAINS = [
  { nom: 'gain-mono', p: GAIN_MONO },
  { nom: 'gain-multi-2', p: GAIN_MULTI_2 },
  { nom: 'gain-multi-5', p: GAIN_MULTI_5 },
  { nom: 'gain-degradee', p: GAIN_DEGRADEE },
];

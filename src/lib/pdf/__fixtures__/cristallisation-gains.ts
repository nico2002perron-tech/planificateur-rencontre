// LES FIXTURES DE PRÉSENTATION DES GAINS — société inventée, chiffres du cas
// de référence mesuré le 21 août 2026 sur les exports locaux.
//
// ⚠ CONSTRUITES PAR L'ADAPTATEUR, pas écrites à la main. La page inspectée sur
// PDF et la page mise sous test décrivent alors le MÊME objet : si l'adaptateur
// change, l'aperçu et les tests bougent ensemble. Une fixture littérale aurait
// pu diverger sans que rien ne rougisse.
//
// ⚠ LA SOCIÉTÉ EST FICTIVE. Aucun symbole réel, aucun nom réel.
import type { Constat } from '@/lib/profils/strategies';
import type {
  MeilleurMonoGain, PropositionCristallisationGain,
} from '@/lib/profils/quantite-a-vendre-gains';
import {
  construirePresentationCristallisationGains,
} from '../presentation-cristallisation-gains';

/**
 * LE CAS DE RÉFÉRENCE, ET SON ARÊTE VIVE : 141 actions rapportent 11 985 $ pour
 * une cible de 12 000 $. La capacité du titre couvre la cible (28 900 $ de gain
 * latent) mais aucune quantité ENTIÈRE ne tombe dessus — d'où −15 $ d'écart et
 * 15 $ de capacité inutilisée. C'est exactement l'état que la page doit savoir
 * raconter sans le maquiller.
 */
export function propositionGainFictive(
  o: Partial<PropositionCristallisationGain> = {}
): PropositionCristallisationGain {
  return {
    positionId: 'FICT-A|FICT', compteId: 'FICT-A', symbole: 'FICT',
    description: 'Compagnie Fictive Ltée', typeInstrument: 'Action',
    devise: 'CAD', uniteValeursRapport: 'CAD',
    quantiteDetenue: 340, quantiteEstimeeAVendre: 141, uniteQuantite: 'unite',
    gainLatentDisponibleCad: 28900, gainParUniteCad: 85, valeurParUniteCad: 140,
    valeurVenteEstimeeCad: 19740, gainRealiseEstimeCad: 11985,
    cibleGainCad: 12000, cibleLocaleCad: 12000, ecartCad: -15, cibleRestanteCad: 15,
    capaciteCouvreCible: true, executionCouvreEntierementCible: false,
    dateValeurs: '2026-08-21', ...o,
  };
}

export function constatGainFictif(o: Partial<Constat> = {}): Constat {
  return {
    strategie: 'cristallisation-gains', titre: 'T',
    titreClient: 'Récolter des gains sans payer d’impôt',
    statut: 'calcule', portee: 'declaree', montantEstime: 12000,
    libelleMontant: 'de gain cristallisable', recurrence: 'annuel',
    explication: '', donneesManquantes: [], sources: [],
    limiteVisibilite: null, dejaEnOrdre: false,
    gainsLatentsCad: 28900, pertesDisponiblesCad: 12000, ...o,
  } as Constat;
}

export function monoGainFictif(o?: Partial<PropositionCristallisationGain>): MeilleurMonoGain {
  return {
    proposition: propositionGainFictive(o), aucunePositionNeCouvreSeule: false,
    propositions: [propositionGainFictive(o)], refus: [],
  };
}

/** Le cas nominal : un seul titre porte la cible, à 15 $ près. */
export const PRESENTATION_GAINS_CALCULEE = construirePresentationCristallisationGains(
  constatGainFictif(), monoGainFictif()
);

/**
 * LE CAS DÉGRADÉ — la page reste lisible ET manifestement non exécutable.
 *
 * ⚠ LE PLAN MOTEUR EST FOURNI QUAND MÊME. C'est le piège que la page doit
 * survivre : la proposition existe dans l'objet, mais le statut interdit d'en
 * tirer un chiffre ferme. Si la page savait lire `mono.proposition` par-dessus
 * le statut, ce rendu afficherait « 141 actions » — et le test le verrait.
 */
export const PRESENTATION_GAINS_DEGRADEE = construirePresentationCristallisationGains(
  constatGainFictif({
    statut: 'montant-a-confirmer', montantEstime: null,
    donneesManquantes: ['la liste des positions détenues ailleurs'],
  }),
  monoGainFictif()
);

/** Le même cas nominal, sur un titre négocié en USD dont les montants sont en CAD. */
export const PRESENTATION_GAINS_USD = construirePresentationCristallisationGains(
  constatGainFictif(), monoGainFictif({ devise: 'USD', uniteValeursRapport: 'CAD' })
);

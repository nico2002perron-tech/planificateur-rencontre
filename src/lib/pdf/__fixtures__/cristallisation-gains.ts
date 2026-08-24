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
import { TITRE_CLIENT_CRISTALLISATION_GAINS } from '@/lib/profils/titres-strategies';
import type { PlanExecution, LigneExecution } from '@/lib/profils/plan-execution';
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
export function ligneGainFictive(
  o: Partial<LigneExecution> = {}
): LigneExecution {
  return {
    positionId: 'FICT-A|FICT', compteId: 'FICT-A', symbole: 'FICT',
    description: 'Compagnie Fictive Ltée', typeInstrument: 'Action',
    devise: 'CAD', uniteValeursRapport: 'CAD',
    quantiteDetenue: 340, quantiteAVendre: 141, uniteQuantite: 'unite',
    valeurVenteEstimeeCad: 19740, montantRealiseEstimeCad: 11985,
    montantLatentDisponibleCad: 28900,
    dateValeurs: '2026-08-21', ...o,
  };
}

const sou = (x: number) => Math.round(x * 100) / 100;

/**
 * ⚠ UN PLAN LITTÉRAL, PAS UNE SORTIE DU MOTEUR. Le moteur a sa propre batterie ;
 * ici on veut les chiffres STABLES qui ont été inspectés sur PDF réel, pour que
 * les assertions visuelles restent comparables d'un lot à l'autre.
 */
export function planGainFictif(
  o: Partial<PlanExecution> & { lignes?: LigneExecution[] } = {}
): PlanExecution {
  const lignes = o.lignes ?? [ligneGainFictive()];
  const realise = sou(lignes.reduce((s, l) => s + l.montantRealiseEstimeCad, 0));
  const cible = o.cibleCad ?? 12000;
  return {
    sens: 'gain',
    valeurVenteTotaleCad: sou(lignes.reduce((s, l) => s + l.valeurVenteEstimeeCad, 0)),
    montantRealiseTotalCad: realise,
    ecartCad: sou(realise - cible),
    cibleRestanteCad: sou(Math.max(0, cible - realise)),
    capaciteCouvreCible: true,
    executionCouvreEntierementCible: realise >= cible,
    monoTitre: lignes.length === 1,
    // ⚠ TOUJOURS `null` CÔTÉ GAINS : cristalliser un gain n'absorbe aucun gain
    // net. Voir `pertinentPourLeSens` dans le plan canonique.
    gainNetApresCad: null,
    rechercheTronquee: false, refus: [], ...o,
    cibleCad: cible, lignes,
  };
}

export function constatGainFictif(o: Partial<Constat> = {}): Constat {
  return {
    strategie: 'cristallisation-gains', titre: 'T',
    titreClient: TITRE_CLIENT_CRISTALLISATION_GAINS,
    statut: 'calcule', portee: 'declaree', montantEstime: 12000,
    libelleMontant: 'de gain cristallisable', recurrence: 'annuel',
    explication: '', donneesManquantes: [], sources: [],
    limiteVisibilite: null, dejaEnOrdre: false,
    gainsLatentsCad: 28900, pertesDisponiblesCad: 12000, ...o,
  } as Constat;
}

/** Raccourci : un plan à un seul titre, éventuellement ajusté. */
export const monoGainFictif = (o?: Partial<LigneExecution>): PlanExecution =>
  planGainFictif({ lignes: [ligneGainFictive(o)] });

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

/**
 * LE CAS MULTI — deux transactions pour une seule cible.
 *
 * ⚠ LE CAS COURANT, PAS L'EXCEPTION. Sur le dossier de référence, la cible de
 * 12 000 $ dépasse de 15 $ le plus gros gain latent d'un seul titre : il en
 * faut deux. La fixture existe pour que les batteries voient réellement passer
 * `lignes.length > 1` de bout en bout, sans qu'aucune ligne se perde.
 */
export const PRESENTATION_GAINS_MULTI = construirePresentationCristallisationGains(
  constatGainFictif({ montantEstime: 20000 }),
  planGainFictif({
    cibleCad: 20000,
    monoTitre: false,
    lignes: [
      ligneGainFictive({
        symbole: 'FICT', description: 'Compagnie Fictive Ltée',
        quantiteAVendre: 141, valeurVenteEstimeeCad: 19740,
        montantRealiseEstimeCad: 11985, montantLatentDisponibleCad: 11985,
      }),
      ligneGainFictive({
        positionId: 'FICT-A|SECO', symbole: 'SECO', description: 'Seconde Fictive Ltée',
        quantiteDetenue: 400, quantiteAVendre: 292,
        valeurVenteEstimeeCad: 32120, montantRealiseEstimeCad: 8030,
        montantLatentDisponibleCad: 11000,
      }),
    ],
  })
);

// LE REGISTRE DES STRATÉGIES QUI ONT UNE PAGE EN CINQ ÉTAPES.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE : POUR QU'UNE STRATÉGIE NE PUISSE PAS SORTIR
// ANONYME.
//
// Jusqu'ici, les deux pages rendaient leurs cinq étapes sans jamais se nommer.
// Le titre était posé par le harnais d'aperçu — chacun le sien, hors de toute
// vérification. Un assembleur réel qui aurait branché une de ces pages dans le
// document fiscal l'aurait sortie sans titre, et rien n'aurait rougi.
//
// Maintenant :
//   · chaque page porte son `EnteteStrategie`, dont les deux champs sont
//     obligatoires (`sousTitre` est nullable : on peut le REFUSER, pas
//     l'OUBLIER) ;
//   · `PageStrategieFiscale` exige cet en-tête pour rendre la page ;
//   · ce registre est le point d'entrée unique de l'assembleur ;
//   · un test parcourt le registre et exige que chaque entrée produise
//     réellement son titre. Ajouter une stratégie sans fixture d'assemblage ne
//     compile pas — le test est typé `Record<CleStrategieVisuelle, …>`.
// ─────────────────────────────────────────────────────────────────────────────
import type React from 'react';
import type { EnteteStrategie } from './langage-fiscal';
import {
  ENTETE_CRISTALLISATION_PERTES, PageStrategieCristallisationPertes,
} from './page-cristallisation-pertes';
import {
  ENTETE_CRISTALLISATION_GAINS, PageStrategieCristallisationGains,
} from './page-cristallisation-gains';
import type { PresentationCristallisationPertes } from './presentation-cristallisation-pertes';
import type { PresentationCristallisationGains } from './presentation-cristallisation-gains';

export type EntreeStrategieVisuelle<P> = {
  entete: EnteteStrategie;
  Page: (props: {
    presentation: P;
    logos?: Record<string, string>;
    pied?: React.ReactNode;
  }) => React.ReactElement;
};

/** Conserve le type de la présentation propre à chaque stratégie. */
const entree = <P,>(e: EntreeStrategieVisuelle<P>) => e;

export const STRATEGIES_VISUELLES = {
  'cristallisation-pertes': entree<PresentationCristallisationPertes>({
    entete: ENTETE_CRISTALLISATION_PERTES,
    Page: PageStrategieCristallisationPertes,
  }),
  'cristallisation-gains': entree<PresentationCristallisationGains>({
    entete: ENTETE_CRISTALLISATION_GAINS,
    Page: PageStrategieCristallisationGains,
  }),
} as const;

export type CleStrategieVisuelle = keyof typeof STRATEGIES_VISUELLES;

export const CLES_STRATEGIES_VISUELLES =
  Object.keys(STRATEGIES_VISUELLES) as CleStrategieVisuelle[];

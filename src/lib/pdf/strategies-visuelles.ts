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
import React from 'react';
import type { EnteteStrategie } from './langage-fiscal';
import {
  ENTETE_CRISTALLISATION_PERTES, PageStrategieCristallisationPertes,
} from './page-cristallisation-pertes';
import {
  ENTETE_CRISTALLISATION_GAINS, PageStrategieCristallisationGains,
} from './page-cristallisation-gains';
import {
  construirePresentationCristallisationPertes,
  type PresentationCristallisationPertes,
} from './presentation-cristallisation-pertes';
import {
  construirePresentationCristallisationGains,
  type PresentationCristallisationGains,
} from './presentation-cristallisation-gains';
import type { Constat } from '@/lib/profils/strategies';

/** Ce que l'assembleur peut poser sur une page de stratégie, quelle qu'elle soit. */
export type OptionsRendu = {
  /** Le cache de logos DÉJÀ RÉSOLU. Aucun accès réseau : voir logo-societe-fiscal. */
  logos?: Record<string, string>;
  /** La mention « usage interne », quand le document la porte. */
  pied?: React.ReactNode;
  /** Le nom du document hôte — une page ne peut pas le deviner. */
  libellePied?: string;
};

export type EntreeStrategieVisuelle<P> = {
  entete: EnteteStrategie;
  /**
   * ⚠ LA BRANCHE QUI MANQUAIT, ET TOUT LE LOT TIENT DEDANS.
   *
   * Le registre savait RENDRE une présentation ; personne ne savait en
   * FABRIQUER une depuis un constat. Résultat mesuré : les deux constructeurs
   * de présentation n'étaient appelés que par des tests, et le document de
   * production ne rendait aucune des deux pages en cinq étapes.
   */
  construire: (constat: Constat) => P;
  Page: (props: { presentation: P } & OptionsRendu) => React.ReactElement;
};

/**
 * Conserve le type de la présentation propre à chaque stratégie, ET expose une
 * forme utilisable SANS le connaître.
 *
 * ⚠ C'EST TOUT L'INTÉRÊT DE CE HELPER. À l'intérieur, `construire` et `Page`
 * partagent le même `P` et le vérificateur le prouve. À l'extérieur, l'assembleur
 * itère sur des clés : il ne peut plus rien savoir de `P`, et devrait forcer un
 * `any` pour appeler `Page`. `rendre` est la porte non générique qui évite ça —
 * le typage reste vrai, et aucune assertion de type n'est écrite nulle part.
 */
const entree = <P,>(e: EntreeStrategieVisuelle<P>) => ({
  ...e,
  rendre: (constat: Constat, options: OptionsRendu = {}): React.ReactElement =>
    React.createElement(e.Page, { presentation: e.construire(constat), ...options }),
});

export const STRATEGIES_VISUELLES = {
  'cristallisation-pertes': entree<PresentationCristallisationPertes>({
    entete: ENTETE_CRISTALLISATION_PERTES,
    // ⚠ AUCUNE DÉDUCTION ICI. `planExecution` est la seule source de « combien
    // vendre » ; `gainNetRealiseCad` est le gain que la stratégie vient réduire,
    // exposé par le moteur. Absents, l'adaptateur produit une action
    // « à confirmer » — c'est exactement ce qu'il doit faire.
    construire: (c) => construirePresentationCristallisationPertes(
      c, c.planExecution ?? null, c.gainNetRealiseCad ?? null),
    Page: PageStrategieCristallisationPertes,
  }),
  'cristallisation-gains': entree<PresentationCristallisationGains>({
    entete: ENTETE_CRISTALLISATION_GAINS,
    construire: (c) => construirePresentationCristallisationGains(c, c.planExecution ?? null),
    Page: PageStrategieCristallisationGains,
  }),
} as const;

export type CleStrategieVisuelle = keyof typeof STRATEGIES_VISUELLES;

export const CLES_STRATEGIES_VISUELLES =
  Object.keys(STRATEGIES_VISUELLES) as CleStrategieVisuelle[];

/** Cette stratégie a-t-elle une page dédiée dans le document ? */
export function aUnePageDetaillee(strategie: string): strategie is CleStrategieVisuelle {
  return Object.prototype.hasOwnProperty.call(STRATEGIES_VISUELLES, strategie);
}

/**
 * LES PAGES DE STRATÉGIE D'UN RÉSULTAT, DANS L'ORDRE DES CONSTATS.
 *
 * ⚠ L'ORDRE EST CELUI DE LA SYNTHÈSE, ET CE N'EST PAS UN DÉTAIL. Deux listes
 * ordonnées différemment obligeraient le lecteur à chercher, dans dix pages,
 * celle qui développe la carte qu'il vient de lire.
 *
 * ⚠ ET LE STATUT NE FILTRE RIEN. Une stratégie enregistrée obtient sa page
 * même sous `montant-a-confirmer`, `indisponible` ou `non-applicable` : le
 * nouveau système sait déjà présenter l'absence de transaction ferme, et
 * renvoyer les statuts dégradés vers l'ancienne carte jaune ferait cohabiter
 * deux designs pour la même stratégie.
 */
export function pagesDeStrategie(
  constats: Constat[], options: OptionsRendu = {}
): React.ReactElement[] {
  return constats
    .filter((c) => aUnePageDetaillee(c.strategie))
    .map((c) => React.cloneElement(
      STRATEGIES_VISUELLES[c.strategie as CleStrategieVisuelle].rendre(c, options),
      { key: c.strategie }
    ));
}

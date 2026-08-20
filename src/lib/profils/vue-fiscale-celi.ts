// LA COUCHE « MONTANT FISCAL CAD » DU CELI — préparation de la migration des
// droits (20 août 2026). ADDITIVE : rien ne la consomme encore, aucun droit
// n'est calculé ici, et `deriverHistoriqueRegime` n'est pas touchée.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA RÈGLE UNIQUE : UN NOMBRE SEUL NE SUFFIT JAMAIS.
//
// Chaque montant CAD porte sa source, sa confiance, son motif et les
// événements qui le fondent. Et « 1 000 USD » ne devient JAMAIS « 1 000 CAD » :
// sans source fiable, l'équivalent CAD est `null` AVEC son motif — jamais 1:1,
// jamais un taux de marché, jamais une moyenne. Le système sait dire
// « inconnu » ; c'est sa qualité première, pas un manque.
//
// LES DEUX QUESTIONS D'UN RETRAIT NE SE CONFONDENT PAS (consigne §10) :
//   A. quel est le montant CAD ?          ← cette couche répond quand elle peut
//   B. est-ce un VRAI retrait CELI ?      ← D1/D2, résolution de NATURE, future
// Un retrait « à confirmer » dont le montant CAD est parfaitement connu reste
// À CONFIRMER : il n'entre jamais dans `retraitsCadConfirmes`.
//
// LES SOURCES RECONNUES, de la plus forte à l'absence :
//   resolution-manuelle      le planificateur/fiscaliste a confirmé LE montant
//                            (grandeur CAD, datée) — confiance `confirme`,
//                            l'événement source reste INTACT. Réservée aux
//                            événements en devise ÉTRANGÈRE : un montant déjà
//                            en CAD est une donnée exacte, une résolution ne le
//                            remplace pas (elle est ignorée ET déclarée) ;
//   transaction-cad          la ligne est en CAD — aucun taux, `confirme` ;
//   taux-explicite-croesus   la NOTE DE LA LIGNE MÊME annonce UN taux par
//                            mot-clé (`tauxExplicitesDansNote`, convention
//                            DIRECTE mesurée : CAD par USD — USD SEULEMENT).
//                            GARDES (contre-expertise du 20 août) : un « @ »
//                            seul ne compte que si la note porte un vocabulaire
//                            de conversion (TAUX/RATE/CONV) — sinon c'est la
//                            notation d'un PRIX, pas d'un taux ; une note
//                            « EN USD » est refusée (convention jamais mesurée,
//                            seule « EN CAD » l'a été). Confiance `eleve`,
//                            JAMAIS `confirme` : sur une jambe FX le ratio
//                            valide le taux ; ici rien ne le valide. Deux taux
//                            différents = CONTRADICTION → `ambigu`, null ;
//   conversion-fx-rapprochee RÉSERVÉE, jamais émise aujourd'hui : les jambes
//                            FX mesurées sont des Transfert/Réception
//                            d'encaisse jumelle E/F — jamais une cotisation ni
//                            un retrait CELI — et la PROXIMITÉ (même jour,
//                            même famille) n'est PAS une relation
//                            transactionnelle. Le jour où le grand livre
//                            démontre un lien, la source existe déjà dans le
//                            vocabulaire ; d'ici là, aucune attribution ;
//   inconnue                 tout le reste : `montantCad = null`, motif honnête.
//
// CE QUE CETTE COUCHE REFUSE PAR CONSTRUCTION (consigne §8) : le taux Banque
// du Canada, le taux quotidien, la moyenne mensuelle, et `useUsdCadRate`
// (Yahoo, rafraîchi aux 5 min) — ce dernier est un outil d'AFFICHAGE de
// portefeuille (proposition, PretAColler) et ne doit jamais toucher un montant
// fiscal. Aucun de ces chemins n'est importé ici, et le test « aucun taux
// externe inventé » tient la porte fermée.
//
// CONFIDENTIALITÉ : les `diagnostics` de cette vue sont des COMPTAGES
// SEULEMENT, comme partout dans le dépôt. Les clés d'événement (elles portent
// un numéro de compte, comme `TransfertResolu`) vivent dans `evenements` et
// `resolutions.ignorees` — des données d'écran interne, jamais des
// diagnostics. La devise, colonne non validée d'un collage, est GARDÉE avant
// d'entrer dans une clé ou un motif (`deviseSure`) — la leçon de la colonne
// « type » du 19 août.
// ─────────────────────────────────────────────────────────────────────────────

import { canoniserCompte } from '@/lib/parseur-croesus/identifiant-compte';
import { tauxExplicitesDansNote } from './rapprochement';
import {
  sortiesCeliAConfirmer, ambigusCeliResiduels,
  type LigneDuTemps, type EvenementFlux,
} from './ligne-du-temps';
import type { Portee, ReponseTernaire } from './types';

// ═══ LES TYPES ═══════════════════════════════════════════════════════════════

export type SourceMontantCad =
  | 'transaction-cad'
  | 'taux-explicite-croesus'
  | 'conversion-fx-rapprochee'
  | 'resolution-manuelle'
  | 'inconnue';

export type ConfianceMontantCad = 'confirme' | 'eleve' | 'ambigu' | 'inconnu';

/**
 * UN montant fiscal CAD, avec toute sa provenance. `montantCad` porte le SIGNE
 * de `montantOriginal` (une cotisation reste positive, un retrait négatif) —
 * les agrégats de la vue prennent la grandeur quand il le faut.
 */
export type MontantFiscalCad = {
  /** L'événement de la timeline (id = indice d'entrée, valable pour CE lot). */
  evenementId: number;
  /** L'identité STABLE entre imports : compte|date|devise|montant. */
  cleEvenement: string;
  annee: string;
  /** Le montant TEL QU'ÉCRIT dans la transaction, dans sa devise. */
  montantOriginal: number;
  /** La devise GARDÉE : trois lettres, ou « (devise-invalide) » — jamais un texte brut de collage. */
  deviseOriginale: string;
  /** `null` tant qu'aucune source fiable — jamais 0, jamais 1:1. */
  montantCad: number | null;
  source: SourceMontantCad;
  confiance: ConfianceMontantCad;
  tauxUtilise: number | null;
  /** La date du taux = la date de la transaction qui le porte. */
  dateTaux: string | null;
  motif: string;
  /** Les événements qui fondent ce montant. */
  sources: number[];
};

export type RoleFiscalCeli =
  | 'cotisation'                // argent neuf ferme
  | 'cotisation-a-confirmer'    // une ENTRÉE dont la nature n'est pas tranchée (virement non résolu) — §18/§19
  | 'retrait-ferme'
  | 'retrait-a-confirmer';

export type EvenementFiscalCeli = {
  /** La nature du flux — question B, INDÉPENDANTE du montant (question A). */
  role: RoleFiscalCeli;
  fiscal: MontantFiscalCad;
};

/**
 * Une résolution manuelle : « transaction X, montant fiscal CAD = Y » — sans
 * jamais modifier la transaction historique. Même famille que
 * `TransfertResolu` (types.ts) : clé de contenu stable, date obligatoire.
 */
export type ResolutionMontantFiscalCad = {
  /** `cleEvenementFiscal(compte, date, devise, montant)` de l'événement visé. */
  cleEvenement: string;
  /** La GRANDEUR fiscale en CAD, toujours POSITIVE — la couche applique le signe de la transaction. */
  montantCad: number;
  /** Obligatoire : une résolution non datée ne vaut rien (précédent TransfertResolu). */
  dateResolution: string;
  /** Écrite par le planificateur ; jamais recopiée dans un motif — référencée seulement. */
  note: string | null;
};

const DEVISE_VALIDE = /^[A-Z]{3}$/;
const DEVISE_INVALIDE = '(devise-invalide)';

/** La devise, GARDÉE avant toute prose ou clé — un collage décalé ne fait pas fuir un texte. */
function deviseSure(devise: string): string {
  const d = (devise || 'CAD').toUpperCase();
  return DEVISE_VALIDE.test(d) ? d : DEVISE_INVALIDE;
}

/**
 * L'identité stable d'un événement entre deux imports — le miroir de
 * `cleTransfert` (compte|date|montant), plus la devise : nos événements en ont
 * plusieurs. `montant` est le total SIGNÉ tel qu'écrit dans la transaction.
 */
export function cleEvenementFiscal(compte: string, date: string, devise: string, montant: number): string {
  return `${canoniserCompte(compte)}|${date}|${deviseSure(devise)}|${montant.toFixed(2)}`;
}

export type AnneeFiscaleCeli = {
  /** Σ des montants CAD `confirme` des cotisations (signés — une correction se soustrait). */
  cotisationsCadConfirmees: number;
  /** Σ des montants CAD `eleve` des cotisations — proposés, à valider. */
  cotisationsCadAConfirmer: number;
  /** Grandeur : retraits FERMES à montant `confirme` — les deux questions répondues. */
  retraitsCadConfirmes: number;
  /** Grandeur : montant connu mais nature à confirmer, OU montant `eleve`. */
  retraitsCadAConfirmer: number;
  /** Les événements dont le montant CAD est `null` — déclarés, jamais fondus. */
  evenementsSansMontantCad: number[];
  /** Les ids qui composent chaque agrégat — la traçabilité de chaque somme. */
  sources: {
    cotisationsCadConfirmees: number[];
    cotisationsCadAConfirmer: number[];
    retraitsCadConfirmes: number[];
    retraitsCadAConfirmer: number[];
  };
};

export type VueFiscaleCeli = {
  parAnnee: Record<string, AnneeFiscaleCeli>;
  /** UN par événement CELI exprimable (cotisations + retraits fermes + à confirmer), ordre des ids. */
  evenements: EvenementFiscalCeli[];
  /** Le sort des résolutions manuelles — données d'écran interne (les clés portent un compte). */
  resolutions: {
    appliquees: number;
    /** Les refus, TOUS déclarés avec leur motif — jamais un refus silencieux. */
    ignorees: { cleEvenement: string; motif: string }[];
  };
  completude: {
    /** STRICT : toutes les cotisations ont un montant CAD `confirme` ET rien de CELI n'échappe à la vue. Vrai à vide — croiser avec `portee`. */
    toutesCotisationsEnCadFiscal: boolean;
    /** STRICT : tous les retraits (fermes ET à confirmer) ont un montant CAD `confirme` ET rien n'échappe — question A seulement. */
    tousRetraitsEnCadFiscal: boolean;
    /** Question B : aucune sortie à confirmer, aucun ambigu CELI, rien qui échappe à la vue. */
    retraitsNatureConfirmee: boolean;
    /**
     * FOURNIE par l'appelant depuis la consolidation (jamais devinée d'ici) :
     * « oui » = l'absence d'activité externe est confirmée par le client.
     */
    activiteExterneConfirmeeAbsente: ReponseTernaire;
    evenementsCeliAmbigus: number;
    /**
     * LES ÉVÉNEMENTS CELI QUE LA VUE NE SAIT PAS EXPRIMER — virements internes
     * (étape 4 non faite), non-agrégés (ex. « Dépôt » que la règle 2 ne voit
     * pas), libellés inconnus. Tant qu'il y en a, AUCUN des trois drapeaux
     * ci-dessus ne monte : « tout est exprimable » ne peut se dire que si la
     * vue a VU tout ce qui est CELI (contre-expertise du 20 août — un
     * Transfert noté ou un Dépôt laissaient un faux vert intégral).
     */
    evenementsCeliNonExprimes: number;
    /**
     * LES ÉVÉNEMENTS CELI QUI PEUVENT ENCORE CHANGER UN CHIFFRE — ambigus,
     * inconnus porteurs d'un montant, virements non résolus. C'est CE compteur
     * qui gouverne les trois drapeaux : un calcul ferme ne doit être bloqué que
     * par ce qui pourrait modifier son résultat (§13-§15).
     */
    evenementsCeliBloquants: number;
    /** Le détail par côté menacé — pour que l'écran dise QUOI est en jeu. */
    impacts: { cotisation: number; retrait: number; lesDeux: number; inconnu: number };
    /**
     * LA GRANDEUR EN JEU, par côté menacé — « le calcul ne peut pas être ferme
     * à cause de X événements représentant jusqu'à Y $ » (§14). Somme des
     * |montant| des bloquants, dans leur devise d'origine : `null` dès qu'un
     * bloquant porte un montant hors CAD ou illisible, car alors la borne ne
     * serait pas fiable — et une borne fausse est pire que pas de borne.
     */
    montantPotentiel: { cotisation: number | null; retrait: number | null };
    portee: Portee;
  };
  /** COMPTAGES SEULEMENT, par doctrine — jamais une clé, jamais un texte de saisie. */
  diagnostics: {
    evenements: number;
    montantsConfirmes: number;
    montantsEleves: number;
    sansMontantCad: number;
    resolutionsAppliquees: number;
    resolutionsIgnorees: number;
  };
};

/**
 * LES NATURES COMPRISES COMME HORS FLUX DE CAPITAL — ni des rôles fiscaux, ni
 * des « non exprimés » : on SAIT ce qu'elles sont, et ce qu'elles sont ne
 * touche ni cotisation ni retrait.
 *
 * `frais-impot` les rejoint le 20 août 2026 (mesuré) : des frais sortent de
 * l'argent du CELI, mais ne recréent AUCUN droit — les confondre avec un
 * retrait fabriquerait un faux droit de cotisation l'année suivante.
 *
 * EXPORTÉE parce que les instruments de mesure en ont besoin pour ventiler les
 * non-exprimés par type : une seconde copie de cet ensemble se serait
 * désynchronisée dès la première nature ajoutée — c'est arrivé le jour même.
 */
export const NATURES_HORS_FLUX: ReadonlySet<string> =
  new Set(['operation-titre', 'revenu', 'conversion-devise', 'frais-impot']);

// ═══ LE MONTANT FISCAL D'UN ÉVÉNEMENT ════════════════════════════════════════

/**
 * La grandeur CAD en jeu d'un côté donné. `null` si un seul bloquant échappe
 * au décompte (devise étrangère, montant illisible) : une borne incomplète
 * présentée comme une borne serait un chiffre faux.
 */
function grandeurEnJeu(bloquants: EvenementFlux[], impacts: string[]): number | null {
  const vises = bloquants.filter((e) => impacts.includes(e.impactCompletude));
  if (vises.length === 0) return 0;
  if (vises.some((e) => e.montant === null || e.devise !== 'CAD')) return null;
  return Math.round(vises.reduce((s, e) => s + Math.abs(e.montant as number), 0) * 100) / 100;
}

/** Arrondi au cent SYMÉTRIQUE : la grandeur ne dépend pas du signe (Math.round seul arrondissait +62,5 ¢ à 63 et −62,5 ¢ à −62). */
const rond = (x: number) => Math.sign(x) * (Math.round(Math.abs(x) * 100) / 100);

/** Le vocabulaire qui annonce une conversion — même frontière gauche que la regex des taux. */
const VOCABULAIRE_CONVERSION = /(?<![A-Z0-9À-Þ])(?:TAUX|RATE|CONV)/;

/** Le montant fiscal CAD d'UN événement CELI — la cascade des sources, documentée en tête de fichier. */
function montantFiscalDeLEvenement(
  ev: EvenementFlux,
  resolution: ResolutionMontantFiscalCad | null
): MontantFiscalCad {
  const montant = ev.montant as number;   // les rôles CELI garantissent un total non nul
  const devise = deviseSure(ev.devise);
  const base = {
    evenementId: ev.id,
    cleEvenement: cleEvenementFiscal(ev.compte, ev.date, ev.devise, montant),
    annee: ev.annee,
    montantOriginal: montant,
    deviseOriginale: devise,
    tauxUtilise: null as number | null,
    dateTaux: null as string | null,
    sources: [ev.id],
  };

  // 1 · LA TRANSACTION EST EN CAD : le montant fiscal EST le montant.
  if (devise === 'CAD') {
    return {
      ...base, montantCad: montant, source: 'transaction-cad', confiance: 'confirme',
      motif: 'transaction en dollars canadiens — le montant fiscal est le montant écrit, aucune conversion',
    };
  }

  // 2 · RÉSOLUTION MANUELLE (devise étrangère seulement — le tri est fait par l'appelant).
  if (resolution) {
    return {
      ...base,
      montantCad: rond(Math.sign(montant) * resolution.montantCad),
      source: 'resolution-manuelle', confiance: 'confirme',
      motif: `montant fiscal CAD confirmé à la main le ${resolution.dateResolution}${resolution.note ? ' — voir la note de résolution' : ''} — la transaction d'origine reste intacte`,
    };
  }

  // 3 · TAUX EXPLICITE DANS LA NOTE DE LA LIGNE MÊME — USD seulement.
  const noteMaj = (ev.source.note ?? '').toUpperCase();
  const bruts = tauxExplicitesDansNote(ev.source.note);
  // UN « @ » SEUL EST LA NOTATION D'UN PRIX (« 500 PARTS @ 9.9999 ») : il ne
  // compte comme taux que si la note porte un vocabulaire de conversion.
  const annoncesValides = bruts.filter((a) => a.motCle !== '@' || VOCABULAIRE_CONVERSION.test(noteMaj));
  const annonces = [...new Set(annoncesValides.map((a) => a.taux))];

  if (annonces.length > 0 && /EN\s*USD/.test(noteMaj)) {
    // LA FORME « EN USD » N'A JAMAIS ÉTÉ MESURÉE (la mesure du 19 août n'a
    // observé que « CONV. EN CAD », convention directe). Lire un taux
    // vraisemblablement « USD par CAD » avec la convention inverse fabriquerait
    // un montant faux à confiance eleve — refusé, comme l'EUR.
    return {
      ...base, montantCad: null, source: 'inconnue', confiance: 'inconnu',
      motif: 'la note annonce une conversion « EN USD » — convention jamais mesurée (seule « EN CAD », directe, l’a été) : à résoudre à la main',
    };
  }
  if (annonces.length > 1) {
    return {
      ...base, montantCad: null, source: 'inconnue', confiance: 'ambigu',
      motif: `la note annonce ${annonces.length} taux différents (${annonces.join(' vs ')}) — contradiction : aucun n'est choisi`,
    };
  }
  if (annonces.length === 1) {
    const taux = annonces[0];
    if (devise !== 'USD') {
      return {
        ...base, montantCad: null, source: 'inconnue', confiance: 'inconnu',
        motif: `un taux ${taux} est annoncé mais la convention n'est mesurée que pour USD (CAD par USD, directe) — aucune conversion ${devise} sans mesure`,
      };
    }
    if (taux <= 0) {
      return {
        ...base, montantCad: null, source: 'inconnue', confiance: 'ambigu',
        motif: `le taux annoncé (${taux}) est inexploitable — un zéro fabriqué serait pire qu'un inconnu déclaré`,
      };
    }
    return {
      ...base,
      montantCad: rond(montant * taux),
      source: 'taux-explicite-croesus', confiance: 'eleve',
      tauxUtilise: taux, dateTaux: ev.date,
      motif: `taux ${taux} annoncé dans la note de la transaction elle-même (convention directe mesurée, CAD par USD) — « eleve », jamais « confirme » : rien ne valide ce taux par un ratio, contrairement à FX-1`,
    };
  }

  // 4 · RIEN : l'inconnu se déclare — jamais 1:1, jamais un taux de marché.
  // LE MOTIF DU NULL DOIT ÊTRE LE VRAI MOTIF : si la note contient des nombres
  // qui POURRAIENT être un taux (forme non reconnue, « @ » sans vocabulaire de
  // conversion, décimales hors gabarit), on le dit — « sans taux » serait faux.
  const indicePossible = bruts.length > 0 || /[0-9][.,][0-9]/.test(noteMaj);
  return {
    ...base, montantCad: null, source: 'inconnue', confiance: 'inconnu',
    motif: indicePossible
      ? `${devise} — la note contient un nombre qui pourrait être un taux, mais rien ne l'annonce dans une forme reconnue : à résoudre à la main, jamais deviné`
      : `${devise} sans taux en note ni résolution manuelle — l'équivalent CAD fiscal est à confirmer (jamais 1:1, jamais un taux externe)`,
  };
}

// ═══ LA VUE ══════════════════════════════════════════════════════════════════

/**
 * LES ÉVÉNEMENTS CELI QUE LA VUE NE SAIT PAS EXPRIMER — exportée pour que les
 * instruments de mesure les ventilent SANS reconstruire la règle. Deux
 * reconstructions se sont déjà désynchronisées : le jour où `frais-impot` est
 * entré, puis le jour où les relations de virement sont arrivées. Une seule
 * définition, ici.
 */
export function evenementsCeliNonExprimes(t: LigneDuTemps): EvenementFlux[] {
  const roles = new Set<number>();
  for (const a of Object.values(t.parAnnee)) {
    for (const ag of Object.values(a.celi.cotisations)) for (const id of ag.sources) roles.add(id);
    for (const ag of Object.values(a.celi.retraits)) for (const id of ag.sources) roles.add(id);
  }
  for (const ev of sortiesCeliAConfirmer(t)) roles.add(ev.id);
  for (const rel of t.relationsVirements) roles.add(rel.jambeCeliId);
  const ambigus = new Set(ambigusCeliResiduels(t).map((e) => e.id));
  const consommes = new Set([
    ...t.consommesPartieDouble.map((e) => e.id),
    // Les écritures « Valeur comptable » d'un groupe ÉQUILIBRÉ : prouvées sans
    // effet sur la valeur du compte. Pas comprises — inoffensives, ce qui suffit
    // à ne plus les compter comme un trou (20 août 2026).
    ...t.ecrituresEquilibrees.map((e) => e.id),
  ]);
  const comprises = new Set(t.relationsVirements
    .filter((r) => r.effet === 'transfert-direct-celi' || r.effet === 'transfert-regime')
    .flatMap((r) => [r.jambeCeliId, r.jambeContrepartieId].filter((x): x is number => x !== null)));
  return t.evenements.filter((ev) =>
    ev.regime === 'celi' && !roles.has(ev.id) && !ambigus.has(ev.id)
    && !consommes.has(ev.id) && !comprises.has(ev.id) && !NATURES_HORS_FLUX.has(ev.nature));
}

/**
 * La vue fiscale CELI — « quelle portion de l'historique CELI est exprimable
 * de manière fiscalement exploitable en CAD ? ». AUCUN droit n'est calculé.
 *
 * `resolutions` : les confirmations manuelles (§7). Une résolution dont la clé
 * ne vise aucun événement, en vise PLUSIEURS (transactions identiques — un
 * choix silencieux serait un montant faux), vise un événement déjà en CAD ou
 * hors de portée de la vue, porte une grandeur non positive, CONTREDIT une
 * autre résolution de la même clé ou SUIT une résolution refusée, n'est PAS
 * appliquée — et CHAQUE refus est déclaré dans `resolutions.ignorees`.
 */
export function vueFiscaleCeli(
  t: LigneDuTemps,
  resolutions: ResolutionMontantFiscalCad[] = [],
  options: { activiteExterneConfirmeeAbsente?: ReponseTernaire } = {}
): VueFiscaleCeli {
  // ── 1 · les rôles : chaque événement CELI exprimable, exactement une fois ───
  const roles: { ev: EvenementFlux; role: RoleFiscalCeli }[] = [];
  for (const a of Object.values(t.parAnnee)) {
    for (const ag of Object.values(a.celi.cotisations)) {
      for (const id of ag.sources) roles.push({ ev: t.evenements[id], role: 'cotisation' });
    }
    for (const ag of Object.values(a.celi.retraits)) {
      for (const id of ag.sources) roles.push({ ev: t.evenements[id], role: 'retrait-ferme' });
    }
  }
  // ── LES RELATIONS DE VIREMENT (étape 4, 20 août 2026) ──────────────────────
  // Un virement APPARIÉ a une nature prouvée : cotisation ferme (non-enregistré
  // → CELI), retrait ferme (CELI → non-enregistré), ou transfert direct
  // (CELI → CELI du même titulaire) — et un transfert direct n'est NI une
  // cotisation NI un retrait (§3). Une relation ORPHELINE reste à confirmer :
  // la note nomme un compte, mais rien ne dit à qui il appartient.
  const jambesDeRelation = new Set<number>();
  for (const rel of t.relationsVirements) {
    const ev = t.evenements[rel.jambeCeliId];
    if (!ev || ev.regime !== 'celi') continue;
    jambesDeRelation.add(ev.id);
    if (rel.effet === 'transfert-direct-celi' || rel.effet === 'transfert-regime') continue;   // compris, aucun rôle fiscal
    if (rel.effet === 'cotisation-celi') { roles.push({ ev, role: 'cotisation' }); continue; }
    if (rel.effet === 'retrait-celi') { roles.push({ ev, role: 'retrait-ferme' }); continue; }
    roles.push({ ev, role: rel.sens === 'entree' ? 'cotisation-a-confirmer' : 'retrait-a-confirmer' });
  }
  // D1/D2 — les sorties à confirmer qui ne sont PAS déjà portées par une
  // relation (aucune ligne deux fois : invariant §10).
  for (const ev of sortiesCeliAConfirmer(t)) {
    if (jambesDeRelation.has(ev.id)) continue;
    roles.push({ ev, role: 'retrait-a-confirmer' });
  }
  roles.sort((a, b) => a.ev.id - b.ev.id);

  // ── 2 · ce qui ÉCHAPPE à la vue : virements internes, non-agrégés, inconnus ─
  // Un « Transfert » CELI noté (étape 4 non faite) ou un « Dépôt » que la
  // règle 2 ne voit pas ne sont NI des rôles NI des ambigus résiduels : sans ce
  // comptage, les drapeaux de complétude viraient au vert au-dessus d'un flux
  // CELI bien réel (contre-expertise du 20 août — deux faux verts prouvés).
  const idsRoles = new Set(roles.map((r) => r.ev.id));
  const ambigusResiduels = ambigusCeliResiduels(t);
  const idsAmbigus = new Set(ambigusResiduels.map((e) => e.id));
  // Une jambe titre CONSOMMÉE par la règle 2 est EXPLIQUÉE — visible dans
  // t.consommesPartieDouble, tracée dans t.partiesDoubles, jamais « non
  // exprimée » (20 août : le faux rouge sur ~46 % des cotisations mesurées).
  const idsConsommes = new Set(t.consommesPartieDouble.map((e) => e.id));
  // Les jambes d'une relation COMPRISE (transfert direct entre CELI, ou vers un
  // autre régime) : ni un rôle fiscal, ni une inconnue — on SAIT ce que c'est,
  // et ce que c'est ne touche ni cotisation ni retrait (§3).
  const idsRelationComprise = new Set(t.relationsVirements
    .filter((r) => r.effet === 'transfert-direct-celi' || r.effet === 'transfert-regime')
    .flatMap((r) => [r.jambeCeliId, r.jambeContrepartieId].filter((x): x is number => x !== null)));
  const nonExprimes = evenementsCeliNonExprimes(t);

  // ── CE QUI PEUT ENCORE CHANGER UN CHIFFRE (§13-§15, 20 août 2026) ──────────
  // Le blocage ne suit plus le NOM de la catégorie mais l'IMPACT POSSIBLE. Une
  // ligne « inconnue » qui porte un montant non nul bloque autant qu'un
  // « ambigu » — elle le doit : le moteur n'en sait pas moins, il en sait
  // MOINS. À l'inverse, une ligne à montant nul ne peut modifier aucune somme,
  // quel que soit son libellé, et ne bloque donc rien.
  const bloquants = t.evenements.filter((ev) =>
    ev.regime === 'celi'
    && !idsRoles.has(ev.id) && !idsConsommes.has(ev.id) && !idsRelationComprise.has(ev.id)
    && ev.impactCompletude !== 'aucun');
  const clesNonExprimes = new Set(nonExprimes.map((ev) =>
    cleEvenementFiscal(ev.compte, ev.date, ev.devise, ev.montant ?? 0)));

  // ── 3 · les résolutions : indexées, filtrées, CHAQUE refus déclaré ──────────
  const ignorees: { cleEvenement: string; motif: string }[] = [];
  const parCleResolution = new Map<string, ResolutionMontantFiscalCad>();
  for (const r of resolutions) {
    const deja = parCleResolution.get(r.cleEvenement);
    if (deja && deja.montantCad !== r.montantCad) {
      parCleResolution.delete(r.cleEvenement);
      ignorees.push({ cleEvenement: r.cleEvenement, motif: `deux résolutions contradictoires (${deja.montantCad} vs ${r.montantCad}) — aucune n'est appliquée` });
      continue;
    }
    if (ignorees.some((i) => i.cleEvenement === r.cleEvenement)) {
      // JAMAIS UN REFUS SILENCIEUX : une résolution qui suit une résolution
      // refusée sur la même clé est refusée AUSSI, et le dit pour elle-même.
      ignorees.push({ cleEvenement: r.cleEvenement, motif: 'une résolution antérieure sur cette clé a déjà été refusée — celle-ci n’est pas appliquée non plus' });
      continue;
    }
    if (!(r.montantCad > 0)) {
      ignorees.push({ cleEvenement: r.cleEvenement, motif: `grandeur non positive (${r.montantCad}) — une résolution porte la grandeur CAD, le signe vient de la transaction` });
      continue;
    }
    parCleResolution.set(r.cleEvenement, r);
  }
  const evenementsParCle = new Map<string, number>();
  for (const { ev } of roles) {
    const cle = cleEvenementFiscal(ev.compte, ev.date, ev.devise, ev.montant as number);
    evenementsParCle.set(cle, (evenementsParCle.get(cle) ?? 0) + 1);
  }
  const resolutionApplicable = (ev: EvenementFlux): ResolutionMontantFiscalCad | null => {
    const cle = cleEvenementFiscal(ev.compte, ev.date, ev.devise, ev.montant as number);
    const r = parCleResolution.get(cle);
    if (!r) return null;
    if ((evenementsParCle.get(cle) ?? 0) > 1) return null;   // clé partagée : traitée au bilan
    if (deviseSure(ev.devise) === 'CAD') return null;        // donnée déjà exacte : traitée au bilan
    return r;
  };
  let appliquees = 0;
  for (const [cle, r] of parCleResolution) {
    const n = evenementsParCle.get(cle) ?? 0;
    if (n === 1 && cle.split('|')[2] !== 'CAD') { appliquees++; continue; }
    if (n === 0 && clesNonExprimes.has(cle)) {
      ignorees.push({ cleEvenement: r.cleEvenement, motif: 'l’événement existe mais la vue ne sait pas l’exprimer (virement interne, non agrégé ou libellé inconnu) — hors de portée de cette couche' });
    } else if (n === 0) {
      ignorees.push({ cleEvenement: r.cleEvenement, motif: 'aucun événement CELI ne porte cette clé — résolution sans cible' });
    } else if (n > 1) {
      ignorees.push({ cleEvenement: r.cleEvenement, motif: `clé partagée par ${n} événements identiques — appliquer au hasard serait un montant faux, aucune n'est appliquée` });
    } else {
      ignorees.push({ cleEvenement: r.cleEvenement, motif: 'l’événement est déjà en dollars canadiens (transaction-cad) — une résolution ne remplace pas une donnée exacte' });
    }
  }

  // ── 4 · le montant fiscal de chaque événement, puis les agrégats ────────────
  const parAnnee: Record<string, AnneeFiscaleCeli> = {};
  const anneeDe = (a: string): AnneeFiscaleCeli => (parAnnee[a] ??= {
    cotisationsCadConfirmees: 0, cotisationsCadAConfirmer: 0,
    retraitsCadConfirmes: 0, retraitsCadAConfirmer: 0,
    evenementsSansMontantCad: [],
    sources: { cotisationsCadConfirmees: [], cotisationsCadAConfirmer: [], retraitsCadConfirmes: [], retraitsCadAConfirmer: [] },
  });

  const evenements: EvenementFiscalCeli[] = [];
  let cotisationsToutesConfirmees = true;
  let retraitsTousConfirmes = true;

  // La traçabilité des apports en nature : les DEUX lignes restent retraçables
  // (jambe argent + jambe titre dans `sources`), seule la jambe argent
  // participe au montant fiscal.
  const titreDe = new Map(t.partiesDoubles.map((p) => [p.jambeArgentId, p.jambeTitreId]));

  for (const { ev, role } of roles) {
    const fiscal = montantFiscalDeLEvenement(ev, resolutionApplicable(ev));
    const jambeTitre = titreDe.get(ev.id);
    if (jambeTitre !== undefined) {
      fiscal.sources.push(jambeTitre);
      fiscal.motif += ` — apport en nature : la jambe titre #${jambeTitre} est consommée par la règle 2, seule la jambe argent porte le montant`;
    }
    evenements.push({ role, fiscal });
    const a = anneeDe(fiscal.annee);

    if (fiscal.montantCad === null) {
      a.evenementsSansMontantCad.push(ev.id);
      if (role === 'cotisation' || role === 'cotisation-a-confirmer') cotisationsToutesConfirmees = false;
      else retraitsTousConfirmes = false;
      continue;
    }
    if (role === 'cotisation' || role === 'cotisation-a-confirmer') {
      // §19 — MONTANT et NATURE sont orthogonaux : une entrée dont la nature
      // n'est pas tranchée va « à confirmer » même si son montant CAD est
      // parfaitement connu ; et une cotisation ferme au montant seulement
      // « eleve » y va aussi. Les deux incertitudes comptent, séparément.
      if (fiscal.confiance === 'confirme' && role === 'cotisation') {
        a.cotisationsCadConfirmees = rond(a.cotisationsCadConfirmees + fiscal.montantCad);
        a.sources.cotisationsCadConfirmees.push(ev.id);
      } else {
        a.cotisationsCadAConfirmer = rond(a.cotisationsCadAConfirmer + fiscal.montantCad);
        a.sources.cotisationsCadAConfirmer.push(ev.id);
        // ⚠ SEUL LE MONTANT COMPTE ICI (§19). Ce drapeau répond à la question A
        // — « l'équivalent CAD est-il établi ? » — et à elle seule. Une nature
        // non tranchée le laissait tomber, ce qui fondait les deux questions
        // que toute cette chaîne sépare : la question B a son propre drapeau
        // (`retraitsNatureConfirmee`). Sans ça, une simple entrée à confirmer
        // faisait disparaître les bornes d'un dossier pourtant tout en CAD.
        if (fiscal.confiance !== 'confirme') cotisationsToutesConfirmees = false;
      }
      continue;
    }
    // LES DEUX QUESTIONS : un montant parfaitement connu n'efface jamais une
    // nature à confirmer — `retraitsCadConfirmes` exige les DEUX réponses.
    const grandeur = Math.abs(fiscal.montantCad);
    if (role === 'retrait-ferme' && fiscal.confiance === 'confirme') {
      a.retraitsCadConfirmes = rond(a.retraitsCadConfirmes + grandeur);
      a.sources.retraitsCadConfirmes.push(ev.id);
    } else {
      a.retraitsCadAConfirmer = rond(a.retraitsCadAConfirmer + grandeur);
      a.sources.retraitsCadAConfirmer.push(ev.id);
      if (fiscal.confiance !== 'confirme') retraitsTousConfirmes = false;
    }
  }

  // « Rien ne bloque » = rien qui puisse changer un chiffre. C'est plus juste
  // que « rien n'échappe » : une ligne à montant nul échappe à la vue sans
  // menacer aucun montant.
  const rienNeBloque = bloquants.length === 0;
  return {
    parAnnee,
    evenements,
    resolutions: { appliquees, ignorees },
    completude: {
      toutesCotisationsEnCadFiscal: cotisationsToutesConfirmees && rienNeBloque,
      tousRetraitsEnCadFiscal: retraitsTousConfirmes && rienNeBloque,
      retraitsNatureConfirmee: roles.every((r) => r.role !== 'retrait-a-confirmer' && r.role !== 'cotisation-a-confirmer') && rienNeBloque,
      activiteExterneConfirmeeAbsente: options.activiteExterneConfirmeeAbsente ?? 'inconnu',
      evenementsCeliAmbigus: ambigusResiduels.length,
      evenementsCeliNonExprimes: nonExprimes.length,
      evenementsCeliBloquants: bloquants.length,
      impacts: {
        cotisation: bloquants.filter((e) => e.impactCompletude === 'peut-affecter-cotisation').length,
        retrait: bloquants.filter((e) => e.impactCompletude === 'peut-affecter-retrait').length,
        lesDeux: bloquants.filter((e) => e.impactCompletude === 'peut-affecter-les-deux').length,
        inconnu: bloquants.filter((e) => e.impactCompletude === 'inconnu').length,
      },
      montantPotentiel: {
        cotisation: grandeurEnJeu(bloquants, ['peut-affecter-cotisation', 'peut-affecter-les-deux']),
        retrait: grandeurEnJeu(bloquants, ['peut-affecter-retrait', 'peut-affecter-les-deux']),
      },
      portee: t.portee,
    },
    diagnostics: {
      evenements: evenements.length,
      montantsConfirmes: evenements.filter((e) => e.fiscal.confiance === 'confirme').length,
      montantsEleves: evenements.filter((e) => e.fiscal.confiance === 'eleve').length,
      sansMontantCad: evenements.filter((e) => e.fiscal.montantCad === null).length,
      resolutionsAppliquees: appliquees,
      resolutionsIgnorees: ignorees.length,
    },
  };
}

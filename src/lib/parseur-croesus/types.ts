// Les types du parseur Croesus. TypeScript pur — aucun import Next.js, React
// ou Supabase, pour rester testable en isolation (règle 4 du chantier).

import { canoniserCompte, decomposerCompte } from './identifiant-compte';

export { canoniserCompte, memeCompte, decomposerCompte } from './identifiant-compte';

/** Les 20 colonnes d'un export de transactions Croesus, telles quelles. */
export const COLONNES = [
  'indVM', 'description', 'nom', 'note', 'traitement', 'transaction',
  'codeCP', 'type', 'symbole', 'quantite', 'prix', 'devise', 'total',
  'commission', 'gainsPertes', 'intCourus', 'frais', 'pbrManuel', 'solde',
  'noCompte',
] as const;

/** Une ligne de transaction, normalisée. */
export type LigneTransaction = {
  date: string;              // AAAA-MM-JJ, colonne « Transaction »
  dateReglement: string;     // colonne « Traitement » — l'axe fiscal
  nom: string;
  note: string;
  type: string;              // « Achat », « Cotisation », « Dividendes »…
  symbole: string;
  quantite: number | null;
  prix: number | null;
  devise: string;
  total: number | null;
  gainsPertes: number | null;
  solde: number | null;
  noCompte: string;
  description: string;
};

/** Une position, telle que lue dans un relevé collé. */
export type LignePosition = {
  devise: string;
  typeInstrument: string;    // « Action », « Obligation », « Fonds d'investissement »…
  quantite: number;
  description: string;
  suffixeCompte: string;     // « A », « S », « W »…
  symbole: string;
  /** PBR unitaire DÉRIVÉ (coût ÷ quantité) — règle 1, jamais la colonne brute. */
  pbrUnitaire: number | null;
  /** Prix unitaire DÉRIVÉ (valeur marchande ÷ quantité) — règle 1. */
  prixUnitaire: number | null;
  coutTotal: number | null;
  valeurMarchande: number | null;
  /**
   * Colonne 12. `null` pour une obligation : l'échelle par 100 de la règle 1
   * n'y a jamais été mesurée, et l'erreur serait d'un facteur 100.
   */
  revenuAnnuel: number | null;
};

/** Ce que le parseur déduit d'un compte enregistré, par année. */
export type FluxCompte = {
  /** Cotisations en ARGENT NEUF seulement — règle 2. */
  cotisations: number;
  /** Retraits (valeur absolue). */
  retraits: number;
  /** Apports en nature appariés — ne consomment pas de droits. */
  apportsEnNature: number;
  /** Règles 3 et 4 : un transfert entrant non apparié force la borne. */
  transfertEntrantDetecte: boolean;
  /** Détail des transferts, pour le journal et l'explication en rencontre. */
  transferts: Array<{ date: string; montant: number; apparie: boolean; note: string }>;
};

/**
 * COMPTES iA « 37-XXXX-L » — le SUFFIXE porte le régime.
 * Table dictée par le planificateur.
 */
export const TYPE_PAR_SUFFIXE: Record<string, string> = {
  A: 'non-enregistre', B: 'non-enregistre', E: 'non-enregistre', F: 'non-enregistre',
  J: 'non-enregistre', S: 'reer', R: 'reer', W: 'celi', Q: 'celiapp',
  T: 'ferr', Y: 'ferr', P: 'frv', N: 'cri', Z: 'reee',
};

/**
 * COMPTES VMBL « 4A-Y3VI-6 » — le régime est le DERNIER caractère du bloc du
 * milieu, pas le suffixe (qui est un chiffre).
 *
 * Table établie le 4 août 2026 en laissant les notes du livre nommer les
 * régimes elles-mêmes. ATTENTION : la convention DIFFÈRE de celle d'iA —
 * chez VMBL, `R` est le REER personnel et `S` le REER conjoint ; c'est
 * l'inverse chez iA.
 *
 * Chaque entrée porte sa preuve :
 *   I  CELI          2 725 notes « CONT AU CELI » / « CONT TO TFSA »
 *   R  REER            997 notes « CONT AU REER »
 *   S  REER conjoint    42 notes « CONTCJ AU REER » (CJ = conjoint)
 *   O  REEE            185 notes « COTIS AU REEE » + subventions SCEE
 *   1  REEE             89 notes idem — un compte par enfant, semble-t-il
 *   2  REEE             39 notes idem
 *   3  REEE              4 notes idem
 *   V  FERR            127 « PAIEMENT RETRAITE » + articles 146(16)
 *
 * NON PROUVÉES, donc ABSENTES À DESSEIN : A (98 comptes), E (24), T (19),
 * B (14), Q (10), F, Z, U, Y. Leurs notes ne nomment aucun régime. Le
 * planificateur pense que `E` est une marge — plausible, jamais mesuré. `Q`
 * ne peut PAS être un CELIAPP : ce régime date de 2023, ces comptes de 2009.
 * Une lettre absente rend `null`, et l'appelant déclare « régime inconnu »
 * plutôt que de ranger la cotisation au mauvais endroit.
 */
export const TYPE_PAR_LETTRE_VMBL: Record<string, string> = {
  I: 'celi',
  R: 'reer',
  S: 'reer-conjoint',
  O: 'reee', '1': 'reee', '2': 'reee', '3': 'reee',
  V: 'ferr',
};

/**
 * Le régime d'un compte, quel que soit SON ÉCRITURE.
 *
 * Passe par `decomposerCompte`, donc « 6A-AZCI-0 » et « 6AAZCI0 » rendent le
 * même régime. Avant le 4 août 2026, la forme sans tirets tombait dans la
 * table iA par son dernier caractère : un CELI VMBL y devenait `null`, et
 * l'origine externe d'un transfert passait inaperçue.
 *
 * Rend `null` quand la lettre est inconnue — jamais un régime deviné. 2 739
 * lignes de cotisation du livre sont dans ce cas, et il vaut mieux les
 * déclarer que les ranger au hasard.
 */
export function typeDeCompte(noCompte: string): string | null {
  const d = decomposerCompte(noCompte);
  if (d?.vmbl) return TYPE_PAR_LETTRE_VMBL[d.milieu.slice(-1)] ?? null;

  // UN IDENTIFIANT REFUSÉ N'A PAS DE RÉGIME — corrigé le 18 août 2026.
  //
  // Le repli lisait le dernier caractère MÊME quand `decomposerCompte` avait
  // refusé l'identifiant, et lui appliquait la table iA. C'était l'unique
  // chemin du dépôt où « celiapp » pouvait sortir sans préfixe iA prouvé —
  // un régime de 2023 posé sur un compte que rien ne rattache à iA. Le même
  // repli rangeait aussi des lignes dans les seaux CELI, REER et REEE sur la
  // foi d'une seule lettre.
  //
  // La règle du dépôt ne laisse pas le choix : « un compte au régime non
  // prouvé est ÉCARTÉ, jamais présumé ». `null` se déclare, une invention non.
  //
  // ⚠ À FAIRE VÉRIFIER PAR NICOLAS : si son livre contenait des numéros que
  // `decomposerCompte` refuse, leurs cotisations cessent d'être comptées, ce
  // qui GONFLERAIT l'espace CELI calculé. Les formes observées jusqu'ici
  // (« 37-XXXX-L ») se décomposent toutes ; le repli ne devrait donc jamais
  // avoir servi. La mesure qui le confirmerait est à lancer par lui.
  if (!d) return null;
  return TYPE_PAR_SUFFIXE[d.suffixe] ?? null;
}

/** Vrai pour un vieux numéro VMBL (« 4A-… », « 6A-… », « 6AAZCI0 »). */
export function estCompteVMBL(noCompte: string): boolean {
  return decomposerCompte(noCompte)?.vmbl ?? false;
}

/**
 * Vrai pour un compte iA — un « 37-… ».
 *
 * ÉCRIT LE 17 AOÛT 2026, et le mot « écrit » compte : jusque-là il n'existait
 * AUCUN prédicat positif. Le seul discriminant était négatif (`vmbl`), et
 * « pas VMBL » n'est pas « iA » : la forme `~E-0024I-0` n'est ni l'un ni
 * l'autre, et un identifiant que `decomposerCompte` refuse n'est rien du tout.
 *
 * Pourquoi il fallait un prédicat POSITIF : la passe des comptes vus au livre
 * seulement (`Compte.presence`) doit s'appliquer aux seuls comptes iA — consigne
 * de Nicolas du 12 août, « fie-toi aux comptes qui commencent par 37 ». Filtrer
 * sur « pas VMBL » y ferait entrer tous les formats non catalogués.
 *
 * On exige donc les DEUX conditions : un identifiant que la décomposition
 * reconnaît, ET le préfixe « 37 » exactement. Tout le reste rend `false` —
 * y compris les autres préfixes à deux chiffres, qui ne sont pas prouvés iA.
 */
export function estCompteIA(noCompte: string): boolean {
  return decomposerCompte(noCompte)?.prefixe === '37';
}

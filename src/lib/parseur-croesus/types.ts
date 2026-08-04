// Les types du parseur Croesus. TypeScript pur — aucun import Next.js, React
// ou Supabase, pour rester testable en isolation (règle 4 du chantier).

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

const FORMAT_VMBL = /^\d[A-Z]-([A-Z0-9]+)-[A-Z0-9]$/i;

/**
 * Le régime d'un compte, quel que soit son format.
 *
 * Rend `null` quand la lettre est inconnue — jamais un régime deviné. 2 739
 * lignes de cotisation du livre sont dans ce cas, et il vaut mieux les
 * déclarer que les ranger au hasard.
 */
export function typeDeCompte(noCompte: string): string | null {
  const n = noCompte.trim();
  const vmbl = FORMAT_VMBL.exec(n);
  if (vmbl) {
    const lettre = vmbl[1].slice(-1).toUpperCase();
    return TYPE_PAR_LETTRE_VMBL[lettre] ?? null;
  }
  return TYPE_PAR_SUFFIXE[n.slice(-1).toUpperCase()] ?? null;
}

/** Vrai pour un vieux numéro VMBL (« 4A-… », « 6A-… »). */
export function estCompteVMBL(noCompte: string): boolean {
  return FORMAT_VMBL.test(noCompte.trim());
}

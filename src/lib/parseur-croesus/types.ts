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

/** Suffixe du numéro de compte → type de régime (dicté par le planificateur). */
export const TYPE_PAR_SUFFIXE: Record<string, string> = {
  A: 'non-enregistre', B: 'non-enregistre', E: 'non-enregistre', F: 'non-enregistre',
  J: 'non-enregistre', S: 'reer', R: 'reer', W: 'celi', Q: 'celiapp',
  T: 'ferr', Y: 'ferr', P: 'frv', N: 'cri', Z: 'reee',
};

export function typeDeCompte(noCompte: string): string | null {
  const suffixe = noCompte.trim().slice(-1).toUpperCase();
  return TYPE_PAR_SUFFIXE[suffixe] ?? null;
}

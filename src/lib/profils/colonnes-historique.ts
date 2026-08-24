// LES COLONNES DE L'HISTORIQUE CROESUS — reconnues par leur TITRE.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE MODULE SUPPRIME.
//
// `parserCollage` déterminait le sens d'une colonne par le NOMBRE de colonnes :
//
//     const decalage = c.length >= 20 ? 0 : c.length >= 18 ? 2 : -1;
//
// Deux formats connus, un décalage constant de 2. Ça a tenu tant qu'il n'y en
// avait que deux. Un export réel où la colonne du NOM DU CLIENT a été retirée
// en compte 19 : il tombait donc dans la branche « 18 », décalé de 2, et
// `noCompte` allait lire la colonne « Solde ». Chaque ligne était rejetée ou,
// pire, lue de travers.
//
// ⚠ ÉLARGIR LA LISTE À « 18, 19 OU 20 » N'AURAIT FAIT QUE DÉPLACER LE PROBLÈME.
// Le nombre de colonnes n'est pas une information sur leur sens. Le titre, si.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE NE FAIT PAS.
//
// ⚠ AUCUNE CORRESPONDANCE APPROXIMATIVE. Pas de distance d'édition, pas de
// « ça ressemble à ». Un titre est reconnu par un alias DÉCLARÉ, ou il ne l'est
// pas. Une correspondance floue finirait un jour par prendre « Prix » pour
// « PBR manuel » sur un export inconnu, et rien ne le dirait.
//
// La normalisation ne tolère que des différences TYPOGRAPHIQUES : espaces de
// tête et de fin, espaces multiples, espaces insécables, casse, accents,
// points d'abréviation. « Gains/Pertes » et « Gains / Pertes » se rejoignent
// parce que les espaces sont réduits — pas parce qu'on devine.
// ─────────────────────────────────────────────────────────────────────────────

export type ChampHistorique =
  | 'indVM' | 'description' | 'nom' | 'note' | 'dateReglement' | 'date'
  | 'codeCp' | 'type' | 'symbole' | 'quantite' | 'prix' | 'devise' | 'total'
  | 'commission' | 'gainsPertes' | 'intCourus' | 'frais' | 'pbrManuel'
  | 'solde' | 'noCompte';

/**
 * LES ALIAS, DÉCLARÉS UN PAR UN.
 *
 * ⚠ CHAQUE ENTRÉE EST UNE OBSERVATION, pas une hypothèse. Ajouter un alias
 * « au cas où » revient à autoriser un format qu'on n'a jamais vu, donc à
 * accepter en silence un fichier dont on ne sait rien.
 */
export const ALIAS_COLONNES: Record<ChampHistorique, readonly string[]> = {
  indVM: ['ind vm', 'ind. vm', 'indicateur vm'],
  description: ['description'],
  // ⚠ LA COLONNE QUE NICOLAS RETIRE VOLONTAIREMENT. Elle est facultative.
  nom: ['nom', 'nom du client', 'client'],
  note: ['note', 'notes'],
  dateReglement: ['traitement', 'date de traitement'],
  date: ['transaction', 'date de transaction'],
  codeCp: ['code de cp', 'code cp', 'cp'],
  type: ['type', 'type de transaction'],
  symbole: ['symbole', 'symbol'],
  quantite: ['quantite', 'qte'],
  prix: ['prix'],
  devise: ['devise', 'currency'],
  total: ['total', 'montant', 'montant net'],
  commission: ['commission'],
  gainsPertes: ['gains/pertes', 'gains / pertes', 'gain/perte', 'gains et pertes'],
  intCourus: ['int courus', 'int. courus', 'interets courus'],
  frais: ['frais'],
  pbrManuel: ['pbr manuel', 'pbr'],
  solde: ['solde'],
  noCompte: ['no de compte', 'no compte', 'numero de compte', 'compte'],
};

/**
 * REQUISES — leur absence changerait un résultat FISCAL, ou rendrait la ligne
 * inclassable. Un fichier qui en manque une est REJETÉ, avec son nom.
 *
 * ⚠ CETTE LISTE EST COURTE EXPRÈS. Rendre requise une colonne décorative
 * refuserait des fichiers parfaitement exploitables ; rendre facultative une
 * colonne fiscale ferait sortir un chiffre faux sans le dire. `gainsPertes`
 * est l'exemple du second danger : absente, les gains réalisés de l'année
 * tomberaient silencieusement à zéro.
 */
export const COLONNES_REQUISES: readonly ChampHistorique[] = [
  'date', 'noCompte', 'type', 'total', 'gainsPertes', 'devise', 'quantite', 'symbole',
];

/**
 * FACULTATIVES — transportées quand elles sont là, vides sinon. Leur absence
 * ne déplace aucune autre colonne et ne change aucun calcul.
 */
export const COLONNES_FACULTATIVES: readonly ChampHistorique[] = [
  'nom', 'description', 'note', 'dateReglement', 'prix', 'solde',
];

/**
 * IGNORÉES MAIS ARCHIVÉES — présentes dans l'export, jamais portées dans
 * `LigneTransaction`. Le collage brut est archivé tel quel, donc rien n'est
 * perdu : elles redeviendront lisibles le jour où elles serviront.
 */
export const COLONNES_IGNOREES: readonly ChampHistorique[] = [
  'indVM', 'codeCp', 'commission', 'intCourus', 'frais', 'pbrManuel',
];

/** Le motif canonique d'une ligne dont la structure contredit les en-têtes. */
export const MOTIF_LIGNE_INCOHERENTE = 'ligne-incoherente-avec-entetes';

/**
 * NORMALISATION PUREMENT TYPOGRAPHIQUE.
 *
 * Accents retirés, casse abaissée, espaces (y compris insécables et fines)
 * réduits à un seul, points d'abréviation supprimés. Rien d'autre : deux
 * titres qui diffèrent par un MOT restent deux titres différents.
 */
export function normaliserEntete(valeur: string): string {
  return valeur
    .replace(/^﻿/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[   ]/g, ' ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const PAR_ALIAS = new Map<string, ChampHistorique>();
for (const [champ, alias] of Object.entries(ALIAS_COLONNES) as [ChampHistorique, readonly string[]][]) {
  for (const a of alias) PAR_ALIAS.set(normaliserEntete(a), champ);
}

export type CarteColonnes = {
  /** L'index de chaque champ reconnu. Absent = colonne non fournie. */
  index: Partial<Record<ChampHistorique, number>>;
  /** Les colonnes REQUISES qui manquent — vide si le format est accepté. */
  requisesManquantes: ChampHistorique[];
  /** Les titres qu'on ne connaît pas. Ils n'entrent nulle part, et c'est tout. */
  inconnues: string[];
};

/**
 * LA CORRESPONDANCE TITRE → INDEX.
 *
 * ⚠ UNE COLONNE INCONNUE NE DÉCALE RIEN. Elle occupe son rang et n'est
 * simplement jamais lue : c'est la propriété qui rend le parseur insensible à
 * l'ajout d'une colonne décorative, où qu'elle soit placée.
 *
 * ⚠ EN CAS DE DOUBLON, LE PREMIER GAGNE. Un export qui répéterait « Total »
 * n'a pas de sens ; on ne devine pas lequel compte.
 */
export function indexerEntetes(entetes: string[]): CarteColonnes {
  const index: Partial<Record<ChampHistorique, number>> = {};
  const inconnues: string[] = [];
  entetes.forEach((brut, i) => {
    const champ = PAR_ALIAS.get(normaliserEntete(brut));
    if (!champ) { if (brut.trim()) inconnues.push(brut.trim()); return; }
    if (index[champ] === undefined) index[champ] = i;
  });
  const requisesManquantes = COLONNES_REQUISES.filter((c) => index[c] === undefined);
  return { index, requisesManquantes, inconnues };
}

/** Combien de titres connus suffisent à affirmer qu'on lit des en-têtes. */
const SEUIL_ENTETE = 5;

/**
 * CETTE LIGNE EST-ELLE UNE LIGNE D'EN-TÊTES ?
 *
 * ⚠ ELLE NE VÉRIFIE PAS QUE LE FORMAT EST COMPLET, et c'est délibéré. Une
 * première version exigeait le trio `type` + `symbole` + `noCompte` : un
 * fichier à qui il manquait « No de compte » n'était alors PAS reconnu comme
 * ayant des en-têtes, retombait sur le repli positionnel, et celui-ci le
 * parsait de travers — en silence. Le test l'a montré.
 *
 * Reconnaître la ligne et REFUSER le format sont deux questions distinctes :
 * celle-ci répond à la première, `indexerEntetes().requisesManquantes` à la
 * seconde. Un fichier titré ne doit jamais glisser vers le chemin positionnel.
 *
 * Le seuil vaut cinq titres connus : une ligne de données ne contient pas cinq
 * cellules valant littéralement « Type », « Symbole », « Devise »…
 */
export function estLigneEntete(cellules: string[]): boolean {
  const champs = new Set<ChampHistorique>();
  for (const c of cellules) {
    const champ = PAR_ALIAS.get(normaliserEntete(c));
    if (champ) champs.add(champ);
  }
  return champs.size >= SEUIL_ENTETE;
}

// ─────────────────────────────────────────────────────────────────────────────
// LA VALIDATION SÉMANTIQUE — détecter un décalage, jamais le réparer
// ─────────────────────────────────────────────────────────────────────────────

/** Les devises observées dans les exports. Une inconnue n'est pas une erreur. */
const DEVISES = new Set(['CAD', 'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', '']);

const EST_DATE = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

/** Un nombre, ou rien. « SA1H » n'est ni l'un ni l'autre. */
function nombreOuVide(v: string): boolean {
  const t = v.replace(/[\s $]/g, '').replace(/,/g, '.').replace(/[()]/g, '');
  return t === '' || t === '-' || Number.isFinite(Number(t));
}

export type VerdictLigne =
  | { coherente: true }
  | { coherente: false; motif: typeof MOTIF_LIGNE_INCOHERENTE; details: string[] };

/**
 * LES INVARIANTS D'UNE LIGNE BIEN ALIGNÉE.
 *
 * ⚠ ON DIAGNOSTIQUE, ON NE RÉPARE PAS. Une ligne où « Transaction » vaut
 * `SA1H`, « Code de CP » vaut `Remboursement` et « Type » vaut `T822D9` est
 * structurellement décalée ; deviner de combien reviendrait à inventer des
 * données fiscales. On la met de côté et on dit pourquoi.
 *
 * Les champs ABSENTS de la carte ne sont pas vérifiés : leur silence est une
 * information sur le format, pas sur la ligne.
 */
export function verifierCoherence(cellules: string[], carte: CarteColonnes): VerdictLigne {
  const lire = (c: ChampHistorique): string | null => {
    const i = carte.index[c];
    return i === undefined ? null : (cellules[i] ?? '').trim();
  };
  const details: string[] = [];

  const date = lire('date');
  if (date !== null && date !== '' && !EST_DATE(date)) details.push('date');

  const devise = lire('devise');
  if (devise !== null && !DEVISES.has(devise.toUpperCase())) details.push('devise');

  for (const champ of ['quantite', 'prix', 'total', 'gainsPertes', 'solde'] as const) {
    const v = lire(champ);
    if (v !== null && !nombreOuVide(v)) details.push(champ);
  }

  return details.length === 0
    ? { coherente: true }
    : { coherente: false, motif: MOTIF_LIGNE_INCOHERENTE, details };
}

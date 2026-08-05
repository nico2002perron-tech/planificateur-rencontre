// LE PROFIL CLIENT — implémentation fidèle de docs/schema-profil-fiscal-v1.md.
//
// TypeScript pur : aucun import Next.js, React ou Supabase. Le schéma fait foi ;
// aucun champ n'est improvisé ici. Toute extension passe d'abord par le document.

import { canoniserCompte } from '@/lib/parseur-croesus/identifiant-compte';

/** Statuts d'un constat — section 1 du schéma. */
export type StatutConstat = 'calcule' | 'montant-a-confirmer' | 'indisponible' | 'non-applicable';

/** Niveau de confiance propagé — un constat hérite de la portée la plus faible. */
export type Portee = 'complete' | 'interne-seulement' | 'declaree' | 'inconnue';

export type EtatCivil = 'celibataire' | 'marie' | 'conjoint-de-fait' | 'veuf' | 'divorce';

export type TrancheRevenu = '0-50k' | '50-100k' | '100-150k' | '150-200k' | '200k+';

export type TypeCompte =
  | 'reer' | 'celi' | 'celiapp' | 'cri' | 'ferr' | 'frv'
  | 'non-enregistre' | 'corpo' | 'reee';

export type Titulaire = 'client' | 'conjoint' | 'conjoint-commun' | 'societe';

/** oui | non | inconnu — la question de rencontre n° 1. */
export type ReponseTernaire = 'oui' | 'non' | 'inconnu';

/** jamais | deja-eu | inconnu — requis pour les droits CELI réels. */
export type HistoriqueExterne = 'jamais' | 'deja-eu' | 'inconnu';

/** Un montant daté, dont la source autoritaire est l'avis de cotisation. */
export type MontantDate = {
  montant: number | null;
  dateDonnee: string | null;
};

export type Demographie = {
  age: number | null;
  etatCivil: EtatCivil | null;
  province: string | null;
  conjoint: {
    age: number | null;
    trancheRevenu: TrancheRevenu | null;
  };
};

export type Revenus = {
  trancheRevenu: TrancheRevenu | null;
  /** declare (dit en rencontre) | document (avis de cotisation) */
  source: 'declare' | 'document' | null;
  dateDonnee: string | null;
};

/**
 * Un transfert entrant résolu à la main — ajout du 4 août 2026.
 *
 * La règle 4 du parseur présume EXTERNE tout transfert non apparié, ce qui
 * rétrograde 75 % des comptes CELI en borne. Le planificateur lève le doute un
 * transfert à la fois, après en avoir parlé au client.
 */
export type TransfertResolu = {
  /** compte|date|montant — identifie le transfert de façon stable. */
  cle: string;
  compte: string;
  date: string;
  montant: number;
  resolution: 'interne' | 'externe';
  /** Obligatoire : une résolution non datée ne vaut rien. */
  dateConfirmation: string;
  note: string | null;
};

export type Consolidation = {
  comptesExternes: ReponseTernaire;
  historiqueExterne: HistoriqueExterne;
  detailsExternes: string | null;
  dateConfirmation: string | null;
  transfertsResolus: TransfertResolu[];
};

export type Droits = {
  reerInutilises: MontantDate;
  celiInutilises: MontantDate;
  celiConjointInutilises: MontantDate;
  pertesCapitalReportees: MontantDate;
};

export type CotisationsAnnee = {
  reer: number;
  celi: number;
  portee: Portee;
};

export type Position = {
  symbole: string;
  /**
   * LA DEVISE FAIT PARTIE DE L'IDENTITÉ D'UNE POSITION — règle héritée du
   * grand livre : « clé de position = symbole + devise ». Le CDR canadien et
   * l'action américaine portent le même symbole ; les confondre a coûté
   * 65 470 $ d'erreur avant correction.
   */
  devise: string;
  categorie: string | null;
  valeurMarchande: number | null;
  /** = PBR. null si absent de l'export → gains latents indisponibles. */
  valeurComptable: number | null;
  revenuAnnuel: number | null;
};

/**
 * D'où vient le numéro complet d'un compte — ajout du 5 août 2026.
 *
 * Un relevé de positions ne porte que le SUFFIXE du compte, jamais son numéro.
 * La jointure vers le livre est donc AMBIGUË PAR NATURE : 65 clients ont deux
 * comptes finissant par la même lettre. Ce champ dit ce qu'on sait vraiment.
 *
 *   livre         un seul compte du livre porte ce suffixe
 *   confirme      le planificateur a tranché lui-même
 *   ambigu        plusieurs candidats — le numéro reste null
 *   absent        aucun candidat : livre pas encore importé, ou compte sans
 *                 transaction dans la période collée
 *   non-jointable le compte cherché est un VMBL (suffixe = chiffre) alors que
 *                 le relevé porte une lettre : les deux ne se comparent pas
 */
export type ProvenanceNumero = 'livre' | 'confirme' | 'ambigu' | 'absent' | 'non-jointable';

export type Compte = {
  /**
   * Numéro complet — la clé durable. `null` tant qu'il n'est pas PROUVÉ.
   *
   * Nullable depuis le 5 août 2026 : le remplir dans les cas ambigus aurait
   * exigé de choisir un candidat, c'est-à-dire d'écrire une invention dans la
   * clé durable de laquelle tout le reste dépend ensuite.
   */
  numero: string | null;
  /** Le suffixe du relevé — toujours connu, toujours vrai. L'identité de repli. */
  suffixe: string;
  provenanceNumero: ProvenanceNumero;
  /** Les candidats du livre quand la jointure est ambiguë — matière de l'écran. */
  candidats: string[];
  /**
   * Le régime. `null` quand seul le suffixe est connu : la table des suffixes
   * est celle d'iA, et rien dans un relevé ne dit de quelle convention relève
   * le compte. Un « Q » de 2009 y deviendrait un CELIAPP — un régime qui
   * n'existait pas à l'ouverture du compte.
   */
  type: TypeCompte | 'reer-conjoint' | null;
  /** Aucune source automatique : les 13 colonnes d'un relevé ne le portent pas. */
  titulaire: Titulaire | null;
  /** La date du relevé d'où viennent ces positions. Sans elle, deux comptes
   *  datés de deux mois différents s'additionnent en un total qui n'a jamais
   *  existé à aucune date. */
  dateReleve: string | null;
  positions: Position[];
  /** L'encaisse et la MARGE DÉBITRICE. Sans ce champ, un compte afficherait sa
   *  valeur marchande sans sa dette. */
  encaisse: Array<{ devise: string; montant: number }>;
};

export type TransactionsAnnee = {
  gainsRealises: number;
  pertesRealisees: number;
  retraitsReer: number;
  retraitsCeli: number;
  portee: Portee;
};

/** Dérivé de l'import « historique complet depuis l'ouverture ». */
export type HistoriqueRegime = {
  dateOuverture: string | null;
  cotisationsTotales: number | null;
  /** Les retraits de l'année courante ne redonnent des droits que l'an prochain. */
  retraitsAnneesPassees: number | null;
  /** true = preuve d'un compte externe passé → droits rétrogradés en borne. */
  transfertEntrantDetecte: boolean | null;
  dateImport: string | null;
  portee: Portee;
};

export type HistoriqueVie = {
  celi: HistoriqueRegime;
  /** Ne permet JAMAIS de calculer les droits REER (revenus + FE requis). */
  reer: HistoriqueRegime;
};

export type Intentions = {
  ageRetraiteVise: number | null;
  donsAnnuelsMoyens: number | null;
  venteEntreprisePrevue: ReponseTernaire | null;
  achatImmobilierPrevu: ReponseTernaire | null;
  testamentAJour: ReponseTernaire | null;
};

/** Le profil complet — `profils/<pseudonyme>.json`. */
export type ProfilClient = {
  /** Pseudonyme — jamais de nom ni de numéro de compte réel. */
  id: string;
  dateMiseAJour: string;
  /** Incrémenté à chaque rencontre. */
  version: number;
  demographie: Demographie;
  revenus: Revenus;
  consolidation: Consolidation;
  droits: Droits;
  cotisationsAnnee: CotisationsAnnee;
  comptes: Compte[];
  transactionsAnnee: TransactionsAnnee;
  historiqueVie: HistoriqueVie;
  intentions: Intentions;
};

/** Un profil vierge, conforme au schéma — tout est `null`, rien n'est deviné. */
export function profilVierge(id: string, date: string): ProfilClient {
  const regimeVierge = (): HistoriqueRegime => ({
    dateOuverture: null,
    cotisationsTotales: null,
    retraitsAnneesPassees: null,
    transfertEntrantDetecte: null,
    dateImport: null,
    portee: 'inconnue',
  });
  const montantVierge = (): MontantDate => ({ montant: null, dateDonnee: null });

  return {
    id,
    dateMiseAJour: date,
    version: 1,
    demographie: {
      age: null, etatCivil: null, province: null,
      conjoint: { age: null, trancheRevenu: null },
    },
    revenus: { trancheRevenu: null, source: null, dateDonnee: null },
    consolidation: {
      comptesExternes: 'inconnu',
      historiqueExterne: 'inconnu',
      detailsExternes: null,
      dateConfirmation: null,
      transfertsResolus: [],
    },
    droits: {
      reerInutilises: montantVierge(),
      celiInutilises: montantVierge(),
      celiConjointInutilises: montantVierge(),
      pertesCapitalReportees: montantVierge(),
    },
    cotisationsAnnee: { reer: 0, celi: 0, portee: 'inconnue' },
    comptes: [],
    transactionsAnnee: {
      gainsRealises: 0, pertesRealisees: 0,
      retraitsReer: 0, retraitsCeli: 0, portee: 'inconnue',
    },
    historiqueVie: { celi: regimeVierge(), reer: regimeVierge() },
    intentions: {
      ageRetraiteVise: null, donsAnnuelsMoyens: null,
      venteEntreprisePrevue: null, achatImmobilierPrevu: null, testamentAJour: null,
    },
  };
}

/**
 * La clé stable d'un transfert, pour le retrouver d'un import à l'autre.
 *
 * Le compte est CANONISÉ : sans ça, un transfert vu une fois « 6A-AZCI-0 » et
 * une fois « 6AAZCI0 » produirait deux clés, et la résolution manuelle déjà
 * saisie par le planificateur cesserait de s'y rattacher. Voir
 * `croiserTransferts`, qui accepte aussi les clés écrites avant ce changement.
 */
export function cleTransfert(compte: string, date: string, montant: number): string {
  return `${canoniserCompte(compte)}|${date}|${montant.toFixed(2)}`;
}

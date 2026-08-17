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
  /**
   * LA DATE DE NAISSANCE remplace l'âge comme source (12 août 2026, demande de
   * Nicolas). L'âge se périme chaque année ; la date jamais. Et elle donne
   * l'ANNÉE EXACTE DES 18 ANS, donc un plafond CELI cumulatif juste — au lieu
   * du « maximum depuis 2009 » qu'un âge inconnu force. Reste locale, comme
   * tout le profil.
   */
  dateNaissance: string | null;
  /** Dérivé de dateNaissance à la lecture quand elle existe ; sinon saisi. */
  age: number | null;
  etatCivil: EtatCivil | null;
  province: string | null;
  conjoint: {
    age: number | null;
    trancheRevenu: TrancheRevenu | null;
  };
  /** Les enfants beneficiaires d'un REEE. Vide = aucun, ou pas encore demande. */
  enfants: EnfantBeneficiaire[];
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
  /**
   * Les cotisations REEE de l'annee, PAR PRENOM DE BENEFICIAIRE.
   *
   * Le livre nomme l'enfant dans la note : « CONTRIBUTION 01LAURIE ». C'est le
   * seul rattachement disponible -- un compte REEE familial peut servir
   * plusieurs enfants, et la colonne du compte ne les distingue pas.
   * Cle = prenom normalise (sans accent, sans casse, sans chiffre).
   */
  reeeParEnfant: Record<string, number>;
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

/**
 * Le compte détient-il encore quelque chose ? — ajouté le 17 août 2026.
 *
 * `au-releve`        des positions (ou une encaisse) figurent au relevé du jour.
 * `livre-seulement`  le compte apparaît dans les transactions, plus au relevé.
 *
 * ⚠ `livre-seulement` NE VEUT PAS DIRE « FERMÉ ». On observe une absence, pas
 * une fermeture : le compte peut être fermé, transféré ailleurs, ou vidé. Dire
 * « fermé » serait une déduction de plus, et ce schéma en refuse une de plus.
 *
 * AXE DISTINCT DE `provenanceNumero`, qui dit la confiance dans le NUMÉRO.
 * Les deux sont orthogonaux : un compte vu au livre seulement a un numéro
 * certain (`livre`) et aucune position (`livre-seulement`).
 */
export type PresenceCompte = 'au-releve' | 'livre-seulement';

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
  /**
   * Détient-il encore quelque chose ? Voir `PresenceCompte`.
   *
   * Absent des profils écrits avant le 17 août 2026 : `completerProfil` le
   * remplit à `au-releve`, ce qui était la seule valeur possible avant.
   */
  presence: PresenceCompte;
  /**
   * Pour un compte `livre-seulement` : la date de sa dernière transaction, et
   * le dernier solde vu. C'est ce qui permet de dire « plus rien depuis mars
   * 2023 » plutôt que d'afficher un compte à 0 $ indistinguable d'un compte
   * vivant qu'on aurait vidé. `null` pour un compte au relevé.
   */
  derniereActivite: string | null;
  dernierSolde: number | null;
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

/**
 * LES STRATEGIES QUE LE PLANIFICATEUR A CHOISI DE PRESENTER — 5 aout 2026.
 *
 * RIEN N'EST COCHE PAR DEFAUT, et c'est la regle. Le moteur DETECTE des pistes ;
 * il ne decide pas lesquelles vont sous les yeux du client. Une piste
 * pertinente sur papier peut etre inopportune en rencontre pour des raisons que
 * le moteur ne connait pas -- une separation en cours, un deuil, un dossier
 * fiscal deja ouvert.
 *
 * La date est obligatoire quand une selection existe : comme pour un transfert
 * resolu, une selection non datee ne vaut rien. On doit pouvoir dire « ces
 * cases ont ete cochees le 5 aout, avant la rencontre du 6 ».
 */
export type SelectionStrategies = {
  /** Identifiants du catalogue (`cristallisation-pertes`, `celi-conjoint`...). */
  strategies: string[];
  dateSelection: string | null;
};

/**
 * UN ENFANT BENEFICIAIRE D'UN REEE — ajoute le 6 aout 2026.
 *
 * Le prenom est le SEUL moyen de rattacher une cotisation a son beneficiaire :
 * le livre les note « CONTRIBUTION 01LAURIE », « CONTRIBUTION 03JULES ». Mesure
 * sur le livre : 110 comptes REEE, et ce motif porte la quasi-totalite des
 * cotisations.
 *
 * ⚠ CE PRENOM RESTE EN LOCAL, comme tout le profil. Il n'entre jamais dans une
 * charge utile sortante (voir reformuler.ts) ni dans un nom de fichier.
 */
export type EnfantBeneficiaire = {
  prenom: string;
  /** null quand il n'a pas ete demande : l'age decide de l'urgence a cotiser. */
  age: number | null;
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
  /** Ce que le planificateur a choisi de presenter. Vide = rien au PDF. */
  selectionStrategies: SelectionStrategies;
  /**
   * VRAI = dossier d'ESSAI, sans aucune donnée réelle — le bac à sable.
   *
   * C'est le garde de la couche IA (11 août 2026) : tant que la conformité iA
   * n'a pas tranché, l'appel au modèle n'est permis QUE sur un profil marqué
   * fictif. Le marqueur se pose à la main, jamais par déduction.
   */
  fictif: boolean;
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
      dateNaissance: null,
      age: null, etatCivil: null, province: null,
      conjoint: { age: null, trancheRevenu: null },
      enfants: [],
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
    cotisationsAnnee: { reer: 0, celi: 0, reeeParEnfant: {}, portee: 'inconnue' },
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
    selectionStrategies: { strategies: [], dateSelection: null },
    fictif: false,
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

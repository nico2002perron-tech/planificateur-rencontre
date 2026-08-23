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
  /**
   * L'ANNÉE seule — la voie rapide (18 août 2026).
   *
   * Pour le plafond CELI cumulatif, c'est l'année des 18 ans qui fixe le
   * départ : l'année de naissance suffit, et le résultat est EXACT, pas
   * approché. Demander une date complète pour ce calcul, c'est demander trois
   * fois plus de frappe pour la même réponse.
   *
   * `dateNaissance` reste prioritaire quand elle existe (elle sert à d'autres
   * calculs d'âge). Ce champ est le raccourci, pas un doublon.
   */
  anneeNaissance: number | null;
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

/**
 * DANS QUELLE UNITÉ LE MONTANT DES PERTES REPORTÉES EST-IL EXPRIMÉ ?
 *
 * Trois notions se ressemblent et ne se valent pas :
 *
 *   · `perte-capital-brute` — la perte AVANT le taux d'inclusion, telle que
 *     Croesus la rapporte pour les dispositions de l'année. C'est l'unité dans
 *     laquelle le moteur travaille : les gains latents (valeur marchande moins
 *     prix de base) sont eux aussi bruts.
 *
 *   · `perte-nette-capital-fiscale` — la « perte en capital nette » telle que
 *     l'avis de cotisation la reporte, DÉJÀ au taux d'inclusion. La comparer à
 *     un gain latent brut compare deux échelles différentes. Le moteur ne la
 *     convertit pas : le taux d'inclusion n'est pas une constante à coder en
 *     dur, et un facteur inventé serait un chiffre faux de plus.
 *
 *   · `montant-normalise-utilisable` — quelqu'un a fait le travail et affirme
 *     que ce montant est directement consommable par la formule. C'est une
 *     déclaration humaine, pas une dérivation.
 *
 *   · `inconnue` — l'unité n'a pas été demandée, ou pas répondue. Le montant
 *     est conservé, jamais interprété.
 */
export type UnitePertesCapital =
  | 'perte-nette-capital-fiscale'
  | 'perte-capital-brute'
  | 'montant-normalise-utilisable'
  | 'inconnue';

/** D'où vient le montant saisi. `inconnue` = jamais demandé. */
export type SourcePertesCapital =
  | 'avis-cotisation'
  | 'avis-recotisation'
  | 'saisie-manuelle'
  | 'autre'
  | 'inconnue';

/**
 * LES PERTES EN CAPITAL REPORTÉES — un montant N'EST PAS une donnée fiscale.
 *
 * Ce champ était un `MontantDate` comme les trois autres droits. Il ne pouvait
 * pas l'être : les droits REER et CELI sont des montants en dollars dont le
 * sens ne fait aucun doute, alors qu'une perte en capital reportée existe en
 * deux unités incompatibles — et que le champ de saisie ne demandait pas
 * laquelle.
 *
 * INVARIANT : montant connu + unité inconnue ≠ montant fiscal utilisable.
 * Le nombre est préservé — c'est une donnée réelle, entrée par un humain — mais
 * aucune stratégie n'a le droit de le consommer tant que son unité n'est pas
 * établie. Voir `unitePermetUnChiffreFerme`.
 */
export type PertesCapitalReportees = {
  montant: number | null;
  unite: UnitePertesCapital;
  source: SourcePertesCapital;
  dateDonnee: string | null;
};

export const UNITES_PERTES_CAPITAL: readonly UnitePertesCapital[] = [
  'perte-nette-capital-fiscale', 'perte-capital-brute',
  'montant-normalise-utilisable', 'inconnue',
] as const;

export const SOURCES_PERTES_CAPITAL: readonly SourcePertesCapital[] = [
  'avis-cotisation', 'avis-recotisation', 'saisie-manuelle', 'autre', 'inconnue',
] as const;

/**
 * L'UNITÉ PERMET-ELLE UN CHIFFRE FERME ? — la seule porte d'entrée du montant
 * dans un calcul.
 *
 * Le moteur compare les pertes disponibles à des gains latents BRUTS (valeur
 * marchande moins prix de base). Une perte brute se compare directement ; un
 * montant déclaré normalisé aussi, par construction. Une perte nette de l'avis
 * de cotisation exigerait une conversion — donc un taux d'inclusion codé en
 * dur, donc une invention. Et une unité inconnue n'est rien du tout.
 *
 * ⚠ Ce prédicat ne dit pas que le montant est JUSTE : il dit qu'il est
 * COMPARABLE. La fiabilité de la saisie reste une question distincte.
 */
export function unitePermetUnChiffreFerme(unite: UnitePertesCapital): boolean {
  return unite === 'perte-capital-brute' || unite === 'montant-normalise-utilisable';
}

export function pertesCapitalReporteesVierges(): PertesCapitalReportees {
  return { montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null };
}

export type Droits = {
  reerInutilises: MontantDate;
  celiInutilises: MontantDate;
  celiConjointInutilises: MontantDate;
  pertesCapitalReportees: PertesCapitalReportees;
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
  /**
   * DANS QUELLE UNITÉ LES COLONNES MONÉTAIRES DE CETTE LIGNE SONT-ELLES
   * EXPRIMÉES ? — ajouté le 21 août 2026, et c'est un correctif de fond.
   *
   * ⚠ CE N'EST PAS `devise`. Les deux étaient confondus, et la confusion
   * bloquait des dossiers pour un motif faux.
   *
   *   `devise`                → la monnaie de NÉGOCIATION du titre (colonne 0
   *                             du relevé). « USD » y signifie « ce titre se
   *                             transige à New York ».
   *   `uniteValeursRapport`   → la monnaie des COLONNES 8 et 9 (coût total,
   *                             valeur marchande), c'est-à-dire des nombres
   *                             que le moteur consomme.
   *
   * MESURÉ LE 21 AOÛT 2026 sur la base réelle, deux fois :
   *   · sur les lignes d'encaisse « 1USD », valeur marchande ÷ nominal donne
   *     1,379 et 1,389 — le taux de change. Croesus CONVERTIT.
   *   · si le coût était resté en USD pendant que la valeur passait en CAD,
   *     les positions USD montreraient ~38 % d'inflation systématique. Elles
   *     ne la montrent pas : médiane valeur/coût de 1,085 contre 1,063 pour
   *     les CAD, et 40 % en perte contre 41 %.
   *
   * ⚠ CE CONTRAT APPARTIENT AU FORMAT D'IMPORT, PAS À « CROESUS ». Il vaut
   * pour l'export de positions à 13 colonnes que nous supportons. Une autre
   * source, ou un autre réglage de rapport, doit déclarer `inconnue` — et le
   * moteur dégradera, comme il le faisait à tort pour toutes les positions USD.
   */
  uniteValeursRapport?: 'CAD' | 'USD' | 'inconnue';
  /**
   * LE TYPE D'INSTRUMENT, TEL QUE LE RELEVÉ LE DIT — colonne 1, reporté sans
   * transformation (21 août 2026).
   *
   * ⚠ CE N'EST PAS `categorie`, qui reste `null` et le restera. La catégorie
   * d'actif ne se fabrique pas depuis le type et la devise — un FNB coté en
   * CAD peut détenir des actions américaines. Ce champ-ci n'infère rien : il
   * transporte ce que la source affirme d'elle-même.
   *
   * Il sert à UNE chose : savoir en quoi une quantité est exprimée. Mesuré sur
   * la base : « Action » 189, « Obligation » 16, « Fonds d'investissement » 6
   * (les seuls fractionnaires, tous à 3 décimales), « Autre » 1. Voir
   * `granulariteVente`.
   */
  typeInstrument?: string;
  /**
   * LA QUANTITÉ, TELLE QUE LE RELEVÉ LA DIT — colonne 2, reportée sans
   * transformation (21 août 2026).
   *
   * ⚠ SON SENS DÉPEND DE `typeInstrument`, et c'est pourquoi elle ne s'appelle
   * ni `nombreActions` ni `nombreUnites` :
   *
   *   Action                 → des unités
   *   Fonds d'investissement → des parts, au millième
   *   Obligation             → une VALEUR NOMINALE, pas un décompte
   *
   * Un nom qui prétendrait « actions » rendrait faux le tiers des cas et
   * inviterait à diviser une perte par un nominal. La sémantique exécutable
   * appartient à `granulariteVente(typeInstrument)`, pas à ce champ.
   */
  quantite?: number;
  /**
   * LE NOM DU TITRE, TEL QUE LE RELEVÉ L'ÉCRIT — colonne 3, reportée sans
   * transformation (21 août 2026).
   *
   * ⚠ DONNÉE DE PRÉSENTATION, ET RIEN D'AUTRE. Elle sert à écrire
   * « goeasy Ltd. » sous « GSY » dans le document remis au client. Elle
   * n'entre dans AUCUN calcul, AUCUNE qualification fiscale, AUCUN choix de
   * candidat — et surtout pas dans une déduction de catégorie d'actif, que
   * `comptes.ts` interdit explicitement de fabriquer.
   */
  description?: string;
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
  /**
   * ⚠ TOUTES LES DISPOSITIONS, TOUS RÉGIMES CONFONDUS — ce n'est PAS l'assiette
   * fiscale, et ça ne doit jamais servir à un calcul de cristallisation.
   *
   * Mesuré le 20 août 2026 sur la base locale : 171 des 440 dispositions du
   * livre (39 %) sont dans des comptes ENREGISTRÉS — REER 128, REEE 25,
   * CELI 12, FERR 6. Une perte réalisée dans un CELI n'existe pas fiscalement :
   * elle n'absorbe aucun gain imposable, et un gain réalisé dans un REER n'est
   * pas un gain en capital. Ces deux champs les additionnent quand même, parce
   * qu'ils décrivent la PERFORMANCE réalisée, pas la matière imposable.
   *
   * Pour tout raisonnement fiscal, utiliser les deux champs suivants.
   */
  gainsRealises: number;
  pertesRealisees: number;
  /**
   * L'ASSIETTE FISCALE — dispositions en comptes NON ENREGISTRÉS seulement
   * (20 août 2026). C'est cette base, et elle seule, que les cristallisations
   * consomment.
   *
   * ⚠ NÉCESSAIRE, PAS SUFFISANT : « non enregistré » veut dire « la disposition
   * a un effet fiscal possible », jamais « la perte est admissible ». Les
   * pertes apparentes (30 jours), les transferts en nature vers un régime
   * enregistré, les personnes affiliées et les autres refus ne sont PAS
   * vérifiés ici — ils viendront avec le lot de cristallisation.
   */
  gainsRealisesNonEnregistres: number;
  pertesRealiseesNonEnregistrees: number;
  /**
   * LES DISPOSITIONS DONT LE RÉGIME N'EST PAS PROUVÉ — comptées à part, jamais
   * assimilées à du non-enregistré. Un compte dont le suffixe n'est pas dans
   * les tables pourrait être un CELI comme une marge : le supposer imposable
   * fabriquerait une perte utilisable qui n'existe peut-être pas.
   *
   * Elles ne sont PAS dans l'assiette. Le compteur existe pour qu'une stratégie
   * puisse un jour se dégrader quand elles sont matérielles — ce branchement
   * n'est pas fait dans ce lot.
   */
  dispositionsRegimeIndetermine: { nombre: number; gains: number; pertes: number };
  /**
   * UNE PERTE DE L'ANNÉE RISQUE-T-ELLE D'ÊTRE APPARENTE ? (20 août 2026)
   *
   * Vrai quand le livre montre le RACHAT du même titre dans les trente jours
   * d'une vente à perte. C'est ce que les données permettent de voir.
   *
   * ⚠ FAUX NE VEUT PAS DIRE « aucune perte apparente » : le conjoint, une
   * société contrôlée et les comptes détenus ailleurs sont hors de notre vue.
   * L'absence de rachat visible est une absence de preuve, pas une preuve
   * d'absence — et le constat le déclare.
   */
  pertesCourantesAValiderPerteApparente: boolean;
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
/**
 * PARTICULIER OU ENTREPRISE — déclaré, jamais deviné.
 *
 * ⚠ AUCUNE DÉDUCTION AUTOMATIQUE. Ni « INC. », ni « LTÉE », ni « Gestion », ni
 * « Holding », ni le nom du client, ni le suffixe d'un compte ne suffisent : un
 * particulier peut détenir un compte au suffixe inhabituel, une société peut
 * porter un nom de famille, et se tromper d'entité fiscale n'est pas une
 * imprécision — c'est recommander à un contribuable les stratégies d'un autre.
 *
 * ⚠ ET C'EST UNE PROPRIÉTÉ DU PROFIL, PAS D'UN COMPTE. Un compte A, E ou autre
 * ne dit rien du propriétaire. Le planificateur le déclare une fois.
 */
export type TypeTitulaire = 'particulier' | 'entreprise';

export type ProfilClient = {
  /** Pseudonyme — jamais de nom ni de numéro de compte réel. */
  id: string;
  /**
   * LE TYPE D'ENTITÉ DU DOSSIER — `particulier` par défaut.
   *
   * Un profil écrit avant ce champ n'en porte pas : les lectures passent donc
   * par `typeTitulaireDe()`, qui répond `particulier` plutôt que `undefined`.
   * Le défaut sûr est celui qui laisse les stratégies personnelles s'appliquer,
   * parce que c'est le cas de la quasi-totalité des dossiers.
   */
  typeTitulaire?: TypeTitulaire;
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
  /**
   * LA LIGNE DU TEMPS DES FLUX — dérivée À LA LECTURE par hydraterProfil(),
   * JAMAIS persistée (même doctrine que `comptes` : un champ figé porterait
   * un chiffre périmé sans le signaler). Optionnelle et ADDITIVE : absente
   * d'un profil non hydraté ou sans livre, et rien ne la consomme encore —
   * elle vit EN PARALLÈLE des dérivations existantes le temps de les
   * comparer (19 août 2026). Amendement au schéma, section 7.
   */
  ligneDuTemps?: import('./ligne-du-temps').LigneDuTemps;
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
      anneeNaissance: null,
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
      pertesCapitalReportees: pertesCapitalReporteesVierges(),
    },
    cotisationsAnnee: { reer: 0, celi: 0, reeeParEnfant: {}, portee: 'inconnue' },
    comptes: [],
    transactionsAnnee: {
      gainsRealises: 0, pertesRealisees: 0,
      gainsRealisesNonEnregistres: 0, pertesRealiseesNonEnregistrees: 0,
      dispositionsRegimeIndetermine: { nombre: 0, gains: 0, pertes: 0 },
      pertesCourantesAValiderPerteApparente: false,
      retraitsReer: 0, retraitsCeli: 0, portee: 'inconnue',
    },
    historiqueVie: { celi: regimeVierge(), reer: regimeVierge() },
    intentions: {
      ageRetraiteVise: null, donsAnnuelsMoyens: null,
      venteEntreprisePrevue: null, achatImmobilierPrevu: null, testamentAJour: null,
    },
    selectionStrategies: { strategies: [], dateSelection: null },
    typeTitulaire: 'particulier',
    fictif: false,
  };
}

/**
 * LE TYPE D'ENTITÉ, AVEC SON DÉFAUT — la seule porte de lecture.
 *
 * Un profil antérieur au champ répond `particulier`. Passer par cette fonction
 * plutôt que par `profil.typeTitulaire` évite qu'un `undefined` se propage
 * jusqu'à une comparaison qui le traiterait comme « ni l'un ni l'autre ».
 */
export function typeTitulaireDe(profil: { typeTitulaire?: TypeTitulaire }): TypeTitulaire {
  return profil.typeTitulaire === 'entreprise' ? 'entreprise' : 'particulier';
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

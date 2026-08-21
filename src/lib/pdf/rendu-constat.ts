// COMMENT UN CONSTAT SE PRÉSENTE — les décisions, hors du JSX.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE.
//
// Le PDF est une PROJECTION du verdict, jamais une seconde couche de
// raisonnement fiscal. Tant que ces décisions vivaient dans le JSX, deux choses
// étaient impossibles : les tester sans rendre un document, et garantir qu'un
// auteur pressé ne contourne pas une règle en écrivant une phrase.
//
// LA RÈGLE CENTRALE, ET ELLE EST STRUCTURELLE :
//
//   un montant fiscal ne peut atteindre le client que par `montantAffichable`,
//   qui ne rend un chiffre que sous `calcule`. Toute autre voie — et en
//   particulier la prose libre du constat — passe par `proseSansMontantFerme`,
//   qui neutralise les montants en dollars des statuts dégradés.
//
// Avant, la protection reposait sur la discipline : chaque auteur de stratégie
// devait penser à ne pas mettre de chiffre dans une phrase dégradée. Ça a tenu
// — mais « ça a tenu » n'est pas une garantie, c'est une chance répétée.
// ─────────────────────────────────────────────────────────────────────────────
import type { Constat } from '@/lib/profils/strategies';
import type { StatutConstat } from '@/lib/profils/types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. LE CHIFFRE — une seule porte
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LE MONTANT FISCAL AFFICHABLE, ou `null`.
 *
 * `strategies.ts` garantit déjà que `montantEstime` est `null` hors de
 * `calcule`, et le teste. On ne dépend pas d'une seule barrière pour un chiffre
 * qui atteint un client : celle-ci est la seconde, et c'est elle que le PDF
 * appelle. Un constat forgé à la main avec un statut dégradé ET un montant ne
 * peut donc rien afficher.
 */
export function montantAffichable(constat: Constat): number | null {
  if (constat.statut !== 'calcule') return null;
  return constat.montantEstime;
}

/**
 * LES MONTANTS EN DOLLARS D'UNE PROSE DÉGRADÉE.
 *
 * Motif : `explication` est rendue quel que soit le statut. C'est le seul canal
 * par lequel un chiffre pourrait encore franchir la garde ci-dessus — il
 * suffirait qu'une stratégie écrive « jusqu'à 32 000 $ pourraient être
 * cristallisés » dans un constat à confirmer.
 *
 * On ne SUPPRIME pas le montant : une phrase amputée devient illisible. On le
 * remplace par ce qu'il est réellement — un montant qui reste à confirmer.
 *
 * ⚠ SEULS LES MONTANTS EN DOLLARS sont visés, pas tous les nombres. « 2
 * positions non enregistrées portent un gain latent » est une phrase vraie et
 * utile ; en effacer le 2 n'aurait protégé personne et aurait abîmé le texte.
 * Le danger nommé par la doctrine, c'est le RÉSULTAT FISCAL présenté comme
 * établi — et un résultat fiscal porte toujours son signe de dollar.
 */
/**
 * ⚠ RISQUE CONNU, NON BLOQUANT — décidé le 21 août 2026 avec Nicolas.
 *
 * Ce filtre est une LISTE NOIRE : il attrape les montants ÉCRITS EN CHIFFRES
 * avec leur signe de dollar. Il n'attraperait PAS « trente-deux mille dollars »
 * écrit en toutes lettres.
 *
 * Pourquoi on l'accepte : aucune stratégie du dépôt n'écrit un montant en
 * lettres, toutes passent par `argent()`, et le danger nommé par la doctrine —
 * un RÉSULTAT FISCAL présenté comme établi — porte toujours son signe de
 * dollar. Un mécanisme de plus aujourd'hui protégerait contre un cas qui
 * n'existe pas, au prix d'une complexité qui, elle, existerait.
 *
 * CE QUI LE RENDRAIT BLOQUANT : le jour où une stratégie — ou une
 * reformulation par un modèle — écrirait un montant en lettres. C'est le
 * déclencheur à surveiller, pas une échéance.
 */
const MONTANT_EN_DOLLARS = /\d[\d.,    ]{0,15}\$/g;

export function proseSansMontantFerme(texte: string, statut: StatutConstat): string {
  if (statut === 'calcule') return texte;
  return texte.replace(MONTANT_EN_DOLLARS, 'un montant à confirmer');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LES QUATRE STATUTS — quatre rendus, jamais trois
// ─────────────────────────────────────────────────────────────────────────────

export type EnteteStatut = {
  /** Le mot de la pastille. Il suit le STATUT, jamais le montant. */
  badge: string;
  /** Ce que la carte annonce, en une ligne, avant toute explication. */
  annonce: string;
  /** Le titre du bloc des raisons, quand il y en a. */
  titreRaisons: string;
};

/**
 * ⚠ `indisponible` ET `non-applicable` NE SE CONFONDENT PAS.
 *
 * « Aucune occasion détectée » est une CONCLUSION : le moteur a regardé et n'a
 * rien trouvé. « Analyse indisponible » est un AVEU : il n'a pas pu regarder.
 * Les présenter pareil transformerait chaque donnée manquante en bonne
 * nouvelle — c'est le faux vert que tout ce chantier existe pour empêcher.
 */
export const ENTETE: Record<StatutConstat, EnteteStatut> = {
  calcule: {
    badge: 'Calculé',
    annonce: 'Opportunité estimée',
    titreRaisons: 'Pour aller plus loin',
  },
  'montant-a-confirmer': {
    badge: 'À confirmer',
    annonce: 'Montant à confirmer',
    titreRaisons: 'À confirmer avant d’agir',
  },
  indisponible: {
    badge: 'Données insuffisantes',
    annonce: 'Analyse indisponible avec les données actuelles',
    titreRaisons: 'Données manquantes',
  },
  'non-applicable': {
    badge: 'Non applicable',
    annonce: 'Aucune occasion détectée avec les données analysées',
    titreRaisons: 'À noter',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. LES RAISONS — traduites une seule fois, ici
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le moteur rend déjà ses `donneesManquantes` en français lisible. Cette table
 * est un FILET, pas une traduction : si un identifiant technique
 * (`bien-identique-multi-comptes-a-confirmer`) atteignait un jour cette
 * couche, il serait rendu tel quel au client. On l'attrape ici, et un test
 * vérifie qu'aucun kebab-case ne franchit la page.
 */
const TRADUCTIONS: Record<string, string> = {
  'positions-sans-pbr': 'le prix de base rajusté de certaines positions',
  'positions-sans-valeur-marchande': 'la valeur marchande de certaines positions',
  'devise-etrangere-non-convertie': 'la valeur en dollars canadiens des positions en devise étrangère',
  'bien-identique-multi-comptes-a-confirmer': 'le prix de base d’un titre détenu dans plusieurs comptes',
  'regime-de-compte-non-prouve': 'le régime de certains comptes',
  'dispositions-regime-indetermine': 'le régime des comptes d’où proviennent certaines ventes',
  'pertes-reportees-unite-non-demontree': 'l’unité des pertes en capital reportées',
  'pertes-reportees-unite-incompatible': 'le montant brut des pertes en capital reportées',
  'perte-courante-a-valider-perte-apparente': 'la confirmation qu’aucune perte de l’année n’est une perte apparente',
  'portee-externe-non-confirmee': 'la liste des positions détenues ailleurs',
};

/** Vrai pour un identifiant technique — du kebab-case sans espace ni majuscule. */
export function estIdentifiantTechnique(s: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)+$/.test(s.trim());
}

export function libelleRaison(brut: string): string {
  const cle = brut.trim();
  if (TRADUCTIONS[cle]) return TRADUCTIONS[cle];
  if (estIdentifiantTechnique(cle)) {
    // Un slug inconnu ne se montre pas au client. On dit qu'il manque quelque
    // chose plutôt que d'afficher du vocabulaire de programmeur.
    return 'une donnée du dossier reste à confirmer';
  }
  return cle;
}

/**
 * CE QUI EMPÊCHE D'AGIR, tel que le moteur l'a déclaré — rien de plus.
 *
 * La limite de visibilité en fait partie quand elle existe : elle est
 * précisément une raison de ne pas conclure, et §10 demande qu'elle apparaisse
 * ici plutôt que reléguée en note.
 */
export function raisonsAConfirmer(constat: Constat): string[] {
  const raisons = constat.donneesManquantes.map(libelleRaison);
  if (constat.limiteVisibilite && constat.statut !== 'calcule') {
    raisons.push('la portée du dossier : ' + constat.limiteVisibilite);
  }
  // Deux stratégies peuvent nommer le même manque par deux chemins.
  return [...new Set(raisons.filter((r) => r.trim() !== ''))];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LE TABLEAU — un plan n'est pas une liste de candidats
// ─────────────────────────────────────────────────────────────────────────────

export type ModeTableau = 'plan' | 'candidats';

/**
 * LEQUEL DES DEUX ON LIT.
 *
 * ⚠ UN PLAN NE SORT JAMAIS D'UN STATUT DÉGRADÉ. Le moteur n'en attache déjà
 * qu'aux constats calculés ; on le vérifie ici aussi, parce que la différence
 * entre les deux modes est une différence d'AUTORITÉ : un plan est une marche à
 * suivre, des candidats sont des observations du relevé.
 */
export function modeTableau(constat: Constat): ModeTableau | null {
  const aUnPlan = constat.statut === 'calcule'
    && Array.isArray(constat.plan) && constat.plan.length > 0;
  if (aUnPlan) return 'plan';
  return Array.isArray(constat.candidats) && constat.candidats.length > 0 ? 'candidats' : null;
}

export function lignesTableau(constat: Constat) {
  const mode = modeTableau(constat);
  if (mode === 'plan') return constat.plan!;
  if (mode === 'candidats') return constat.candidats!;
  return [];
}

/**
 * LES EN-TÊTES DE COLONNES CHANGENT AVEC LE MODE — et c'était un vrai défaut.
 *
 * Le tableau affichait « Vendre (environ) » dans les deux cas. Sous un statut
 * dégradé, la colonne montrait donc la VALEUR ENTIÈRE de la position sous un
 * intitulé qui dit de la vendre : une instruction d'exécution fabriquée par la
 * mise en page, à partir d'un montant que le moteur n'a jamais recommandé.
 *
 * En mode candidats, les deux colonnes redeviennent ce qu'elles sont vraiment :
 * des mesures lues sur le relevé.
 */
export const COLONNES: Record<ModeTableau, { montant: string; gain: string; legende: string }> = {
  plan: {
    montant: 'Vendre (environ)',
    gain: 'Gain cristallisé',
    legende:
      'L’ordre va du titre au gain le plus dense au moins dense : la cible est atteinte en '
      + 'vendant-rachetant le moins possible. Une ligne marquée « en partie » suppose que la '
      + 'part vendue porte la même part du gain ; le montant exact se confirme au relevé.',
  },
  candidats: {
    montant: 'Valeur au relevé',
    gain: 'Gain latent observé',
    legende:
      'Positions présentant un gain latent selon les données disponibles. Ces deux colonnes sont '
      + 'des mesures du relevé — valeur marchande et écart avec le prix de base —, pas un ordre de '
      + 'vente ni un montant fiscal. Ce qui manque pour chiffrer l’opération est nommé plus haut.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. LA DATE ET LA PORTÉE
// ─────────────────────────────────────────────────────────────────────────────

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * « Selon les valeurs au 19 août 2026 » — et jamais « valeur actuelle ».
 *
 * Le moteur n'a VOLONTAIREMENT aucun seuil de fraîcheur : une date ancienne est
 * vieille, pas invalide. Le PDF n'en invente donc pas non plus — il date, il ne
 * juge pas.
 */
export function mentionDate(dateISO: string | null | undefined): string | null {
  if (!dateISO) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO.trim());
  if (!m) return null;
  const [, a, mois, j] = m;
  const nom = MOIS[Number(mois) - 1];
  if (!nom) return null;
  return `Selon les valeurs au ${Number(j)} ${nom} ${a}.`;
}

/**
 * CE QUE LA PORTÉE PERMET DE CONCLURE.
 *
 * `complete` est le seul cas où le document peut se taire : partout ailleurs il
 * dit sur quoi il s'est appuyé, pour qu'aucune conclusion ne soit lue comme
 * exhaustive.
 */
export function mentionPortee(constat: Constat): string | null {
  if (constat.portee === 'complete') return null;
  return 'Analyse fondée sur les comptes et positions disponibles dans le dossier.';
}

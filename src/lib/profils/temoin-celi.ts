// LA PHASE TÉMOIN DES DROITS CELI — l'ancien décide, le nouveau observe.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE MODULE (20 août 2026, après le NO-GO temporaire de Nicolas).
//
// La nouvelle chaîne fiscale est prête et à parité sur tous les cas propres.
// Elle ne devient PAS pour autant la source de vérité : un seul passage sur
// des dossiers réels a suffi à révéler une régression que 1 000 tests
// synthétiques n'avaient pas vue — une ligne « Retrait » à montant POSITIF qui
// devenait une cotisation ferme. Ce genre de défaut ne s'invente pas au
// clavier ; il se rencontre.
//
// D'où la phase témoin : le nouveau calcule EN PARALLÈLE, ses écarts avec
// l'ancien sont classés et journalisés, et RIEN de ce qu'il produit n'atteint
// le client. C'est un calcul de l'ombre — `shadow calculation` — dont la seule
// production est de la preuve.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE NE FAIT PAS, ET C'EST VOULU :
//   · aucune écriture disque. Le journal est une VALEUR ; c'est l'appelant
//     (un instrument, jamais le serveur) qui décide de l'imprimer. Le chemin
//     de production ne doit ni ralentir ni toucher au disque pour observer ;
//   · aucune donnée nominative. L'identifiant de dossier est un condensé
//     tronqué, non réversible ; les montants n'apparaissent QUE sur les lignes
//     divergentes — une parité n'a rien à dire, donc elle ne dit rien ;
//   · aucune décision. `verdictCeliDuLivre` continue de rendre l'ancien
//     verdict, et il reste le point unique où la bascule se fera.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import type { HistoriqueRegime } from './types';
import type { ResultatDroitsCeli } from './droits-celi';
import type { HistoriqueCeliFiscal, ClasseDivergence } from './droits-celi-fiscal';

/** Les six classes de la consigne — `non-classee` est le filet, et il bloque. */
export type ClasseTemoin = ClasseDivergence | 'non-classee';

export type ComparaisonChamp = {
  champ: string;
  ancien: string | number | null;
  nouveau: string | number | null;
  identiques: boolean;
  classe: ClasseTemoin;
  motif: string;
};

export type RapportTemoin = {
  /** Condensé tronqué du nom du dossier — non réversible, stable d'un passage à l'autre. */
  dossier: string;
  champs: ComparaisonChamp[];
  /** La classe la PLUS GRAVE observée sur le dossier — c'est elle qui décide. */
  classe: ClasseTemoin;
  /** Ce que le dossier contient, en comptages : de quoi expliquer une divergence sans la nommer. */
  contexte: {
    evenementsBloquants: number;
    devisesNonResolues: boolean;
    virementsOrphelins: number;
    inconnusAImpact: number;
    anneesCouvertes: number;
  };
};

/**
 * L'identifiant technique d'un dossier : un condensé SHA-256 tronqué.
 *
 * Ce n'est PAS un nom, et il ne se remonte pas — mais il est STABLE, ce qui
 * permet de suivre le même dossier d'un passage à l'autre sans jamais l'écrire.
 */
export function idDossierAnonyme(nomDossier: string): string {
  return createHash('sha256').update(`temoin-celi|${nomDossier}`).digest('hex').slice(0, 10);
}

const GRAVITE: Record<ClasseTemoin, number> = {
  parite: 0, 'bug-ancien-corrige': 1, 'ambiguite-volontaire': 1, 'difference-de-portee': 1,
  'non-classee': 2, regression: 3,
};

/**
 * Compare l'ancien verdict au nouveau sur TOUS les champs de la consigne §3,
 * et classe chaque écart.
 *
 * LA RÈGLE DE CLASSEMENT, dans l'ordre : ce qui est identique est `parite` ;
 * ce qu'un défaut connu explique est nommé ; ce qui reste sort `non-classee`,
 * et `non-classee` BLOQUE la bascule au même titre qu'une régression. Un écart
 * qu'on ne sait pas nommer est un écart qu'on ne comprend pas.
 */
export function comparerVerdictsCeli(
  nomDossier: string,
  ancienHistorique: HistoriqueRegime,
  ancienDroits: ResultatDroitsCeli,
  nouveau: HistoriqueCeliFiscal,
  contexte: RapportTemoin['contexte']
): RapportTemoin {
  const champs: ComparaisonChamp[] = [];
  const c = nouveau.completude;

  const ajouter = (champ: string, a: string | number | null, n: string | number | null, expliquer: () => { classe: ClasseTemoin; motif: string } | null) => {
    if (a === n) { champs.push({ champ, ancien: a, nouveau: n, identiques: true, classe: 'parite', motif: 'identiques' }); return; }
    const e = expliquer();
    champs.push({
      champ, ancien: a, nouveau: n, identiques: false,
      classe: e?.classe ?? 'non-classee',
      motif: e?.motif ?? 'écart qu’aucune explication connue ne couvre — à comprendre avant toute bascule',
    });
  };

  // ── les montants ──────────────────────────────────────────────────────────
  const expliquerMontant = (a: number | null, n: number | null) => (): { classe: ClasseTemoin; motif: string } | null => {
    if (a === null || n === null) return { classe: 'difference-de-portee', motif: 'l’un des deux n’a rien à dire sur ce champ' };
    if (c.devisesNonResolues && a > n) return { classe: 'bug-ancien-corrige', motif: 'l’ancien additionnait la devise étrangère au nominal (D5)' };
    if (c.naturesNonResolues && a > n) return { classe: 'ambiguite-volontaire', motif: 'des mouvements de nature non tranchée sont exclus du ferme' };
    return null;   // → non-classee, et ça bloque
  };
  ajouter('cotisationsTotales', ancienHistorique.cotisationsTotales, nouveau.versHistoriqueRegime.cotisationsTotales,
    expliquerMontant(ancienHistorique.cotisationsTotales, nouveau.versHistoriqueRegime.cotisationsTotales));
  ajouter('retraitsAnneesPassees', ancienHistorique.retraitsAnneesPassees, nouveau.versHistoriqueRegime.retraitsAnneesPassees,
    expliquerMontant(ancienHistorique.retraitsAnneesPassees, nouveau.versHistoriqueRegime.retraitsAnneesPassees));

  // ── le statut ─────────────────────────────────────────────────────────────
  ajouter('statut', ancienDroits.statut, nouveau.statut, () => {
    // Le nouveau est PLUS EXIGEANT par construction : il refuse le ferme sur
    // une devise, une nature ou un inconnu à impact que l'ancien ignorait.
    if (ancienDroits.statut === 'calcule' && nouveau.statut !== 'calcule') {
      if (c.devisesNonResolues) return { classe: 'bug-ancien-corrige', motif: 'l’ancien chiffrait malgré une devise étrangère non convertie' };
      if (c.naturesNonResolues || c.evenementsBloquants > 0) {
        return { classe: 'ambiguite-volontaire', motif: 'le nouveau refuse le ferme tant que des événements peuvent changer le résultat' };
      }
    }
    if (nouveau.statut === 'indisponible' && ancienDroits.statut !== 'indisponible') {
      return { classe: 'difference-de-portee', motif: 'une donnée fondamentale manque au nouveau (plafond, historique)' };
    }
    return null;
  });

  // ── le montant du droit, et les bornes ────────────────────────────────────
  ajouter('droitCalcule', ancienDroits.montant, nouveau.statut === 'calcule' ? nouveau.droitMinimum : null, () => {
    if (nouveau.statut !== 'calcule') return { classe: 'ambiguite-volontaire', motif: 'le nouveau ne chiffre pas tant que tout n’est pas tranché' };
    if (ancienDroits.montant === null) return { classe: 'difference-de-portee', motif: 'l’ancien ne chiffrait pas non plus' };
    return null;
  });
  ajouter('borneAncienne_vs_droitMaximum', ancienDroits.borne, nouveau.droitMaximum, () => {
    if (nouveau.droitMaximum === null) return { classe: 'ambiguite-volontaire', motif: 'aucune borne chiffrable : une devise ou un montant reste inconnu' };
    if (ancienDroits.borne === null) return { classe: 'difference-de-portee', motif: 'l’ancien n’avait pas de borne' };
    if (c.devisesNonResolues || c.naturesNonResolues) return { classe: 'ambiguite-volontaire', motif: 'les bornes s’écartent parce que le nouveau isole ce qui n’est pas tranché' };
    return null;
  });

  // ── la portée ─────────────────────────────────────────────────────────────
  ajouter('portee', ancienHistorique.portee, nouveau.versHistoriqueRegime.portee, () => (
    { classe: 'difference-de-portee', motif: 'la portée déclarée diffère entre les deux chaînes' }
  ));

  // ── ce que chacun réclame ─────────────────────────────────────────────────
  ajouter('nbDonneesManquantes', ancienDroits.conditionsManquantes.length, nouveau.donneesManquantes.length, () => (
    { classe: 'ambiguite-volontaire', motif: 'le nouveau nomme des questions que l’ancien ne posait pas (devise, nature, événements à impact)' }
  ));

  const classe = champs.reduce<ClasseTemoin>((pire, ch) => (GRAVITE[ch.classe] > GRAVITE[pire] ? ch.classe : pire), 'parite');
  return { dossier: idDossierAnonyme(nomDossier), champs, classe, contexte };
}

// ═══ LE JOURNAL — non nominatif, une ligne par dossier et par passage ════════

export type LigneJournalTemoin = {
  date: string;
  versionMoteur: string;
  dossier: string;
  classe: ClasseTemoin;
  ancienStatut: string;
  nouveauStatut: string;
  /** Les montants n'apparaissent QUE sur une ligne divergente : une parité n'a rien à dire. */
  ancienMontant: number | null;
  nouveauMontant: number | null;
  evenementsBloquants: number;
  devisesEtrangeres: number;
  virementsOrphelins: number;
  inconnusAImpact: number;
  /** Le motif NORMALISÉ — celui du champ le plus grave, jamais un texte libre de client. */
  motif: string;
};

/** La version du moteur fiscal — à incrémenter quand une règle change. */
export const VERSION_MOTEUR_FISCAL = 'celi-fiscal/2026-08-20';

export function ligneJournalTemoin(
  rapport: RapportTemoin,
  ancienDroits: ResultatDroitsCeli,
  nouveau: HistoriqueCeliFiscal,
  jour: string
): LigneJournalTemoin {
  const pire = rapport.champs.find((ch) => ch.classe === rapport.classe && !ch.identiques);
  const divergent = rapport.classe !== 'parite';
  return {
    date: jour,
    versionMoteur: VERSION_MOTEUR_FISCAL,
    dossier: rapport.dossier,
    classe: rapport.classe,
    ancienStatut: ancienDroits.statut,
    nouveauStatut: nouveau.statut,
    ancienMontant: divergent ? ancienDroits.montant ?? ancienDroits.borne : null,
    nouveauMontant: divergent ? nouveau.droitMinimum : null,
    evenementsBloquants: rapport.contexte.evenementsBloquants,
    devisesEtrangeres: rapport.contexte.devisesNonResolues ? 1 : 0,
    virementsOrphelins: rapport.contexte.virementsOrphelins,
    inconnusAImpact: rapport.contexte.inconnusAImpact,
    motif: pire ? `${pire.champ} : ${pire.motif}` : 'aucun écart',
  };
}

export type StatistiquesTemoin = {
  dossiers: number;
  parClasse: Record<ClasseTemoin, number>;
  tauxParite: number;
  /** VRAI seulement si aucune régression NI non-classée : c'est la condition de bascule. */
  basculePossible: boolean;
  couverture: {
    avecUsd: number;
    avecVirementsOrphelins: number;
    avecInconnusAImpact: number;
    dossiersPropres: number;
  };
};

/** Les statistiques cumulées (§6) — lues du journal, jamais recalculées ailleurs. */
export function agregerTemoin(journal: LigneJournalTemoin[]): StatistiquesTemoin {
  const parClasse: Record<ClasseTemoin, number> = {
    parite: 0, 'bug-ancien-corrige': 0, 'ambiguite-volontaire': 0,
    'difference-de-portee': 0, regression: 0, 'non-classee': 0,
  };
  for (const l of journal) parClasse[l.classe]++;
  const propres = journal.filter((l) =>
    l.devisesEtrangeres === 0 && l.virementsOrphelins === 0 && l.inconnusAImpact === 0 && l.evenementsBloquants === 0);
  return {
    dossiers: journal.length,
    parClasse,
    tauxParite: journal.length === 0 ? 0 : Math.round((parClasse.parite / journal.length) * 1000) / 10,
    basculePossible: parClasse.regression === 0 && parClasse['non-classee'] === 0
      && propres.every((l) => l.classe === 'parite'),
    couverture: {
      avecUsd: journal.filter((l) => l.devisesEtrangeres > 0).length,
      avecVirementsOrphelins: journal.filter((l) => l.virementsOrphelins > 0).length,
      avecInconnusAImpact: journal.filter((l) => l.inconnusAImpact > 0).length,
      dossiersPropres: propres.length,
    },
  };
}

// ═══ LA MÉMOIRE DU TÉMOIN — comparer deux passages ══════════════════════════
//
// Un journal qui ne garde qu'un passage répond à « où en est-on ? ». Il ne
// répond pas à la seule question qui compte quand le moteur change : « qu'est-ce
// qui a bougé ? ». Une divergence qui APPARAÎT entre deux versions est un
// signal ; une qui DISPARAÎT sans qu'on ait corrigé quoi que ce soit en est un
// autre, plus inquiétant encore.
//
// Ces fonctions sont PURES : elles lisent deux listes de lignes de journal et
// disent ce qui a changé. C'est l'instrument qui possède le fichier ; le
// serveur, lui, ne touche jamais au disque pour observer.

export type EvolutionDossier = {
  dossier: string;
  avant: ClasseTemoin | null;
  apres: ClasseTemoin | null;
  /** `apparue` : le dossier diverge maintenant · `disparue` : il ne diverge plus · `aggravee`/`amelioree` · `stable`. */
  mouvement: 'apparue' | 'disparue' | 'aggravee' | 'amelioree' | 'stable' | 'nouveau-dossier' | 'dossier-absent';
};

export type ComparaisonPassages = {
  versionAvant: string;
  versionApres: string;
  evolutions: EvolutionDossier[];
  /** Ce qui exige un regard : une divergence apparue, aggravée, ou disparue sans raison. */
  aExaminer: EvolutionDossier[];
};

/**
 * Compare deux passages du journal, dossier par dossier.
 *
 * ⚠ UNE DISPARITION EST AUSSI UN SIGNAL. Si une divergence s'évapore alors
 * qu'aucune correction ne la visait, c'est que quelque chose d'autre a bougé —
 * et un silence obtenu par accident vaut moins que rien.
 */
export function comparerPassages(
  precedent: LigneJournalTemoin[],
  courant: LigneJournalTemoin[]
): ComparaisonPassages {
  const avantParDossier = new Map(precedent.map((l) => [l.dossier, l]));
  const apresParDossier = new Map(courant.map((l) => [l.dossier, l]));
  const dossiers = [...new Set([...avantParDossier.keys(), ...apresParDossier.keys()])].sort();

  const evolutions: EvolutionDossier[] = dossiers.map((dossier) => {
    const a = avantParDossier.get(dossier) ?? null;
    const b = apresParDossier.get(dossier) ?? null;
    if (a === null) return { dossier, avant: null, apres: b!.classe, mouvement: 'nouveau-dossier' };
    if (b === null) return { dossier, avant: a.classe, apres: null, mouvement: 'dossier-absent' };
    if (a.classe === b.classe) return { dossier, avant: a.classe, apres: b.classe, mouvement: 'stable' };
    if (a.classe === 'parite') return { dossier, avant: a.classe, apres: b.classe, mouvement: 'apparue' };
    if (b.classe === 'parite') return { dossier, avant: a.classe, apres: b.classe, mouvement: 'disparue' };
    return {
      dossier, avant: a.classe, apres: b.classe,
      mouvement: GRAVITE[b.classe] > GRAVITE[a.classe] ? 'aggravee' : 'amelioree',
    };
  });

  return {
    versionAvant: precedent[0]?.versionMoteur ?? '(aucun passage précédent)',
    versionApres: courant[0]?.versionMoteur ?? '(aucun passage courant)',
    evolutions,
    aExaminer: evolutions.filter((e) => e.mouvement !== 'stable' && e.mouvement !== 'nouveau-dossier'),
  };
}

/** Le dernier passage COMPLET d'un journal cumulé — celui d'une même date et d'une même version. */
export function dernierPassage(journal: LigneJournalTemoin[]): LigneJournalTemoin[] {
  if (journal.length === 0) return [];
  const dernier = journal[journal.length - 1];
  return journal.filter((l) => l.date === dernier.date && l.versionMoteur === dernier.versionMoteur);
}

/** L'avant-dernier passage — celui auquel comparer le courant. */
export function passagePrecedent(journal: LigneJournalTemoin[]): LigneJournalTemoin[] {
  const cle = (l: LigneJournalTemoin) => `${l.date}|${l.versionMoteur}`;
  const cles = [...new Set(journal.map(cle))];
  if (cles.length < 2) return [];
  const avant = cles[cles.length - 2];
  return journal.filter((l) => cle(l) === avant);
}

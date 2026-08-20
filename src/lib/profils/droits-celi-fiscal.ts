// L'HISTORIQUE FISCAL CELI — la nouvelle chaîne des droits (20 août 2026).
//
// ─────────────────────────────────────────────────────────────────────────────
//   historique Croesus → LigneDuTemps → vueFiscaleCeli → ICI → droits CELI
//
// CE MODULE NE RELIT AUCUNE TRANSACTION. Il ne consomme que `vueFiscaleCeli`,
// où chaque montant porte déjà sa devise, sa source, sa confiance et sa nature.
// C'est tout l'objet de la migration : la provenance des flux change, les
// règles fiscales ne changent pas.
//
// ─────────────────────────────────────────────────────────────────────────────
// LES QUATRE RÈGLES QUE CE MODULE PRÉSERVE, SANS Y TOUCHER.
//
// 1. LE RETRAIT NE REDONNE DES DROITS QUE L'ANNÉE SUIVANTE. `deriverHistoriqueRegime`
//    ne compte que les retraits des années STRICTEMENT ANTÉRIEURES à l'année
//    d'analyse ; on fait exactement pareil, année par année. C'est la ligne qui
//    empêche de surestimer l'espace (mandat fiscaliste, fichier 5).
// 2. LE PLAFOND vient de l'appelant (`plafondCeliCumulatif`) — aucune table ici.
// 3. L'ANNÉE DE NAISSANCE ne s'infère jamais : sans plafond, `indisponible`.
// 4. LA PORTÉE EXTERNE prime sur l'arithmétique : un calcul exact sur nos
//    livres n'est pas le dossier ARC. Sans confirmation du client, jamais
//    `calcule` (§20).
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUI CHANGE, ET C'EST TOUT : QUELS MONTANTS ENTRENT DANS LE CALCUL.
//
// Seuls les montants CAD dont la NATURE et le MONTANT sont l'un et l'autre
// fermes servent au chiffre. Les « à confirmer » — devise étrangère non
// résolue, virement orphelin, nature ambiguë — ne fabriquent jamais un droit :
// ils élargissent une BORNE, et la borne se lit dans la bonne direction.
//
// LA DIRECTION DE L'INCERTITUDE, puisqu'elle est connue :
//
//     droit = plafond − cotisations + retraits
//
//   · une cotisation de plus RÉDUIT le droit  → elle pousse le MINIMUM ;
//   · un retrait de plus AUGMENTE le droit    → il pousse le MAXIMUM.
//
//   droitMinimum = plafond − cotisationsMax + retraitsMin
//   droitMaximum = plafond − cotisationsMin + retraitsMax
//
// Ce n'est une borne que si les deux côtés sont chiffrables. Dès qu'un
// bloquant porte un montant illisible ou une devise non résolue, la borne
// correspondante vaut `null` — une borne incomplète présentée comme une borne
// est un chiffre faux, et ce dépôt en a déjà payé un.
// ─────────────────────────────────────────────────────────────────────────────

import type { VueFiscaleCeli } from './vue-fiscale-celi';
import type { HistoriqueRegime, ReponseTernaire, Portee } from './types';

export type StatutHistoriqueFiscal = 'calcule' | 'montant-a-confirmer' | 'indisponible';

export type AnneeFiscale = {
  cotisationsCadConfirmees: number;
  cotisationsCadAConfirmer: number;
  retraitsCadConfirmes: number;
  retraitsCadAConfirmer: number;
};

export type HistoriqueCeliFiscal = {
  /** Par année — exactement les quatre nombres de la consigne §3. */
  parAnnee: Record<string, AnneeFiscale>;
  /**
   * LES TOTAUX QUI ENTRENT DANS LE CALCUL. `min` = fermes seulement ;
   * `max` = fermes + à confirmer. Le calcul FERME n'utilise que `min` des
   * cotisations et `min` des retraits — jamais la somme des deux mondes.
   */
  cotisations: { min: number; max: number };
  /** Retraits des années STRICTEMENT ANTÉRIEURES (règle 1) — les seuls qui redonnent des droits. */
  retraitsAnneesPassees: { min: number; max: number };
  /**
   * Les bornes du droit, quand elles sont chiffrables (§19). `null` dès qu'un
   * événement bloquant échappe au décompte — pas de borne inventée.
   */
  droitMinimum: number | null;
  droitMaximum: number | null;
  statut: StatutHistoriqueFiscal;
  /** Ce qui empêche le chiffre ferme, en clair, dans l'ordre où on le dirait. */
  raisons: string[];
  /** Les données absentes que le planificateur peut aller chercher. */
  donneesManquantes: string[];
  completude: {
    /** Combien d'événements peuvent encore changer le résultat, et de combien. */
    evenementsBloquants: number;
    montantPotentielCotisation: number | null;
    montantPotentielRetrait: number | null;
    devisesNonResolues: boolean;
    naturesNonResolues: boolean;
    porteeExterne: Portee;
  };
  /** L'historique au format ATTENDU par `calculerDroitsCeli` — la compatibilité, pas une copie. */
  versHistoriqueRegime: HistoriqueRegime;
};

export type ContexteDroitsCeli = {
  anneeCourante: number;
  /** `plafondCeliCumulatif(...).montant` — jamais recalculé ici. */
  plafondCumulatif: number | null;
  /** La réponse du client, telle que saisie : jamais devinée (§10, §20). */
  historiqueExterne: 'jamais' | 'deja-eu' | 'inconnu';
  comptesExternes: ReponseTernaire;
  /** Pour la compatibilité avec `HistoriqueRegime`. */
  dateImport: string | null;
  dateOuverture: string | null;
};

const somme = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

/**
 * L'historique fiscal CELI, dérivé de la vue — additif, ne remplace encore
 * rien. `deriverHistoriqueRegime` reste le témoin (§15).
 */
export function deriverHistoriqueCeliFiscal(
  vue: VueFiscaleCeli,
  ctx: ContexteDroitsCeli
): HistoriqueCeliFiscal {
  // ── 1 · les quatre nombres, année par année ────────────────────────────────
  const parAnnee: Record<string, AnneeFiscale> = {};
  for (const [annee, a] of Object.entries(vue.parAnnee)) {
    parAnnee[annee] = {
      cotisationsCadConfirmees: a.cotisationsCadConfirmees,
      cotisationsCadAConfirmer: a.cotisationsCadAConfirmer,
      retraitsCadConfirmes: a.retraitsCadConfirmes,
      retraitsCadAConfirmer: a.retraitsCadAConfirmer,
    };
  }

  // ── 2 · les totaux — LA RÈGLE DU RETRAIT REPORTÉ, préservée ────────────────
  const annees = Object.keys(parAnnee);
  const passees = annees.filter((a) => Number.parseInt(a, 10) < ctx.anneeCourante);
  const cotisationsMin = somme(annees.map((a) => parAnnee[a].cotisationsCadConfirmees));
  const cotisationsMax = somme([cotisationsMin, ...annees.map((a) => parAnnee[a].cotisationsCadAConfirmer)]);
  const retraitsMin = somme(passees.map((a) => parAnnee[a].retraitsCadConfirmes));
  const retraitsMax = somme([retraitsMin, ...passees.map((a) => parAnnee[a].retraitsCadAConfirmer)]);

  // ── 3 · ce qui empêche le chiffre ferme ────────────────────────────────────
  const c = vue.completude;
  const raisons: string[] = [];
  const donneesManquantes: string[] = [];

  const devisesNonResolues = !c.toutesCotisationsEnCadFiscal || !c.tousRetraitsEnCadFiscal;
  const naturesNonResolues = !c.retraitsNatureConfirmee;
  const aConfirmer = cotisationsMax - cotisationsMin + (retraitsMax - retraitsMin);

  if (ctx.plafondCumulatif === null) {
    raisons.push('le plafond cumulatif n’est pas établi — l’année de naissance manque');
    donneesManquantes.push('l’année de naissance du client');
  }
  if (c.evenementsCeliBloquants > 0) {
    const potentiel = [c.montantPotentiel.cotisation, c.montantPotentiel.retrait]
      .filter((x): x is number => x !== null && x > 0);
    const chiffre = potentiel.length > 0 ? ` représentant jusqu’à ${Math.max(...potentiel).toFixed(2)} $` : '';
    raisons.push(`${c.evenementsCeliBloquants} événement(s) peuvent encore changer le résultat${chiffre}`);
  }
  if (aConfirmer > 0) {
    raisons.push(`${aConfirmer.toFixed(2)} $ de flux dont la nature ou la devise n’est pas tranchée`);
  }
  // ⚠ CES DEUX DRAPEAUX SONT DES RAISONS, PAS SEULEMENT DES QUESTIONS. Une
  // première version ne les poussait que dans `donneesManquantes` : un dossier
  // avec une cotisation USD non convertie sortait donc « calcule », puisque
  // `raisons` restait vide — et la somme des montants CAD, elle, était exacte.
  // Le montant juste sur un périmètre amputé est exactement le faux vert que
  // toute cette chaîne existe pour supprimer. Les tests E, G, J l'ont attrapé.
  if (naturesNonResolues) {
    raisons.push('la nature de certains mouvements CELI n’est pas tranchée (retrait réel ou transfert direct)');
    donneesManquantes.push('la nature des mouvements CELI à confirmer (retrait réel ou transfert direct)');
  }
  if (devisesNonResolues) {
    raisons.push('des montants CELI en devise étrangère n’ont pas d’équivalent CAD établi');
    donneesManquantes.push('l’équivalent en dollars canadiens des mouvements CELI en devise étrangère');
  }
  // §20 — LA PORTÉE PRIME SUR L'ARITHMÉTIQUE. Un calcul exact sur nos livres
  // n'est pas l'historique ARC : sans la confirmation du client, jamais ferme.
  if (ctx.historiqueExterne !== 'jamais') {
    raisons.push(ctx.historiqueExterne === 'deja-eu'
      ? 'le client a déjà eu un CELI ailleurs — notre historique ne peut pas être complet'
      : 'le client n’a pas confirmé n’avoir jamais eu de CELI ailleurs');
    donneesManquantes.push('la confirmation qu’aucun CELI n’a jamais été détenu ailleurs');
  }
  if (ctx.comptesExternes !== 'non') {
    raisons.push('des comptes détenus ailleurs ne sont pas exclus — la portée reste celle de nos livres');
  }

  // ── 4 · les bornes, dans la direction connue de l'incertitude ──────────────
  // Une borne n'existe que si les deux côtés sont chiffrables : dès qu'un
  // bloquant porte une devise non résolue ou un montant illisible, elle vaut
  // `null`. Une borne incomplète serait un chiffre faux.
  const p = ctx.plafondCumulatif;
  // Une DEVISE NON RÉSOLUE interdit toute borne : on ignore complètement la
  // valeur CAD du montant étranger, donc aucun des deux côtés n'est majoré ni
  // minoré. Sans cette condition, un dossier à 5 000 USD non convertis rendait
  // « au moins 95 000 $ ET au plus 95 000 $ » — une précision inventée.
  const bornable = p !== null && !devisesNonResolues
    && c.montantPotentiel.cotisation !== null && c.montantPotentiel.retrait !== null;
  const droitMinimum = bornable ? Math.max(0, p - cotisationsMax - (c.montantPotentiel.cotisation as number) + retraitsMin) : null;
  const droitMaximum = bornable ? Math.max(0, p - cotisationsMin + retraitsMax + (c.montantPotentiel.retrait as number)) : null;

  // ── 5 · le statut ─────────────────────────────────────────────────────────
  const aucuneDonnee = annees.length === 0 && vue.diagnostics.evenements === 0;
  const statut: StatutHistoriqueFiscal =
    ctx.plafondCumulatif === null || (aucuneDonnee && ctx.dateImport === null) ? 'indisponible'
      : raisons.length === 0 ? 'calcule'
        : 'montant-a-confirmer';

  return {
    parAnnee,
    cotisations: { min: cotisationsMin, max: cotisationsMax },
    retraitsAnneesPassees: { min: retraitsMin, max: retraitsMax },
    droitMinimum, droitMaximum,
    statut, raisons, donneesManquantes,
    completude: {
      evenementsBloquants: c.evenementsCeliBloquants,
      montantPotentielCotisation: c.montantPotentiel.cotisation,
      montantPotentielRetrait: c.montantPotentiel.retrait,
      devisesNonResolues, naturesNonResolues,
      porteeExterne: c.portee,
    },
    // LES MONTANTS FERMES SEULEMENT (§3, §5, §6) : ce que l'ancien format
    // transporte doit être ce qui peut fonder un droit, jamais la borne haute.
    versHistoriqueRegime: {
      dateOuverture: ctx.dateOuverture,
      cotisationsTotales: annees.length === 0 ? null : cotisationsMin,
      retraitsAnneesPassees: annees.length === 0 ? null : retraitsMin,
      transfertEntrantDetecte: null,
      dateImport: ctx.dateImport,
      portee: c.portee,
    },
  };
}

// ═══ LE COMPARATEUR — ancien contre nouveau, divergence par divergence ═══════

export type ClasseDivergence =
  | 'parite'
  | 'bug-ancien-corrige'
  | 'ambiguite-volontaire'
  | 'difference-de-portee'
  | 'regression';

export type Divergence = {
  champ: string;
  ancien: number | null;
  nouveau: number | null;
  classe: ClasseDivergence;
  motif: string;
};

/**
 * Compare l'ancien historique (`deriverHistoriqueRegime`) au nouveau, et
 * CLASSE chaque écart. Aucune divergence silencieuse (§15) : tout écart qui
 * n'est pas expliqué par un défaut connu ou une prudence assumée sort en
 * `regression`, et c'est au lot de le justifier.
 */
export function comparerDroitsCeli(
  ancien: HistoriqueRegime,
  nouveau: HistoriqueCeliFiscal
): Divergence[] {
  const divergences: Divergence[] = [];
  const c = nouveau.completude;

  const classer = (champ: string, a: number | null, n: number | null): Divergence => {
    if (a === n) return { champ, ancien: a, nouveau: n, classe: 'parite', motif: 'identiques' };
    if (a === null || n === null) {
      return { champ, ancien: a, nouveau: n, classe: 'difference-de-portee',
        motif: 'l’un des deux n’a rien à dire sur ce champ (aucune ligne CELI d’un côté)' };
    }
    // L'ancien FOND les devises étrangères au nominal (défaut D5, démontré le
    // 20 août) : quand des devises ne sont pas résolues, un ancien PLUS GRAND
    // est ce défaut, pas une régression.
    if (c.devisesNonResolues && a > n) {
      return { champ, ancien: a, nouveau: n, classe: 'bug-ancien-corrige',
        motif: 'l’ancien additionnait des montants en devise étrangère au nominal (D5) ; le nouveau les exclut et les déclare' };
    }
    // Le nouveau ne compte FERME que ce dont la nature est tranchée : un
    // ancien plus grand, quand des natures sont ouvertes, est une prudence
    // assumée, pas une perte.
    if (c.naturesNonResolues && a > n) {
      return { champ, ancien: a, nouveau: n, classe: 'ambiguite-volontaire',
        motif: 'des mouvements dont la nature n’est pas tranchée sont exclus du ferme et comptés dans la borne' };
    }
    return { champ, ancien: a, nouveau: n, classe: 'regression',
      motif: 'écart inexpliqué — à traiter comme une régression jusqu’à preuve du contraire' };
  };

  divergences.push(classer('cotisationsTotales', ancien.cotisationsTotales, nouveau.versHistoriqueRegime.cotisationsTotales));
  divergences.push(classer('retraitsAnneesPassees', ancien.retraitsAnneesPassees, nouveau.versHistoriqueRegime.retraitsAnneesPassees));
  return divergences;
}

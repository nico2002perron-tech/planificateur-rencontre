// LE PLAN D'EXÉCUTION CANONIQUE — une seule réponse à « combien vendre ».
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE MODULE EXISTE.
//
// Deux moteurs répondaient à la même question, et le document client les
// affichait tous les deux :
//
//   `planifierRecolte` (strategies.ts)     multi-titres · EN DOLLARS · lignes
//                                          partielles · tri par densité
//   `meilleurPlanMonoTitre`                MONO-titre · unités exécutables ·
//                                          refuse dès qu'un titre ne suffit pas
//
// Mesuré le 23 août 2026 sur un même dossier calculé, trois cibles, trois
// contradictions : la page disait « à confirmer » sur un constat chiffré, ou
// nommait un AUTRE titre que la carte, ou le même titre à un AUTRE montant.
//
// ⚠ ET AUCUN DES DEUX NE POUVAIT ÊTRE ÉLU TEL QUEL. `planifierRecolte` produit
// des lignes INEXÉCUTABLES — « vendre 7 209 $ » d'un titre à 40 $ l'action n'est
// pas un ordre qu'un conseiller peut passer ; `meilleurPlanMonoTitre` ne sait
// pas combiner deux titres, et la mesure a montré que c'est le cas COURANT.
//
// Ce module combine ce que les deux ont appris :
//   · du premier, l'idée qu'une cible peut demander plusieurs positions ;
//   · du second, TOUTE l'arithmétique — granularité, quantités voisines,
//     capacité vs exécution, écart signé, reste jamais négatif.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA POLITIQUE, DANS L'ORDRE, ET RIEN D'AUTRE.
//
//   1. chercher d'abord une solution à UN SEUL titre ;
//   2. si aucune position n'a la capacité, en combiner plusieurs ;
//   3. minimiser le NOMBRE de positions ;
//   4. puis minimiser `abs(ecartCad)` ;
//   5. départage canonique stable, indépendant de l'ordre reçu.
//
// ⚠ AUCUNE TOLÉRANCE. Une exécution qui reste sous la cible reste SOUS la
// cible : `ecartCad` le dit, signé, et `cibleRestanteCad` dit combien il
// manque. Rien n'est « assez proche ».
//
// ⚠ AUCUN CALCUL FISCAL. La cible vient de la stratégie ; ce module ne décide
// ni du régime, ni de la perte apparente, ni de la portée. Les positions
// arrivent déjà qualifiées.
// ─────────────────────────────────────────────────────────────────────────────
import type { Compte, Position } from './types';
import type { UniteQuantite } from './granularite-vente';
import {
  proposerQuantitePourPosition, compteId, positionId,
  type PropositionCristallisationPosition, type RefusQuantite,
} from './quantite-a-vendre';
import {
  proposerQuantitePourGain,
  type PropositionCristallisationGain, type RefusQuantiteGain,
} from './quantite-a-vendre-gains';

export type SensPlan = 'perte' | 'gain';

/** Une ligne du plan : un ordre qu'un conseiller peut réellement passer. */
export type LigneExecution = {
  positionId: string;
  compteId: string;
  symbole: string;
  description: string | null;
  typeInstrument: string | null;
  devise: string | null;
  uniteValeursRapport: 'CAD' | 'USD' | 'inconnue';

  quantiteDetenue: number;
  /** ⚠ EXÉCUTABLE : action entière, part au millième. Jamais un montant divisé. */
  quantiteAVendre: number;
  uniteQuantite: UniteQuantite;

  valeurVenteEstimeeCad: number;
  /** La perte OU le gain que cette ligne réalise — selon `sens`. */
  montantRealiseEstimeCad: number;
  /** Ce que la position porte en tout, avant toute quantité. */
  montantLatentDisponibleCad: number;

  dateValeurs: string | null;
};

export type RefusPlan = { motif: string; symbole: string; positionId: string };

export type PlanExecution = {
  sens: SensPlan;
  cibleCad: number;
  /** Vide quand aucune position n'est proposable — jamais une ligne inventée. */
  lignes: LigneExecution[];

  valeurVenteTotaleCad: number;
  montantRealiseTotalCad: number;

  /** SIGNÉ : positif = on dépasse la cible, négatif = on reste dessous. */
  ecartCad: number;
  /** JAMAIS NÉGATIF : ce qu'il reste à couvrir. */
  cibleRestanteCad: number;

  /**
   * LA MATIÈRE DISPONIBLE SUFFIT-ELLE, toutes positions confondues ?
   * ⚠ Question de CAPACITÉ, indépendante de l'arrondi et du nombre de lignes.
   */
  capaciteCouvreCible: boolean;
  /** LE PLAN RETENU atteint-il ou dépasse-t-il effectivement la cible ? */
  executionCouvreEntierementCible: boolean;

  /** Vrai quand un seul titre a suffi — l'issue préférée de la politique. */
  monoTitre: boolean;

  /**
   * LE GAIN EN CAPITAL NET QUI SUBSISTE UNE FOIS LA PERTE APPLIQUÉE.
   *
   * ⚠ IL VIT ICI, ET NULLE PART AILLEURS. Il vivait sur la proposition d'UNE
   * position ; dès qu'un plan en combine plusieurs, la seule valeur juste se
   * calcule sur le TOTAL RÉELLEMENT EXÉCUTÉ. Le laisser à la couche
   * présentation l'obligerait à écrire `max(0, avant − total)` — une règle
   * fiscale dans le document, donc une seconde source de vérité.
   *
   * ⚠ SUR LE MONTANT EXÉCUTÉ, JAMAIS SUR LA CIBLE. La cible est ce qu'on
   * VISAIT ; le plan atterrit à une unité près, parfois au-dessus. Trois cas
   * mesurés qui le montrent :
   *   cible 8 997,81 · exécuté 9 031,60 · avant 8 997,81 → 0
   *   cible 5 000    · exécuté 5 000    · avant 20 000   → 15 000
   *   cible 8 998    · exécuté 5 000    · avant 8 998    → 3 998
   *
   * ⚠ BORNÉ À ZÉRO. Une perte qui dépasse le gain ne rend pas le gain négatif ;
   * l'excédent reste dit par `ecartCad`, et n'est requalifié ni en économie
   * d'impôt ni en perte reportable — ce serait une règle que ce module n'a pas.
   *
   * ⚠ ET IL NE VAUT QUE POUR LES PERTES. La cristallisation de GAINS n'absorbe
   * aucun gain net avec des pertes latentes : elle emploie une capacité fiscale
   * déjà au dossier. Il n'y a rien qui « reste après », et le moteur de quantité
   * des gains ne porte d'ailleurs aucun champ équivalent. Ce serait donc une
   * pseudo-symétrie fiscale : `null` est plus vrai. Voir `pertinentPourLeSens`.
   */
  gainNetApresCad: number | null;

  /**
   * ⚠ VRAI QUAND LA RECHERCHE EXHAUSTIVE A ÉTÉ BORNÉE. Le plan reste valide et
   * exécutable, mais on ne peut plus affirmer qu'aucune combinaison de même
   * taille ne ferait mieux. Le document doit pouvoir le dire plutôt que de
   * laisser croire à une optimalité non vérifiée.
   */
  rechercheTronquee: boolean;

  refus: RefusPlan[];
};

/**
 * LA BORNE DE RECHERCHE.
 *
 * ⚠ CE N'EST PAS UNE TOLÉRANCE FISCALE, c'est une borne de calcul, et elle est
 * DÉCLARÉE plutôt que mesurée : les profils stockés ne portent aucune position
 * (elles sont hydratées du livre Croesus à l'exécution), donc la distribution
 * réelle du nombre de candidats par dossier n'a pas pu être établie ici.
 *
 * L'ordre de grandeur connu — une douzaine de positions en perte sur les
 * dossiers observés — donne au pire C(12,3) = 220 combinaisons. La borne est
 * posée trois ordres de grandeur au-dessus ; si elle mord un jour, le plan le
 * DIT (`rechercheTronquee`) au lieu de se taire.
 */
export const MAX_COMBINAISONS_EXAMINEES = 200_000;

const sou = (x: number) => Math.round(x * 100) / 100;

/** La clé de départage canonique — la même que celle du moteur mono-titre. */
const cle = (l: { compteId: string; positionId: string; symbole: string }) =>
  `${l.compteId}|${l.positionId}|${l.symbole}`;

// ─────────────────────────────────────────────────────────────────────────────
// LA FAÇADE SUR LES DEUX MOTEURS DE QUANTITÉ — ils restent intacts
// ─────────────────────────────────────────────────────────────────────────────

type Propose = {
  ligne: LigneExecution;
  /** La capacité propre de la position, pour le classement. */
  capaciteCad: number;
};

function proposer(
  sens: SensPlan, compte: Compte, position: Position, cibleCad: number
): { ok: true; v: Propose } | { ok: false; refus: RefusPlan } {
  if (sens === 'perte') {
    const r = proposerQuantitePourPosition(compte, position, cibleCad);
    if (!r.ok) return { ok: false, refus: r.refus as RefusQuantite };
    return { ok: true, v: depuisPerte(r.proposition) };
  }
  const r = proposerQuantitePourGain(compte, position, cibleCad);
  if (!r.ok) return { ok: false, refus: r.refus as RefusQuantiteGain };
  return { ok: true, v: depuisGain(r.proposition) };
}

function depuisPerte(p: PropositionCristallisationPosition): Propose {
  return {
    capaciteCad: p.perteLatenteDisponibleCad,
    ligne: {
      positionId: p.positionId, compteId: p.compteId, symbole: p.symbole,
      description: null,
      typeInstrument: p.typeInstrument, devise: p.devise,
      uniteValeursRapport: p.uniteValeursRapport,
      quantiteDetenue: p.quantiteDetenue,
      quantiteAVendre: p.quantiteEstimeeAVendre,
      uniteQuantite: p.uniteQuantite,
      valeurVenteEstimeeCad: p.valeurVenteEstimeeCad,
      montantRealiseEstimeCad: p.perteRealiseeEstimeeCad,
      montantLatentDisponibleCad: p.perteLatenteDisponibleCad,
      dateValeurs: p.dateValeurs,
    },
  };
}

function depuisGain(p: PropositionCristallisationGain): Propose {
  return {
    capaciteCad: p.gainLatentDisponibleCad,
    ligne: {
      positionId: p.positionId, compteId: p.compteId, symbole: p.symbole,
      description: p.description ?? null,
      typeInstrument: p.typeInstrument, devise: p.devise,
      uniteValeursRapport: p.uniteValeursRapport,
      quantiteDetenue: p.quantiteDetenue,
      quantiteAVendre: p.quantiteEstimeeAVendre,
      uniteQuantite: p.uniteQuantite,
      valeurVenteEstimeeCad: p.valeurVenteEstimeeCad,
      montantRealiseEstimeCad: p.gainRealiseEstimeCad,
      montantLatentDisponibleCad: p.gainLatentDisponibleCad,
      dateValeurs: p.dateValeurs,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// L'ALLOCATION D'UN SOUS-ENSEMBLE — en quantités exécutables, jamais en dollars
// ─────────────────────────────────────────────────────────────────────────────

type Candidat = { compte: Compte; position: Position; capaciteCad: number; cle: string };

/**
 * DISTRIBUER UNE CIBLE SUR UN SOUS-ENSEMBLE ORDONNÉ.
 *
 * ⚠ CHAQUE LIGNE EST CALCULÉE PAR LE MOTEUR DE QUANTITÉ VALIDÉ, sur le RESTE
 * réel — pas sur une part théorique de la cible. Le reste diminue du montant
 * EFFECTIVEMENT réalisé par la ligne précédente, arrondis compris : c'est la
 * différence entre un plan exécutable et une division de dollars.
 *
 * L'ordre est décroissant de capacité : les grosses positions absorbent le
 * gros de la cible, la dernière porte le résidu — c'est elle qui décide de
 * l'écart final, et c'est le plus petit résidu possible pour ce sous-ensemble.
 */
function allouer(sens: SensPlan, sousEnsemble: Candidat[], cibleCad: number): LigneExecution[] {
  const lignes: LigneExecution[] = [];
  let reste = cibleCad;
  for (const c of sousEnsemble) {
    if (reste <= 0.005) break;
    const r = proposer(sens, c.compte, c.position, reste);
    if (!r.ok) continue;
    lignes.push(r.v.ligne);
    reste = sou(reste - r.v.ligne.montantRealiseEstimeCad);
  }
  return lignes;
}

const totalRealise = (lignes: LigneExecution[]) =>
  sou(lignes.reduce((s, l) => s + l.montantRealiseEstimeCad, 0));

/** Toutes les combinaisons de taille `k`, dans l'ordre canonique des indices. */
function* combinaisons(n: number, k: number): Generator<number[]> {
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k > n) return;
  for (;;) {
    yield [...idx];
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LE PLAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LE GAIN NET APRÈS A-T-IL UN SENS POUR CE PLAN ?
 *
 * ⚠ SEULEMENT POUR LES PERTES. Cristalliser une perte ABSORBE un gain net déjà
 * réalisé : « ce qui reste après » est la question même de la stratégie.
 * Cristalliser un gain n'absorbe rien — la capacité fiscale est déjà au
 * dossier, et le moteur de quantité des gains ne porte aucun champ équivalent.
 * Fabriquer un « après » symétrique inventerait une grandeur fiscale par
 * simple commodité de structure.
 */
function pertinentPourLeSens(sens: SensPlan): boolean {
  return sens === 'perte';
}

export function construirePlanExecution(
  sens: SensPlan,
  positions: Array<{ compte: Compte; position: Position }>,
  cibleCad: number,
  /**
   * LE GAIN EN CAPITAL NET AVANT LA STRATÉGIE, quand l'appelant le connaît.
   *
   * ⚠ JAMAIS DÉDUIT DE `cibleCad`. La stratégie pose
   * `absorbable = min(pertesLatentes, gainsRealises)` : quand les pertes
   * latentes ne suffisent pas, la cible est PLUS PETITE que le gain à
   * compenser. Les confondre rendrait un « après » faux.
   */
  gainNetAvantCad?: number
): PlanExecution {
  const refus: RefusPlan[] = [];
  const candidats: Candidat[] = [];

  // ── QUI PEUT PARTICIPER, ET AVEC QUELLE CAPACITÉ ─────────────────────────
  // On interroge le moteur de quantité sur la cible ENTIÈRE : sa réponse porte
  // la capacité propre de la position, et son refus porte le motif exact.
  for (const { compte, position } of positions) {
    const r = proposer(sens, compte, position, cibleCad);
    if (!r.ok) { refus.push(r.refus); continue; }
    candidats.push({
      compte, position,
      capaciteCad: r.v.capaciteCad,
      cle: cle(r.v.ligne),
    });
  }

  const capaciteTotale = sou(candidats.reduce((s, c) => s + c.capaciteCad, 0));
  const capaciteCouvreCible = capaciteTotale >= cibleCad;

  const vide = (lignes: LigneExecution[], monoTitre: boolean, tronquee = false): PlanExecution => {
    const realise = totalRealise(lignes);
    return {
      sens, cibleCad, lignes,
      valeurVenteTotaleCad: sou(lignes.reduce((s, l) => s + l.valeurVenteEstimeeCad, 0)),
      montantRealiseTotalCad: realise,
      ecartCad: sou(realise - cibleCad),
      cibleRestanteCad: sou(Math.max(0, cibleCad - realise)),
      capaciteCouvreCible,
      executionCouvreEntierementCible: realise >= cibleCad,
      monoTitre,
      // ⚠ `realise` EST LE TOTAL DU PLAN COMPLET — toutes lignes confondues.
      // Sur un plan à trois titres, ne lire que la première ligne rendrait un
      // « après » beaucoup trop élevé, donc rassurant à tort.
      gainNetApresCad: gainNetAvantCad === undefined || !pertinentPourLeSens(sens)
        ? null
        : sou(Math.max(0, gainNetAvantCad - realise)),
      rechercheTronquee: tronquee,
      refus,
    };
  };

  if (candidats.length === 0 || !(cibleCad > 0)) return vide([], false);

  // ── UNE SEULE MÉCANIQUE DE SÉLECTION, ET C'EST UN RÉSULTAT DE SABOTAGE ───
  //
  // Une « étape 1 » cherchait d'abord le meilleur titre seul. Retirée, la suite
  // restait VERTE : la recherche par sous-ensembles de taille minimale traite
  // déjà k = 1 exactement pareil — même filtre de capacité, même minimisation
  // de l'écart, même départage canonique. Deux mécaniques concurrentes pour le
  // même cas, c'était la faute d'origine du lot ; on n'en garde qu'une.
  //
  // La politique « un seul titre d'abord » n'a pas disparu : elle est PORTÉE
  // par kMin, qui vaut 1 dès qu'une position couvre seule.

  // ── ÉTAPE 2 — PLUSIEURS TITRES, LE MOINS POSSIBLE ────────────────────────
  // Le nombre MINIMAL est celui du plus court préfixe, capacités décroissantes,
  // dont le cumul atteint la cible. Aucun sous-ensemble plus petit ne peut
  // couvrir : c'est une propriété du tri, pas une heuristique.
  //
  // ⚠ CE QUE kMin FAIT VRAIMENT, mesuré par sabotage : il BORNE LA RECHERCHE.
  // Le faire grossir artificiellement ne change pas le nombre de lignes rendues
  // — c'est `allouer` qui s'arrête dès que le reste est couvert. kMin sert à ne
  // pas énumérer des sous-ensembles dont on sait qu'ils ne feront pas mieux.
  const parCapacite = [...candidats].sort((a, b) => {
    const d = b.capaciteCad - a.capaciteCad;
    return Math.abs(d) > 1e-9 ? d : a.cle.localeCompare(b.cle);
  });

  let kMin = 0;
  let cumul = 0;
  for (const c of parCapacite) {
    kMin++; cumul += c.capaciteCad;
    if (cumul >= cibleCad) break;
  }
  // La matière ne suffit pas : on rend le meilleur plan possible — toutes les
  // positions — et `cibleRestanteCad` dit franchement ce qui manque.
  if (!capaciteCouvreCible) return vide(allouer(sens, parCapacite, cibleCad), false);

  // ⚠ ICI, `kMin` VAUT NÉCESSAIREMENT AU MOINS 2. `kMin === 1` signifierait
  // qu'une position couvre seule — et l'étape 1 aurait déjà rendu. Une branche
  // « si kMin vaut 1 » a existé : elle retenait la plus GROSSE capacité au lieu
  // du plus petit écart, donnant une seconde réponse mono-titre concurrente.
  // Retirer l'étape 1 laissait la suite verte : c'est le sabotage qui l'a dit.

  // ── ÉTAPE 3 — À NOMBRE ÉGAL, LE PLUS PETIT ÉCART ─────────────────────────
  const n = parCapacite.length;
  let meilleuresLignes: LigneExecution[] | null = null;
  let meilleurEcart = Number.POSITIVE_INFINITY;
  let meilleureCle = '';
  let examinees = 0;
  let tronquee = false;

  for (const combo of combinaisons(n, kMin)) {
    if (++examinees > MAX_COMBINAISONS_EXAMINEES) { tronquee = true; break; }
    const sousEnsemble = combo.map((i) => parCapacite[i]);
    // Un sous-ensemble qui ne peut pas couvrir n'est pas une solution de
    // taille `kMin` : on ne le retient pas, sinon on comparerait un plan
    // complet à un plan incomplet sur le seul critère de l'écart.
    //
    // ⚠ GARDE DE CEINTURE, ET LE SABOTAGE LE DIT : la retirer ne change rien
    // sur les cas mesurés, parce qu'un plan qui sous-couvre a presque toujours
    // un écart plus grand. « Presque » ne suffit pas — une granularité
    // grossière pourrait inverser le classement.
    const capacite = sousEnsemble.reduce((s, c) => s + c.capaciteCad, 0);
    if (capacite < cibleCad - 1e-9) continue;

    const lignes = allouer(sens, sousEnsemble, cibleCad);
    if (lignes.length === 0) continue;
    const ecart = Math.abs(totalRealise(lignes) - cibleCad);
    const cleCombo = lignes.map(cle).join('/');
    if (ecart < meilleurEcart - 1e-9
      || (Math.abs(ecart - meilleurEcart) <= 1e-9 && cleCombo.localeCompare(meilleureCle) < 0)) {
      meilleuresLignes = lignes; meilleurEcart = ecart; meilleureCle = cleCombo;
    }
  }

  if (meilleuresLignes === null) {
    // La recherche n'a rien retenu : on retombe sur le préfixe par capacité,
    // qui couvre par construction. Jamais « aucun plan » quand la matière est là.
    return vide(allouer(sens, parCapacite.slice(0, kMin), cibleCad), false, tronquee);
  }
  return vide(meilleuresLignes, meilleuresLignes.length === 1, tronquee);
}

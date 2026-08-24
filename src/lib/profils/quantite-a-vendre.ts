// COMBIEN VENDRE — le moteur de quantité, mono-titre.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QU'IL FAIT, ET CE QU'IL NE REFAIT PAS.
//
// Il répond à une seule question : « pour créer telle perte, quelle quantité de
// CETTE position faut-il vendre ? ». Il ne décide RIEN de fiscal — ni le régime,
// ni la perte apparente, ni les biens identiques, ni la portée. Ces verdicts
// appartiennent aux primitives canoniques, et une position arrive ici déjà
// qualifiée.
//
// Il peut en revanche refuser TECHNIQUEMENT : sans quantité, sans valeur
// marchande, ou sur un type dont la granularité d'exécution n'est pas établie,
// il n'y a pas de quantité à proposer. Chaque refus porte son motif — jamais
// une disparition silencieuse.
//
// TOUT CE QU'IL PRODUIT EST UNE ESTIMATION DATÉE. Les valeurs viennent du
// relevé ; le prix d'exécution, lui, sera celui du jour de l'ordre.
// ─────────────────────────────────────────────────────────────────────────────
import {
  granulariteVente, quantitesExecutablesVoisines, type UniteQuantite,
} from './granularite-vente';
import type { Position, Compte } from './types';

export type MotifSansQuantite =
  | 'quantite-manquante'
  | 'quantite-invalide'
  | 'valeur-comptable-manquante'
  | 'valeur-marchande-manquante'
  | 'unite-valeurs-non-etablie'
  | 'position-pas-en-perte'
  | 'obligation-nominal-non-supporte'
  | 'type-instrument-non-supporte';

export type PropositionCristallisationPosition = {
  positionId: string;
  compteId: string;
  symbole: string;
  typeInstrument: string | null;
  devise: string | null;
  uniteValeursRapport: 'CAD' | 'USD' | 'inconnue';

  quantiteDetenue: number;
  quantiteEstimeeAVendre: number;
  uniteQuantite: UniteQuantite;

  perteLatenteDisponibleCad: number;
  perteParUniteCad: number;
  valeurParUniteCad: number;

  valeurVenteEstimeeCad: number;
  perteRealiseeEstimeeCad: number;

  cibleGlobaleCad: number;
  cibleLocaleCad: number;
  /** SIGNÉ : positif = la perte dépasse la cible, négatif = elle reste dessous. */
  ecartCad: number;
  /** JAMAIS NÉGATIF : ce qu'il reste à couvrir, zéro si la cible est atteinte. */
  cibleRestanteCad: number;
  /**
   * CETTE POSITION A-T-ELLE ASSEZ DE MATIÈRE POUR PORTER TOUTE LA CIBLE ?
   *
   * ⚠ INDÉPENDANT DE LA GRANULARITÉ. C'est une question de CAPACITÉ, pas
   * d'arrondi : « ce titre suffit-il ? », et non « la quantité entière tombe-t-elle
   * pile ? ».
   *
   * La distinction est née d'un vrai défaut, le 21 août 2026. Le critère unique
   * était `cibleRestanteCad === 0`, et il était ASYMÉTRIQUE : une quantité qui
   * DÉPASSE la cible « couvrait », une qui reste 15 $ en dessous sur 12 000 $ ne
   * couvrait pas — et le moteur ne proposait alors RIEN. Avec des titres
   * entiers, de quel côté on tombe est un accident d'arrondi.
   */
  capaciteCouvreCible: boolean;
  /**
   * LA QUANTITÉ RETENUE ATTEINT-ELLE OU DÉPASSE-T-ELLE EFFECTIVEMENT LA CIBLE ?
   * Question distincte de la précédente, et les deux se disent au client.
   */
  executionCouvreEntierementCible: boolean;

  /**
   * ⚠ `gainNetApresCad` N'EST PLUS ICI — il appartient à `PlanExecution`.
   *
   * Il vivait sur la proposition d'UNE position. Dès qu'un plan en combine
   * plusieurs, la seule valeur juste se calcule sur le TOTAL réellement
   * exécuté : une valeur par position ne veut plus rien dire, et deux endroits
   * qui répondent à la même question finissent par diverger.
   *
   * Les trois notions qui ne se confondent pas restent, elles, ici :
   *   `ecartCad`         — de combien la perte dépasse ou manque LA CIBLE
   *   `cibleRestanteCad` — combien de perte manque encore pour l'atteindre
   * et `PlanExecution.gainNetApresCad` porte la troisième.
   */
  dateValeurs: string | null;
};

export type RefusQuantite = { motif: MotifSansQuantite; symbole: string; positionId: string };

export type ResultatProposition =
  | { ok: true; proposition: PropositionCristallisationPosition }
  | { ok: false; refus: RefusQuantite };

/** Identifiants stables — ils servent aussi de clé canonique de départage. */
export function compteId(c: Compte): string {
  return c.numero ?? `suffixe:${c.suffixe}`;
}
export function positionId(c: Compte, p: Position): string {
  return `${compteId(c)}|${p.symbole}`;
}

const arrondiSou = (x: number) => Math.round(x * 100) / 100;

/**
 * LA PROPOSITION POUR UNE POSITION.
 *
 * ⚠ AUCUN `?? 0`. Une valeur comptable absente n'est pas une valeur comptable
 * de zéro : c'est un refus, avec son motif. C'est la doctrine du dépôt appliquée
 * au dernier maillon.
 */
export function proposerQuantitePourPosition(
  compte: Compte,
  position: Position,
  cibleGlobaleCad: number
): ResultatProposition {
  const id = positionId(compte, position);
  const refus = (motif: MotifSansQuantite): ResultatProposition =>
    ({ ok: false, refus: { motif, symbole: position.symbole, positionId: id } });

  // ── LA GRANULARITÉ D'ABORD : sans elle, aucune quantité n'a de sens ───────
  const g = granulariteVente(position.typeInstrument);
  if (!g.supportee) return refus(g.raison);

  if ((position.uniteValeursRapport ?? 'CAD') !== 'CAD') return refus('unite-valeurs-non-etablie');
  if (position.valeurComptable === null || position.valeurComptable === undefined) {
    return refus('valeur-comptable-manquante');
  }
  if (position.valeurMarchande === null || position.valeurMarchande === undefined) {
    return refus('valeur-marchande-manquante');
  }

  const q = position.quantite;
  if (q === null || q === undefined) return refus('quantite-manquante');
  if (!Number.isFinite(q) || q <= 0) return refus('quantite-invalide');

  const perteLatenteDisponibleCad = position.valeurComptable - position.valeurMarchande;
  if (perteLatenteDisponibleCad <= 0) return refus('position-pas-en-perte');

  // ── LES UNITAIRES SE DÉRIVENT DES TOTAUX, jamais des colonnes brutes ──────
  // C'est la règle 1 du parseur : `pbrUnitaire` et `prixUnitaire` existent mais
  // ne sont pas transportés dans `Position`, précisément pour qu'il n'y ait
  // qu'une source de vérité.
  const perteParUniteCad = perteLatenteDisponibleCad / q;
  const valeurParUniteCad = position.valeurMarchande / q;

  // ── LA CIBLE LOCALE : une position ne promet jamais plus qu'elle ne porte ─
  // Bornée par sa propre perte disponible, elle reste utilisable dans un plan
  // à plusieurs titres sans prétendre couvrir la cible entière.
  const cibleLocaleCad = Math.min(cibleGlobaleCad, perteLatenteDisponibleCad);
  const quantiteTheorique = cibleLocaleCad / perteParUniteCad;

  const voisines = quantitesExecutablesVoisines(quantiteTheorique, q, position.typeInstrument);
  if (voisines.length === 0) return refus('quantite-invalide');

  // ── LE CHOIX ENTRE LES DEUX VOISINES, ET RIEN D'AUTRE ────────────────────
  // ⚠ « la plus petite quantité » ne départage QUE deux quantités du MÊME
  // titre, à écart fiscal strictement égal — là, vendre moins est
  // évidemment préférable. Entre deux titres différents, ce critère serait
  // absurde : une action à 1 000 $ et dix à 5 $ ne se comparent pas au nombre.
  let meilleure = voisines[0];
  let meilleurEcart = Math.abs(meilleure * perteParUniteCad - cibleLocaleCad);
  for (const candidate of voisines.slice(1)) {
    const ecart = Math.abs(candidate * perteParUniteCad - cibleLocaleCad);
    if (ecart < meilleurEcart - 1e-9) { meilleure = candidate; meilleurEcart = ecart; }
    // À égalité, on GARDE la précédente : `voisines` est triée croissante,
    // donc la plus petite est déjà en place.
  }

  const perteRealiseeEstimeeCad = arrondiSou(meilleure * perteParUniteCad);
  const valeurVenteEstimeeCad = arrondiSou(meilleure * valeurParUniteCad);

  return {
    ok: true,
    proposition: {
      positionId: id,
      compteId: compteId(compte),
      symbole: position.symbole,
      typeInstrument: position.typeInstrument ?? null,
      devise: position.devise ?? null,
      uniteValeursRapport: position.uniteValeursRapport ?? 'CAD',

      quantiteDetenue: q,
      quantiteEstimeeAVendre: meilleure,
      uniteQuantite: g.unite,

      perteLatenteDisponibleCad: arrondiSou(perteLatenteDisponibleCad),
      perteParUniteCad,
      valeurParUniteCad,

      valeurVenteEstimeeCad,
      perteRealiseeEstimeeCad,

      cibleGlobaleCad,
      cibleLocaleCad: arrondiSou(cibleLocaleCad),
      // ⚠ DEUX NOTIONS DIFFÉRENTES, ET ELLES LE RESTENT.
      //   `ecartCad`         — signé : de combien on dépasse ou on reste sous.
      //   `cibleRestanteCad` — jamais négatif : ce qu'il reste à couvrir.
      // Une sur-réalisation de 6 $ donne écart +6 ET restante 0, pas −6.
      ecartCad: arrondiSou(perteRealiseeEstimeeCad - cibleGlobaleCad),
      cibleRestanteCad: arrondiSou(Math.max(0, cibleGlobaleCad - perteRealiseeEstimeeCad)),
      capaciteCouvreCible: perteLatenteDisponibleCad >= cibleGlobaleCad,
      executionCouvreEntierementCible: perteRealiseeEstimeeCad >= cibleGlobaleCad,

      dateValeurs: compte.dateReleve ?? null,
    },
  };
}

export type MeilleurMono = {
  /** La proposition retenue, ou `null` si aucune position ne couvre seule. */
  proposition: PropositionCristallisationPosition | null;
  /**
   * Vrai quand AUCUNE position n'a la CAPACITÉ de porter toute la cible.
   * ⚠ Ne dit rien de l'arrondi : une position suffisante dont l'exécution
   * laisse quelques dollars reste un candidat légitime.
   */
  aucunePositionNeCouvreSeule: boolean;
  /** Toutes les propositions calculables — l'entrée d'un futur plan multi. */
  propositions: PropositionCristallisationPosition[];
  /** Ce qui a été écarté, et pourquoi. */
  refus: RefusQuantite[];
};

/**
 * LE MEILLEUR PLAN À UN SEUL TITRE, POUR UN DOSSIER.
 *
 * ⚠ LE RÉSULTAT NE DÉPEND PAS DE L'ORDRE DU TABLEAU REÇU. C'est un invariant
 * testé : deux planificateurs regardant le même dossier doivent lire la même
 * recommandation, et un tri accidentel amont ne doit rien changer.
 *
 * Quand aucune position ne couvre seule la cible, on ne désigne PAS un gagnant
 * par défaut : ce serait présenter une solution partielle comme la réponse. On
 * le dit, et on rend les propositions individuelles — matière d'un futur plan à
 * plusieurs titres.
 */
export function meilleurPlanMonoTitre(
  positions: Array<{ compte: Compte; position: Position }>,
  cibleGlobaleCad: number
): MeilleurMono {
  const propositions: PropositionCristallisationPosition[] = [];
  const refus: RefusQuantite[] = [];
  for (const { compte, position } of positions) {
    const r = proposerQuantitePourPosition(compte, position, cibleGlobaleCad);
    if (r.ok) propositions.push(r.proposition);
    else refus.push(r.refus);
  }

  // ⚠ LA CAPACITÉ, PAS L'ARRONDI. Filtrer sur `cibleRestanteCad === 0` écartait
  // une position parfaitement suffisante dont la meilleure quantité entière
  // tombait 15 $ sous la cible — et le moteur ne proposait plus rien du tout.
  const couvrantes = propositions.filter((p) => p.capaciteCouvreCible);
  if (couvrantes.length === 0) {
    return { proposition: null, aucunePositionNeCouvreSeule: true, propositions, refus };
  }

  // 1. l'écart absolu le plus faible ; 2. à égalité RÉELLE, la clé canonique.
  const trie = [...couvrantes].sort((a, b) => {
    const d = Math.abs(a.ecartCad) - Math.abs(b.ecartCad);
    if (Math.abs(d) > 1e-9) return d;
    return `${a.compteId}|${a.positionId}|${a.symbole}`
      .localeCompare(`${b.compteId}|${b.positionId}|${b.symbole}`);
  });
  return {
    proposition: trie[0], aucunePositionNeCouvreSeule: false, propositions, refus,
  };
}

// COMBIEN VENDRE POUR RÉALISER UN GAIN — le pendant du moteur des pertes.
//
// ─────────────────────────────────────────────────────────────────────────────
// IL NE DÉCIDE PAS COMBIEN CRISTALLISER. Il exécute une cible déjà décidée.
//
// `strategieCristallisationGains` pose `montantEstime = min(gainsLatents,
// pertesDisponibles)` — avec toutes ses conditions d'admissibilité, l'unité des
// pertes reportées comprise. Ce module CONSOMME ce nombre. Le recalculer ici
// depuis `gainsLatentsCad` et `pertesDisponiblesCad` créerait une seconde
// source de vérité qui divergerait au premier raffinement fiscal.
//
// ⚠ POURQUOI CE FICHIER N'EST PAS FACTORISÉ AVEC CELUI DES PERTES. Les deux se
// ressemblent beaucoup — c'est mesuré, pas supposé. Mais on écrit d'abord
// l'implémentation lisible, on compare ensuite, et on n'extrait que sur preuve.
// Une abstraction posée par anticipation coûte plus cher que la duplication
// qu'elle prétend éviter.
// ─────────────────────────────────────────────────────────────────────────────
import {
  granulariteVente, quantitesExecutablesVoisines, type UniteQuantite,
} from './granularite-vente';
import { compteId, positionId } from './quantite-a-vendre';
import type { Position, Compte } from './types';

export type MotifSansQuantiteGain =
  | 'quantite-manquante'
  | 'quantite-invalide'
  | 'valeur-comptable-manquante'
  | 'valeur-marchande-manquante'
  | 'unite-valeurs-non-etablie'
  /**
   * ⚠ DISTINCT DE `position-pas-en-perte`, et il doit le rester même si les
   * deux moteurs sont un jour factorisés. Dire à un planificateur qu'une
   * position « n'est pas en perte » quand on cherchait un gain lui ferait
   * chercher le mauvais problème.
   */
  | 'position-pas-en-gain'
  | 'obligation-nominal-non-supporte'
  | 'type-instrument-non-supporte';

export type PropositionCristallisationGain = {
  positionId: string;
  compteId: string;
  symbole: string;
  description: string | null;
  typeInstrument: string | null;
  devise: string | null;
  uniteValeursRapport: 'CAD' | 'USD' | 'inconnue';

  quantiteDetenue: number;
  quantiteEstimeeAVendre: number;
  uniteQuantite: UniteQuantite;

  gainLatentDisponibleCad: number;
  gainParUniteCad: number;
  valeurParUniteCad: number;

  valeurVenteEstimeeCad: number;
  gainRealiseEstimeCad: number;

  cibleGainCad: number;
  cibleLocaleCad: number;
  /** SIGNÉ : positif = le gain réalisé dépasse la cible. */
  ecartCad: number;
  /** JAMAIS NÉGATIF. */
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


  dateValeurs: string | null;
};

export type RefusQuantiteGain = {
  motif: MotifSansQuantiteGain; symbole: string; positionId: string;
};

export type ResultatPropositionGain =
  | { ok: true; proposition: PropositionCristallisationGain }
  | { ok: false; refus: RefusQuantiteGain };

const arrondiSou = (x: number) => Math.round(x * 100) / 100;

export function proposerQuantitePourGain(
  compte: Compte,
  position: Position,
  /** LA CIBLE VIENT DE LA STRATÉGIE (`constat.montantEstime`), jamais d'ici. */
  cibleGainCad: number
): ResultatPropositionGain {
  const id = positionId(compte, position);
  const refus = (motif: MotifSansQuantiteGain): ResultatPropositionGain =>
    ({ ok: false, refus: { motif, symbole: position.symbole, positionId: id } });

  const g = granulariteVente(position.typeInstrument);
  if (!g.supportee) return refus(g.raison);

  // ⚠ LA DEVISE DE NÉGOCIATION N'EST PAS L'UNITÉ DES MONTANTS. Un titre USD
  // dont le rapport rend des valeurs canadiennes se calcule normalement — le
  // faux garde qui les bloquait a été retiré le 21 août 2026.
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

  // LE SENS S'INVERSE ICI, ET NULLE PART AILLEURS.
  const gainLatentDisponibleCad = position.valeurMarchande - position.valeurComptable;
  if (gainLatentDisponibleCad <= 0) return refus('position-pas-en-gain');

  const gainParUniteCad = gainLatentDisponibleCad / q;
  const valeurParUniteCad = position.valeurMarchande / q;

  // Une position ne promet jamais plus de gain qu'elle n'en porte — ce qui
  // borne aussi structurellement la quantité au détenu.
  const cibleLocaleCad = Math.min(cibleGainCad, gainLatentDisponibleCad);
  const quantiteTheorique = cibleLocaleCad / gainParUniteCad;

  const voisines = quantitesExecutablesVoisines(quantiteTheorique, q, position.typeInstrument);
  if (voisines.length === 0) return refus('quantite-invalide');

  // `voisines` est triée croissante : à égalité d'écart, la première gagne,
  // donc la plus petite. Ce départage ne vaut QU'entre deux quantités du même
  // titre — comparer des nombres d'unités entre deux titres serait absurde.
  let meilleure = voisines[0];
  let meilleurEcart = Math.abs(meilleure * gainParUniteCad - cibleLocaleCad);
  for (const c of voisines.slice(1)) {
    const e = Math.abs(c * gainParUniteCad - cibleLocaleCad);
    if (e < meilleurEcart - 1e-9) { meilleure = c; meilleurEcart = e; }
  }

  const gainRealiseEstimeCad = arrondiSou(meilleure * gainParUniteCad);

  return {
    ok: true,
    proposition: {
      positionId: id,
      compteId: compteId(compte),
      symbole: position.symbole,
      description: position.description ?? null,
      typeInstrument: position.typeInstrument ?? null,
      devise: position.devise ?? null,
      uniteValeursRapport: position.uniteValeursRapport ?? 'CAD',

      quantiteDetenue: q,
      quantiteEstimeeAVendre: meilleure,
      uniteQuantite: g.unite,

      gainLatentDisponibleCad: arrondiSou(gainLatentDisponibleCad),
      gainParUniteCad,
      valeurParUniteCad,

      valeurVenteEstimeeCad: arrondiSou(meilleure * valeurParUniteCad),
      gainRealiseEstimeCad,

      cibleGainCad,
      cibleLocaleCad: arrondiSou(cibleLocaleCad),
      ecartCad: arrondiSou(gainRealiseEstimeCad - cibleGainCad),
      cibleRestanteCad: arrondiSou(Math.max(0, cibleGainCad - gainRealiseEstimeCad)),
      capaciteCouvreCible: gainLatentDisponibleCad >= cibleGainCad,
      executionCouvreEntierementCible: gainRealiseEstimeCad >= cibleGainCad,

      dateValeurs: compte.dateReleve ?? null,
    },
  };
}

export type MeilleurMonoGain = {
  proposition: PropositionCristallisationGain | null;
  aucunePositionNeCouvreSeule: boolean;
  propositions: PropositionCristallisationGain[];
  refus: RefusQuantiteGain[];
};

/** Le résultat ne dépend jamais de l'ordre du tableau reçu. */
export function meilleurPlanGainMonoTitre(
  positions: Array<{ compte: Compte; position: Position }>,
  cibleGainCad: number
): MeilleurMonoGain {
  const propositions: PropositionCristallisationGain[] = [];
  const refus: RefusQuantiteGain[] = [];
  for (const { compte, position } of positions) {
    const r = proposerQuantitePourGain(compte, position, cibleGainCad);
    if (r.ok) propositions.push(r.proposition);
    else refus.push(r.refus);
  }

  // ⚠ LA CAPACITÉ, PAS L'ARRONDI — voir le champ `capaciteCouvreCible`.
  const couvrantes = propositions.filter((p) => p.capaciteCouvreCible);
  if (couvrantes.length === 0) {
    return { proposition: null, aucunePositionNeCouvreSeule: true, propositions, refus };
  }
  const trie = [...couvrantes].sort((a, b) => {
    const d = Math.abs(a.ecartCad) - Math.abs(b.ecartCad);
    if (Math.abs(d) > 1e-9) return d;
    return `${a.compteId}|${a.positionId}|${a.symbole}`
      .localeCompare(`${b.compteId}|${b.positionId}|${b.symbole}`);
  });
  return { proposition: trie[0], aucunePositionNeCouvreSeule: false, propositions, refus };
}

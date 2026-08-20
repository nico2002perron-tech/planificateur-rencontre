// LES ÉCRITURES DE « VALEUR COMPTABLE » — le dernier blocage matériel avant
// les droits CELI (20 août 2026).
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE LA MESURE A ÉTABLI (docs/mesure-valeur-comptable-2026-08-20.md,
// 244 occurrences sur TOUS les régimes de la base locale).
//
// D'ABORD, DEUX HYPOTHÈSES RÉFUTÉES — celles qu'on aurait « devinées » :
//   · « chaque écriture est annulée par son opposée » : 0 sur 169 lignes à
//     montant non nul trouvent une contrepartie de même symbole et de montant
//     opposé, ni à J0, ni à ±1 jour, ni à ±2 ;
//   · « une opération sur titre voisine explique le montant » (l'hypothèse
//     « Valeur comptable −9 000 + Remboursement +9 000 » du cahier) : 0 sur 169.
//     À J0, une « Valeur comptable » n'a pour voisines que d'autres « Valeur
//     comptable » — aucun Achat, aucune Vente, aucun Remboursement.
//   · et le PBR ne se vérifie pas non plus : les 166 lignes en titres n'ont
//     AUCUN prix. `|total| = quantité × prix` est intestable ici.
//
// CE QUI EST VRAI, EN REVANCHE, ET MESURÉ :
//   · la forme croisée avec la quantité est d'une régularité frappante —
//     en TITRES : quantité > 0 avec un total NÉGATIF (83), ou quantité < 0 avec
//     un total NUL (75) ; en ENCAISSE : quantité 0 avec un total POSITIF (73) ;
//   · et surtout : **15 des 17 groupes (compte × jour) nettent à ZÉRO**. Sur
//     un même compte, un même jour, ces écritures se redistribuent entre elles
//     sans changer la valeur du compte.
//
// LA RÈGLE QUI EN DÉCOULE, ET RIEN DE PLUS : quand les écritures « Valeur
// comptable » d'un compte, un jour donné, s'annulent entre elles (±0,02 $),
// AUCUNE VALEUR N'EST ENTRÉE NI SORTIE de ce compte ce jour-là. Elles ne
// peuvent donc modifier ni cotisation ni retrait : ce sont des écritures
// internes, et elles cessent de bloquer.
//
// Quand le groupe NE s'annule PAS, le résidu est un mouvement réel que
// personne n'explique — il reste `inconnu` et BLOQUANT. Les deux groupes
// concernés (un REER, un CELI dont le fameux net de −9 000 $) sont exactement
// ceux qu'on veut continuer de voir.
//
// CE QUE CETTE RÈGLE NE DIT PAS : ce que « Valeur comptable » SIGNIFIE. On ne
// le sait toujours pas, et le libellé reste hors de la liste blanche
// (`classerLigne` le rend `inconnu`). On sait seulement, et on le prouve
// groupe par groupe, que certaines de ces écritures ne déplacent aucune valeur.
// C'est une preuve d'INNOCUITÉ, pas une compréhension — et c'est tout ce dont
// la complétude a besoin.
//
// PÉRIMÈTRE : tous les régimes. Le motif est le même partout (REER 113, CELI 59,
// FERR 33, non-enregistré 24, REEE 15), et la règle ne dépend d'aucun régime.
// ─────────────────────────────────────────────────────────────────────────────

import { cleLibelleInconnu } from './flux';
import type { EvenementFlux } from './ligne-du-temps';

/** Le libellé visé — normalisé par la même garde que les diagnostics. */
const LIBELLE = 'valeur comptable';

/** Tolérance d'annulation : le cent, comme partout dans ce dépôt. */
const TOLERANCE = 0.02;

export type GroupeEcritures = {
  /** compte × jour — la maille où la mesure montre l'annulation. */
  compte: string;
  date: string;
  /** Les événements du groupe, dans l'ordre des ids. */
  ids: number[];
  /** La somme de leurs montants — ≈ 0 quand le groupe s'annule. */
  net: number;
  equilibre: boolean;
};

export type ResultatEcritures = {
  groupes: GroupeEcritures[];
  /** Les ids des écritures d'un groupe ÉQUILIBRÉ : prouvées sans effet sur la valeur du compte. */
  equilibrees: Set<number>;
};

/**
 * Regroupe les écritures « Valeur comptable » par compte × jour et dit
 * lesquelles s'annulent entre elles.
 *
 * `disposes` : les ids déjà consommés ailleurs (FX, règle 2, virements). Une
 * ligne déjà expliquée ne peut pas être réutilisée — invariant d'unicité.
 */
export function rapprocherEcrituresComptables(
  evenements: EvenementFlux[],
  disposes: ReadonlySet<number>
): ResultatEcritures {
  const parCompteJour = new Map<string, EvenementFlux[]>();
  for (const ev of evenements) {
    if (disposes.has(ev.id)) continue;
    if (cleLibelleInconnu(ev.source.type) !== LIBELLE) continue;
    if (ev.montant === null) continue;              // un montant illisible ne peut rien prouver
    const cle = `${ev.compte}|${ev.date}`;
    if (!parCompteJour.has(cle)) parCompteJour.set(cle, []);
    parCompteJour.get(cle)!.push(ev);
  }

  const groupes: GroupeEcritures[] = [];
  const equilibrees = new Set<number>();
  for (const [cle, evs] of parCompteJour) {
    const [compte, date] = cle.split('|');
    const net = Math.round(evs.reduce((s, e) => s + (e.montant as number), 0) * 100) / 100;
    const equilibre = Math.abs(net) <= TOLERANCE;
    groupes.push({ compte, date, ids: evs.map((e) => e.id).sort((a, b) => a - b), net, equilibre });
    if (equilibre) for (const e of evs) equilibrees.add(e.id);
  }
  groupes.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.compte < b.compte ? -1 : 1));
  return { groupes, equilibrees };
}

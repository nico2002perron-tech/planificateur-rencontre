// LIRE CE QUI ATTEINT VRAIMENT LE CLIENT — harnais commun aux tests PDF.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI ON DÉROULE L'ARBRE PLUTÔT QUE D'INSPECTER LE JSX.
//
// Un test qui regarde les props d'un composant vérifie ce qu'on lui a passé,
// pas ce qui sort. Ici on EXÉCUTE les composants fonction et on récolte le
// texte réellement posé — c'est le seul niveau où « la page dégradée n'affiche
// pas 141 actions » veut dire quelque chose.
//
// ⚠ CE FICHIER N'EST PAS UNE SUITE DE TESTS. Le préfixe `_` et l'absence de
// `.test.` le tiennent hors du motif `include` de vitest.config.ts.
//
// Il existait en CINQ copies avant l'extraction du langage fiscal commun.
// ─────────────────────────────────────────────────────────────────────────────
import { Text } from '@react-pdf/renderer';

/** Tous les fragments de texte posés par un arbre, dans l'ordre du rendu. */
export function textesDe(noeud: unknown): string[] {
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return [];
  if (typeof noeud === 'string') return [noeud];
  if (typeof noeud === 'number') return [String(noeud)];
  if (Array.isArray(noeud)) return noeud.flatMap(textesDe);
  const el = noeud as { type?: unknown; props?: Record<string, unknown> };
  if (!el.props) return [];
  // Un composant fonction : on l'exécute pour voir ce qu'il produit.
  if (typeof el.type === 'function') return textesDe((el.type as (p: unknown) => unknown)(el.props));
  return textesDe(el.props.children);
}

/**
 * Le texte d'un arbre, aplati.
 *
 * ⚠ JOINT SANS SÉPARATEUR : react-pdf colle les fragments d'un même `<Text>`.
 * Les espaces insécables (dont l'étroite des milliers de `fr-CA`) sont
 * normalisées, sinon « 11 985,00 $ » ne se compare à rien.
 */
export const platDe = (noeud: unknown) =>
  textesDe(noeud).join('').replace(/[\s   ]+/g, ' ');

export type NoeudTexte = { texte: string; couleur: string | undefined };

/**
 * LES `<Text>` AVEC LEUR COULEUR — pour verrouiller un STYLE, pas un mot.
 *
 * ⚠ UN TEST SUR LE TEXTE SEUL NE VOIT PAS LE DÉFAUT DU TIRET : « — » est
 * présent que la valeur soit absente ou non. Ce qui distingue le bogue de la
 * correction est la couleur, donc il faut descendre jusqu'aux props.
 */
export function noeudsTexte(noeud: unknown): NoeudTexte[] {
  if (noeud === null || noeud === undefined || typeof noeud !== 'object') return [];
  if (Array.isArray(noeud)) return noeud.flatMap(noeudsTexte);
  const el = noeud as { type?: unknown; props?: Record<string, unknown> };
  if (!el.props) return [];
  if (el.type === Text) {
    const style = (el.props.style ?? {}) as { color?: string };
    return [
      { texte: textesDe(el.props.children).join('').replace(/[\s   ]+/g, ' '), couleur: style.color },
      ...noeudsTexte(el.props.children),
    ];
  }
  if (typeof el.type === 'function') {
    return noeudsTexte((el.type as (p: unknown) => unknown)(el.props));
  }
  return noeudsTexte(el.props.children);
}

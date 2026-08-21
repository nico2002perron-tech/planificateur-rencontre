// EN QUOI UNE QUANTITÉ EST-ELLE EXPRIMÉE, ET PAR QUEL PAS ?
//
// ─────────────────────────────────────────────────────────────────────────────
// UNE SEULE PRIMITIVE CONNAÎT CETTE POLITIQUE.
//
// Sans elle, la connaissance « une action se vend par unités, une part de fonds
// par millièmes » se serait dispersée en `if` un peu partout — et le jour où le
// pas change, il en resterait toujours un.
//
// LA POLITIQUE VIENT D'UNE MESURE, pas d'une intuition. Sur la base réelle du
// 21 août 2026, 212 positions :
//
//   Action                  189   aucune fraction
//   Obligation               16   aucune fraction
//   Fonds d'investissement    6   TOUTES fractionnaires, à 3 décimales exactes
//   Autre                     1   aucune fraction
//
// Exemples de parts observées : 527,731 · 379,659 · 1204,123 · 427,478.
//
// ⚠ CE QUE LE CONTRAT DIT, ET CE QU'IL NE DIT PAS.
//   Il dit : « le format d'import que nous supportons représente les quantités
//   de fonds à trois décimales ».
//   Il NE dit PAS : « tout fonds est toujours négociable par 0,001 part ». La
//   quantité produite reste une ESTIMATION à valider avant exécution.
//
// LES FNB suivent le contrat « Action » : le relevé ne les distingue pas, il
// les classe sous « Action ». On ne l'invente pas — on le constate.
// ─────────────────────────────────────────────────────────────────────────────

/** Ce en quoi la quantité se compte, pour que la présentation puisse le dire. */
export type UniteQuantite = 'unite' | 'part';

export type RaisonNonSupportee =
  /**
   * ⚠ UNE OBLIGATION N'A PAS DE « QUANTITÉ D'UNITÉS ».
   *
   * Sa quantité est une VALEUR NOMINALE — c'est déjà la règle 1 du parseur, qui
   * dérive les unitaires des totaux parce que les colonnes 6 et 7 sont « par
   * 100 $ de nominal ». Diviser une perte latente par cette quantité donnerait
   * une « perte par dollar de nominal » : un nombre exact dont le libellé
   * serait faux, et une instruction de vente inexécutable.
   *
   * ⚠ CE N'EST PAS UN DÉFAUT DE DONNÉES. Le prix de base et la valeur marchande
   * peuvent être parfaitement lisibles. C'est la GRANULARITÉ D'EXÉCUTION qui
   * n'est pas établie — et la coupure minimale d'une obligation ne s'invente
   * pas.
   *
   * Mesuré le 21 août 2026 : sur 16 obligations, ZÉRO en compte non enregistré,
   * donc zéro atteignant les stratégies de cristallisation. Cette exclusion est
   * aujourd'hui une protection d'avenir, pas une perte.
   */
  | 'obligation-nominal-non-supporte'
  /**
   * Un type dont la sémantique d'exécution n'est pas établie. Une seule
   * observation d'« Autre » dans la base ne suffit pas à en décider.
   */
  | 'type-instrument-non-supporte';

export type GranulariteVente =
  | { supportee: true; unite: UniteQuantite; pas: number }
  | { supportee: false; raison: RaisonNonSupportee };

/** Le pas des fonds, en MILLIÈMES entiers — voir `enMillièmes` plus bas. */
export const MILLIEMES_PAR_PART = 1000;

const ACTION = /^action$/i;
const FONDS = /^fonds\s+d['’]investissement$/i;
const OBLIGATION = /^obligation$/i;

/**
 * LA POLITIQUE, EN UN SEUL ENDROIT.
 *
 * Un type absent ou vide n'est pas supporté : on ne devine pas la granularité
 * d'un instrument qu'on n'a pas identifié. C'est le défaut sûr — il dégrade,
 * il ne fabrique pas.
 */
export function granulariteVente(typeInstrument: string | null | undefined): GranulariteVente {
  const t = (typeInstrument ?? '').trim();
  if (ACTION.test(t)) return { supportee: true, unite: 'unite', pas: 1 };
  if (FONDS.test(t)) return { supportee: true, unite: 'part', pas: 1 / MILLIEMES_PAR_PART };
  if (OBLIGATION.test(t)) return { supportee: false, raison: 'obligation-nominal-non-supporte' };
  return { supportee: false, raison: 'type-instrument-non-supporte' };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA QUANTIFICATION — en entiers, jamais en flottants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UNE QUANTITÉ DE PARTS, EN MILLIÈMES ENTIERS.
 *
 * ⚠ POURQUOI CE DÉTOUR. `Math.floor(120.1234 / 0.001) * 0.001` rend
 * `120.12299999999999` : la division par 0,001 en binaire ne tombe pas juste,
 * et le client lirait une quantité à quatorze décimales. En passant par des
 * millièmes ENTIERS, `120,123` reste `120,123`.
 *
 * L'arrondi à l'entier le plus proche absorbe le bruit d'un `527.7310000001`
 * venu d'un calcul amont ; il ne crée aucune précision — les données mesurées
 * s'arrêtent au millième.
 */
export function enMilliemes(parts: number): number {
  return Math.round(parts * MILLIEMES_PAR_PART);
}

export function depuisMilliemes(milliemes: number): number {
  // La division finale reste exacte à l'affichage : 527731 / 1000 = 527.731.
  return Math.round(milliemes) / MILLIEMES_PAR_PART;
}

/**
 * LES DEUX QUANTITÉS EXÉCUTABLES QUI ENCADRENT UNE QUANTITÉ THÉORIQUE.
 *
 * Rend `[]` quand le type n'est pas supporté — jamais une quantité inventée —,
 * et écarte tout candidat hors des bornes `1 ≤ q ≤ détenu` (ou, pour un fonds,
 * `1 millième ≤ q ≤ détenu`).
 *
 * ⚠ LES DEUX VOISINS SONT RENDUS, PAS UN SEUL. Le choix entre eux appartient à
 * l'appelant, qui seul connaît la cible et peut minimiser l'écart. Trancher ici
 * reviendrait à privilégier en silence le dépassement ou le sous-dépassement.
 */
export function quantitesExecutablesVoisines(
  quantiteTheorique: number,
  quantiteDetenue: number,
  typeInstrument: string | null | undefined
): number[] {
  const g = granulariteVente(typeInstrument);
  if (!g.supportee) return [];
  if (!Number.isFinite(quantiteTheorique) || quantiteTheorique <= 0) return [];
  if (!Number.isFinite(quantiteDetenue) || quantiteDetenue <= 0) return [];

  if (g.unite === 'unite') {
    const detenu = Math.floor(quantiteDetenue);          // pas de fraction d'action
    const bas = Math.floor(quantiteTheorique);
    const haut = Math.ceil(quantiteTheorique);
    return [...new Set([bas, haut])]
      .filter((q) => q >= 1 && q <= detenu)
      .sort((a, b) => a - b);
  }

  const detenuM = enMilliemes(quantiteDetenue);
  const theoriqueM = quantiteTheorique * MILLIEMES_PAR_PART;
  const bas = Math.floor(theoriqueM);
  const haut = Math.ceil(theoriqueM);
  return [...new Set([bas, haut])]
    .filter((m) => m >= 1 && m <= detenuM)
    .sort((a, b) => a - b)
    .map(depuisMilliemes);
}

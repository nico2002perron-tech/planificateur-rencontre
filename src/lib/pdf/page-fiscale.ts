// LE CONTRAT DE PAGE DU DOCUMENT FISCAL — un seul, pour toutes ses pages.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE.
//
// Deux familles de pages se sont développées séparément :
//   · la couverture et la page de synthèse — A4, fond #fffdf9, obtenu par un
//     override inline de `styles.page` posé à chaque `<Page>` ;
//   · les pages de stratégie en cinq étapes — LETTER, fond #f8fafc, décidé
//     dans leur harnais d'aperçu, hors de tout document.
//
// Les réunir dans un même PDF demandait de trancher, et de le trancher UNE
// FOIS. Un override ponctuel de plus aurait tenu jusqu'à la troisième page.
//
// ⚠ CE QUI A ÉTÉ TRANCHÉ, ET POURQUOI :
//
//   FORMAT → A4. C'est le format du document réel, celui que Nicolas imprime.
//   Les pages de stratégie n'étaient en LETTER que parce que leur aperçu
//   l'était. A4 est plus étroit de 17 pt et plus haut de 50 pt : la conversion
//   REFLUE le contenu, elle ne le met pas à l'échelle. Elle a donc été
//   regardée sur PDF, pas supposée.
//
//   FOND → #fffdf9. Le blanc chaud est l'identité du document client, posée
//   sur la couverture. Le #f8fafc des pages de stratégie était une décision
//   d'aperçu isolé. Le document remis fait foi.
//
//   MARGES → celles de `styles.page` (36 · haut 44 · bas 50). Le bas de 50 pt
//   n'est pas décoratif : `PageFooterV12` s'y loge.
//
// ⚠ LE FOND N'EST PAS RÉÉCRIT ICI : il reste un override de `styles.page`,
// mais un SEUL, à un SEUL endroit, que toutes les pages consomment. C'est la
// différence entre un contrat et une habitude.
// ─────────────────────────────────────────────────────────────────────────────
import { styles } from './styles';

/** A4 portrait — le format du document remis. */
export const FORMAT_PAGE_FISCALE = 'A4';
export const ORIENTATION_PAGE_FISCALE = 'portrait';

/**
 * Le blanc chaud du document fiscal.
 *
 * ⚠ PAS `NEUTRE.page` (#f8fafc). Les cartes des pages de stratégie sont
 * dessinées en gris ardoise froid ; posées sur ce blanc chaud, leur contraste
 * change. Ça a été rendu et regardé avant d'être adopté.
 */
export const FOND_PAGE_FISCALE = '#fffdf9';

/** Le style de page, commun à la couverture, à la synthèse et aux stratégies. */
export const STYLE_PAGE_FISCALE = {
  ...styles.page,
  backgroundColor: FOND_PAGE_FISCALE,
};

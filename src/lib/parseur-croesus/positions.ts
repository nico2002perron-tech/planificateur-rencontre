// LE PARSEUR D'EXPORT POSITIONS — le relevé que le planificateur colle.
//
// Format observé (13 colonnes, tabulées) :
//   0 devise · 1 type d'instrument · 2 quantité · 3 description · 4 suffixe du
//   compte · 5 symbole · 6 PBR unitaire · 7 prix unitaire · 8 coût total ·
//   9 valeur marchande · 10 durée · 11 intérêts courus · 12 revenu annuel
//
// RÈGLE 1 APPLIQUÉE ICI : les colonnes 6 et 7 sont « par 100 $ de nominal »
// pour une obligation. On dérive donc TOUJOURS les unitaires des totaux
// (colonnes 8 et 9), qui portent l'échelle en eux. Voir docs/regles-parseur.md.

import { nombre } from './regles';
import { canoniserCompte } from './identifiant-compte';
import type { LignePosition } from './types';

export type ResultatPositions = {
  positions: LignePosition[];
  /** Les lignes d'encaisse, mises à part : ce ne sont pas des positions. */
  encaisses: Array<{ suffixeCompte: string; devise: string; montant: number }>;
  ignorees: number;
  /** Les suffixes de compte rencontrés, pour la jointure. */
  suffixes: string[];
  /**
   * Combien de séparateurs « ### » le collage contient.
   *
   * Un collage qui en porte couvre PLUSIEURS clients, et le suffixe « A » de
   * deux clients différents fusionnerait en un seul compte fantôme dont chaque
   * ligne a l'air juste. L'appelant DOIT refuser la jointure dans ce cas.
   */
  blocs: number;
};

const EST_ENCAISSE = /^1(CAD|USD)$/i;

/**
 * Une obligation : le revenu annuel de la colonne 12 y est SUSPECT.
 *
 * Les colonnes 6 et 7 d'une obligation sont exprimées pour 100 $ de nominal —
 * c'est la règle 1, née d'un portefeuille affiché à 21,9 M$. Personne n'a
 * encore mesuré si la colonne 12 suit la même échelle. Sur un nominal de
 * 39 000 $, l'erreur serait d'un facteur 100.
 *
 * Tant que la mesure n'est pas faite, on rend `null` pour les obligations et
 * on le déclare, plutôt que de publier un revenu peut-être centuplé.
 *
 * ON NE REGARDE QUE LA COLONNE 1, la famille d'instrument que Croesus déclare
 * lui-même — jamais la description. « FNB OBLIGATIONS CANADIENNES » est un
 * FONDS : ses colonnes sont par part, pas par 100 $ de nominal. Chercher le
 * mot « obligation » dans le texte libre effacerait le revenu de tous les FNB
 * obligataires, qui sont légion dans ces portefeuilles.
 */
const EST_OBLIGATION = /^(OBLIGATION|BILLET|D[EÉ]B[EÉ]NTURE|CPG|BOND)/i;

/**
 * Lit un collage de positions.
 *
 * Tolérant par construction : une ligne trop courte, un en-tête, une ligne
 * vide sont comptés dans `ignorees` plutôt que de faire échouer l'import. Le
 * planificateur colle depuis Excel, le contenu n'est jamais parfaitement propre.
 */
export function parserPositions(texte: string): ResultatPositions {
  const positions: LignePosition[] = [];
  const encaisses: ResultatPositions['encaisses'] = [];
  const suffixes = new Set<string>();
  let ignorees = 0;
  let blocs = 0;

  for (const brut of texte.split(/\r?\n/)) {
    if (!brut.trim()) continue;
    if (brut.startsWith('###')) { blocs++; continue; }   // séparateur de client
    const c = brut.split('\t');
    if (c.length < 10) { ignorees++; continue; }

    const symbole = (c[5] || '').trim();
    // La règle générale : un identifiant de compte se compare canonisé. Ici il
    // sert de CLÉ de regroupement, donc il doit être canonisé dès l'entrée.
    const suffixeCompte = canoniserCompte(c[4]);
    if (!symbole) { ignorees++; continue; }

    const quantite = nombre(c[2]);
    if (quantite === null) { ignorees++; continue; }

    // UN SUFFIXE VIDE N'EST PAS UNE CLÉ. `memeCompte` pose déjà le principe :
    // une chaîne vide n'égale rien, pas même une autre chaîne vide. Sans ce
    // refus, toutes les lignes sans compte de tous les collages fusionneraient
    // en un compte unique qui n'existe pas.
    if (!suffixeCompte) { ignorees++; continue; }
    suffixes.add(suffixeCompte);

    const devise = (c[0] || 'CAD').trim();
    const valeurMarchande = nombre(c[9]);

    if (EST_ENCAISSE.test(symbole)) {
      encaisses.push({ suffixeCompte, devise, montant: valeurMarchande ?? quantite });
      continue;
    }

    const coutTotal = nombre(c[8]);
    const typeInstrument = (c[1] || '').trim();
    const description = (c[3] || '').trim();

    positions.push({
      devise,
      typeInstrument,
      quantite,
      description,
      suffixeCompte,
      symbole,
      // RÈGLE 1 — dérivés des totaux, jamais lus dans les colonnes unitaires.
      pbrUnitaire: unitaire(coutTotal, quantite),
      prixUnitaire: unitaire(valeurMarchande, quantite),
      coutTotal,
      valeurMarchande,
      revenuAnnuel: EST_OBLIGATION.test(typeInstrument)
        ? null                                  // échelle non mesurée — voir EST_OBLIGATION
        : nombre(c[12]),
    });
  }

  return { positions, encaisses, ignorees, suffixes: [...suffixes].sort(), blocs };
}

function unitaire(total: number | null, quantite: number): number | null {
  if (total === null || Math.abs(quantite) < 1e-9) return null;
  return Math.abs(total / quantite);
}

/** Le verdict d'une jointure suffixe → numéro complet. */
export type VerdictJointure = {
  numero: string | null;
  provenance: 'livre' | 'ambigu' | 'absent' | 'non-jointable';
  candidats: string[];
};

/**
 * Les positions groupées par compte, prêtes pour `profil.comptes`.
 *
 * Le suffixe ne suffit pas à nommer un compte : 65 clients du livre ont deux
 * comptes finissant par la même lettre. Le rappel de jointure rend donc un
 * VERDICT, pas un numéro — il n'existe pas de façon honnête d'exprimer
 * « ambigu » avec un `string | null`, et c'est précisément le cas où
 * l'ancienne signature aurait fait choisir au hasard.
 */
export function grouperParCompte(
  positions: LignePosition[],
  jointure?: (suffixe: string) => VerdictJointure
): Array<{ suffixe: string; positions: LignePosition[] } & VerdictJointure> {
  const parSuffixe = new Map<string, LignePosition[]>();
  for (const p of positions) {
    // Les positions sortent déjà canonisées de `parserPositions` ; on le refait
    // ici parce que rien ne garantit que l'appelant soit passé par lui.
    const cle = canoniserCompte(p.suffixeCompte);
    if (!cle) continue;
    if (!parSuffixe.has(cle)) parSuffixe.set(cle, []);
    parSuffixe.get(cle)!.push(p);
  }
  const inconnu: VerdictJointure = { numero: null, provenance: 'absent', candidats: [] };
  return [...parSuffixe.entries()]
    .map(([suffixe, liste]) => ({
      suffixe,
      positions: liste,
      ...(jointure?.(suffixe) ?? inconnu),
    }))
    .sort((a, b) => a.suffixe.localeCompare(b.suffixe));
}

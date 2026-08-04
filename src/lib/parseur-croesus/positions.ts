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
import type { LignePosition } from './types';

export type ResultatPositions = {
  positions: LignePosition[];
  /** Les lignes d'encaisse, mises à part : ce ne sont pas des positions. */
  encaisses: Array<{ suffixeCompte: string; devise: string; montant: number }>;
  ignorees: number;
  /** Les suffixes de compte rencontrés, pour la jointure. */
  suffixes: string[];
};

const EST_ENCAISSE = /^1(CAD|USD)$/i;

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

  for (const brut of texte.split(/\r?\n/)) {
    if (!brut.trim()) continue;
    if (brut.startsWith('###')) continue;            // séparateur de client
    const c = brut.split('\t');
    if (c.length < 10) { ignorees++; continue; }

    const symbole = (c[5] || '').trim();
    const suffixeCompte = (c[4] || '').trim().toUpperCase();
    if (!symbole) { ignorees++; continue; }

    const quantite = nombre(c[2]);
    if (quantite === null) { ignorees++; continue; }
    if (suffixeCompte) suffixes.add(suffixeCompte);

    const devise = (c[0] || 'CAD').trim();
    const valeurMarchande = nombre(c[9]);

    if (EST_ENCAISSE.test(symbole)) {
      encaisses.push({ suffixeCompte, devise, montant: valeurMarchande ?? quantite });
      continue;
    }

    const coutTotal = nombre(c[8]);

    positions.push({
      devise,
      typeInstrument: (c[1] || '').trim(),
      quantite,
      description: (c[3] || '').trim(),
      suffixeCompte,
      symbole,
      // RÈGLE 1 — dérivés des totaux, jamais lus dans les colonnes unitaires.
      pbrUnitaire: unitaire(coutTotal, quantite),
      prixUnitaire: unitaire(valeurMarchande, quantite),
      coutTotal,
      valeurMarchande,
    });
  }

  return { positions, encaisses, ignorees, suffixes: [...suffixes].sort() };
}

function unitaire(total: number | null, quantite: number): number | null {
  if (total === null || Math.abs(quantite) < 1e-9) return null;
  return Math.abs(total / quantite);
}

/**
 * Les positions groupées par compte, prêtes pour `profil.comptes`.
 *
 * Le suffixe ne suffit pas à nommer un compte : 65 clients du livre ont deux
 * comptes finissant par la même lettre. Le numéro complet doit venir de
 * l'appelant (jointure avec l'historique), sinon on ne garde que le suffixe et
 * on le déclare.
 */
export function grouperParCompte(
  positions: LignePosition[],
  numeroPourSuffixe?: (suffixe: string) => string | null
): Array<{ suffixe: string; numero: string | null; positions: LignePosition[] }> {
  const parSuffixe = new Map<string, LignePosition[]>();
  for (const p of positions) {
    if (!parSuffixe.has(p.suffixeCompte)) parSuffixe.set(p.suffixeCompte, []);
    parSuffixe.get(p.suffixeCompte)!.push(p);
  }
  return [...parSuffixe.entries()]
    .map(([suffixe, liste]) => ({
      suffixe,
      numero: numeroPourSuffixe?.(suffixe) ?? null,
      positions: liste,
    }))
    .sort((a, b) => a.suffixe.localeCompare(b.suffixe));
}

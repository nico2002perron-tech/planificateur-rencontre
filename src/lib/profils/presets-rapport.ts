// LES DEUX PRÉRÉGLAGES DU RAPPORT FISCAL — sortis de la route pour être testables.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE.
//
// La sélection de stratégies vivait dans `const PRESETS` au milieu de
// `app/api/base-locale/rapport-fiscal/route.ts`, module-privée. Conséquence
// mesurée : AUCUN test ne pouvait produire le document tel que la production le
// produit — il aurait porté les huit constats du catalogue au lieu des quatre
// ou huit retenus, donc potentiellement plus de pages de stratégie que le vrai
// PDF. Un harnais qui ne reproduit pas la sélection ne prouve pas le chemin.
//
// ⚠ AUCUNE RÈGLE N'A CHANGÉ EN DÉMÉNAGEANT. Ce sont les mêmes listes, dans le
// même ordre. Le seul changement est qu'on peut désormais les lire d'ailleurs.
//
// DÉCISION D'ORIGINE (5 août 2026), conservée telle quelle : deux gabarits
// distincts, c'est deux mises en page à entretenir et un jour deux histoires
// différentes pour le même client. Un préréglage, c'est une SÉLECTION sur la
// MÊME page.
//
//   instantané — ce qui se calcule à partir du seul portefeuille ;
//   complet    — tout le catalogue, y compris ce qui exige la fiche.
// ─────────────────────────────────────────────────────────────────────────────

export type ClePreset = 'instantane' | 'complet';

export const PRESETS: Record<ClePreset, string[]> = {
  instantane: ['cristallisation-pertes', 'cristallisation-gains', 'don-titres', 'ordre-vente'],
  complet: [
    'cristallisation-pertes', 'cristallisation-gains', 'droits-cotisation',
    'localisation-actifs', 'celi-conjoint', 'don-titres', 'subvention-reee',
    'ordre-vente',
  ],
};

/**
 * LES STRATÉGIES QUE LE DOCUMENT RETIENDRA — celles du préréglage que le moteur
 * a RÉELLEMENT produites.
 *
 * ⚠ LE FILTRE N'EST PAS DÉCORATIF. Nommer une stratégie absente du résultat
 * ferait sortir `restreindre` sur une liste plus courte que prévu sans qu'on
 * sache laquelle manque ; ici, ce qui est demandé et ce qui existe se croisent
 * à un seul endroit.
 */
export function strategiesDuPreset(preset: ClePreset, produites: string[]): string[] {
  return PRESETS[preset].filter((s) => produites.includes(s));
}

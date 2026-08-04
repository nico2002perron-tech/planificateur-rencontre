// Petits utilitaires purs partagés par les axes du moteur.

/** Borne x dans l'intervalle [min, max]. */
export function borner(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** Arrondit x à `decimales` décimales. */
export function arrondir(x: number, decimales = 0): number {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

/** Formate une part (0-1) en pourcentage fr-CA, ex. 0.0178 → « 1,78 % ». */
export function pct(x: number, decimales = 1): string {
  return `${arrondir(x * 100, decimales).toLocaleString("fr-CA")} %`;
}

/** Formate un montant en dollars fr-CA, ex. 195694 → « 195 694 $ ». */
export function dollars(x: number): string {
  return `${Math.round(x).toLocaleString("fr-CA")} $`;
}

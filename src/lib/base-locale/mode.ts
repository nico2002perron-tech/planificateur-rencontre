// LA SOURCE UNIQUE DE VÉRITÉ : « suis-je en exécution locale ? »
//
// Tout ce qui touche au disque, aux profils fiscaux et à la section fiscale du
// PDF passe par ici. Une seule fonction, un seul endroit à auditer.
//
// POURQUOI PAS UNE VARIABLE NEXT_PUBLIC_* : elle serait figée au moment du
// build. Un build fait sur le poste local puis déployé embarquerait « local =
// vrai » jusque sur Vercel. La détection doit donc être faite À L'EXÉCUTION,
// côté serveur, à chaque appel.
//
// POURQUOI CÔTÉ SERVEUR SEULEMENT : le navigateur ne doit jamais pouvoir
// prétendre être local. Une requête falsifiée depuis Vercel n'activera rien —
// c'est la route qui décide, pas le corps de la requête.
import 'server-only';

/**
 * Vrai uniquement hors de l'infrastructure Vercel.
 *
 * Vercel pose VERCEL=1 sur toutes ses exécutions (build comme runtime, dev
 * comme production) : son absence est le signal le plus fiable. On refuse
 * aussi explicitement si VERCEL_ENV est présent, au cas où la première
 * variable disparaîtrait d'une version à l'autre.
 */
export function estLocal(): boolean {
  // ── 1. REFUS EXPLICITE DE L'HÉBERGEUR ──────────────────────────────────────
  // Vercel pose ces variables sur toutes ses exécutions (build comme runtime).
  if (process.env.VERCEL) return false;
  if (process.env.VERCEL_ENV) return false;
  if (process.env.VERCEL_URL) return false;

  // ── 2. UNE PREUVE POSITIVE, pas seulement une absence — 18 août 2026 ───────
  //
  // La version d'origine s'arrêtait au refus ci-dessus : tout ce qui n'était
  // pas Vercel passait pour « local », y compris un conteneur, une autre
  // plateforme d'hébergement, ou une machine de collègue. La doctrine promet
  // « 404 hors localhost » ; le code ne vérifiait jamais localhost.
  //
  // On exige donc désormais que le serveur soit ATTACHÉ À LA BOUCLE LOCALE.
  // `HOSTNAME` est ce que Next expose ; sans lui, `next dev` n'écoute que
  // 127.0.0.1 par défaut — l'absence de variable reste donc du local.
  //
  // ÉCHAPPATOIRE ASSUMÉE : `BASE_LOCALE_AUTORISER=1` laisse Nicolas exécuter
  // ailleurs que sur la boucle locale s'il le décide un jour (une machine
  // dédiée hors ligne, par exemple). C'est un geste explicite, pas un défaut.
  if (process.env.BASE_LOCALE_AUTORISER === '1') return true;

  const hote = (process.env.HOSTNAME ?? process.env.HOST ?? '').trim();
  if (hote === '') return true;                       // défaut de `next dev`
  return BOUCLE_LOCALE.has(hote.toLowerCase());
}

/** Les hôtes qui désignent la machine elle-même. */
const BOUCLE_LOCALE = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * Le drapeau du volet fiscal. Séparé de `estLocal()` pour deux raisons :
 * il pourra exiger d'autres conditions (présence du dossier de données, un
 * réglage explicite), et le nommer distinctement rend les intentions lisibles
 * à la lecture des routes.
 */
export function modeFiscalActif(): boolean {
  return estLocal();
}

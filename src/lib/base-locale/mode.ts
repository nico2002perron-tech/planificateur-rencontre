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
  if (process.env.VERCEL) return false;
  if (process.env.VERCEL_ENV) return false;
  if (process.env.VERCEL_URL) return false;
  return true;
}

/**
 * Le drapeau du volet fiscal. Séparé de `estLocal()` pour deux raisons :
 * il pourra exiger d'autres conditions (présence du dossier de données, un
 * réglage explicite), et le nommer distinctement rend les intentions lisibles
 * à la lecture des routes.
 */
export function modeFiscalActif(): boolean {
  return estLocal();
}

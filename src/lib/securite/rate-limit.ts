// Rate-limiting EN MÉMOIRE (éphémère, AUCUNE IP persistée). Première ligne de défense
// pour les routes publiques. En production multi-instances (Vercel), à remplacer par
// Upstash/Redis pour un comptage global — mais ceci protège déjà chaque instance sans
// écrire quoi que ce soit sur disque ni en base.

type Fenetre = { debut: number; compte: number };
const compteurs = new Map<string, Fenetre>();

/** Cœur pur et testable : incrémente le compteur d'une clé sur une fenêtre glissante. */
export function limiter(
  cle: string,
  max: number,
  fenetreMs: number,
  maintenant: number,
): { ok: boolean; restant: number } {
  // Élagage opportuniste pour borner la mémoire.
  if (compteurs.size > 10_000) {
    for (const [k, v] of compteurs) {
      if (maintenant - v.debut >= fenetreMs) compteurs.delete(k);
    }
  }

  const f = compteurs.get(cle);
  if (!f || maintenant - f.debut >= fenetreMs) {
    compteurs.set(cle, { debut: maintenant, compte: 1 });
    return { ok: true, restant: max - 1 };
  }
  if (f.compte >= max) return { ok: false, restant: 0 };
  f.compte += 1;
  return { ok: true, restant: max - f.compte };
}

/** IP de la requête (derrière le proxy Vercel). Utilisée seulement en mémoire, jamais stockée. */
export function ipDe(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "inconnue";
}

/** Applique une limite ; retourne une réponse 429 si dépassée, sinon null (on continue). */
export function verifierLimite(
  request: Request,
  nom: string,
  max: number,
  fenetreMs = 3_600_000, // 1 h
): Response | null {
  const { ok } = limiter(`${nom}:${ipDe(request)}`, max, fenetreMs, Date.now());
  if (ok) return null;
  return new Response(
    JSON.stringify({ erreur: "Trop de requêtes. Réessayez plus tard." }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(fenetreMs / 1000)) } },
  );
}

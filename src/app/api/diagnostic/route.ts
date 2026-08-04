import { NextRequest, NextResponse } from "next/server";
import { diagnosticInputSchema } from "@/lib/securite/validation";
import { diagnostiquer } from "@/lib/moteur/resolution";
import { obtenirFonds } from "@/lib/supabase/requetes/fonds";
import { sauvegarderDiagnostic } from "@/lib/supabase/requetes/diagnostics";
import { verifierLimite } from "@/lib/securite/rate-limit";

// POST PUBLIC : positions → diagnostic. Rate-limité, validé (Zod), sauvegardé anonymement.
export async function POST(request: NextRequest) {
  const bloque = verifierLimite(request, "diagnostic", 20);
  if (bloque) return bloque;

  let brut: unknown;
  try {
    brut = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }

  const parsed = diagnosticInputSchema.safeParse(brut);
  if (!parsed.success) {
    return NextResponse.json(
      { erreur: "Données invalides.", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { positions, trancheAge, sourceUtm } = parsed.data;

  // Résolution + moteur. Si le référentiel est indisponible, on dégrade proprement
  // (tout non résolu) au lieu de planter — le constat le dira.
  let diagnostic;
  try {
    diagnostic = await diagnostiquer(positions, obtenirFonds);
  } catch (e) {
    console.error("[/api/diagnostic] référentiel indisponible:", (e as Error).message);
    diagnostic = await diagnostiquer(positions, async () => []);
  }

  // Sauvegarde ANONYME — non bloquante. On récupère l'id pour pouvoir lier un futur
  // lead à ce diagnostic (uniquement sur consentement, via /api/transmission).
  let diagnosticId: string | null = null;
  try {
    diagnosticId = await sauvegarderDiagnostic({ positions, diagnostic, trancheAge, sourceUtm });
  } catch (e) {
    console.error("[/api/diagnostic] sauvegarde ignorée:", (e as Error).message);
  }

  return NextResponse.json({ diagnostic, diagnosticId });
}

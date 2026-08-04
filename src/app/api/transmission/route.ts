import { NextRequest, NextResponse } from "next/server";
import { transmissionSchema } from "@/lib/securite/validation";
import { creerLead } from "@/lib/supabase/requetes/leads";
import { notifierNouveauLead } from "@/lib/courriel/notification-lead";
import { CONSENTEMENT_TRANSMISSION } from "@/lib/analyse/textes";
import { verifierLimite } from "@/lib/securite/rate-limit";

// POST PUBLIC : crée un lead ENTRANT, uniquement sur consentement (validé par Zod).
export async function POST(request: NextRequest) {
  const bloque = verifierLimite(request, "transmission", 5);
  if (bloque) return bloque;

  let brut: unknown;
  try {
    brut = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }

  const parsed = transmissionSchema.safeParse(brut);
  if (!parsed.success) {
    // Consentement absent/false ou coordonnées invalides → rejet.
    return NextResponse.json(
      { erreur: "Consentement requis et coordonnées valides.", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { diagnosticId, prenom, nom, courriel, telephone } = parsed.data;

  try {
    await creerLead({
      diagnosticId,
      prenom,
      nom,
      courriel,
      telephone,
      consentementVersion: CONSENTEMENT_TRANSMISSION.version,
    });
  } catch (e) {
    console.error("[/api/transmission]", (e as Error).message);
    return NextResponse.json({ erreur: "La transmission a échoué. Réessayez." }, { status: 500 });
  }

  // Notification interne à Nicolas — non bloquante.
  try {
    await notifierNouveauLead({ prenom, nom, courriel, telephone });
  } catch (e) {
    console.error("[/api/transmission] notification ignorée:", (e as Error).message);
  }

  return NextResponse.json({ transmis: true });
}

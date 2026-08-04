import { NextRequest, NextResponse } from "next/server";
import { rechercherFonds } from "@/lib/supabase/requetes/fonds";

// Autocomplete PUBLIC (voir middleware). Max 8 résultats, jamais le RFG. Cache 1h.
// Dégrade proprement (liste vide) si le référentiel est indisponible.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const resultats = await rechercherFonds(q);
    return NextResponse.json(
      { resultats },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch (e) {
    console.error("[/api/fonds/recherche]", (e as Error).message);
    return NextResponse.json({ resultats: [] });
  }
}

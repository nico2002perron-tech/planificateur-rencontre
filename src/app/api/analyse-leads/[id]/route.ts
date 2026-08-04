import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/features/auth/config";
import { changerStatut, type StatutLead } from "@/lib/supabase/requetes/leads";

const STATUTS: StatutLead[] = ["nouveau", "contacte", "rencontre", "converti", "perdu"];

// PRIVÉ : change le statut d'un lead. Auth requise.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  let body: { statut?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }
  if (!body.statut || !STATUTS.includes(body.statut as StatutLead)) {
    return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  }

  try {
    await changerStatut(id, body.statut as StatutLead);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: 500 });
  }
}

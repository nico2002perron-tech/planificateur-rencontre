import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/features/auth/config";
import { listerLeads } from "@/lib/supabase/requetes/leads";

// PRIVÉ : liste des analyses reçues (leads entrants). Auth requise.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });

  try {
    const leads = await listerLeads();
    return NextResponse.json({ leads });
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: 500 });
  }
}

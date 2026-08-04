import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { estLocal } from '@/lib/base-locale/mode';
import { importerCollage, lireHistorique } from '@/lib/profils/historique';
import { lireProfil, ecrireProfil, profilPourClient } from '@/lib/profils/stockage';
import { deriverHistoriqueRegime, observerTransferts } from '@/lib/profils/deriver';

// Import de l'historique complet (point 3b) — LOCAL SEULEMENT.
export async function POST(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, nom, texte } = (await req.json()) as { id?: string; nom?: string; texte?: string };
  if (!texte?.trim()) return NextResponse.json({ error: 'Aucun texte collé' }, { status: 400 });

  const date = new Date().toISOString().slice(0, 10);
  const profil = id ? await lireProfil(id) : nom ? await profilPourClient(nom, date) : null;
  if (!profil) return NextResponse.json({ error: 'Client inconnu' }, { status: 400 });

  const resume = await importerCollage({ id: profil.id, texte, horodatage: date });

  // Dérivation : historiqueVie est RECALCULÉ depuis le grand livre complet,
  // jamais incrémenté — c'est ce qui rend l'opération rejouable.
  const livre = await lireHistorique(profil.id);
  const annee = Number.parseInt(date.slice(0, 4), 10);
  profil.historiqueVie = {
    celi: deriverHistoriqueRegime(livre, 'celi', annee, date),
    reer: deriverHistoriqueRegime(livre, 'reer', annee, date),
  };
  const aJour = await ecrireProfil(profil, date);

  return NextResponse.json({
    resume,
    profil: aJour,
    transferts: observerTransferts(livre, 'celi'),
  });
}

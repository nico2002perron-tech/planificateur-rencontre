import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { estLocal } from '@/lib/base-locale/mode';
import { listerProfils, lireProfil, ecrireProfil, profilPourClient } from '@/lib/profils/stockage';
import type { ProfilClient } from '@/lib/profils/types';
import { badgesProfil, questionsRencontre, resumeBadges } from '@/lib/profils/badges';

// Profils fiscaux — LOCAL SEULEMENT. 404 hors local avant toute autre chose :
// on ne confirme même pas l'existence de la route.
async function garde() {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export async function GET(req: NextRequest) {
  const refus = await garde();
  if (refus) return refus;

  const id = req.nextUrl.searchParams.get('id');
  const nom = req.nextUrl.searchParams.get('nom');
  const date = new Date().toISOString().slice(0, 10);

  // Les badges accompagnent toujours le profil : l'écran n'a aucune logique de
  // provenance à refaire, et les questions de rencontre en découlent.
  const avecBadges = (profil: ProfilClient) => {
    const badges = badgesProfil(profil, date);
    return { profil, badges, questions: questionsRencontre(badges), resume: resumeBadges(badges) };
  };

  if (id) {
    const profil = await lireProfil(id);
    if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    return NextResponse.json(avecBadges(profil));
  }
  if (nom) return NextResponse.json(avecBadges(await profilPourClient(nom, date)));
  return NextResponse.json({ profils: await listerProfils() });
}

export async function PUT(req: NextRequest) {
  const refus = await garde();
  if (refus) return refus;

  const profil = (await req.json()) as ProfilClient;
  if (!profil?.id) return NextResponse.json({ error: 'Profil sans identifiant' }, { status: 400 });
  const date = new Date().toISOString().slice(0, 10);
  return NextResponse.json({ profil: await ecrireProfil(profil, date) });
}

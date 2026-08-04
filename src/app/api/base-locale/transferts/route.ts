import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { estLocal } from '@/lib/base-locale/mode';
import { lireProfil, ecrireProfil, nomPour } from '@/lib/profils/stockage';
import { lireHistorique } from '@/lib/profils/historique';
import { observerTransferts } from '@/lib/profils/deriver';
import { croiserTransferts } from '@/lib/profils/droits-celi';
import { cleTransfert, type TransfertResolu } from '@/lib/profils/types';

// La résolution manuelle des transferts orphelins — LOCAL SEULEMENT.
// C'est le levier qui fait fondre les 75 % de comptes rétrogradés en borne.
export async function GET(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const profil = await lireProfil(id);
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  const nom = await nomPour(id);
  if (!nom) return NextResponse.json({ error: 'Client inconnu' }, { status: 404 });
  const observes = observerTransferts(await lireHistorique(nom), 'celi');
  return NextResponse.json({
    douteux: croiserTransferts(observes, profil.consolidation.transfertsResolus),
    apparies: observes.filter((t) => t.apparie).length,
  });
}

export async function POST(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, compte, date, montant, resolution, note } = (await req.json()) as {
    id: string; compte: string; date: string; montant: number;
    resolution: 'interne' | 'externe'; note?: string;
  };
  const profil = await lireProfil(id);
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const cle = cleTransfert(compte, date, montant);
  const entree: TransfertResolu = {
    cle, compte, date, montant, resolution,
    dateConfirmation: aujourdhui,          // toujours daté : une résolution non datée ne vaut rien
    note: note?.trim() || null,
  };
  const sans = profil.consolidation.transfertsResolus.filter((t) => t.cle !== cle);
  profil.consolidation.transfertsResolus = [...sans, entree];

  // Un transfert confirmé EXTERNE fixe l'historique externe : le client a bien
  // eu un compte ailleurs, la question n° 1 est répondue par le fait.
  if (resolution === 'externe') {
    profil.consolidation.historiqueExterne = 'deja-eu';
    profil.consolidation.dateConfirmation = aujourdhui;
  }

  return NextResponse.json({ profil: await ecrireProfil(profil, aujourdhui) });
}

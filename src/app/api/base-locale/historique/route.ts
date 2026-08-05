import { NextRequest, NextResponse } from 'next/server';
import { estLocal } from '@/lib/base-locale/mode';
import { dossierTransactions } from '@/lib/base-locale/chemins';
import { importerCollage, lireHistorique } from '@/lib/profils/historique';
import { ecrireProfil, profilPourClient } from '@/lib/profils/stockage';
import { deriverHistoriqueRegime, observerTransferts } from '@/lib/profils/deriver';

// Import de l'historique complet — LOCAL SEULEMENT.
//
// LE NOM DU CLIENT COMMANDE TOUT : le même nom que celui saisi pour le rapport
// nomme le dossier de transactions, comme il nomme déjà le dossier de documents.
// Le profil fiscal, lui, reste rangé sous un pseudonyme (schéma section 2) —
// c'est le seul fichier qui porte des données fiscales, il n'a pas à porter
// aussi le nom.
// GARDE : `estLocal()` SUFFIT, et c'est raisonne.
//
// Ces routes n'existent PAS hors de la machine du planificateur : `estLocal()`
// renvoie 404 avant toute autre chose, et le mode est evalue cote serveur a
// l'execution — le navigateur ne peut pas le forcer. En local, elles servent
// les donnees de la machine a l'utilisateur de cette machine.
//
// Exiger EN PLUS une session next-auth n'ajoutait aucune protection (quiconque
// atteint localhost a deja la machine) mais cassait l'usage : le 4 aout 2026,
// « Unauthorized » au moment de coller des transactions, alors que l'ecran
// s'affichait normalement.
export async function POST(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  const { nom, texte } = (await req.json()) as { nom?: string; texte?: string };
  if (!nom?.trim()) return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 });
  if (!texte?.trim()) return NextResponse.json({ error: 'Aucun texte collé' }, { status: 400 });

  const date = new Date().toISOString().slice(0, 10);
  const resume = await importerCollage({ nomClient: nom, texte, horodatage: date });

  // Le profil est RECALCULÉ depuis le livre complet du client, jamais
  // incrémenté : l'opération reste rejouable à l'identique.
  const profil = await profilPourClient(nom, date);
  const livre = await lireHistorique(nom);
  const annee = Number.parseInt(date.slice(0, 4), 10);
  profil.historiqueVie = {
    celi: deriverHistoriqueRegime(livre, 'celi', annee, date),
    reer: deriverHistoriqueRegime(livre, 'reer', annee, date),
  };
  const aJour = await ecrireProfil(profil, date);

  return NextResponse.json({
    resume: { ...resume, dossier: dossierTransactions(nom) },
    profil: aJour,
    transferts: observerTransferts(livre, 'celi'),
  });
}

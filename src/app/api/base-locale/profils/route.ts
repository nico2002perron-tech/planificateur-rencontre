import { NextRequest, NextResponse } from 'next/server';
import { estLocal } from '@/lib/base-locale/mode';
import { listerProfils, lireProfil, ecrireProfil, profilPourClient, nomPour } from '@/lib/profils/stockage';
import { resumeCeli } from '@/lib/profils/resume';
import type { ProfilClient } from '@/lib/profils/types';
import { badgesProfil, questionsRencontre, resumeBadges } from '@/lib/profils/badges';
import { deriverComptes } from '@/lib/profils/comptes';
import { lireDernierReleve, lireHistorique } from '@/lib/profils/historique';

// Profils fiscaux — LOCAL SEULEMENT. 404 hors local avant toute autre chose :
// on ne confirme même pas l'existence de la route.
async function garde() {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });
  return null;
}

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

  // La liste porte le RÉSUMÉ DÉRIVÉ de chaque profil : c'est ce que le
  // planificateur regarde pour valider que les chiffres collent à ce qu'il
  // sait de ses clients. Sans lui, il devrait ouvrir chaque dossier.
  const annee = Number.parseInt(date.slice(0, 4), 10);
  const profils = await listerProfils();
  const avecResume = [];
  for (const p of profils) {
    const complet = await lireProfil(p.id);
    const nomClient = p.nom ?? (await nomPour(p.id));
    const badges = complet ? badgesProfil(complet, date) : [];

    // LES COMPTES SONT DÉRIVÉS ICI, pas lus dans le profil — même raison que
    // le résumé CELI : une jointure figée ne bénéficierait d'aucune correction
    // future et rien ne signalerait qu'elle est périmée.
    let comptes: Awaited<ReturnType<typeof deriverComptes>> | null = null;
    if (nomClient) {
      const releve = await lireDernierReleve(nomClient);
      if (releve) {
        comptes = deriverComptes(releve.texte, await lireHistorique(nomClient), {
          dateReleve: releve.dateReleve,
        });
      }
    }

    avecResume.push({
      ...p,
      celi: complet && nomClient ? await resumeCeli(complet, nomClient, annee) : null,
      badges,
      questions: questionsRencontre(badges),
      compteurs: resumeBadges(badges),
      comptes,
    });
  }
  return NextResponse.json({ profils: avecResume });
}

export async function PUT(req: NextRequest) {
  const refus = await garde();
  if (refus) return refus;

  const profil = (await req.json()) as ProfilClient;
  if (!profil?.id) return NextResponse.json({ error: 'Profil sans identifiant' }, { status: 400 });
  const date = new Date().toISOString().slice(0, 10);
  return NextResponse.json({ profil: await ecrireProfil(profil, date) });
}

// LA SÉLECTION DES STRATÉGIES — LOCAL SEULEMENT.
//
// Le moteur DÉTECTE cinq pistes ; le planificateur choisit lesquelles vont sous
// les yeux du client. Rien n'est coché par défaut : une piste pertinente sur
// papier peut être inopportune en rencontre pour des raisons que le moteur ne
// connaît pas.
//
// Route DÉDIÉE plutôt que le PUT des profils, qui écrit sans validation ce
// qu'on lui donne : ici on ne touche qu'un champ, et on refuse tout
// identifiant qui n'est pas au catalogue.
import { NextRequest, NextResponse } from 'next/server';
import { estLocal } from '@/lib/base-locale/mode';
import { lireProfil, ecrireProfil, profilPourClient, nomPour } from '@/lib/profils/stockage';
import { parametresReee } from '@/lib/profils/parametres-fiscaux';
import { analyser } from '@/lib/profils/strategies';
import { hydraterProfil } from '@/lib/profils/hydrater';

export async function GET(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 });

  const profil = await lireProfil(id);
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  const jour = new Date().toISOString().slice(0, 10);
  const annee = Number.parseInt(jour.slice(0, 4), 10);
  const resultat = analyser(await hydraterProfil(profil, await nomPour(id), annee), null, jour, parametresReee(annee));
  return NextResponse.json({
    constats: resultat.constats,
    angleMort: resultat.angleMort,
    revisionFiscalisteRequise: resultat.revisionFiscalisteRequise,
    selection: profil.selectionStrategies ?? { strategies: [], dateSelection: null },
  });
}

export async function POST(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  const { id, nom, strategies } = (await req.json()) as {
    id?: string; nom?: string; strategies?: unknown;
  };
  if (!Array.isArray(strategies) || strategies.some((s) => typeof s !== 'string')) {
    return NextResponse.json({ error: 'Sélection invalide' }, { status: 400 });
  }

  const jour = new Date().toISOString().slice(0, 10);
  const profil = id ? await lireProfil(id) : nom ? await profilPourClient(nom, jour) : null;
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  // ON NE FAIT PAS CONFIANCE À LA LISTE REÇUE. Seuls les identifiants que le
  // moteur a réellement produits pour CE profil sont retenus : une stratégie
  // inventée, ou une qui ne s'applique pas à ce client, ne doit pas pouvoir
  // s'inscrire dans un profil et ressortir un jour dans un PDF.
  const nomClient = nom ?? (await nomPour(profil.id));
  const annee = Number.parseInt(jour.slice(0, 4), 10);
  const hydrate = await hydraterProfil(profil, nomClient, annee);
  const connues = new Set(analyser(hydrate, null, jour, parametresReee(annee)).constats.map((c) => c.strategie));
  const retenues = (strategies as string[]).filter((s) => connues.has(s));

  profil.selectionStrategies = {
    strategies: retenues,
    // UNE SÉLECTION NON DATÉE NE VAUT RIEN — même règle que pour un transfert
    // résolu. On doit pouvoir dire « ces cases ont été cochées le 5 août,
    // avant la rencontre du 6 ». Une liste vidée n'a plus de date.
    dateSelection: retenues.length > 0 ? jour : null,
  };

  const ecrit = await ecrireProfil(profil, jour);
  return NextResponse.json({
    selection: ecrit.selectionStrategies,
    refusees: (strategies as string[]).filter((s) => !connues.has(s)),
    nom: profil.id ? await nomPour(profil.id) : null,
  });
}

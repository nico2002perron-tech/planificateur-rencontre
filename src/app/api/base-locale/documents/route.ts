import { NextResponse } from 'next/server';
import { estLocal } from '@/lib/base-locale/mode';
import { racineBaseLocale } from '@/lib/base-locale/chemins';
import { inventorierDocuments } from '@/lib/base-locale/inventaire';

// L'inventaire de la base locale — noms de clients en clair, donc :
//   · 404 hors exécution locale (la route n'existe pas, du point de vue de
//     Vercel : on ne confirme même pas son existence) ;
//   · session obligatoire par-dessus, comme la route des cours cibles.
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
export async function GET() {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  const clients = await inventorierDocuments();
  return NextResponse.json({ racine: racineBaseLocale(), clients });
}

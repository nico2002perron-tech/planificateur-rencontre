import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { estLocal } from '@/lib/base-locale/mode';
import { racineBaseLocale } from '@/lib/base-locale/chemins';
import { inventorierDocuments } from '@/lib/base-locale/inventaire';

// L'inventaire de la base locale — noms de clients en clair, donc :
//   · 404 hors exécution locale (la route n'existe pas, du point de vue de
//     Vercel : on ne confirme même pas son existence) ;
//   · session obligatoire par-dessus, comme la route des cours cibles.
export async function GET() {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clients = await inventorierDocuments();
  return NextResponse.json({ racine: racineBaseLocale(), clients });
}

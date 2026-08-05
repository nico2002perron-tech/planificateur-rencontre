// LE COLLAGE D'UN RELEVÉ DE POSITIONS — route serveur dédiée, LOCAL SEULEMENT.
//
// Pourquoi une route à part plutôt que le PUT des profils : la jointure
// suffixe → numéro complet a besoin du GRAND LIVRE, qui est `server-only`. Elle
// ne peut donc pas se faire dans le navigateur. Et le PUT des profils écrit ce
// qu'on lui donne sans validation : lui laisser recevoir des comptes construits
// côté client reviendrait à persister une jointure décidée hors de portée du
// livre, dans la clé durable dont tout le reste dépend.
import { NextRequest, NextResponse } from 'next/server';
import { estLocal } from '@/lib/base-locale/mode';
import { archiverReleve, lireHistorique } from '@/lib/profils/historique';
import { deriverComptes } from '@/lib/profils/comptes';

export async function POST(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  const { nomClient, texte } = (await req.json()) as { nomClient?: string; texte?: string };
  if (!nomClient?.trim()) return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 });
  if (!texte?.trim()) return NextResponse.json({ error: 'Collage vide' }, { status: 400 });

  const horodatage = new Date().toISOString().slice(0, 10);
  const { chemin, dateReleve } = await archiverReleve({ nomClient, texte, horodatage });
  const livre = await lireHistorique(nomClient);
  const resultat = deriverComptes(texte, livre, { dateReleve });

  if (resultat.multiClients) {
    return NextResponse.json({
      chemin,
      refus:
        'Ce collage porte plusieurs clients (séparateurs « ### »). La jointure est refusée : ' +
        'le suffixe « A » de deux clients fusionnerait en un seul compte. Collez un client à la fois.',
      comptes: [], aTrancher: [],
    });
  }

  return NextResponse.json({
    chemin,
    dateReleve,
    ignorees: resultat.ignorees,
    comptes: resultat.comptes,
    aTrancher: resultat.aTrancher,
    // Ce que le livre ne peut PAS confirmer, dit explicitement plutôt que
    // laissé à l'interprétation d'un `null`.
    livreVide: livre.length === 0,
  });
}

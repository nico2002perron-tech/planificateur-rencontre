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

  // ON VALIDE AVANT D'ARCHIVER — corrigé le 17 août 2026.
  //
  // Cette route archivait le collage comme relevé AVANT de le lire, donc même
  // quand elle le refusait ensuite. Or « le relevé le plus récent fait foi » :
  // un texte illisible, ou un export multi-clients, devenait le relevé de
  // référence et OMBRAGEAIT le bon relevé de la veille. À la lecture suivante,
  // `hydraterProfil` n'en tirait aucun compte, les stratégies retombaient
  // toutes « indisponible » et le résumé CELI se vidait — en silence, chaque
  // ligne prise isolément restant exacte. C'est exactement la garde posée dans
  // `nourrirBaseLocale` le 12 août ; la route sœur ne l'avait pas.
  //
  // Cas multi-clients aggravant : les positions d'AUTRES clients se rangeaient
  // dans le dossier d'un seul — un autre contribuable dans le mauvais dossier.
  const horodatage = new Date().toISOString().slice(0, 10);
  const livre = await lireHistorique(nomClient);
  const resultat = deriverComptes(texte, livre, { dateReleve: horodatage });

  if (resultat.multiClients) {
    return NextResponse.json({
      refus:
        'Ce collage porte plusieurs clients (séparateurs « ### »). La jointure est refusée : ' +
        'le suffixe « A » de deux clients fusionnerait en un seul compte. Collez un client à la fois. ' +
        'Rien n’a été archivé — le relevé précédent reste en place.',
      comptes: [], aTrancher: [],
    });
  }

  if (resultat.comptes.length === 0) {
    return NextResponse.json({
      refus:
        'Aucune position n’a pu être lue dans ce collage. Rien n’a été archivé : le relevé précédent ' +
        'reste en place plutôt que d’être masqué par un texte illisible. Vérifiez que les colonnes ' +
        'du relevé Croesus sont bien collées (devise, type, quantité, description, compte, symbole…).',
      comptes: [], aTrancher: [], ignorees: resultat.ignorees,
    });
  }

  // Le collage est lisible : il peut devenir le relevé de référence.
  const { chemin, dateReleve } = await archiverReleve({ nomClient, texte, horodatage });

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

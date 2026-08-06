// LA RÉPONSE À LA QUESTION DE RENCONTRE N° 1 — LOCAL SEULEMENT.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CETTE ROUTE CORRIGE (5 août 2026).
//
// `consolidation.comptesExternes` et `consolidation.historiqueExterne`
// commandent tout : la portée des constats, et la condition 2 des droits CELI.
// L'écran posait les deux questions depuis le début — et rien dans toute
// l'application ne permettait d'y répondre.
//
// Pire : le seul chemin d'écriture existant (résolution d'un transfert
// « externe ») ne pouvait mettre `historiqueExterne` qu'à `'deja-eu'`. La
// réponse `'jamais'`, qui est justement CELLE QUI DÉBLOQUE le calcul d'un
// montant plutôt qu'une borne, était inatteignable. Tous les clients restaient
// donc en borne, pour toujours, quoi qu'ils répondent en rencontre.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { estLocal } from '@/lib/base-locale/mode';
import { lireProfil, ecrireProfil } from '@/lib/profils/stockage';
import type { ReponseTernaire, HistoriqueExterne } from '@/lib/profils/types';

const TERNAIRE: ReponseTernaire[] = ['oui', 'non', 'inconnu'];
const HISTORIQUE: HistoriqueExterne[] = ['jamais', 'deja-eu', 'inconnu'];

export async function POST(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  const { id, comptesExternes, historiqueExterne, detailsExternes } = (await req.json()) as {
    id?: string;
    comptesExternes?: string;
    historiqueExterne?: string;
    detailsExternes?: string;
  };
  if (!id) return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 });

  const profil = await lireProfil(id);
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  // On n'accepte que les trois valeurs de chaque énumération. Un champ absent
  // laisse la valeur en place : l'écran envoie une question à la fois.
  if (comptesExternes !== undefined) {
    if (!TERNAIRE.includes(comptesExternes as ReponseTernaire)) {
      return NextResponse.json({ error: 'Réponse invalide' }, { status: 400 });
    }
    profil.consolidation.comptesExternes = comptesExternes as ReponseTernaire;
  }
  if (historiqueExterne !== undefined) {
    if (!HISTORIQUE.includes(historiqueExterne as HistoriqueExterne)) {
      return NextResponse.json({ error: 'Réponse invalide' }, { status: 400 });
    }
    profil.consolidation.historiqueExterne = historiqueExterne as HistoriqueExterne;
  }
  if (detailsExternes !== undefined) {
    profil.consolidation.detailsExternes = detailsExternes.trim() || null;
  }

  const jour = new Date().toISOString().slice(0, 10);

  // LA DATE EST LE CŒUR DE CE CHAMP, pas un accessoire. « Le client a confirmé
  // n'avoir aucun compte ailleurs » ne vaut que daté : la réponse d'il y a
  // trois ans ne dit rien de sa situation d'aujourd'hui, et `badges.ts` la
  // redemande passé douze mois. Une réponse remise à « inconnu » perd sa date.
  const repondu =
    profil.consolidation.comptesExternes !== 'inconnu' ||
    profil.consolidation.historiqueExterne !== 'inconnu';
  profil.consolidation.dateConfirmation = repondu ? jour : null;

  const ecrit = await ecrireProfil(profil, jour);
  return NextResponse.json({ consolidation: ecrit.consolidation });
}

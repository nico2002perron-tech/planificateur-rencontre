import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

/**
 * Coffre client — paramètres de chiffrement par conseiller.
 *
 * Ce que le serveur stocke et renvoie est NON secret :
 *   • kdf_salt      : sel de dérivation (PBKDF2). Public par conception.
 *   • name_verifier : un court texte chiffré servant à valider la phrase de
 *                     passe au déverrouillage. Inutile sans la phrase de passe.
 *
 * Le serveur ne voit JAMAIS la phrase de passe ni les clés dérivées — tout le
 * chiffrement se fait dans le navigateur du conseiller.
 */

// GET — récupère le sel + verifier du conseiller courant (null si jamais configuré).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // UN COFFRE NON CONFIGURÉ N'EST PAS UNE ERREUR — corrigé le 17 août 2026.
  //
  // Vu en éprouvant la génération de documents : cette route rendait 500 sur
  // toute session dont l'identifiant n'est pas résolu, et `.single()` échoue
  // aussi quand la ligne n'existe pas encore. Deux conséquences : la case
  // « Enregistrer au Journal » se désarme en silence à côté du bouton de
  // génération, et le message d'erreur brut de la base — « invalid input
  // syntax for type uuid » — remontait jusqu'au navigateur, ce qui décrit le
  // schéma à qui regarde. On répond « pas configuré », qui est la vérité.
  const identifiant = session.user?.id;
  if (!identifiant) {
    return NextResponse.json({ salt: null, verifier: null, configured: false });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('kdf_salt, name_verifier')
    .eq('id', identifiant)
    .maybeSingle();

  if (error) {
    console.error('[vault] lecture impossible :', error.message);
    return NextResponse.json({ error: 'Coffre indisponible' }, { status: 500 });
  }

  return NextResponse.json({
    salt: data?.kdf_salt ?? null,
    verifier: data?.name_verifier ?? null,
    configured: Boolean(data?.kdf_salt && data?.name_verifier),
  });
}

// POST — configuration initiale de la phrase de passe (une seule fois).
// On refuse d'écraser un sel existant : changer le sel rendrait illisibles
// toutes les captures déjà chiffrées. (Le changement de phrase de passe est un
// flux distinct, non couvert ici.)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const salt = typeof body.salt === 'string' ? body.salt.trim() : '';
  const verifier = typeof body.verifier === 'string' ? body.verifier.trim() : '';
  if (!salt || !verifier) {
    return NextResponse.json({ error: 'salt et verifier requis' }, { status: 400 });
  }

  const identifiant = session.user?.id;
  if (!identifiant) {
    return NextResponse.json({ error: 'Session sans identifiant' }, { status: 401 });
  }

  const supabase = createClient();

  // Refuse si déjà configuré.
  const { data: existing } = await supabase
    .from('users')
    .select('kdf_salt')
    .eq('id', identifiant)
    .maybeSingle();

  if (existing?.kdf_salt) {
    return NextResponse.json({ error: 'Coffre déjà configuré' }, { status: 409 });
  }

  const { error } = await supabase
    .from('users')
    .update({ kdf_salt: salt, name_verifier: verifier })
    .eq('id', identifiant);

  // Le détail de l'erreur reste au journal serveur : un message de base de
  // données renvoyé au navigateur décrit le schéma à qui regarde.
  if (error) {
    console.error('[vault] écriture impossible :', error.message);
    return NextResponse.json({ error: 'Configuration du coffre impossible' }, { status: 500 });
  }
  return NextResponse.json({ success: true }, { status: 201 });
}

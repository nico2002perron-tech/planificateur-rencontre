import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTeamCaptains, type Recipient } from '@/lib/tournament/recipients';
import { sendEventNotice } from '@/lib/email';

// Un avis peut représenter tous les inscrits d'un événement (~100 courriels,
// par lots de 100) : même marge d'exécution que l'envoi d'horaire.
export const maxDuration = 60;

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

const valide = (e?: string | null): e is string => !!e && !e.toLowerCase().endsWith('.sans-courriel');

/**
 * POST /api/events/[id]/avis — avis ponctuel aux participants
 * (correction d'information, report pour la pluie, changement de lieu…).
 *
 * Deux façons de s'authentifier :
 *   - session de l'organisateur (ou admin) ;
 *   - en-tête `Authorization: Bearer <CRON_SECRET>`, pour un envoi piloté hors navigateur.
 *
 * Corps : { titre, paragraphes[], alerte?, cible?: 'tous'|'capitaines',
 *           testEmail?: n'envoyer qu'à cette adresse, simulation?: ne rien envoyer }
 *
 * `simulation: true` retourne la liste exacte des destinataires SANS rien envoyer :
 * on vérifie toujours la cible avant d'écrire à des dizaines de personnes.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = createClient();

  const parSecret = request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!parSecret) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => null);
  const titre = typeof body?.titre === 'string' ? body.titre.trim() : '';
  const paragraphes = Array.isArray(body?.paragraphes)
    ? body.paragraphes.filter((p: unknown): p is string => typeof p === 'string' && p.trim() !== '')
    : [];
  if (!titre || paragraphes.length === 0) {
    return NextResponse.json({ error: 'Il faut un « titre » et au moins un paragraphe.' }, { status: 400 });
  }
  const alerte = typeof body?.alerte === 'string' && body.alerte.trim() ? body.alerte.trim() : undefined;
  const cible: 'tous' | 'capitaines' = body?.cible === 'capitaines' ? 'capitaines' : 'tous';
  const simulation = body?.simulation === true;
  const testEmail = typeof body?.testEmail === 'string' ? body.testEmail.trim() : '';

  const { data: event } = await supabase
    .from('events')
    .select('id, title, date, time, location, contact_email, contact_phone')
    .eq('id', eventId)
    .single();
  if (!event) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });

  // ── Destinataires ──
  const { data: teams } = await supabase.from('event_teams').select('id, captain_email').eq('event_id', eventId);
  const teamIds = (teams || []).map(t => t.id);

  let destinataires: Recipient[] = [];
  if (cible === 'capitaines') {
    destinataires = [...(await fetchTeamCaptains(supabase, teamIds)).values()];
  } else {
    // Exactement la même règle que le rappel automatique : inscrits confirmés
    // + membres d'équipe confirmés, dédupliqués par courriel.
    const parCourriel = new Map<string, Recipient>();
    const { data: regs } = await supabase
      .from('event_registrations')
      .select('first_name, email')
      .eq('event_id', eventId)
      .eq('status', 'confirmed');
    for (const r of regs || []) {
      if (valide(r.email)) parCourriel.set(r.email.toLowerCase(), { email: r.email, firstName: r.first_name || '' });
    }
    if (teamIds.length) {
      const { data: members } = await supabase
        .from('event_team_members')
        .select('first_name, email')
        .in('team_id', teamIds)
        .eq('status', 'confirmed');
      for (const m of members || []) {
        if (valide(m.email)) parCourriel.set(m.email.toLowerCase(), { email: m.email, firstName: m.first_name || '' });
      }
    }
    destinataires = [...parCourriel.values()];
  }

  // Envoi d'essai : une seule adresse, le reste du courriel est identique.
  if (testEmail) {
    const connu = destinataires.find(d => d.email.toLowerCase() === testEmail.toLowerCase());
    destinataires = [{ email: testEmail, firstName: connu?.firstName || '' }];
  }

  if (simulation) {
    return NextResponse.json({
      ok: true,
      simulation: true,
      cible,
      destinataires: destinataires.length,
      adresses: destinataires.map(d => d.email),
      sujet: `${titre} – ${event.title}`,
    });
  }

  const { envoyes, invalides, erreurs } = await sendEventNotice(event, destinataires, { titre, paragraphes, alerte });
  return NextResponse.json({
    ok: erreurs.length === 0,
    cible,
    destinataires: destinataires.length,
    envoyes,
    // Adresses malformées dans les inscriptions : écartées pour ne pas faire
    // rejeter le lot. À corriger à la source, sinon ces gens n'ont jamais rien.
    ...(invalides.length ? { invalides } : {}),
    ...(erreurs.length ? { erreurs } : {}),
  });
}

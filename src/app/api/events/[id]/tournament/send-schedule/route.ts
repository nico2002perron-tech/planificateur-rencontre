import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState } from '@/lib/tournament/state';
import { sendTournamentSchedule, type TeamScheduleMatch } from '@/lib/email';

// L'envoi à toutes les équipes peut représenter ~100 courriels (par lots de 100,
// donc peu d'appels API, mais on se donne de la marge sur le temps d'exécution).
export const maxDuration = 60;

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// POST /api/events/[id]/tournament/send-schedule — le bouton « Envoyer l'horaire à tous ».
// Chaque joueur confirmé reçoit l'horaire de SON équipe + le lien de la page en direct.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Version PUBLIÉE (includeDraft=false) : les courriels disent exactement ce
  // que le site affiche — jamais un brouillon en cours de réarrangement.
  const state = await fetchTournamentState(supabase, eventId, false);
  if (!state || !state.config) {
    return NextResponse.json({ error: 'Aucun tournoi configuré pour cet événement.' }, { status: 400 });
  }
  if (state.config.status !== 'published' || state.matches.length === 0) {
    return NextResponse.json({ error: 'Mets d\'abord l\'horaire en ligne (« Mettre à jour le site ») avant de l\'envoyer aux équipes.' }, { status: 400 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, date, time, location, contact_email, contact_phone')
    .eq('id', eventId)
    .single();
  if (!event) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });

  // Membres confirmés de chaque équipe
  const teamIds = state.teams.map(t => t.id);
  const { data: members } = await supabase
    .from('event_team_members')
    .select('team_id, first_name, email')
    .in('team_id', teamIds)
    .eq('status', 'confirmed');

  const teamNames = new Map(state.teams.map(t => [t.id, t.name]));
  const appUrl = process.env.NEXTAUTH_URL || 'https://planificateur-rencontre.vercel.app';
  const liveUrl = `${appUrl}/tournoi/${eventId}`;

  let emailsSent = 0;
  let teamsNotified = 0;
  const teamsWithoutMatches: string[] = [];

  for (const team of state.teams) {
    const teamMatches: TeamScheduleMatch[] = state.matches
      .filter(m => m.team_a_id === team.id || m.team_b_id === team.id)
      .map(m => {
        const opponentId = m.team_a_id === team.id ? m.team_b_id : m.team_a_id;
        const opponentSource = m.team_a_id === team.id ? m.source_b : m.source_a;
        return {
          matchNumber: m.match_number,
          scheduledTime: m.scheduled_time,
          court: m.court,
          opponentName: (opponentId ? teamNames.get(opponentId) : '') || opponentSource || '',
          phase: m.phase,
        };
      });

    if (teamMatches.length === 0) {
      teamsWithoutMatches.push(team.name);
      continue;
    }

    // Dédupliqués par courriel (un capitaine aussi joueur ne reçoit qu'un envoi)
    const recipients = new Map<string, { email: string; firstName: string }>();
    for (const m of members || []) {
      if (m.team_id !== team.id || !m.email) continue;
      recipients.set(m.email.toLowerCase(), { email: m.email, firstName: m.first_name || '' });
    }
    if (recipients.size === 0) continue;

    const sent = await sendTournamentSchedule(
      { id: event.id, title: event.title, date: event.date, time: event.time, location: event.location, contact_email: event.contact_email, contact_phone: event.contact_phone },
      team.name,
      [...recipients.values()],
      teamMatches,
      `${liveUrl}?equipe=${team.id}`,
    );
    emailsSent += sent;
    if (sent > 0) teamsNotified++;
  }

  await supabase
    .from('event_tournaments')
    .update({ schedule_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('event_id', eventId);

  return NextResponse.json({ ok: true, emailsSent, teamsNotified, teamsWithoutMatches });
}

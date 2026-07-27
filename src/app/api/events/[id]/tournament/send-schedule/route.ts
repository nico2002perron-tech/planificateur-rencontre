import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState } from '@/lib/tournament/state';
import { fetchTeamCaptains } from '@/lib/tournament/recipients';
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

  // Un seul destinataire par équipe : le CAPITAINE (décidé avec Nicolas — volume minimal).
  const teamIds = state.teams.map(t => t.id);
  const captains = await fetchTeamCaptains(supabase, teamIds);

  const teamNames = new Map(state.teams.map(t => [t.id, t.name]));
  const appUrl = process.env.NEXTAUTH_URL || 'https://planificateur-rencontre.vercel.app';
  const liveUrl = `${appUrl}/tournoi/${eventId}`;

  let emailsSent = 0;
  let teamsNotified = 0;
  const teamsWithoutMatches: string[] = [];

  // Le jour n'est affiché dans le courriel que si le tournoi a plusieurs journées
  const matchDate = (m: { scheduled_date: string }) => m.scheduled_date || state.event.date || '';
  const multiDay = new Set(state.matches.map(matchDate)).size > 1;
  const dayLabel = (d: string) => d
    ? new Date(d + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  for (const team of state.teams) {
    const teamMatches: TeamScheduleMatch[] = state.matches
      .filter(m => m.team_a_id === team.id || m.team_b_id === team.id)
      .sort((x, y) => `${matchDate(x)}|${x.scheduled_time}`.localeCompare(`${matchDate(y)}|${y.scheduled_time}`))
      .map(m => {
        const opponentId = m.team_a_id === team.id ? m.team_b_id : m.team_a_id;
        const opponentSource = m.team_a_id === team.id ? m.source_b : m.source_a;
        return {
          matchNumber: m.match_number,
          dayLabel: multiDay ? dayLabel(matchDate(m)) : undefined,
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

    // Capitaine seulement — 1 courriel par équipe.
    const captain = captains.get(team.id);
    if (!captain) continue;

    const sent = await sendTournamentSchedule(
      { id: event.id, title: event.title, date: event.date, time: event.time, location: event.location, contact_email: event.contact_email, contact_phone: event.contact_phone },
      team.name,
      [captain],
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

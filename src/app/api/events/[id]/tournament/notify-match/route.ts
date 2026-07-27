import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState, type TournamentMatch } from '@/lib/tournament/state';
import { fetchTeamCaptains } from '@/lib/tournament/recipients';
import { sendMatchResultEmails, type NextMatchInfo } from '@/lib/email';

export const maxDuration = 60;

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// POST /api/events/[id]/tournament/notify-match — le « 1 tap » du jour J.
// Après la saisie d'un pointage, avise les joueurs des DEUX équipes :
// résultat + leur prochaine partie respective (heure/terrain/adversaire,
// calculée sur l'état VIVANT, séries déjà propagées) + bracket s'il y en a un.
// Body : { matchId }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const matchId = String(body.matchId || '');
  if (!matchId) return NextResponse.json({ error: 'matchId requis' }, { status: 400 });

  const state = await fetchTournamentState(supabase, eventId, true);
  if (!state || !state.config) return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 });

  const match = state.matches.find(m => m.id === matchId);
  if (!match) return NextResponse.json({ error: 'Partie introuvable' }, { status: 404 });
  if (match.status !== 'finished' || match.score_a === null || match.score_b === null) {
    return NextResponse.json({ error: 'Saisis d\'abord le pointage de cette partie.' }, { status: 400 });
  }
  if (!match.team_a_id || !match.team_b_id) {
    return NextResponse.json({ error: 'Les deux équipes de cette partie doivent être connues.' }, { status: 400 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, date, time, location, contact_email, contact_phone')
    .eq('id', eventId)
    .single();
  if (!event) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });

  const teamNames = new Map(state.teams.map(t => [t.id, t.name]));
  const nameOf = (id: string | null, source: string) => (id ? teamNames.get(id) : '') || source || 'À déterminer';
  const matchDate = (m: TournamentMatch) => m.scheduled_date || state.event.date || '';
  const multiDay = new Set(state.matches.map(matchDate)).size > 1;
  const dayLabel = (d: string) => d
    ? new Date(d + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  // Prochaine partie d'une équipe : la plus tôt (jour+heure) encore à jouer
  const nextFor = (teamId: string): NextMatchInfo | null => {
    const next = state.matches
      .filter(m => m.id !== match.id
        && (m.team_a_id === teamId || m.team_b_id === teamId)
        && m.status !== 'finished' && m.status !== 'cancelled')
      .sort((a, b) => `${matchDate(a)}|${a.scheduled_time}`.localeCompare(`${matchDate(b)}|${b.scheduled_time}`))[0];
    if (!next) return null;
    const opponentId = next.team_a_id === teamId ? next.team_b_id : next.team_a_id;
    const opponentSource = next.team_a_id === teamId ? next.source_b : next.source_a;
    return {
      dayLabel: multiDay ? dayLabel(matchDate(next)) : undefined,
      time: next.scheduled_time,
      court: next.court,
      opponent: nameOf(opponentId, opponentSource),
      phase: next.phase,
    };
  };

  // Capitaine seulement, un par équipe (décidé avec Nicolas — volume minimal).
  const captains = await fetchTeamCaptains(supabase, [match.team_a_id, match.team_b_id]);

  const appUrl = process.env.NEXTAUTH_URL || 'https://planificateur-rencontre.vercel.app';
  const hasPlayoffs = state.matches.some(m => m.phase !== 'garantie');
  const bracketImageUrl = hasPlayoffs
    ? `${appUrl}/api/events/${eventId}/tournament/bracket?ts=${Date.now()}`
    : undefined;

  const sides: { teamId: string; scoreFor: number; scoreAgainst: number; opponentId: string }[] = [
    { teamId: match.team_a_id, scoreFor: match.score_a, scoreAgainst: match.score_b, opponentId: match.team_b_id },
    { teamId: match.team_b_id, scoreFor: match.score_b, scoreAgainst: match.score_a, opponentId: match.team_a_id },
  ];

  let emailsSent = 0;
  const notified: string[] = [];
  for (const side of sides) {
    const captain = captains.get(side.teamId);
    if (!captain) continue;

    const sent = await sendMatchResultEmails(
      { id: event.id, title: event.title, date: event.date, time: event.time, location: event.location, contact_email: event.contact_email, contact_phone: event.contact_phone },
      teamNames.get(side.teamId) || '',
      [captain],
      { opponent: teamNames.get(side.opponentId) || '', scoreFor: side.scoreFor, scoreAgainst: side.scoreAgainst },
      nextFor(side.teamId),
      `${appUrl}/tournoi/${eventId}?equipe=${side.teamId}`,
      bracketImageUrl,
    );
    emailsSent += sent;
    if (sent > 0) notified.push(teamNames.get(side.teamId) || '');
  }

  return NextResponse.json({ ok: true, emailsSent, notified });
}

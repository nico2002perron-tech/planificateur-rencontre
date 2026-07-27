import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState } from '@/lib/tournament/state';
import { renderTournamentSheet } from '@/lib/pdf/tournament-sheet';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// GET /api/events/[id]/tournament/pdf — « Feuille de tournoi » (horaire + cases de
// pointage + classement avec la ligne des séries + bracket + champion), à imprimer
// vierge ou en direct. Organisateur seulement (état vivant, includeDraft=true).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const state = await fetchTournamentState(supabase, eventId, true);
  if (!state || !state.config) {
    return NextResponse.json({ error: 'Aucun tournoi pour cet événement' }, { status: 404 });
  }

  const hasScores = state.matches.some(m => m.status === 'finished');
  const updatedLabel = hasScores
    ? `Mis à jour le ${new Date().toLocaleString('fr-CA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
    : undefined; // pas de pointage encore → feuille vierge à imprimer

  const buffer = await renderTournamentSheet({
    event: state.event,
    config: {
      guaranteed_games: state.config.guaranteed_games,
      playoffs_enabled: state.config.playoffs_enabled,
      playoffs_team_count: state.config.playoffs_team_count,
      points_win: state.config.points_win,
      points_tie: state.config.points_tie,
      points_loss: state.config.points_loss,
    },
    teams: state.teams.map(t => ({ id: t.id, name: t.name })),
    matches: state.matches,
    standings: state.standings,
    updatedLabel,
  });

  const slug = (state.event.title || 'tournoi').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tournoi';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="feuille-${slug}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTournamentState, MATCH_COLUMNS } from '@/lib/tournament/state';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// POST /api/events/[id]/tournament/publish — « Mettre à jour le site ».
// Prend une PHOTO des parties vivantes → published_snapshot. C'est cette photo
// (et rien d'autre) que la page publique affiche : l'organisateur peut donc
// réarranger son horaire en paix et publier quand il est prêt.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const supabase = createClient();
  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: config } = await supabase
    .from('event_tournaments')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!config) {
    return NextResponse.json({ error: 'Aucun tournoi configuré — génère d\'abord un horaire.' }, { status: 400 });
  }

  const { data: matches, error: matchError } = await supabase
    .from('event_matches')
    .select(MATCH_COLUMNS)
    .eq('event_id', eventId)
    .order('match_number');
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });
  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: 'Aucune partie à publier — génère d\'abord un horaire.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('event_tournaments')
    .update({
      status: 'published',
      published_snapshot: matches,
      published_at: now,
      updated_at: now,
    })
    .eq('event_id', eventId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const state = await fetchTournamentState(supabase, eventId, true);
  return NextResponse.json(state);
}

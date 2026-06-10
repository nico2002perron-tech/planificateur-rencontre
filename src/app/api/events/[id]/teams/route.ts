import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function corsJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  return response;
}

// GET /api/events/[id]/teams — Public team wall (no personal data: name, logo, spots only)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  // Only published events expose their team wall
  const { data: event } = await supabase
    .from('events')
    .select('id, status, registration_mode')
    .eq('id', id)
    .single();

  if (!event || event.status !== 'published') return corsJson({ error: 'Evenement introuvable' }, 404);
  if (event.registration_mode !== 'team' && event.registration_mode !== 'both') {
    return corsJson({ teams: [] }, 200);
  }

  const { data: teams } = await supabase
    .from('event_teams')
    .select('id, team_name, logo_url, max_members, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: true });

  const teamIds = (teams || []).map(t => t.id);
  const memberCounts: Record<string, number> = {};
  if (teamIds.length > 0) {
    const { data: members } = await supabase
      .from('event_team_members')
      .select('team_id')
      .in('team_id', teamIds)
      .eq('status', 'confirmed');
    (members || []).forEach(m => { memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1; });
  }

  return corsJson({
    teams: (teams || []).map(t => ({
      team_name: t.team_name,
      logo_url: t.logo_url || null,
      member_count: memberCounts[t.id] || 0,
      max_members: t.max_members,
    })),
  }, 200);
}

export async function OPTIONS() {
  return corsJson(null, 204);
}

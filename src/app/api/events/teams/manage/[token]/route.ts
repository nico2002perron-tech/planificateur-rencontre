import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function corsJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// GET /api/events/teams/manage/[token] — Captain views team members
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createClient();

  const { data: team, error } = await supabase
    .from('event_teams')
    .select('id, event_id, team_name, team_code, max_members, captain_email')
    .eq('manage_token', token)
    .single();

  if (error || !team) return corsJson({ error: 'Lien invalide' }, 404);

  const { data: members } = await supabase
    .from('event_team_members')
    .select('id, first_name, last_name, email, phone, skill_level, shirt_size, dietary_restrictions, is_captain, status, joined_at')
    .eq('team_id', team.id)
    .eq('status', 'confirmed')
    .order('is_captain', { ascending: false })
    .order('joined_at', { ascending: true });

  const { data: event } = await supabase
    .from('events')
    .select('title, date, time, location')
    .eq('id', team.event_id)
    .single();

  return corsJson({
    team_name: team.team_name,
    team_code: team.team_code,
    max_members: team.max_members,
    event: event || null,
    members: members || [],
    member_count: members?.length || 0,
  }, 200);
}

// DELETE /api/events/teams/manage/[token] — Captain removes a member
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('member_id');

  if (!memberId) return corsJson({ error: 'member_id requis' }, 400);

  // Verify token
  const { data: team, error } = await supabase
    .from('event_teams')
    .select('id')
    .eq('manage_token', token)
    .single();

  if (error || !team) return corsJson({ error: 'Lien invalide' }, 404);

  // Don't allow removing the captain
  const { data: member } = await supabase
    .from('event_team_members')
    .select('id, is_captain')
    .eq('id', memberId)
    .eq('team_id', team.id)
    .single();

  if (!member) return corsJson({ error: 'Membre introuvable' }, 404);
  if (member.is_captain) return corsJson({ error: 'Impossible de retirer le capitaine' }, 400);

  const { error: updateError } = await supabase
    .from('event_team_members')
    .update({ status: 'removed' })
    .eq('id', memberId)
    .eq('team_id', team.id);

  if (updateError) return corsJson({ error: updateError.message }, 500);

  return corsJson({ ok: true }, 200);
}

export async function OPTIONS() {
  return corsJson(null, 204);
}

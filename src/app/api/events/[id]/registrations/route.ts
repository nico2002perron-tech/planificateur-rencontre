import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// GET /api/events/[id]/registrations — Individual registrations + teams with members (creator or admin only)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();

  if (!(await checkPermission(supabase, id, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: registrations, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', id)
    .order('registered_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Teams + their members
  const { data: teams } = await supabase
    .from('event_teams')
    .select('id, team_name, team_code, captain_email, logo_url, max_members, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: true });

  const teamIds = (teams || []).map(t => t.id);
  let members: Record<string, unknown>[] = [];
  if (teamIds.length > 0) {
    const { data: memberRows } = await supabase
      .from('event_team_members')
      .select('*')
      .in('team_id', teamIds)
      .eq('status', 'confirmed')
      .order('joined_at', { ascending: true });
    members = memberRows || [];
  }

  const enrichedTeams = (teams || []).map(t => ({
    ...t,
    members: members.filter(m => m.team_id === t.id),
  }));

  return NextResponse.json({ registrations: registrations || [], teams: enrichedTeams });
}

// DELETE /api/events/[id]/registrations — Cancel a registration, remove a team member, or delete a whole team
// Body: { registration_id } OR { member_id } OR { team_id }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  if (!(await checkPermission(supabase, id, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (body.registration_id) {
    const { error } = await supabase
      .from('event_registrations')
      .update({ status: 'cancelled' })
      .eq('id', body.registration_id)
      .eq('event_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.member_id) {
    // Verify the member belongs to a team of this event
    const { data: member } = await supabase
      .from('event_team_members')
      .select('id, team_id, event_teams!inner(event_id)')
      .eq('id', body.member_id)
      .single();
    const teamEvent = member?.event_teams as unknown as { event_id: string } | undefined;
    if (!member || teamEvent?.event_id !== id) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 });
    }
    const { error } = await supabase
      .from('event_team_members')
      .update({ status: 'removed' })
      .eq('id', body.member_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.team_id) {
    // Delete the whole team (members removed via cascade or explicitly)
    const { data: team } = await supabase
      .from('event_teams')
      .select('id')
      .eq('id', body.team_id)
      .eq('event_id', id)
      .single();
    if (!team) return NextResponse.json({ error: 'Equipe introuvable' }, { status: 404 });

    await supabase.from('event_team_members').delete().eq('team_id', body.team_id);
    const { error } = await supabase.from('event_teams').delete().eq('id', body.team_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'registration_id, member_id ou team_id requis' }, { status: 400 });
}

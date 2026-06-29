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

// Supprime un fichier logo du bucket 'team-photos' a partir de son URL publique.
// Best-effort : sans effet si l'URL est vide ou hors du bucket, et n'echoue jamais la requete.
async function deleteLogoFile(supabase: SupabaseClient, logoUrl: string | null | undefined) {
  if (!logoUrl) return;
  const marker = '/team-photos/';
  const idx = logoUrl.indexOf(marker);
  if (idx === -1) return;
  const path = logoUrl.slice(idx + marker.length).split('?')[0];
  if (!path) return;
  try {
    await supabase.storage.from('team-photos').remove([path]);
  } catch {
    // fichier orphelin : on ignore, ce n'est pas bloquant
  }
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

// PATCH /api/events/[id]/registrations — Update a team's name and/or logo (creator or admin only)
// Body: { team_id, team_name?, logo_url? }  — logo_url: null removes the logo, omit to leave unchanged
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  if (!(await checkPermission(supabase, id, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!body.team_id) {
    return NextResponse.json({ error: 'team_id requis' }, { status: 400 });
  }

  // Verify the team belongs to this event
  const { data: team } = await supabase
    .from('event_teams')
    .select('id, logo_url')
    .eq('id', body.team_id)
    .eq('event_id', id)
    .single();
  if (!team) return NextResponse.json({ error: 'Equipe introuvable' }, { status: 404 });

  const updates: { team_name?: string; logo_url?: string | null } = {};

  if (typeof body.team_name === 'string') {
    const name = body.team_name.trim();
    if (!name) return NextResponse.json({ error: "Le nom de l'equipe ne peut pas etre vide" }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: 'Nom trop long (max 80 caracteres)' }, { status: 400 });
    updates.team_name = name;
  }

  if ('logo_url' in body) {
    updates.logo_url = body.logo_url || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('event_teams')
    .update(updates)
    .eq('id', body.team_id)
    .select('id, team_name, team_code, captain_email, logo_url, max_members, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nettoyage : si le logo a ete remplace ou retire, on supprime l'ancien fichier
  if ('logo_url' in updates && team.logo_url && team.logo_url !== updates.logo_url) {
    await deleteLogoFile(supabase, team.logo_url);
  }

  return NextResponse.json({ ok: true, team: updated });
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
      .select('id, logo_url')
      .eq('id', body.team_id)
      .eq('event_id', id)
      .single();
    if (!team) return NextResponse.json({ error: 'Equipe introuvable' }, { status: 404 });

    await supabase.from('event_team_members').delete().eq('team_id', body.team_id);
    const { error } = await supabase.from('event_teams').delete().eq('id', body.team_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await deleteLogoFile(supabase, team.logo_url);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'registration_id, member_id ou team_id requis' }, { status: 400 });
}

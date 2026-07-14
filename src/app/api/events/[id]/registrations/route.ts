import { NextRequest, NextResponse, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTeamCreatedEmail, sendTeamJoinedEmail, sendTeamMemberNotification } from '@/lib/email';
import { publishedTournamentUrl } from '@/lib/tournament/state';

const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://groupefinancierstefoy.com';

async function checkPermission(supabase: SupabaseClient, eventId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return !!event && event.created_by === userId;
}

// Code d'équipe lisible (préfixe tiré du nom + suffixe aléatoire), comme le flux public.
function generateCode(teamName: string): string {
  const prefix = teamName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

function generateToken(): string {
  return Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('');
}

// Normalise un genre : 'M' (gars) / 'F' (filles) / '' si non spécifié.
function normGender(g: unknown): string {
  return g === 'M' || g === 'F' ? g : '';
}

// Un courriel « placeholder » (.sans-courriel) désigne une personne sans adresse
// réelle : on ne lui envoie donc jamais de courriel.
function isRealEmail(email: string | null | undefined): email is string {
  return !!email && !email.endsWith('.sans-courriel');
}

interface PersonInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  skill_level?: string;
  shirt_size?: string;
  dietary_restrictions?: string;
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

// POST /api/events/[id]/registrations — L'organisateur ajoute lui-même une équipe
// ou un membre (comme une inscription manuelle), et déclenche les MÊMES courriels
// que le flux public. Corps :
//   { action: 'create_team', team_name, captain: {…}, logo_url?, send_email? }
//   { action: 'add_member',  team_id, member: {…}, send_email?, notify_captain? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  if (!(await checkPermission(supabase, id, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, date, time, location, contact_email, contact_phone, registration_mode, team_size')
    .eq('id', id)
    .single();
  if (!event) return NextResponse.json({ error: 'Evenement introuvable' }, { status: 404 });
  if (event.registration_mode !== 'team' && event.registration_mode !== 'both') {
    return NextResponse.json({ error: 'Cet evenement ne supporte pas les equipes' }, { status: 400 });
  }

  const maxMembers = event.team_size || 10;
  const eventInfo = {
    id: event.id, title: event.title, date: event.date, time: event.time,
    location: event.location, contact_email: event.contact_email, contact_phone: event.contact_phone,
  };

  // ── Créer une équipe (avec son capitaine) ──
  if (body.action === 'create_team') {
    const teamName = (body.team_name || '').trim();
    const cap: PersonInput = body.captain || {};
    if (!teamName) return NextResponse.json({ error: "Nom d'equipe requis" }, { status: 400 });
    if (teamName.length > 80) return NextResponse.json({ error: 'Nom trop long (max 80 caracteres)' }, { status: 400 });
    if (!cap.first_name?.trim() || !cap.last_name?.trim()) {
      return NextResponse.json({ error: 'Prenom et nom du capitaine requis' }, { status: 400 });
    }

    const teamCode = generateCode(teamName);
    const manageToken = generateToken();
    const rawEmail = (cap.email || '').trim().toLowerCase();
    // Le capitaine sans courriel reçoit une adresse placeholder (colonne NOT NULL) ;
    // aucun courriel ne lui sera envoyé.
    const captainEmail = rawEmail || `capitaine@${teamCode.toLowerCase()}.sans-courriel`;

    const { data: team, error: teamError } = await supabase
      .from('event_teams')
      .insert({
        event_id: id,
        team_name: teamName,
        team_code: teamCode,
        captain_email: captainEmail,
        manage_token: manageToken,
        max_members: maxMembers,
        logo_url: body.logo_url || null,
      })
      .select('id, team_name, team_code, captain_email, logo_url, max_members, created_at')
      .single();
    if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 });

    const { data: captainMember, error: memberError } = await supabase
      .from('event_team_members')
      .insert({
        team_id: team.id,
        first_name: cap.first_name.trim(),
        last_name: cap.last_name.trim(),
        email: captainEmail,
        phone: (cap.phone || '').trim(),
        skill_level: cap.skill_level || '',
        shirt_size: cap.shirt_size || '',
        dietary_restrictions: cap.dietary_restrictions || '',
        notes: "Ajoute par l'organisateur",
        is_captain: true,
        gender: normGender(cap.gender),
      })
      .select('*')
      .single();
    // Si le capitaine échoue, on retire l'équipe orpheline pour ne pas laisser d'incohérence.
    if (memberError) {
      await supabase.from('event_teams').delete().eq('id', team.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (body.send_email !== false && isRealEmail(rawEmail)) {
      const shareUrl = `${PUBLIC_SITE_URL}/evenements.html?event=${encodeURIComponent(id)}&team=${encodeURIComponent(teamCode)}`;
      const manageUrl = `${PUBLIC_SITE_URL}/evenements.html?gestion=${encodeURIComponent(manageToken)}`;
      after(async () => sendTeamCreatedEmail(
        { ...eventInfo, tournament_live_url: await publishedTournamentUrl(supabase, id) },
        captainEmail, cap.first_name!.trim(),
        { team_name: teamName, team_code: teamCode, share_url: shareUrl, manage_url: manageUrl, max_members: maxMembers, member_count: 1 },
        captainMember?.id,
      ));
    }

    return NextResponse.json({ ok: true, team: { ...team, members: [captainMember] } }, { status: 201 });
  }

  // ── Ajouter un membre à une équipe existante ──
  if (body.action === 'add_member') {
    if (!body.team_id) return NextResponse.json({ error: 'team_id requis' }, { status: 400 });

    const { data: team } = await supabase
      .from('event_teams')
      .select('id, team_name, team_code, max_members, captain_email')
      .eq('id', body.team_id)
      .eq('event_id', id)
      .single();
    if (!team) return NextResponse.json({ error: 'Equipe introuvable' }, { status: 404 });

    const m: PersonInput = body.member || {};
    if (!m.first_name?.trim() || !m.last_name?.trim()) {
      return NextResponse.json({ error: 'Prenom et nom requis' }, { status: 400 });
    }

    const { count } = await supabase
      .from('event_team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('status', 'confirmed');
    if ((count || 0) >= team.max_members) {
      return NextResponse.json({ error: "L'equipe est complete" }, { status: 400 });
    }

    const rawEmail = (m.email || '').trim().toLowerCase();
    if (rawEmail) {
      const { data: dup } = await supabase
        .from('event_team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('email', rawEmail)
        .eq('status', 'confirmed')
        .maybeSingle();
      if (dup) return NextResponse.json({ error: 'Ce courriel est deja inscrit dans cette equipe' }, { status: 409 });
    }
    const email = rawEmail || `membre-${Math.random().toString(36).slice(2, 8)}@${team.team_code.toLowerCase()}.sans-courriel`;

    const { data: newMember, error: insertError } = await supabase
      .from('event_team_members')
      .insert({
        team_id: team.id,
        first_name: m.first_name.trim(),
        last_name: m.last_name.trim(),
        email,
        phone: (m.phone || '').trim(),
        skill_level: m.skill_level || '',
        shirt_size: m.shirt_size || '',
        dietary_restrictions: m.dietary_restrictions || '',
        notes: "Ajoute par l'organisateur",
        is_captain: false,
        gender: normGender(m.gender),
      })
      .select('*')
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const memberCount = (count || 0) + 1;

    if (body.send_email !== false && isRealEmail(rawEmail)) {
      after(async () => sendTeamJoinedEmail(
        { ...eventInfo, tournament_live_url: await publishedTournamentUrl(supabase, id) },
        email, m.first_name!.trim(), team.team_name, newMember?.id,
      ));
    }
    if (body.notify_captain !== false && isRealEmail(team.captain_email) && team.captain_email !== email) {
      after(() => sendTeamMemberNotification(
        eventInfo, team.captain_email, team.team_name,
        `${m.first_name!.trim()} ${m.last_name!.trim()}`, memberCount, team.max_members,
      ));
    }

    return NextResponse.json({ ok: true, member: newMember }, { status: 201 });
  }

  return NextResponse.json({ error: 'action invalide' }, { status: 400 });
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

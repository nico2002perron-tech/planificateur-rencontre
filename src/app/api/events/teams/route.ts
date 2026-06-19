import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTeamCreatedEmail, sendRegistrationNotification } from '@/lib/email';

const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://groupefinancierstefoy.com';

function corsJson(body: unknown, status: number) {
  // Un statut 204 (préflight CORS) ne doit PAS avoir de corps : NextResponse.json(null)
  // écrirait « null » et Next 16 renvoie alors 500 → le préflight échoue → « Erreur de connexion ».
  const response = body === null
    ? new NextResponse(null, { status })
    : NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

function generateCode(teamName: string): string {
  const prefix = teamName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

function generateToken(): string {
  return Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join('');
}

interface TeammateInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  shirt_size?: string;
  skill_level?: string;
  dietary_restrictions?: string;
}

// POST /api/events/teams — Captain creates a team (optionally with teammates)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createClient();

  const eventId = body.event_id;
  if (!eventId) return corsJson({ error: 'event_id requis' }, 400);

  // Validate event exists and supports teams
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, date, time, location, contact_email, contact_phone, created_by, status, is_registration_open, registration_mode, team_size, max_attendees, registration_deadline')
    .eq('id', eventId)
    .single();

  if (eventError || !event) return corsJson({ error: 'Evenement introuvable' }, 404);
  if (event.status !== 'published') return corsJson({ error: 'Evenement non disponible' }, 400);
  if (!event.is_registration_open) return corsJson({ error: 'Inscriptions fermees' }, 400);
  if (event.registration_mode !== 'team' && event.registration_mode !== 'both') {
    return corsJson({ error: 'Cet evenement ne supporte pas les equipes' }, 400);
  }

  if (event.registration_deadline) {
    const deadline = new Date(event.registration_deadline);
    deadline.setHours(23, 59, 59);
    if (new Date() > deadline) return corsJson({ error: 'La date limite d\'inscription est passee' }, 400);
  }

  // Validate captain info
  if (!body.team_name?.trim()) return corsJson({ error: 'Nom d\'equipe requis' }, 400);
  if (!body.first_name?.trim()) return corsJson({ error: 'Prenom requis' }, 400);
  if (!body.last_name?.trim()) return corsJson({ error: 'Nom requis' }, 400);
  if (!body.email?.trim()) return corsJson({ error: 'Courriel requis' }, 400);
  if (!body.phone?.trim()) return corsJson({ error: 'Telephone requis' }, 400);

  const maxMembers = event.team_size || 10;

  // Teammates added directly by the captain (optional)
  const teammates: TeammateInput[] = Array.isArray(body.teammates)
    ? body.teammates.filter((t: TeammateInput) => t && (t.first_name?.trim() || t.last_name?.trim()))
    : [];

  if (teammates.length > maxMembers - 1) {
    return corsJson({ error: `Maximum ${maxMembers - 1} coequipiers (equipe de ${maxMembers} incluant le capitaine)` }, 400);
  }
  for (const t of teammates) {
    if (!t.first_name?.trim() || !t.last_name?.trim()) {
      return corsJson({ error: 'Chaque coequipier doit avoir un prenom et un nom' }, 400);
    }
  }

  // Check global event capacity (individuals + team members already registered)
  if (event.max_attendees) {
    const { count: indivCount } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'confirmed');

    const { data: teamRows } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', eventId);

    let teamMemberCount = 0;
    const teamIds = (teamRows || []).map(t => t.id);
    if (teamIds.length > 0) {
      const { count } = await supabase
        .from('event_team_members')
        .select('*', { count: 'exact', head: true })
        .in('team_id', teamIds)
        .eq('status', 'confirmed');
      teamMemberCount = count || 0;
    }

    const newPeople = 1 + teammates.length;
    if ((indivCount || 0) + teamMemberCount + newPeople > event.max_attendees) {
      return corsJson({ error: 'L\'evenement est complet ou il ne reste pas assez de places' }, 400);
    }
  }

  // Check if email already has a team for this event
  const { data: existingTeams } = await supabase
    .from('event_teams')
    .select('id')
    .eq('event_id', eventId)
    .eq('captain_email', body.email.toLowerCase().trim());

  if (existingTeams && existingTeams.length > 0) {
    return corsJson({ error: 'Vous avez deja cree une equipe pour cet evenement' }, 409);
  }

  const teamCode = generateCode(body.team_name);
  const manageToken = generateToken();

  // Create team
  const { data: team, error: teamError } = await supabase
    .from('event_teams')
    .insert({
      event_id: eventId,
      team_name: body.team_name.trim(),
      team_code: teamCode,
      captain_email: body.email.toLowerCase().trim(),
      manage_token: manageToken,
      max_members: maxMembers,
      logo_url: body.logo_url || null,
    })
    .select()
    .single();

  if (teamError) return corsJson({ error: teamError.message }, 500);

  // Add captain as first member
  const { data: captainMember, error: memberError } = await supabase
    .from('event_team_members')
    .insert({
      team_id: team.id,
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      email: body.email.toLowerCase().trim(),
      phone: body.phone.trim(),
      skill_level: body.skill_level || '',
      shirt_size: body.shirt_size || '',
      dietary_restrictions: body.dietary_restrictions || '',
      notes: body.notes || '',
      is_captain: true,
    })
    .select('id')
    .single();

  if (memberError) return corsJson({ error: memberError.message }, 500);

  // Add teammates entered by the captain (email/phone optional for them)
  if (teammates.length > 0) {
    const rows = teammates.map((t, i) => ({
      team_id: team.id,
      first_name: (t.first_name || '').trim(),
      last_name: (t.last_name || '').trim(),
      // email must be unique within the team — use a placeholder when not provided
      email: t.email?.trim() ? t.email.trim().toLowerCase() : `coequipier-${i + 1}@${teamCode.toLowerCase()}.sans-courriel`,
      phone: t.phone?.trim() || '',
      skill_level: t.skill_level || '',
      shirt_size: t.shirt_size || '',
      dietary_restrictions: t.dietary_restrictions || '',
      notes: 'Inscrit par le capitaine',
      is_captain: false,
    }));

    const { error: teammatesError } = await supabase
      .from('event_team_members')
      .insert(rows);

    if (teammatesError) return corsJson({ error: teammatesError.message }, 500);
  }

  const memberCount = 1 + teammates.length;
  const shareUrl = `${PUBLIC_SITE_URL}/evenements.html?event=${encodeURIComponent(eventId)}&team=${encodeURIComponent(teamCode)}`;
  const manageUrl = `${PUBLIC_SITE_URL}/evenements.html?gestion=${encodeURIComponent(manageToken)}`;

  // Emails (non-blocking)
  const eventInfo = { id: event.id, title: event.title, date: event.date, time: event.time, location: event.location, contact_email: event.contact_email, contact_phone: event.contact_phone };

  // 1. Le capitaine reçoit code + lien d'invitation + lien de gestion — via after() (envoi garanti après la réponse)
  after(() => sendTeamCreatedEmail(eventInfo, body.email.toLowerCase().trim(), body.first_name.trim(), {
    team_name: team.team_name,
    team_code: teamCode,
    share_url: shareUrl,
    manage_url: manageUrl,
    max_members: maxMembers,
    member_count: memberCount,
  }, captainMember?.id));

  // 2. Le créateur de l'événement est notifié
  if (event.created_by) {
    after(async () => {
      const { data: creator } = await supabase.from('users').select('email').eq('id', event.created_by).single();
      if (creator?.email) {
        await sendRegistrationNotification(creator.email, eventInfo, {
          first_name: body.first_name.trim(),
          last_name: body.last_name.trim(),
          email: body.email.toLowerCase().trim(),
          phone: body.phone.trim(),
          registration_type: 'team',
          team_name: team.team_name,
          pricing_option: body.pricing_option || '',
        });
      }
    });
  }

  return corsJson({
    ok: true,
    team_code: teamCode,
    team_name: team.team_name,
    member_count: memberCount,
    share_url: shareUrl,
    manage_url: manageUrl,
    manage_token: manageToken,
    max_members: maxMembers,
  }, 201);
}

export async function OPTIONS() {
  return corsJson(null, 204);
}

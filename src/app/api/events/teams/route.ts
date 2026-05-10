import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function corsJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
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

// POST /api/events/teams — Captain creates a team
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createClient();

  const eventId = body.event_id;
  if (!eventId) return corsJson({ error: 'event_id requis' }, 400);

  // Validate event exists and supports teams
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, status, is_registration_open, registration_mode, team_size')
    .eq('id', eventId)
    .single();

  if (eventError || !event) return corsJson({ error: 'Evenement introuvable' }, 404);
  if (event.status !== 'published') return corsJson({ error: 'Evenement non disponible' }, 400);
  if (!event.is_registration_open) return corsJson({ error: 'Inscriptions fermees' }, 400);
  if (event.registration_mode !== 'team' && event.registration_mode !== 'both') {
    return corsJson({ error: 'Cet evenement ne supporte pas les equipes' }, 400);
  }

  // Validate captain info
  if (!body.team_name?.trim()) return corsJson({ error: 'Nom d\'equipe requis' }, 400);
  if (!body.first_name?.trim()) return corsJson({ error: 'Prenom requis' }, 400);
  if (!body.last_name?.trim()) return corsJson({ error: 'Nom requis' }, 400);
  if (!body.email?.trim()) return corsJson({ error: 'Courriel requis' }, 400);
  if (!body.phone?.trim()) return corsJson({ error: 'Telephone requis' }, 400);

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
  const maxMembers = event.team_size || 10;

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
    })
    .select()
    .single();

  if (teamError) return corsJson({ error: teamError.message }, 500);

  // Add captain as first member
  const { error: memberError } = await supabase
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
    });

  if (memberError) return corsJson({ error: memberError.message }, 500);

  return corsJson({
    ok: true,
    team_code: teamCode,
    team_name: team.team_name,
    manage_url: `/api/events/teams/manage/${manageToken}`,
    manage_token: manageToken,
    max_members: maxMembers,
  }, 201);
}

export async function OPTIONS() {
  return corsJson(null, 204);
}

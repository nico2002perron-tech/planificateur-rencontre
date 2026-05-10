import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function corsJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// GET /api/events/teams/[code] — Get team info by code (public)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createClient();

  const { data: team, error } = await supabase
    .from('event_teams')
    .select('id, event_id, team_name, team_code, max_members, created_at')
    .eq('team_code', code.toUpperCase())
    .single();

  if (error || !team) return corsJson({ error: 'Equipe introuvable. Verifiez le code.' }, 404);

  // Get current members
  const { data: members } = await supabase
    .from('event_team_members')
    .select('first_name, last_name, is_captain, joined_at')
    .eq('team_id', team.id)
    .eq('status', 'confirmed')
    .order('joined_at', { ascending: true });

  // Get event info
  const { data: event } = await supabase
    .from('events')
    .select('title, date, time, location, is_registration_open, form_options')
    .eq('id', team.event_id)
    .single();

  return corsJson({
    team_name: team.team_name,
    team_code: team.team_code,
    event: event || null,
    members: (members || []).map(m => ({
      name: `${m.first_name} ${m.last_name}`,
      is_captain: m.is_captain,
    })),
    member_count: members?.length || 0,
    max_members: team.max_members,
    spots_left: team.max_members - (members?.length || 0),
  }, 200);
}

// POST /api/events/teams/[code] — Join a team by code
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await request.json();
  const supabase = createClient();

  // Find team
  const { data: team, error: teamError } = await supabase
    .from('event_teams')
    .select('id, event_id, team_name, max_members')
    .eq('team_code', code.toUpperCase())
    .single();

  if (teamError || !team) return corsJson({ error: 'Equipe introuvable. Verifiez le code.' }, 404);

  // Check event is still open
  const { data: event } = await supabase
    .from('events')
    .select('is_registration_open, status')
    .eq('id', team.event_id)
    .single();

  if (!event || event.status !== 'published' || !event.is_registration_open) {
    return corsJson({ error: 'Les inscriptions sont fermees' }, 400);
  }

  // Check team capacity
  const { count } = await supabase
    .from('event_team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .eq('status', 'confirmed');

  if ((count || 0) >= team.max_members) {
    return corsJson({ error: 'L\'equipe est complete' }, 400);
  }

  // Validate fields
  if (!body.first_name?.trim()) return corsJson({ error: 'Prenom requis' }, 400);
  if (!body.last_name?.trim()) return corsJson({ error: 'Nom requis' }, 400);
  if (!body.email?.trim()) return corsJson({ error: 'Courriel requis' }, 400);
  if (!body.phone?.trim()) return corsJson({ error: 'Telephone requis' }, 400);

  // Check duplicate email in this team
  const { data: existing } = await supabase
    .from('event_team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('email', body.email.toLowerCase().trim())
    .eq('status', 'confirmed')
    .single();

  if (existing) return corsJson({ error: 'Ce courriel est deja inscrit dans cette equipe' }, 409);

  // Add member
  const { error: insertError } = await supabase
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
      is_captain: false,
    });

  if (insertError) return corsJson({ error: insertError.message }, 500);

  return corsJson({
    ok: true,
    team_name: team.team_name,
    message: `Vous avez rejoint l'equipe "${team.team_name}" !`,
  }, 201);
}

export async function OPTIONS() {
  return corsJson(null, 204);
}

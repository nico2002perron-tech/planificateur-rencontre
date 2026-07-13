import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTeamJoinedEmail, sendTeamMemberNotification } from '@/lib/email';
import { publishedTournamentUrl } from '@/lib/tournament/state';

function corsJson(body: unknown, status: number) {
  // Un statut 204 (préflight CORS) ne doit PAS avoir de corps : NextResponse.json(null)
  // écrirait « null » et Next 16 renvoie alors 500 → le préflight échoue → « Erreur de connexion ».
  const response = body === null
    ? new NextResponse(null, { status })
    : NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// Normalise un genre : 'M' (gars) / 'F' (filles) / '' si non spécifié.
function normGender(g: unknown): string {
  return g === 'M' || g === 'F' ? g : '';
}

// GET /api/events/teams/[code] — Get team info by code (public)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createClient();

  const { data: team, error } = await supabase
    .from('event_teams')
    .select('id, event_id, team_name, team_code, logo_url, max_members, created_at')
    .eq('team_code', code.toUpperCase())
    .single();

  if (error || !team) return corsJson({ error: 'Equipe introuvable. Verifiez le code.' }, 404);

  // Get current members
  const { data: members } = await supabase
    .from('event_team_members')
    .select('first_name, last_name, is_captain, joined_at, gender')
    .eq('team_id', team.id)
    .eq('status', 'confirmed')
    .order('joined_at', { ascending: true });

  // Get event info
  const { data: event } = await supabase
    .from('events')
    .select('title, date, time, location, is_registration_open, form_options, team_gender_composition')
    .eq('id', team.event_id)
    .single();

  const males = (members || []).filter(m => m.gender === 'M').length;
  const females = (members || []).filter(m => m.gender === 'F').length;

  return corsJson({
    team_name: team.team_name,
    team_code: team.team_code,
    logo_url: team.logo_url || null,
    event: event || null,
    members: (members || []).map(m => ({
      name: `${m.first_name} ${m.last_name}`,
      is_captain: m.is_captain,
      gender: m.gender || '',
    })),
    member_count: members?.length || 0,
    max_members: team.max_members,
    spots_left: team.max_members - (members?.length || 0),
    team_gender_composition: event?.team_gender_composition || null,
    gender_counts: { male: males, female: females },
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
    .select('id, event_id, team_name, max_members, captain_email')
    .eq('team_code', code.toUpperCase())
    .single();

  if (teamError || !team) return corsJson({ error: 'Equipe introuvable. Verifiez le code.' }, 404);

  // Check event is still open
  const { data: event } = await supabase
    .from('events')
    .select('id, title, date, time, location, contact_email, contact_phone, is_registration_open, status, team_gender_composition')
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

  // ── Composition par genre (gars / filles), si activée sur l'événement ──
  const genderRule = event.team_gender_composition && event.team_gender_composition.enabled
    ? event.team_gender_composition : null;
  const joinGender = normGender(body.gender);
  if (genderRule) {
    if (!joinGender) return corsJson({ error: 'Indiquez si vous etes un gars ou une fille' }, 400);
    const { data: curMembers } = await supabase
      .from('event_team_members')
      .select('gender')
      .eq('team_id', team.id)
      .eq('status', 'confirmed');
    const males = (curMembers || []).filter(m => m.gender === 'M').length;
    const females = (curMembers || []).filter(m => m.gender === 'F').length;
    const maleSpots = parseInt(genderRule.male_spots, 10) || 0;
    const femaleSpots = parseInt(genderRule.female_spots, 10) || 0;
    if (joinGender === 'M' && males >= maleSpots) return corsJson({ error: 'Toutes les places gars de cette equipe sont prises.' }, 400);
    if (joinGender === 'F' && females >= femaleSpots) return corsJson({ error: 'Toutes les places filles de cette equipe sont prises.' }, 400);
  }

  // Add member
  const { data: newMember, error: insertError } = await supabase
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
      gender: joinGender,
    })
    .select('id')
    .single();

  if (insertError) return corsJson({ error: insertError.message }, 500);

  // Emails (non-blocking)
  const eventInfo = {
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    location: event.location,
    contact_email: event.contact_email,
    contact_phone: event.contact_phone,
  };
  const memberCount = (count || 0) + 1;

  // 1. Confirmation au nouveau membre — via after() (envoi garanti après la réponse)
  after(async () => sendTeamJoinedEmail(
    { ...eventInfo, tournament_live_url: await publishedTournamentUrl(supabase, event.id) },
    body.email.toLowerCase().trim(),
    body.first_name.trim(),
    team.team_name,
    newMember?.id,
  ));

  // 2. Notifier le capitaine (sauf si le capitaine vient de rejoindre sa propre équipe)
  if (team.captain_email && team.captain_email !== body.email.toLowerCase().trim()) {
    after(() => sendTeamMemberNotification(
      eventInfo,
      team.captain_email,
      team.team_name,
      `${body.first_name.trim()} ${body.last_name.trim()}`,
      memberCount,
      team.max_members,
    ));
  }

  return corsJson({
    ok: true,
    team_name: team.team_name,
    member_count: memberCount,
    max_members: team.max_members,
    message: `Vous avez rejoint l'equipe "${team.team_name}" !`,
  }, 201);
}

export async function OPTIONS() {
  return corsJson(null, 204);
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function corsJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// POST /api/events/[id]/register — Public registration (no auth required)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  // Validate event exists and is open
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, status, is_registration_open, max_attendees, registration_deadline, registration_mode, team_size')
    .eq('id', id)
    .single();

  if (eventError || !event) return corsJson({ error: 'Evenement introuvable' }, 404);
  if (event.status !== 'published') return corsJson({ error: 'Evenement non disponible' }, 400);
  if (!event.is_registration_open) return corsJson({ error: 'Les inscriptions sont fermees' }, 400);

  if (event.registration_deadline) {
    const deadline = new Date(event.registration_deadline);
    deadline.setHours(23, 59, 59);
    if (new Date() > deadline) return corsJson({ error: 'La date limite d\'inscription est passee' }, 400);
  }

  // Check capacity
  if (event.max_attendees) {
    const { count } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'confirmed');

    if ((count || 0) >= event.max_attendees) {
      return corsJson({ error: 'L\'evenement est complet' }, 400);
    }
  }

  // Validate required fields
  if (!body.first_name?.trim()) return corsJson({ error: 'Le prenom est requis' }, 400);
  if (!body.last_name?.trim()) return corsJson({ error: 'Le nom est requis' }, 400);
  if (!body.email?.trim()) return corsJson({ error: 'Le courriel est requis' }, 400);
  if (!body.phone?.trim()) return corsJson({ error: 'Le telephone est requis' }, 400);

  // Validate team registration
  const regType = body.registration_type || 'individual';
  if (regType === 'team') {
    if (!body.team_name?.trim()) return corsJson({ error: 'Le nom d\'equipe est requis' }, 400);
    const members = body.team_members || [];
    if (members.length < 1) return corsJson({ error: 'Ajoutez au moins un coequipier' }, 400);
  }

  // Check duplicate email for this event
  const { data: existing } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', id)
    .eq('email', body.email.toLowerCase().trim())
    .eq('status', 'confirmed')
    .single();

  if (existing) return corsJson({ error: 'Ce courriel est deja inscrit a cet evenement' }, 409);

  const { data, error } = await supabase
    .from('event_registrations')
    .insert({
      event_id: id,
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      email: body.email.toLowerCase().trim(),
      phone: body.phone.trim(),
      company: body.company || '',
      is_client: body.is_client ?? false,
      registration_type: regType,
      team_name: body.team_name || '',
      team_members: body.team_members || [],
      guests: body.guests || 0,
      pricing_option: body.pricing_option || '',
      dietary_restrictions: body.dietary_restrictions || '',
      skill_level: body.skill_level || '',
      shirt_size: body.shirt_size || '',
      notes: body.notes || '',
    })
    .select()
    .single();

  if (error) return corsJson({ error: error.message }, 500);

  return corsJson({ ok: true, registration: data }, 201);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

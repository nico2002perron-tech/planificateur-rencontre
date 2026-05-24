import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// GET /api/events — Public list of published events
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get('all') === '1';

  // If authenticated and requesting all, show all events for the user
  if (showAll) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.user.role === 'admin';
    let query = supabase.from('events').select('*, event_registrations(count)');

    if (!isAdmin) {
      query = query.eq('created_by', session.user.id);
    }

    const { data, error } = await query.order('date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Enrich with creator info
    const userIds = [...new Set((data || []).map(e => e.created_by))];
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds);
    const userMap = new Map((users || []).map(u => [u.id, u]));

    const enriched = (data || []).map(e => ({
      ...e,
      registration_count: e.event_registrations?.[0]?.count || 0,
      creator: userMap.get(e.created_by) || null,
    }));

    return NextResponse.json(enriched);
  }

  // Public: only published events, upcoming first
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description, event_type, date, time, end_date, location, location_url, cover_image, images, collab_logos, max_attendees, registration_deadline, is_registration_open, registration_mode, team_size, team_label, allow_team_logo, pricing, form_options, contact_email, contact_phone, status')
    .eq('status', 'published')
    .eq('is_registration_open', true)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get registration counts
  const eventIds = (data || []).map(e => e.id);
  const { data: regCounts } = await supabase
    .from('event_registrations')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('status', 'confirmed');

  const countMap: Record<string, number> = {};
  (regCounts || []).forEach(r => { countMap[r.event_id] = (countMap[r.event_id] || 0) + 1; });

  const enriched = (data || []).map(e => ({
    ...e,
    registration_count: countMap[e.id] || 0,
  }));

  const response = NextResponse.json(enriched);
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET');
  response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return response;
}

// POST /api/events — Create a new event (any authenticated user)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.title?.trim()) return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 });
  if (!body.date) return NextResponse.json({ error: 'La date est requise' }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .insert({
      created_by: session.user.id,
      title: body.title.trim(),
      description: body.description || '',
      event_type: body.event_type || 'autre',
      date: body.date,
      time: body.time || '',
      end_date: body.end_date || null,
      location: body.location || '',
      location_url: body.location_url || '',
      cover_image: body.cover_image || '',
      images: body.images || [],
      collab_logos: body.collab_logos || [],
      max_attendees: body.max_attendees || null,
      registration_deadline: body.registration_deadline || null,
      is_registration_open: body.is_registration_open ?? true,
      registration_mode: body.registration_mode || 'individual',
      team_size: body.team_size || 4,
      team_label: body.team_label || 'Equipe',
      allow_team_logo: body.allow_team_logo ?? false,
      pricing: body.pricing || [],
      form_options: body.form_options || { show_company: true, show_dietary: false, show_skill_level: false, show_shirt_size: false, show_is_client: false },
      contact_email: body.contact_email || '',
      contact_phone: body.contact_phone || '',
      status: body.status || 'draft',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

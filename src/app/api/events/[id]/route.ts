import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

async function canManage(eventId: string, session: { user: { id: string; role: string } }) {
  if (session.user.role === 'admin') return true;
  const supabase = createClient();
  const { data } = await supabase.from('events').select('created_by').eq('id', eventId).single();
  return data?.created_by === session.user.id;
}

// PUT /api/events/[id] — Update an event
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await canManage(id, session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const supabase = createClient();

  const updates: Record<string, unknown> = {};
  const fields = [
    'title', 'description', 'event_type', 'date', 'time', 'end_date',
    'location', 'location_url', 'cover_image', 'images', 'collab_logos',
    'max_attendees', 'registration_deadline', 'is_registration_open',
    'registration_mode', 'team_size', 'team_label', 'allow_team_logo', 'pricing', 'form_options',
    'contact_email', 'contact_phone', 'status',
    'tagline', 'highlights', 'program', 'accent_color', 'cta_label', 'show_countdown', 'featured',
    'reminder_dates',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/events/[id] — Delete an event
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await canManage(id, session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// GET /api/events/[id]/registrations — List registrations (creator or admin only)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();

  // Check permission: creator or admin
  if (session.user.role !== 'admin') {
    const { data: event } = await supabase.from('events').select('created_by').eq('id', id).single();
    if (!event || event.created_by !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', id)
    .order('registered_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/events/[id]/registrations — Cancel a registration
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { registration_id } = await request.json();
  if (!registration_id) return NextResponse.json({ error: 'registration_id requis' }, { status: 400 });

  const supabase = createClient();

  // Check permission
  if (session.user.role !== 'admin') {
    const { data: event } = await supabase.from('events').select('created_by').eq('id', id).single();
    if (!event || event.created_by !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from('event_registrations')
    .update({ status: 'cancelled' })
    .eq('id', registration_id)
    .eq('event_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

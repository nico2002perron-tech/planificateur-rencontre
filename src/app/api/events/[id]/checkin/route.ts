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

// POST /api/events/[id]/checkin — Toggle attendance for a registration or a team member
// Body: { kind: 'registration' | 'member', id: string, checked: boolean }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;
  const body = await request.json();
  const supabase = createClient();

  if (!(await checkPermission(supabase, eventId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const kind = body.kind;
  const targetId = body.id;
  const checkedInAt = body.checked ? new Date().toISOString() : null;
  if (!targetId || (kind !== 'registration' && kind !== 'member')) {
    return NextResponse.json({ error: 'kind (registration|member) et id requis' }, { status: 400 });
  }

  if (kind === 'registration') {
    const { error } = await supabase
      .from('event_registrations')
      .update({ checked_in_at: checkedInAt })
      .eq('id', targetId)
      .eq('event_id', eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Verify the member belongs to a team of this event before updating
    const { data: member } = await supabase
      .from('event_team_members')
      .select('id, event_teams!inner(event_id)')
      .eq('id', targetId)
      .single();
    const teamEvent = member?.event_teams as unknown as { event_id: string } | undefined;
    if (!member || teamEvent?.event_id !== eventId) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 });
    }
    const { error } = await supabase
      .from('event_team_members')
      .update({ checked_in_at: checkedInAt })
      .eq('id', targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checked_in_at: checkedInAt });
}

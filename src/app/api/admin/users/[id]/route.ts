import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any) {
  return session?.user?.role === 'admin';
}

// PUT /api/admin/users/[id] — Update user info or status
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.email !== undefined) updates.email = body.email.toLowerCase().trim();
  if (body.role !== undefined) updates.role = body.role === 'admin' ? 'admin' : 'advisor';
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
  }

  // Prevent admin from deactivating themselves
  if (updates.status === 'inactive' && id === session!.user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas desactiver votre propre compte' }, { status: 400 });
  }

  // Prevent admin from removing their own admin role
  if (updates.role === 'advisor' && id === session!.user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas retirer votre propre role admin' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, email, name, role, status, must_change_password, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-link team profile when activating a user (match by name)
  if (updates.status === 'active' && data) {
    const { data: unlinkedProfile } = await supabase
      .from('team_profiles')
      .select('id')
      .is('user_id', null)
      .ilike('display_name', data.name)
      .limit(1)
      .single();

    if (unlinkedProfile) {
      await supabase
        .from('team_profiles')
        .update({ user_id: id })
        .eq('id', unlinkedProfile.id);
    }
  }

  return NextResponse.json(data);
}

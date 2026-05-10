import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { hash } from 'bcryptjs';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any) {
  return session?.user?.role === 'admin';
}

// GET /api/admin/users — List all users with linked team profile
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();

  // Get users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, role, status, must_change_password, last_login_at, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get team profiles to show link status
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('user_id, display_name, photo_url');

  const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

  const enriched = (users || []).map(u => ({
    ...u,
    team_profile: profileMap.get(u.id) || null,
  }));

  return NextResponse.json(enriched);
}

// POST /api/admin/users — Create a new user and optionally link team profile
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { email, name, role, password, team_profile_id } = body;

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, nom et mot de passe requis' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' }, { status: 400 });
  }

  const supabase = createClient();

  // Check if email already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Un compte avec ce courriel existe deja' }, { status: 409 });
  }

  const password_hash = await hash(password, 12);

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: role === 'admin' ? 'admin' : 'advisor',
      password_hash,
      status: 'active',
      must_change_password: true,
    })
    .select('id, email, name, role, status, must_change_password, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Link team profile if requested
  if (team_profile_id && data) {
    await supabase
      .from('team_profiles')
      .update({ user_id: data.id })
      .eq('id', team_profile_id);
  }

  return NextResponse.json(data, { status: 201 });
}

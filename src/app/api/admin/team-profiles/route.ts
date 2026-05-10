import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { hash } from 'bcryptjs';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any) {
  return session?.user?.role === 'admin';
}

// GET /api/admin/team-profiles — List all team profiles with linked user info
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  const { data: profiles, error } = await supabase
    .from('team_profiles')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with linked user data
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name, role, status, must_change_password, last_login_at, created_at');

  const userMap = new Map((users || []).map(u => [u.id, u]));

  const enriched = (profiles || []).map(p => ({
    ...p,
    linked_user: p.user_id ? userMap.get(p.user_id) || null : null,
  }));

  return NextResponse.json(enriched);
}

// POST /api/admin/team-profiles — Create a new team profile
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();

  if (!body.display_name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 });
  }

  const supabase = createClient();

  const initials = body.display_name
    .trim()
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const { data, error } = await supabase
    .from('team_profiles')
    .insert({
      display_name: body.display_name.trim(),
      role_title: body.role_title || '',
      bio: body.bio || '',
      photo_url: body.photo_url || '',
      certifications: body.certifications || [],
      languages: body.languages || [],
      years_experience: body.years_experience || '',
      linkedin_url: body.linkedin_url || '',
      instagram_url: body.instagram_url || '',
      facebook_url: body.facebook_url || '',
      twitter_url: body.twitter_url || '',
      website_url: body.website_url || '',
      badge: body.badge || 'Conseiller',
      category: body.category || 'conseiller',
      initials,
      logo_id: body.logo_id || null,
      quote: body.quote || '',
      specialties: body.specialties || [],
      booking_url: body.booking_url || '',
      phone: body.phone || '',
      education: body.education || [],
      sort_order: body.sort_order ?? 99,
      is_visible: body.is_visible ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally create a linked user account
  if (body.create_account && body.account_email && body.account_password && data) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', body.account_email.toLowerCase().trim())
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Un compte avec ce courriel existe deja', profile: data }, { status: 409 });
    }

    if (body.account_password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caracteres', profile: data }, { status: 400 });
    }

    const password_hash = await hash(body.account_password, 12);
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: body.account_email.toLowerCase().trim(),
        name: body.display_name.trim(),
        role: body.account_role === 'admin' ? 'admin' : 'advisor',
        password_hash,
        status: 'active',
        must_change_password: true,
      })
      .select('id')
      .single();

    if (userError) return NextResponse.json({ error: userError.message, profile: data }, { status: 500 });

    // Link profile to user
    if (user) {
      await supabase
        .from('team_profiles')
        .update({ user_id: user.id })
        .eq('id', data.id);
    }
  }

  return NextResponse.json(data, { status: 201 });
}

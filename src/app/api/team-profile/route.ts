import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    // No profile yet — return empty with user info for pre-fill
    return NextResponse.json({
      user_id: session.user.id,
      display_name: session.user.name,
      role_title: '',
      bio: '',
      photo_url: '',
      linkedin_url: '',
      instagram_url: '',
      facebook_url: '',
      twitter_url: '',
      website_url: '',
      badge: 'Conseiller',
      category: 'conseiller',
      initials: session.user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
      sort_order: 99,
      is_visible: true,
    });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = createClient();

  const profileData = {
    user_id: session.user.id,
    display_name: body.display_name || session.user.name,
    role_title: body.role_title || '',
    bio: body.bio || '',
    photo_url: body.photo_url || '',
    linkedin_url: body.linkedin_url || '',
    instagram_url: body.instagram_url || '',
    facebook_url: body.facebook_url || '',
    twitter_url: body.twitter_url || '',
    website_url: body.website_url || '',
    badge: body.badge || 'Conseiller',
    category: body.category || 'conseiller',
    initials: body.initials || session.user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
    sort_order: body.sort_order ?? 99,
    is_visible: body.is_visible ?? true,
  };

  const { data, error } = await supabase
    .from('team_profiles')
    .upsert(profileData, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

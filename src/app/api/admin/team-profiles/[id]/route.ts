import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any) {
  return session?.user?.role === 'admin';
}

// PUT /api/admin/team-profiles/[id] — Update a team profile
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  const updates: Record<string, unknown> = {};
  if (body.display_name !== undefined) updates.display_name = body.display_name.trim();
  if (body.role_title !== undefined) updates.role_title = body.role_title;
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.photo_url !== undefined) updates.photo_url = body.photo_url;
  if (body.certifications !== undefined) updates.certifications = body.certifications;
  if (body.languages !== undefined) updates.languages = body.languages;
  if (body.years_experience !== undefined) updates.years_experience = body.years_experience;
  if (body.linkedin_url !== undefined) updates.linkedin_url = body.linkedin_url;
  if (body.instagram_url !== undefined) updates.instagram_url = body.instagram_url;
  if (body.facebook_url !== undefined) updates.facebook_url = body.facebook_url;
  if (body.twitter_url !== undefined) updates.twitter_url = body.twitter_url;
  if (body.website_url !== undefined) updates.website_url = body.website_url;
  if (body.badge !== undefined) updates.badge = body.badge;
  if (body.category !== undefined) updates.category = body.category;
  if (body.initials !== undefined) updates.initials = body.initials;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
  if (body.is_visible !== undefined) updates.is_visible = body.is_visible;
  if (body.logo_id !== undefined) updates.logo_id = body.logo_id || null;
  if (body.quote !== undefined) updates.quote = body.quote;
  if (body.specialties !== undefined) updates.specialties = body.specialties;
  if (body.booking_url !== undefined) updates.booking_url = body.booking_url;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.education !== undefined) updates.education = body.education;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('team_profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/team-profiles/[id] — Delete a team profile
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const supabase = createClient();

  const { error } = await supabase
    .from('team_profiles')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

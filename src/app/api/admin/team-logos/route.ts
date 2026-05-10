import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any) {
  return session?.user?.role === 'admin';
}

// GET /api/admin/team-logos — List all logos (available to all authenticated users)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('team_logos')
    .select('*')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/team-logos — Upload a new logo (admin only)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('logo') as File | null;
  const name = formData.get('name') as string | null;

  if (!file || !name?.trim()) {
    return NextResponse.json({ error: 'Nom et fichier requis' }, { status: 400 });
  }

  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) return NextResponse.json({ error: 'Fichier trop lourd (max 2 Mo)' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Type invalide (JPG, PNG, WebP, SVG)' }, { status: 400 });

  const supabase = createClient();
  const ext = file.name.split('.').pop() || 'webp';
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const fileName = `logos/${slug}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('team-photos')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage
    .from('team-photos')
    .getPublicUrl(fileName);

  const { data, error } = await supabase
    .from('team_logos')
    .insert({ name: name.trim(), image_url: urlData.publicUrl })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/admin/team-logos — Delete a logo (admin only)
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  const supabase = createClient();

  // Remove logo_id from any profiles using it
  await supabase.from('team_profiles').update({ logo_id: null }).eq('logo_id', id);

  const { error } = await supabase.from('team_logos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any) {
  return session?.user?.role === 'admin';
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('photo') as File | null;
  const profileId = formData.get('profile_id') as string | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!profileId) return NextResponse.json({ error: 'No profile_id provided' }, { status: 400 });

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });

  const ext = file.name.split('.').pop() || 'webp';
  const fileName = `profile-${profileId}.${ext}`;

  const supabase = createClient();
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

  // Update profile with new photo URL
  await supabase
    .from('team_profiles')
    .update({ photo_url: urlData.publicUrl })
    .eq('id', profileId);

  return NextResponse.json({ url: urlData.publicUrl });
}

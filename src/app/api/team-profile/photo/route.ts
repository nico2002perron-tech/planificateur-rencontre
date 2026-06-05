import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('photo') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });

  const ext = file.name.split('.').pop() || 'webp';
  const fileName = `${session.user.id}.${ext}`;

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

  // Le fichier garde le même nom (upsert) → on ajoute une version pour casser
  // les caches navigateur/CDN, sinon l'ancienne photo resterait affichée.
  const versionedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  // Update profile with new photo URL
  await supabase
    .from('team_profiles')
    .upsert({
      user_id: session.user.id,
      display_name: session.user.name,
      photo_url: versionedUrl,
    }, { onConflict: 'user_id' });

  return NextResponse.json({ url: versionedUrl });
}

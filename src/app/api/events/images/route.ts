import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// POST /api/events/images — Upload an event image
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) return NextResponse.json({ error: 'Fichier trop lourd (max 5 Mo)' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Type invalide (JPG, PNG, WebP)' }, { status: 400 });

  const supabase = createClient();
  const ext = file.name.split('.').pop() || 'webp';
  const fileName = `events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('team-photos')
    .upload(fileName, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from('team-photos').getPublicUrl(fileName);
  return NextResponse.json({ url: urlData.publicUrl });
}

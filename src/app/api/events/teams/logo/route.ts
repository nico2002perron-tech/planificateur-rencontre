import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

// POST /api/events/teams/logo — Upload public du logo d'équipe (capitaine non connecté).
// Strict : images seulement, max 2 Mo. Retourne l'URL publique.
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return cors(NextResponse.json({ error: 'Requête invalide' }, { status: 400 }));
  }

  const file = formData.get('logo') as File | null;
  if (!file) return cors(NextResponse.json({ error: 'Aucun fichier' }, { status: 400 }));

  const maxSize = 2 * 1024 * 1024; // 2 Mo
  if (file.size > maxSize) return cors(NextResponse.json({ error: 'Logo trop lourd (max 2 Mo)' }, { status: 400 }));

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return cors(NextResponse.json({ error: 'Type invalide (JPG, PNG ou WebP)' }, { status: 400 }));

  const supabase = createClient();
  const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
  const fileName = `team-logos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('team-photos')
    .upload(fileName, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return cors(NextResponse.json({ error: uploadError.message }, { status: 500 }));

  const { data: urlData } = supabase.storage.from('team-photos').getPublicUrl(fileName);
  return cors(NextResponse.json({ url: urlData.publicUrl }));
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any) {
  return session?.user?.role === 'admin';
}

const STATUSES = ['new', 'in_progress', 'resolved'];

// GET /api/admin/tool-feedback — liste tous les signalements (récents d'abord)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('tool_feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// PATCH /api/admin/tool-feedback — change le statut d'un signalement
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'statut invalide' }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase
    .from('tool_feedback')
    .update({ status: body.status })
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/tool-feedback?id=... — supprime un signalement
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase.from('tool_feedback').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

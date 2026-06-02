import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('meeting_notes')
    .select('*')
    .eq('advisor_id', session.user.id)
    .order('meeting_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const supabase = createClient();

  const { data, error } = await supabase
    .from('meeting_notes')
    .insert({
      advisor_id: session.user.id,
      // Coffre client : nom/compte chiffrés dans le navigateur. Plus de clair.
      client_name: '',
      account_number: '',
      name_enc: body.name_enc ?? null,
      name_idx: body.name_idx ?? null,
      account_enc: body.account_enc ?? null,
      meeting_date: body.meeting_date || new Date().toISOString().split('T')[0],
      meeting_time: body.meeting_time || '',
      meeting_type: body.meeting_type || 'in_person',
      subject: body.subject || 'revision',
      compliance: body.compliance || {},
      transaction: body.transaction || null,
      notes: body.notes || {},
      transcription: body.transcription || null,
      ai_summary_advisor: body.ai_summary_advisor || null,
      ai_summary_client: body.ai_summary_client || null,
      status: body.status || 'draft',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/**
 * Migration des anciennes notes : remplace client_name/account_number en clair
 * par leur version chiffrée. Body : { updates: [{ id, nameEnc, nameIdx, accountEnc }] }.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: { id?: string; nameEnc?: string; nameIdx?: string; accountEnc?: string | null }[] =
    Array.isArray(body.updates) ? body.updates : [];
  if (updates.length === 0) return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 });
  if (updates.length > 2000) return NextResponse.json({ error: 'Trop de lignes à la fois' }, { status: 400 });

  const supabase = createClient();
  let updated = 0;
  for (const u of updates) {
    if (!u.id || typeof u.nameIdx !== 'string' || !u.nameIdx.trim()) continue;
    const { error } = await supabase
      .from('meeting_notes')
      .update({ name_enc: u.nameEnc ?? null, name_idx: u.nameIdx.trim(), account_enc: u.accountEnc ?? null, client_name: '', account_number: '' })
      .eq('id', u.id)
      .eq('advisor_id', session.user.id);
    if (!error) updated++;
  }
  return NextResponse.json({ updated });
}

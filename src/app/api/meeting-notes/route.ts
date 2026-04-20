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
      client_name: body.client_name || '',
      account_number: body.account_number || '',
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

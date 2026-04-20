import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('meeting_notes')
    .select('*')
    .eq('id', id)
    .eq('advisor_id', session.user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = createClient();

  const { data, error } = await supabase
    .from('meeting_notes')
    .update({
      client_name: body.client_name,
      account_number: body.account_number,
      meeting_date: body.meeting_date,
      meeting_time: body.meeting_time,
      meeting_type: body.meeting_type,
      subject: body.subject,
      compliance: body.compliance,
      transaction: body.transaction,
      notes: body.notes,
      transcription: body.transcription,
      ai_summary_advisor: body.ai_summary_advisor,
      ai_summary_client: body.ai_summary_client,
      status: body.status,
    })
    .eq('id', id)
    .eq('advisor_id', session.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();
  const { error } = await supabase
    .from('meeting_notes')
    .delete()
    .eq('id', id)
    .eq('advisor_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

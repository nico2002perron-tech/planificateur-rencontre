import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// GET — get activities for a lead
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('lead_activities')
    .select('*, users!lead_activities_user_id_fkey(name)')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activities = (data || []).map((a: Record<string, unknown>) => ({
    ...a,
    user_name: (a.users as { name: string } | null)?.name || '',
    users: undefined,
  }));

  return NextResponse.json(activities);
}

// POST — log a new activity
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;
  const body = await req.json();
  const supabase = createClient();

  const { data, error } = await supabase
    .from('lead_activities')
    .insert({
      lead_id: id,
      user_id: userId,
      type: body.type || 'note',
      outcome: body.outcome || null,
      notes: body.notes || null,
      ai_summary: body.ai_summary || null,
      next_action: body.next_action || null,
      next_action_date: body.next_action_date || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update lead status if provided
  if (body.new_status) {
    await supabase
      .from('leads')
      .update({ status: body.new_status, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  return NextResponse.json(data, { status: 201 });
}

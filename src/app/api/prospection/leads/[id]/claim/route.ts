import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// POST — claim a lead (assign to current user)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;
  const supabase = createClient();

  // Check if lead is still available
  const { data: lead } = await supabase.from('leads').select('claimed_by').eq('id', id).single();
  if (!lead) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
  if (lead.claimed_by) return NextResponse.json({ error: 'Ce lead a déjà été pris par un autre conseiller' }, { status: 409 });

  const { data, error } = await supabase
    .from('leads')
    .update({
      claimed_by: userId,
      status: 'new',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('claimed_by', null) // Optimistic lock
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Ce lead a déjà été pris' }, { status: 409 });
  }

  return NextResponse.json(data);
}

// DELETE — release a lead back to the pool
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('leads')
    .update({
      claimed_by: null,
      status: 'new',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('claimed_by', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const supabase = createClient();

    const { error } = await supabase.from('transition_history').insert({
      user_id: session.user.id,
      client_name: body.client_name || '',
      profile_name: body.profile_name || '',
      profile_id: body.profile_id || null,
      total_value: body.total_value || 0,
      total_buys: body.total_buys || 0,
      total_sells: body.total_sells || 0,
      total_gain_loss: body.total_gain_loss || 0,
      transactions_count: body.transactions_count || 0,
      advisor_notes: body.advisor_notes || null,
      data: body.data || {},
    });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Transition Save]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur sauvegarde' },
      { status: 500 }
    );
  }
}

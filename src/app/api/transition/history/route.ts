import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createClient();

    const { data: transitions, error } = await supabase
      .from('transition_history')
      .select('id, client_name, profile_name, total_value, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ transitions: transitions || [] });
  } catch (e) {
    console.error('[Transition History]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur historique' },
      { status: 500 }
    );
  }
}

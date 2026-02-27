import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createClient();

    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        id,
        title,
        status,
        config,
        generated_at,
        created_at,
        portfolio_id,
        client_id,
        portfolios ( id, name, account_type ),
        clients ( id, first_name, last_name )
      `)
      .eq('advisor_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Reports fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }

    // Flatten the joined data
    const result = (reports || []).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      config: r.config,
      generated_at: r.generated_at,
      created_at: r.created_at,
      portfolio_id: r.portfolio_id,
      client_id: r.client_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      portfolio_name: (r.portfolios as any)?.name || '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client_name: (r.clients as any) ? `${(r.clients as any).first_name} ${(r.clients as any).last_name}` : '',
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reports list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

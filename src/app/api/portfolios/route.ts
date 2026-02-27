import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();

  const { data, error } = await supabase
    .from('portfolios')
    .select(`
      *,
      clients!inner(first_name, last_name, advisor_id),
      holdings(id)
    `)
    .eq('clients.advisor_id', session.user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const portfolios = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    account_type: p.account_type,
    currency: p.currency,
    status: p.status,
    client_id: p.client_id,
    client_name: `${p.clients.first_name} ${p.clients.last_name}`,
    holdings_count: p.holdings?.length || 0,
    total_value: 0, // calculated client-side with live prices
    created_at: p.created_at,
  }));

  return NextResponse.json(portfolios);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = createClient();

  // Verify client belongs to this advisor
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', body.client_id)
    .eq('advisor_id', session.user.id)
    .single();

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('portfolios')
    .insert({
      client_id: body.client_id,
      name: body.name,
      account_type: body.account_type || 'REER',
      currency: body.currency || 'CAD',
      benchmark_symbols: body.benchmark_symbols || ['^GSPTSE', '^GSPC'],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

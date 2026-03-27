import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();

  const { data, error } = await supabase
    .from('model_portfolios')
    .select('*')
    .eq('created_by', session.user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  if (!body.name || !body.risk_level) {
    return NextResponse.json({ error: 'Nom et niveau de risque requis' }, { status: 400 });
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('model_portfolios')
    .insert({
      name: body.name,
      description: body.description || null,
      risk_level: body.risk_level,
      holdings: body.holdings || [],
      created_by: session.user.id,
      is_default: body.is_default || false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

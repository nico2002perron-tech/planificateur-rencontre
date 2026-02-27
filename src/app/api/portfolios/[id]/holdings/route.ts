import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase
    .from('holdings')
    .insert({
      portfolio_id: id,
      symbol: body.symbol,
      name: body.name,
      quantity: body.quantity,
      average_cost: body.average_cost,
      asset_class: body.asset_class || null,
      sector: body.sector || null,
      region: body.region || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase
    .from('holdings')
    .update({
      quantity: body.quantity,
      average_cost: body.average_cost,
      asset_class: body.asset_class,
      sector: body.sector,
      region: body.region,
      name: body.name,
    })
    .eq('id', body.holding_id)
    .eq('portfolio_id', (await params).id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { holding_id } = await request.json();
  const supabase = createClient();

  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', holding_id)
    .eq('portfolio_id', (await params).id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

/** GET — Liste les obligations de l'univers */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const source = searchParams.get('source');

  const supabase = createClient();
  let query = supabase
    .from('bonds_universe')
    .select('*')
    .order('is_mandatory', { ascending: false })
    .order('maturity');

  if (category) query = query.eq('category', category);
  if (source) query = query.eq('source', source);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bonds: data });
}

/** POST — Ajouter une obligation manuellement */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { description, issuer, cusip, coupon, maturity, price, yield: bondYield,
          spread, category, source, rating_sp, rating_dbrs, is_mandatory } = body;

  if (!description && !cusip) {
    return NextResponse.json({ error: 'description ou cusip requis' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('bonds_universe')
    .insert({
      description: description || '',
      issuer: issuer || null,
      cusip: cusip || null,
      coupon: coupon ?? null,
      maturity: maturity || null,
      price: price ?? null,
      yield: bondYield ?? null,
      spread: spread ?? null,
      category: category || null,
      source: source || 'MANUAL',
      rating_sp: rating_sp || null,
      rating_dbrs: rating_dbrs || null,
      is_mandatory: is_mandatory ?? false,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bond: data }, { status: 201 });
}

/** PUT — Modifier une obligation */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('bonds_universe')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bond: data });
}

/** DELETE — Supprimer une obligation */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase
    .from('bonds_universe')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

/** GET — Liste l'univers de titres, groupé par secteur */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('model_stock_universe')
    .select('*')
    .order('sector')
    .order('stock_type', { ascending: false }) // obligatoire en premier
    .order('position');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stocks: data });
}

/** POST — Ajouter un titre à l'univers */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { symbol, name, sector, stock_type, position, notes } = body;

  if (!symbol || !name || !sector) {
    return NextResponse.json({ error: 'symbol, name et sector requis' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('model_stock_universe')
    .upsert({
      symbol: symbol.toUpperCase(),
      name,
      sector,
      stock_type: stock_type || 'variable',
      position: position ?? 99,
      notes: notes || null,
      created_by: session.user.id,
    }, { onConflict: 'symbol,sector' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stock: data }, { status: 201 });
}

/** PUT — Mise à jour en batch (réordonner, changer type, etc.) */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { stocks } = await req.json();
  if (!Array.isArray(stocks)) {
    return NextResponse.json({ error: 'stocks[] requis' }, { status: 400 });
  }

  const supabase = createClient();
  const errors: string[] = [];

  for (const s of stocks) {
    const { id, ...updates } = s;
    if (!id) continue;
    const { error } = await supabase
      .from('model_stock_universe')
      .update(updates)
      .eq('id', id);
    if (error) errors.push(`${id}: ${error.message}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE — Supprimer un titre par ID */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase
    .from('model_stock_universe')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

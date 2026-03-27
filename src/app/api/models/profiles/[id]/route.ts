import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

/** GET — Profil par ID avec configs secteurs et bonds */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();

  const { data: profile, error } = await supabase
    .from('investment_profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  }

  const [{ data: sectors }, { data: bondConfig }] = await Promise.all([
    supabase.from('model_sector_config').select('*').eq('profile_id', id),
    supabase.from('model_bond_config').select('*').eq('profile_id', id).maybeSingle(),
  ]);

  return NextResponse.json({
    profile: { ...profile, sectors: sectors || [], bond_config: bondConfig },
  });
}

/** PUT — Modifier un profil (nom, allocations, secteurs, config bonds) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, equity_pct, bond_pct, nb_bonds, description, is_active,
          sectors, price_min_bonds, price_max_bonds } = body;

  const supabase = createClient();

  // Mettre à jour le profil principal
  const updates: Record<string, unknown> = {};
  if (name != null) updates.name = name;
  if (equity_pct != null) updates.equity_pct = equity_pct;
  if (bond_pct != null) updates.bond_pct = bond_pct;
  if (nb_bonds != null) updates.nb_bonds = nb_bonds;
  if (description !== undefined) updates.description = description;
  if (is_active != null) updates.is_active = is_active;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('investment_profiles')
      .update(updates)
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Réécrire les configs secteurs si fournies
  if (sectors && Array.isArray(sectors)) {
    await supabase.from('model_sector_config').delete().eq('profile_id', id);
    if (sectors.length > 0) {
      const rows = sectors.map((s: { sector: string; weight_pct: number; nb_titles: number }) => ({
        profile_id: id,
        sector: s.sector,
        weight_pct: s.weight_pct,
        nb_titles: s.nb_titles || 3,
      }));
      const { error: sErr } = await supabase.from('model_sector_config').insert(rows);
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
  }

  // Réécrire la config bonds si fournie
  if (price_min_bonds != null || price_max_bonds != null) {
    await supabase.from('model_bond_config').delete().eq('profile_id', id);
    await supabase.from('model_bond_config').insert({
      profile_id: id,
      price_min: price_min_bonds ?? 0,
      price_max: price_max_bonds ?? 100,
    });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE — Désactiver un profil (soft delete) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();

  const { error } = await supabase
    .from('investment_profiles')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

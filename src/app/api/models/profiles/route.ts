import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

/** GET — Liste tous les profils d'investissement avec leur config secteurs */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();

  const { data: profiles, error: pErr } = await supabase
    .from('investment_profiles')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Charger la config secteurs pour chaque profil
  const profileIds = (profiles || []).map(p => p.id);
  const { data: sectorConfigs } = await supabase
    .from('model_sector_config')
    .select('*')
    .in('profile_id', profileIds);

  // Charger la config bonds pour chaque profil
  const { data: bondConfigs } = await supabase
    .from('model_bond_config')
    .select('*')
    .in('profile_id', profileIds);

  // Assembler
  const result = (profiles || []).map(p => ({
    ...p,
    sectors: (sectorConfigs || []).filter(sc => sc.profile_id === p.id),
    bond_config: (bondConfigs || []).find(bc => bc.profile_id === p.id) || null,
  }));

  return NextResponse.json({ profiles: result });
}

/** POST — Créer un nouveau profil d'investissement */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, equity_pct, bond_pct, nb_bonds, description, sectors, price_min_bonds, price_max_bonds } = body;

  if (!name || equity_pct == null || bond_pct == null) {
    return NextResponse.json({ error: 'name, equity_pct et bond_pct requis' }, { status: 400 });
  }

  const supabase = createClient();

  // Déterminer le prochain numéro de profil
  const { data: existing } = await supabase
    .from('investment_profiles')
    .select('profile_number')
    .order('profile_number', { ascending: false })
    .limit(1);

  const nextNumber = (existing?.[0]?.profile_number || 0) + 1;
  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Créer le profil
  const { data: profile, error: pErr } = await supabase
    .from('investment_profiles')
    .insert({
      name,
      slug,
      profile_number: nextNumber,
      equity_pct,
      bond_pct,
      nb_bonds: nb_bonds || 15,
      description: description || null,
      sort_order: nextNumber,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Créer les configs secteurs si fournies
  if (sectors && Array.isArray(sectors) && sectors.length > 0) {
    const sectorRows = sectors.map((s: { sector: string; weight_pct: number; nb_titles: number }) => ({
      profile_id: profile.id,
      sector: s.sector,
      weight_pct: s.weight_pct,
      nb_titles: s.nb_titles || 3,
    }));
    await supabase.from('model_sector_config').insert(sectorRows);
  }

  // Créer la config bonds si fournie
  if (price_min_bonds != null || price_max_bonds != null) {
    await supabase.from('model_bond_config').insert({
      profile_id: profile.id,
      price_min: price_min_bonds ?? 0,
      price_max: price_max_bonds ?? 100,
    });
  }

  return NextResponse.json({ profile }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// GET — fetch leads pool (unclaimed) or my leads
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'pool'; // pool | mine | all
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  let query = supabase
    .from('leads')
    .select('*, users!leads_claimed_by_fkey(name)')
    .order('score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (view === 'pool') {
    query = query.is('claimed_by', null).eq('dncl_listed', false);
  } else if (view === 'mine') {
    query = query.eq('claimed_by', userId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,business_name.ilike.%${search}%,phone.ilike.%${search}%,city.ilike.%${search}%`);
  }

  query = query.limit(200);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = (data || []).map((l: Record<string, unknown>) => ({
    ...l,
    claimed_by_name: (l.users as { name: string } | null)?.name || null,
    users: undefined,
  }));

  return NextResponse.json(leads);
}

// POST — create a lead manually
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json();
  const { name, business_name, profession, phone, email, address, city, region, source } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: 'Nom et téléphone requis' }, { status: 400 });
  }

  const supabase = createClient();

  // Check for duplicate phone
  const { data: existing } = await supabase.from('leads').select('id').eq('phone', phone.replace(/[^0-9+]/g, '')).single();
  if (existing) {
    return NextResponse.json({ error: 'Ce numéro existe déjà dans le système' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      name,
      business_name: business_name || null,
      profession: profession || '',
      phone: phone.replace(/[^0-9+]/g, ''),
      email: email || null,
      address: address || null,
      city: city || '',
      region: region || null,
      source: source || 'manual',
      status: 'new',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

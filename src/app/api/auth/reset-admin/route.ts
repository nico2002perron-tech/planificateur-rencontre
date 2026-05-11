import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/reset-admin — Temporary: create/reset admin account
// DELETE THIS FILE after use
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { secret } = body;

  if (secret !== 'gfsf-reset-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  const password_hash = await hash('Admin2025!', 12);
  const email = 'admin@gfsf.ca';

  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) {
    // Update password
    const { data, error } = await supabase
      .from('users')
      .update({ password_hash, must_change_password: false, status: 'active' })
      .eq('id', existing.id)
      .select('id, email, name, role')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, action: 'updated', user: data });
  }

  // Create admin user
  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      name: 'Admin GFSF',
      role: 'admin',
      password_hash,
      status: 'active',
      must_change_password: false,
    })
    .select('id, email, name, role')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, action: 'created', user: data });
}

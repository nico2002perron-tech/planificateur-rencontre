import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/reset-admin — Temporary: reset an admin password
// DELETE THIS FILE after use
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, newPassword, secret } = body;

  // Simple protection — change this secret before deploying
  if (secret !== 'gfsf-reset-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!email || !newPassword) {
    return NextResponse.json({ error: 'Email and newPassword required' }, { status: 400 });
  }

  const supabase = createClient();
  const password_hash = await hash(newPassword, 12);

  const { data, error } = await supabase
    .from('users')
    .update({ password_hash, must_change_password: false })
    .eq('email', email.toLowerCase().trim())
    .select('id, email, name, role')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, user: data });
}

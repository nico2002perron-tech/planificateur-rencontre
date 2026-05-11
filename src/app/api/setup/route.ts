import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';

// GET /api/setup — Bootstrap: creates admin account if none exists
// Safe to call multiple times — does nothing if admin already exists
export async function GET() {
  const supabase = createClient();

  // Check if any admin exists
  const { data: existingAdmin } = await supabase
    .from('users')
    .select('id, email')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (existingAdmin) {
    return NextResponse.json({
      message: 'Un compte admin existe deja',
      email: existingAdmin.email,
    });
  }

  // Create admin account
  const password_hash = await hash('Admin2025!', 12);

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: 'admin@gfsf.ca',
      name: 'Admin GFSF',
      role: 'admin',
      password_hash,
      status: 'active',
      must_change_password: false,
    })
    .select('id, email, name, role')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, hint: error.hint, details: error.details }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Compte admin cree avec succes',
    user: data,
    credentials: { email: 'admin@gfsf.ca', password: 'Admin2025!' },
  }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/register — Public self-registration for conseillers
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, password, confirmPassword } = body;

  if (!name || !email || !password || !confirmPassword) {
    return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Les mots de passe ne correspondent pas' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' }, { status: 400 });
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre' }, { status: 400 });
  }

  const supabase = createClient();

  // Check if email already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Un compte avec ce courriel existe deja' }, { status: 409 });
  }

  const password_hash = await hash(password, 12);

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: 'advisor',
      password_hash,
      status: 'active',
      must_change_password: false,
    })
    .select('id, email, name, role, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

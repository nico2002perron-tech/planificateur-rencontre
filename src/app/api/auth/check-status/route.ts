import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/check-status — Check why login failed (pending, disabled, or bad credentials)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ status: 'invalid' });
  }

  const supabase = createClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('password_hash, status')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !user) {
    return NextResponse.json({ status: 'invalid' });
  }

  const valid = await compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ status: 'invalid' });
  }

  // Password is correct but account has a status issue
  return NextResponse.json({ status: user.status });
}

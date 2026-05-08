import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { hash } from 'bcryptjs';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$%&*';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  // Insert a special char and a digit at random positions for strength
  password += special[Math.floor(Math.random() * special.length)];
  password += Math.floor(Math.random() * 10);
  return password;
}

// POST /api/admin/users/[id]/reset-password — Generate temporary password
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const tempPassword = generateTempPassword();
  const password_hash = await hash(tempPassword, 12);

  const supabase = createClient();
  const { error } = await supabase
    .from('users')
    .update({ password_hash, must_change_password: true })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the temp password — shown ONCE to admin, never stored in clear
  return NextResponse.json({ tempPassword });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { compare, hash } from 'bcryptjs';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

// PUT /api/auth/change-password — User changes their own password
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Mot de passe actuel et nouveau requis' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caracteres' }, { status: 400 });
  }

  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre' }, { status: 400 });
  }

  const supabase = createClient();

  // Get current password hash
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', session.user.id)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  // Verify current password
  const valid = await compare(currentPassword, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 403 });
  }

  // Hash and save new password
  const password_hash = await hash(newPassword, 12);
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash, must_change_password: false })
    .eq('id', session.user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

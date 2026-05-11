import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Courriel', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const supabase = createClient();
        const { data: user, error } = await supabase
          .from('users')
          .select('id, email, name, role, password_hash, status, must_change_password')
          .eq('email', credentials.email.toLowerCase().trim())
          .single();

        if (error || !user) return null;

        // Check password first
        const valid = await compare(credentials.password, user.password_hash);
        if (!valid) return null;

        // Check status after password (so we can give specific error)
        if (user.status === 'pending') {
          throw new Error('PENDING_APPROVAL');
        }
        if (user.status !== 'active') {
          throw new Error('ACCOUNT_DISABLED');
        }

        // Track last login
        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.must_change_password ?? false,
        };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8h
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: 'admin' | 'advisor' }).role;
        token.id = user.id as string;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; role: string; mustChangePassword: boolean }).id = token.id as string;
        (session.user as { id: string; role: string; mustChangePassword: boolean }).role = token.role as string;
        (session.user as { id: string; role: string; mustChangePassword: boolean }).mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
};

'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Mail } from 'lucide-react';

interface LoginFormProps {
  onToggle?: () => void;
  pendingMessage?: boolean;
}

export function LoginForm({ onToggle, pendingMessage }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(pendingMessage ? 'Votre compte a ete cree. Un administrateur doit l\'approuver avant que vous puissiez vous connecter.' : '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // Login failed — check WHY (pending? disabled? bad credentials?)
      try {
        const res = await fetch('/api/auth/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (data.status === 'pending') {
          setError('Votre compte est en attente d\'approbation par un administrateur.');
        } else if (data.status === 'inactive') {
          setError('Votre compte a ete desactive. Contactez un administrateur.');
        } else {
          setError('Courriel ou mot de passe invalide');
        }
      } catch {
        setError('Courriel ou mot de passe invalide');
      }
    } else {
      router.push('/');
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {info && (
        <div className="bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-lg border border-amber-200">
          {info}
        </div>
      )}

      <div className="relative">
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted z-10" />
        <Input
          type="email"
          placeholder="Courriel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="pl-11"
        />
      </div>

      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted z-10" />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="pl-11"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} className="w-full">
        Se connecter
      </Button>
    </form>
  );
}

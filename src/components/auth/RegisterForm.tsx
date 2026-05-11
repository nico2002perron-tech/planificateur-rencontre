'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Mail, UserCircle, Eye, EyeOff, CheckCircle, Clock } from 'lucide-react';

interface RegisterFormProps {
  onToggle: () => void;
}

export function RegisterForm({ onToggle }: RegisterFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const allValid = hasUpper && hasLower && hasDigit && hasLength && passwordsMatch && name.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la creation du compte');
        return;
      }

      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 mx-auto mb-4 flex items-center justify-center">
          <Clock className="h-7 w-7 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-text-main mb-2">Compte cree avec succes!</h2>
        <p className="text-sm text-text-muted mb-6">
          Votre demande a ete envoyee. Un administrateur doit approuver votre compte avant que vous puissiez vous connecter.
        </p>
        <button
          onClick={onToggle}
          className="text-brand-primary font-semibold text-sm hover:underline"
        >
          Retour a la connexion
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted z-10" />
        <Input
          type="text"
          placeholder="Nom complet"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="pl-11"
        />
      </div>

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

      <div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted z-10" />
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="pl-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main z-10"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password.length > 0 && (
          <div className="grid grid-cols-2 gap-1 mt-2">
            {[
              { ok: hasLength, label: '8+ caracteres' },
              { ok: hasUpper, label: '1 majuscule' },
              { ok: hasLower, label: '1 minuscule' },
              { ok: hasDigit, label: '1 chiffre' },
            ].map((r) => (
              <span key={r.label} className={`text-[11px] font-medium ${r.ok ? 'text-emerald-600' : 'text-text-light'}`}>
                {r.ok ? '\u2713' : '\u25CB'} {r.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted z-10" />
          <Input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="pl-11"
          />
        </div>
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} disabled={!allValid} className="w-full">
        Demander un compte
      </Button>

      <p className="text-xs text-text-muted text-center">
        Deja un compte?{' '}
        <button type="button" onClick={onToggle} className="text-brand-primary font-semibold hover:underline">
          Se connecter
        </button>
      </p>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Eye, EyeOff, Shield, CheckCircle } from 'lucide-react';

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const hasLength = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors du changement');
        return;
      }

      setSuccess(true);
      // Sign out so they log back in with new password (clears mustChangePassword from token)
      setTimeout(() => signOut({ callbackUrl: '/login' }), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-dark via-brand-accent to-brand-primary p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 mx-auto mb-4 flex items-center justify-center">
              <Shield className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-text-main">
              Changement de mot de passe requis
            </h1>
            <p className="text-sm text-text-muted mt-2">
              {session?.user?.name ? `Bonjour ${session.user.name}, ` : ''}
              votre administrateur vous a attribue un mot de passe temporaire. Veuillez le changer maintenant.
            </p>
          </div>

          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-text-main">Mot de passe change avec succes!</p>
              <p className="text-sm text-text-muted mt-1">Reconnexion en cours...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">Mot de passe temporaire</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Mot de passe fourni par l'admin"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 caracteres"
                    required
                    className="pl-10 pr-10"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {[
                      { ok: hasLength, label: '8+ caracteres' },
                      { ok: hasUpper, label: '1 majuscule' },
                      { ok: hasLower, label: '1 minuscule' },
                      { ok: hasDigit, label: '1 chiffre' },
                    ].map((r) => (
                      <span key={r.label} className={`text-[11px] font-medium ${r.ok ? 'text-emerald-600' : 'text-text-light'}`}>
                        {r.ok ? '✓' : '○'} {r.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">Confirmer le nouveau mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez le nouveau mot de passe"
                    required
                    className="pl-10"
                  />
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>
              )}

              <Button
                type="submit"
                loading={loading}
                disabled={!hasLength || !hasUpper || !hasLower || !hasDigit || !passwordsMatch}
                className="w-full"
              >
                Changer mon mot de passe
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

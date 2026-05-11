'use client';

import { useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [justRegistered, setJustRegistered] = useState(false);

  function handleBackToLogin() {
    setJustRegistered(true);
    setMode('login');
  }

  function handleGoToRegister() {
    setJustRegistered(false);
    setMode('register');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-dark via-brand-accent to-brand-primary p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)] p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-dark mx-auto mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-xl font-[family-name:var(--font-heading)]">GF</span>
            </div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-text-main">
              Groupe Financier Ste-Foy
            </h1>
            <p className="text-sm text-text-muted mt-2">
              {mode === 'login' ? 'Planificateur de rencontre' : 'Creer un compte conseiller'}
            </p>
          </div>

          {mode === 'login' ? (
            <LoginForm onToggle={handleGoToRegister} pendingMessage={justRegistered} />
          ) : (
            <RegisterForm onToggle={handleBackToLogin} />
          )}

          {mode === 'login' && !justRegistered && (
            <p className="text-xs text-text-light text-center mt-6">
              Pas encore de compte?{' '}
              <button onClick={handleGoToRegister} className="text-brand-primary font-semibold hover:underline">
                Creer un compte
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-dark via-brand-accent to-brand-primary p-4">
      <div className="w-full max-w-md">
        {/* Logo Card */}
        <div className="bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)] p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-dark mx-auto mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-xl font-[family-name:var(--font-heading)]">GF</span>
            </div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-text-main">
              Groupe Financier Ste-Foy
            </h1>
            <p className="text-sm text-text-muted mt-2">
              Planificateur de rencontre
            </p>
          </div>

          <LoginForm />

          <p className="text-xs text-text-light text-center mt-6">
            Accès réservé aux conseillers autorisés
          </p>
        </div>
      </div>
    </div>
  );
}

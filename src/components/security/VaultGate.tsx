'use client';

import { useState, type ReactNode } from 'react';
import { useVault } from './VaultProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Lock, ShieldCheck, KeyRound, AlertTriangle } from 'lucide-react';

const MIN_LENGTH = 12;

/**
 * Enveloppe un contenu qui manipule des noms de clients. Tant que le coffre
 * n'est pas déverrouillé, on affiche l'écran de configuration / déverrouillage
 * au lieu du contenu. Les noms ne sont déchiffrés/chiffrés qu'une fois le
 * coffre ouvert, avec une phrase de passe qui ne quitte jamais le navigateur.
 */
export function VaultGate({ children, inline = false }: { children: ReactNode; inline?: boolean }) {
  const { status } = useVault();

  if (status === 'loading') {
    return <div className={`flex items-center justify-center ${inline ? 'py-6' : 'py-20'}`}><Spinner /></div>;
  }
  if (status === 'unlocked') return <>{children}</>;
  if (status === 'needs-setup') return <SetupCard inline={inline} />;
  return <UnlockCard inline={inline} />;
}

function SetupCard({ inline = false }: { inline?: boolean }) {
  const { setup } = useVault();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tooShort = pass.length > 0 && pass.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== pass;
  const canSubmit = pass.length >= MIN_LENGTH && confirm === pass && ack && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await setup(pass);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setBusy(false);
    }
  }

  return (
    <div className={inline ? '' : 'max-w-lg mx-auto mt-6'}>
      <Card className={inline ? 'p-0 shadow-none bg-transparent rounded-none' : 'p-6'}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-text-main">Protéger les noms de clients</h2>
            <p className="text-xs text-text-muted">Configuration unique du coffre chiffré</p>
          </div>
        </div>

        <p className="text-sm text-text-muted mb-4">
          Choisis une <strong className="text-text-main">phrase de passe</strong>. Elle sert à chiffrer
          le nom de chaque client avant le stockage. Elle <strong className="text-text-main">ne quitte
          jamais ton navigateur</strong> et n&apos;est enregistrée nulle part — ni chez nous, ni sur le
          serveur. Sans elle, les noms stockés sont indéchiffrables.
        </p>

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4 flex gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Si tu oublies cette phrase de passe, les noms déjà chiffrés sont
            <strong> définitivement irrécupérables</strong> (les positions, elles, restent).
            Conserve-la dans ton gestionnaire de mots de passe.
          </p>
        </div>

        <label className="block text-xs font-semibold text-text-muted mb-1">Phrase de passe</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="new-password"
          placeholder={`Au moins ${MIN_LENGTH} caractères`}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-text-main mb-1"
        />
        {tooShort && <p className="text-xs text-amber-700 mb-2">Trop courte — vise au moins {MIN_LENGTH} caractères (idéalement plusieurs mots).</p>}

        <label className="block text-xs font-semibold text-text-muted mb-1 mt-3">Confirme la phrase de passe</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="Retape-la"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-text-main mb-1"
        />
        {mismatch && <p className="text-xs text-red-600 mb-2">Les deux phrases ne correspondent pas.</p>}

        <label className="flex items-start gap-2 mt-4 mb-4 cursor-pointer">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
          <span className="text-xs text-text-muted">J&apos;ai noté ma phrase de passe en lieu sûr et je comprends qu&apos;elle ne peut pas être réinitialisée.</span>
        </label>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <Button onClick={handleSubmit} disabled={!canSubmit} loading={busy} className="w-full">
          Activer le coffre
        </Button>
      </Card>
    </div>
  );
}

function UnlockCard({ inline = false }: { inline?: boolean }) {
  const { unlock } = useVault();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!pass || busy) return;
    setBusy(true);
    setError('');
    try {
      await unlock(pass);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setBusy(false);
      setPass('');
    }
  }

  return (
    <div className={inline ? '' : 'max-w-md mx-auto mt-10'}>
      <Card className={inline ? 'p-0 shadow-none bg-transparent rounded-none' : 'p-6'}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Lock className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-text-main">Coffre verrouillé</h2>
            <p className="text-xs text-text-muted">Déverrouille pour voir et enregistrer les noms de clients</p>
          </div>
        </div>

        <label className="block text-xs font-semibold text-text-muted mb-1">Phrase de passe</label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
            autoComplete="current-password"
            placeholder="Ta phrase de passe"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm text-text-main"
          />
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <Button onClick={handleSubmit} disabled={!pass || busy} loading={busy} className="w-full mt-4">
          Déverrouiller
        </Button>
      </Card>
    </div>
  );
}

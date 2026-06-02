'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  deriveKeys, generateSalt, makeVerifier, checkVerifier,
  encryptName, decryptName, blindIndex, type VaultKeys,
} from '@/lib/crypto/clientVault';

type VaultStatus = 'loading' | 'needs-setup' | 'locked' | 'unlocked';

type VaultContextValue = {
  status: VaultStatus;
  /** Première configuration : crée la phrase de passe et déverrouille. */
  setup: (passphrase: string) => Promise<void>;
  /** Déverrouille avec une phrase de passe existante. Lève si elle est fausse. */
  unlock: (passphrase: string) => Promise<void>;
  /** Reverrouille (efface les clés de la mémoire). */
  lock: () => void;
  /** Chiffre un nom de client → à stocker dans name_enc. */
  encrypt: (name: string) => Promise<string>;
  /** Index aveugle d'un nom → à stocker dans name_idx (déterministe). */
  index: (name: string) => Promise<string>;
  /** Déchiffre un name_enc. Lève si altéré / mauvaise clé. */
  decrypt: (blob: string) => Promise<string>;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading');
  // Clés en mémoire UNIQUEMENT (jamais en localStorage/sessionStorage).
  // Un rafraîchissement complet de la page les efface → re-déverrouillage requis.
  const keysRef = useRef<VaultKeys | null>(null);
  const [salt, setSalt] = useState<string | null>(null);

  // Au montage : on regarde si le conseiller a déjà configuré son coffre.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/vault');
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        if (data.configured) {
          setSalt(data.salt);
          setStatus('locked');
        } else {
          setStatus('needs-setup');
        }
      } catch {
        if (!cancelled) setStatus('needs-setup');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setup = useCallback(async (passphrase: string) => {
    const newSalt = generateSalt();
    const keys = await deriveKeys(passphrase, newSalt);
    const verifier = await makeVerifier(keys);
    const res = await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salt: newSalt, verifier }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'Échec de la configuration du coffre');
    }
    keysRef.current = keys;
    setSalt(newSalt);
    setStatus('unlocked');
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    // On (re)charge le sel + verifier au cas où le composant a été monté sans.
    let s = salt;
    let verifier: string | null = null;
    const res = await fetch('/api/vault');
    if (res.ok) {
      const data = await res.json();
      s = data.salt;
      verifier = data.verifier;
    }
    if (!s || !verifier) throw new Error('Coffre non configuré');

    const keys = await deriveKeys(passphrase, s);
    const ok = await checkVerifier(keys, verifier);
    if (!ok) throw new Error('Phrase de passe incorrecte');

    keysRef.current = keys;
    setSalt(s);
    setStatus('unlocked');
  }, [salt]);

  const lock = useCallback(() => {
    keysRef.current = null;
    setStatus('locked');
  }, []);

  const requireKeys = (): VaultKeys => {
    if (!keysRef.current) throw new Error('Coffre verrouillé');
    return keysRef.current;
  };

  const encrypt = useCallback((name: string) => encryptName(requireKeys(), name), []);
  const index = useCallback((name: string) => blindIndex(requireKeys(), name), []);
  const decrypt = useCallback((blob: string) => decryptName(requireKeys(), blob), []);

  const value = useMemo<VaultContextValue>(
    () => ({ status, setup, unlock, lock, encrypt, index, decrypt }),
    [status, setup, unlock, lock, encrypt, index, decrypt],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault doit être utilisé dans un <VaultProvider>');
  return ctx;
}

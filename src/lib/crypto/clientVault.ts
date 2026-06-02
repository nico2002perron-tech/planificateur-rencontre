/**
 * Coffre client — chiffrement des noms de clients côté navigateur (option D).
 *
 * Tout se passe dans le navigateur du conseiller, via l'API Web Crypto :
 *   1. Une phrase de passe (jamais envoyée au serveur) + un sel par conseiller
 *      sont passés dans PBKDF2-HMAC-SHA256 (600 000 itérations) → clé maîtresse.
 *   2. HKDF dérive deux sous-clés distinctes et NON exportables :
 *        • aesKey  : AES-256-GCM, pour chiffrer/déchiffrer le nom (authentifié).
 *        • hmacKey : HMAC-SHA256, pour l'« index aveugle » déterministe.
 *
 * La base ne voit jamais ni la phrase de passe, ni la clé, ni le nom en clair —
 * seulement `name_enc` (chiffré) et `name_idx` (index opaque). Une fuite de la
 * base est donc inexploitable sans la phrase de passe.
 *
 * Pourquoi un index aveugle ? AES-GCM est randomisé (IV aléatoire) : deux
 * chiffrés du même nom diffèrent, donc impossible de chercher/grouper dessus.
 * L'index HMAC est déterministe : même nom normalisé → même index → on retrouve
 * et on regroupe un client sans jamais exposer son nom.
 */

const PBKDF2_ITERATIONS = 600_000; // recommandation OWASP pour PBKDF2-SHA256
const VERIFIER_TOKEN = 'coffre-client-v1'; // texte connu, chiffré pour valider la phrase de passe

export type VaultKeys = {
  aesKey: CryptoKey;
  hmacKey: CryptoKey;
};

// ─── Encodage ───────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const dec = new TextDecoder();

// Encode en octets avec un backing ArrayBuffer explicite (requis par les
// signatures BufferSource de l'API Web Crypto sous TypeScript récent).
function te(s: string): Uint8Array<ArrayBuffer> {
  return enc.encode(s) as Uint8Array<ArrayBuffer>;
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ─── Normalisation du nom (avant l'index aveugle) ─────────────────────────────
// « Étienne  Côté » et « etienne cote » doivent donner le même index, sinon le
// même client se retrouverait éclaté en plusieurs groupes. On retire les
// accents, on met en minuscules, on réduit les espaces.
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// ─── Génération du sel (première configuration) ───────────────────────────────
export function generateSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

// ─── Dérivation des clés ──────────────────────────────────────────────────────
export async function deriveKeys(passphrase: string, saltB64: string): Promise<VaultKeys> {
  const salt = fromB64(saltB64);

  // 1) Phrase de passe → matériel de clé maîtresse (PBKDF2, coûteux à dessein).
  const passKey = await crypto.subtle.importKey(
    'raw',
    te(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const masterBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passKey,
    256,
  );

  // 2) HKDF découpe la clé maîtresse en deux sous-clés indépendantes et NON
  //    exportables (impossible de relire les octets de clé depuis la mémoire JS).
  const hkdfKey = await crypto.subtle.importKey('raw', masterBits, 'HKDF', false, ['deriveKey']);

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te('aes-gcm-name') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  const hmacKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te('blind-index') },
    hkdfKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return { aesKey, hmacKey };
}

// ─── Chiffrement / déchiffrement du nom ───────────────────────────────────────
export async function encryptName(keys: VaultKeys, name: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.aesKey, te(name)),
  );
  // iv ‖ (chiffré + tag d'authentification)
  return toB64(concat(iv, ct));
}

/** Déchiffre. Lève une erreur si le texte a été altéré OU si la clé est mauvaise
 *  (AES-GCM vérifie le tag d'authentification). */
export async function decryptName(keys: VaultKeys, stored: string): Promise<string> {
  const raw = fromB64(stored);
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keys.aesKey, ct);
  return dec.decode(pt);
}

// ─── Index aveugle (déterministe, pour chercher / grouper) ────────────────────
export async function blindIndex(keys: VaultKeys, name: string): Promise<string> {
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', keys.hmacKey, te(normalizeName(name))),
  );
  // 16 octets (128 bits) suffisent pour une égalité sans collision pratique.
  return toB64(mac.slice(0, 16));
}

// ─── Jeton de vérification (valide la phrase de passe au déverrouillage) ──────
export async function makeVerifier(keys: VaultKeys): Promise<string> {
  return encryptName(keys, VERIFIER_TOKEN);
}

export async function checkVerifier(keys: VaultKeys, verifier: string): Promise<boolean> {
  try {
    return (await decryptName(keys, verifier)) === VERIFIER_TOKEN;
  } catch {
    return false; // tag invalide → mauvaise phrase de passe
  }
}

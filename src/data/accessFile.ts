/**
 * Accesso con password (metodo 1).
 *
 * Il file pubblico accesso.json contiene, per ogni persona autorizzata, il token GitHub e il nome del
 * repository dati cifrati con AES-256-GCM. La chiave deriva dalla password con PBKDF2-SHA256 e un sale
 * casuale per voce. Senza la password il file non rivela nulla, nemmeno dove sono i dati.
 *
 * Il file è pubblico: la sicurezza dipende dalla forza della password. Per questo la password viene
 * generata dall'app (20 caratteri casuali) e la derivazione è volutamente lenta.
 */
import { base64ToBytes, bytesToBase64 } from './base64';

/** Raccomandazione OWASP 2023+ per PBKDF2-HMAC-SHA256. */
export const DEFAULT_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 16;
export const MAX_PEOPLE = 2;

export interface AccessEntry {
  salt: string;
  iv: string;
  data: string;
}

export interface AccessFile {
  app: 'registro';
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number };
  entries: AccessEntry[];
  createdAt: string;
}

/** Contenuto cifrato di una voce. */
export interface AccessSecret {
  /** Nome della persona, solo per riconoscere la voce. */
  label: string;
  owner: string;
  repo: string;
  token: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bytes = base64ToBytes(s);
  const copy = new Uint8Array(new ArrayBuffer(bytes.length));
  copy.set(bytes);
  return copy;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Spazi iniziali/finali tolti: capita incollando o dettando la password. */
const normalize = (password: string) => password.trim();

export async function createEntry(
  secret: AccessSecret,
  password: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<AccessEntry> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(normalize(password), salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(secret)));
  return { salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(data)) };
}

/** Restituisce il contenuto della voce, o null se la password non è quella giusta. */
export async function openEntry(
  entry: AccessEntry,
  password: string,
  iterations: number,
): Promise<AccessSecret | null> {
  try {
    const key = await deriveKey(normalize(password), fromBase64(entry.salt), iterations);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(entry.iv) },
      key,
      fromBase64(entry.data),
    );
    const secret = JSON.parse(dec.decode(plain)) as Partial<AccessSecret>;
    if (!secret.owner || !secret.repo || !secret.token) return null;
    return { label: secret.label ?? '', owner: secret.owner, repo: secret.repo, token: secret.token };
  } catch {
    // AES-GCM rifiuta la decifratura con la chiave sbagliata: password errata
    return null;
  }
}

/** Prova la password su ogni voce (al massimo poche persone: qualche secondo nel caso peggiore). */
export async function unlockAccess(file: AccessFile, password: string): Promise<AccessSecret | null> {
  for (const entry of file.entries) {
    const secret = await openEntry(entry, password, file.kdf.iterations);
    if (secret) return secret;
  }
  return null;
}

export async function buildAccessFile(
  people: { secret: AccessSecret; password: string }[],
  iterations = DEFAULT_ITERATIONS,
  now: Date = new Date(),
): Promise<AccessFile> {
  const entries: AccessEntry[] = [];
  for (const p of people) entries.push(await createEntry(p.secret, p.password, iterations));
  return {
    app: 'registro',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations },
    entries,
    createdAt: now.toISOString(),
  };
}

export class AccessFileError extends Error {}

export function parseAccessFile(text: string): AccessFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AccessFileError('Il file di accesso non è leggibile.');
  }
  const f = raw as Partial<AccessFile>;
  const ok =
    f?.app === 'registro' &&
    f.version === 1 &&
    f.kdf?.name === 'PBKDF2' &&
    f.kdf.hash === 'SHA-256' &&
    Number.isInteger(f.kdf.iterations) &&
    f.kdf.iterations >= 100_000 &&
    Array.isArray(f.entries) &&
    f.entries.length > 0 &&
    f.entries.every(
      (e) => typeof e?.salt === 'string' && typeof e.iv === 'string' && typeof e.data === 'string',
    );
  if (!ok) throw new AccessFileError('Il file di accesso non è valido.');
  return f as AccessFile;
}

/** Alfabeto senza caratteri ambigui (0/O, 1/l/I): più facile da leggere se va copiata a mano. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Password casuale di 20 caratteri in 4 gruppi (≈ 115 bit), es. "kVq7m-3ZtRx-9wLp2-eHs4N". */
export function generatePassword(): string {
  const chars: string[] = [];
  // Campionamento con rifiuto: distribuzione uniforme sull'alfabeto
  const limit = 256 - (256 % ALPHABET.length);
  while (chars.length < 20) {
    for (const b of randomBytes(32)) {
      if (b < limit && chars.length < 20) chars.push(ALPHABET[b % ALPHABET.length] ?? '');
    }
  }
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join('')).join('-');
}

export function passwordProblem(password: string): string | null {
  const p = normalize(password);
  if (p.length < MIN_PASSWORD_LENGTH) {
    return `Troppo corta: servono almeno ${MIN_PASSWORD_LENGTH} caratteri. Usa «Genera».`;
  }
  if (new Set(p).size < 8) return 'Troppo prevedibile: usa «Genera».';
  return null;
}

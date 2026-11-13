import { describe, expect, it } from 'vitest';
import {
  AccessFileError,
  buildAccessFile,
  generatePassword,
  parseAccessFile,
  passwordProblem,
  unlockAccess,
} from '@/data/accessFile';

// Iterazioni ridotte solo per la velocità dei test (l'app usa 600.000)
const FAST = 100_000;
const secretA = { label: 'Titolare', owner: 'utente-prova', repo: 'registro-data', token: 'tok-titolare' };
const secretB = { label: 'Aiuto', owner: 'utente-prova', repo: 'registro-data', token: 'tok-aiuto' };

describe('file di accesso cifrato', () => {
  it('ogni persona apre la propria voce con la propria password', async () => {
    const pa = generatePassword();
    const pb = generatePassword();
    const file = await buildAccessFile(
      [
        { secret: secretA, password: pa },
        { secret: secretB, password: pb },
      ],
      FAST,
    );
    expect(await unlockAccess(file, pa)).toEqual(secretA);
    expect(await unlockAccess(file, pb)).toEqual(secretB);
    // Spazi copiati per sbaglio non bloccano l'accesso
    expect(await unlockAccess(file, `  ${pa} `)).toEqual(secretA);
  });

  it('con la password sbagliata non rivela nulla', async () => {
    const file = await buildAccessFile([{ secret: secretA, password: generatePassword() }], FAST);
    expect(await unlockAccess(file, generatePassword())).toBeNull();
    const text = JSON.stringify(file);
    for (const leak of ['tok-titolare', 'registro-data', 'utente-prova', 'Titolare'])
      expect(text).not.toContain(leak);
  });

  it('due cifrature della stessa password sono diverse (sale e IV casuali)', async () => {
    const p = generatePassword();
    const a = await buildAccessFile([{ secret: secretA, password: p }], FAST);
    const b = await buildAccessFile([{ secret: secretA, password: p }], FAST);
    expect(a.entries[0]?.data).not.toBe(b.entries[0]?.data);
  });

  it('valida il file letto dal sito', async () => {
    const file = await buildAccessFile([{ secret: secretA, password: generatePassword() }], FAST);
    expect(parseAccessFile(JSON.stringify(file))).toEqual(file);
    expect(() => parseAccessFile('<html>')).toThrow(AccessFileError);
    expect(() =>
      parseAccessFile(JSON.stringify({ ...file, kdf: { ...file.kdf, iterations: 1000 } })),
    ).toThrow(AccessFileError);
  });
});

describe('password generate', () => {
  it('sono lunghe, casuali e senza caratteri ambigui', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generatePassword();
      expect(p).toMatch(/^[a-zA-Z2-9]{5}(-[a-zA-Z2-9]{5}){3}$/);
      expect(p).not.toMatch(/[01oOlI]/);
      expect(passwordProblem(p)).toBeNull();
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });

  it('rifiuta password corte o prevedibili', () => {
    expect(passwordProblem('parrucchiera')).toMatch(/Troppo corta/);
    expect(passwordProblem('aaaaaaaaaaaaaaaaaaaa')).toMatch(/prevedibile/);
  });
});

/**
 * Repository GitHub privato contro un finto server della Contents API:
 * controlla privacy del repo, creazione del file, scrittura con SHA e conflitti.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDatabase } from '@/domain/defaults';
import { GitHubRepository } from '@/data/github';
import { ConflictError, PrivacyError } from '@/data/repository';

interface FakeState {
  private: boolean;
  push: boolean;
  file: { sha: string; content: string } | null;
  requests: { method: string; url: string; auth: string | null }[];
}

function fakeGitHub(state: FakeState) {
  let n = 0;
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    // Come GitHub, decodifica lo slash codificato da Octokit (data%2Fdb.json)
    const path = decodeURIComponent(url.pathname);
    state.requests.push({ method: req.method, url: req.url, auth: req.headers.get('authorization') });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

    if (path === '/repos/utente-prova/registro-data' && req.method === 'GET') {
      return json(200, { private: state.private, default_branch: 'main', permissions: { push: state.push } });
    }
    if (path === '/repos/utente-prova/registro-data/contents/data/db.json') {
      if (req.method === 'GET') {
        if (!state.file) return json(404, { message: 'Not Found' });
        return json(200, {
          type: 'file',
          sha: state.file.sha,
          encoding: 'base64',
          content: state.file.content,
        });
      }
      if (req.method === 'PUT') {
        const body = JSON.parse(await req.text()) as { content: string; sha?: string };
        if (state.file && body.sha !== state.file.sha) return json(409, { message: 'conflict' });
        if (!state.file && body.sha) return json(422, { message: 'sha wasn’t supplied' });
        state.file = { sha: `sha-${++n}`, content: body.content };
        return json(200, { content: { sha: state.file.sha } });
      }
    }
    return json(404, { message: 'Not Found' });
  });
}

const conn = { kind: 'github' as const, owner: 'utente-prova', repo: 'registro-data', token: 'test-token' };
let state: FakeState;

beforeEach(() => {
  state = { private: true, push: true, file: null, requests: [] };
  vi.stubGlobal('fetch', fakeGitHub(state));
});
afterEach(() => vi.unstubAllGlobals());

describe('GitHubRepository', () => {
  it('accetta solo repository privati con permesso di scrittura', async () => {
    expect((await new GitHubRepository(conn).verify()).ok).toBe(true);
    state.private = false;
    const pub = await new GitHubRepository(conn).verify();
    expect(pub.ok).toBe(false);
    expect(pub.message).toMatch(/PUBBLICO/);
    state.private = true;
    state.push = false;
    expect((await new GitHubRepository(conn).verify()).ok).toBe(false);
  });

  it('crea il registro, lo rilegge e invia il token solo come intestazione', async () => {
    const repo = new GitHubRepository(conn);
    expect(await repo.read()).toBeNull();
    const db = emptyDatabase();
    db.days['2026-01-13'] = {
      date: '2026-01-13',
      contantiCents: 12345,
      cartaCents: 0,
      varieCents: 0,
      updatedAt: 't',
    };
    const v1 = await repo.write(db, null);
    const back = await repo.read();
    expect(back?.version).toBe(v1);
    expect(back?.db.days['2026-01-13']?.contantiCents).toBe(12345);
    expect(state.requests.every((r) => r.auth === 'token test-token' || r.auth === 'bearer test-token')).toBe(
      true,
    );
    expect(state.requests.every((r) => !r.url.includes('test-token'))).toBe(true);
  });

  it('segnala un conflitto se un altro dispositivo ha salvato nel frattempo', async () => {
    const repo = new GitHubRepository(conn);
    const v1 = await repo.write(emptyDatabase(), null);
    await repo.write(emptyDatabase(), v1); // altro dispositivo
    await expect(repo.write(emptyDatabase(), v1)).rejects.toBeInstanceOf(ConflictError);
  });

  it('si ferma se il repository dei dati diventa pubblico, senza leggere né scrivere', async () => {
    state.private = false;
    const repo = new GitHubRepository(conn);
    await expect(repo.read()).rejects.toBeInstanceOf(PrivacyError);
    await expect(repo.write(emptyDatabase(), null)).rejects.toBeInstanceOf(PrivacyError);
    expect(state.file).toBeNull();
    expect(state.requests.every((r) => !r.url.includes('/contents/'))).toBe(true);
  });
});

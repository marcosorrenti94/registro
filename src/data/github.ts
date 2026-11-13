import { Octokit } from '@octokit/rest';
import type { Database } from '@/domain/types';
import { normalizeDatabase } from '@/domain/defaults';
import { base64ToUtf8, utf8ToBase64 } from './base64';
import type { GitHubConnection } from './connection';
import { AuthError, ConflictError, PrivacyError, type RemoteRepository, type RemoteSnapshot } from './repository';

/** Ogni quanto ricontrollare che il repository dei dati sia ancora privato. */
const PRIVACY_CHECK_MS = 5 * 60 * 1000;

export const DB_PATH = 'data/db.json';

export interface VerifyResult {
  ok: boolean;
  isPrivate: boolean;
  canWrite: boolean;
  hasDatabase: boolean;
  message: string;
}

function status(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status: unknown }).status)
    : undefined;
}

function wrap(err: unknown): Error {
  const s = status(err);
  if (s === 401) {
    return new AuthError(
      "Accesso scaduto o revocato: esci da questo dispositivo e accedi di nuovo. Se succede ancora, chi gestisce l'app deve rinnovare il token.",
    );
  }
  if (s === 403) return new AuthError('Il token non ha i permessi necessari (Contents: Read and write).');
  if (s === 409) return new ConflictError();
  if (err instanceof Error) return err;
  return new Error(String(err));
}

/**
 * Database salvato come data/db.json in un repository GitHub privato (Contents API).
 * Ogni scrittura usa lo SHA dell'ultima versione letta: se il file è cambiato GitHub risponde 409.
 */
export class GitHubRepository implements RemoteRepository {
  private octokit: Octokit;
  private branch: string | undefined;

  constructor(private conn: GitHubConnection) {
    this.octokit = new Octokit({
      auth: conn.token,
      userAgent: 'registro-app',
      // Niente cache HTTP del browser: lo SHA deve essere sempre il più recente
      request: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) => fetch(url, { ...init, cache: 'no-store' }),
      },
    });
    this.branch = conn.branch;
  }

  private privateCheckedAt = 0;

  /**
   * Prima di leggere o scrivere controlla (al massimo ogni 5 minuti) che il repository dei dati sia
   * ancora privato. Se qualcuno lo rendesse pubblico, l'app smette di sincronizzare.
   */
  private async ensurePrivate(): Promise<void> {
    if (Date.now() - this.privateCheckedAt < PRIVACY_CHECK_MS) return;
    try {
      const { data } = await this.octokit.rest.repos.get(this.repoParams);
      this.branch ??= data.default_branch;
      if (!data.private) throw new PrivacyError();
      this.privateCheckedAt = Date.now();
    } catch (e) {
      if (e instanceof PrivacyError) throw e;
      throw wrap(e);
    }
  }

  private get repoParams() {
    return { owner: this.conn.owner, repo: this.conn.repo };
  }

  async verify(): Promise<VerifyResult> {
    const fail = (message: string): VerifyResult => ({
      ok: false,
      isPrivate: false,
      canWrite: false,
      hasDatabase: false,
      message,
    });
    try {
      const { data } = await this.octokit.rest.repos.get(this.repoParams);
      this.branch = data.default_branch;
      const canWrite = Boolean(data.permissions?.push);
      let hasDatabase = false;
      try {
        await this.octokit.rest.repos.getContent({ ...this.repoParams, path: DB_PATH, ref: this.branch });
        hasDatabase = true;
      } catch (e) {
        if (status(e) !== 404) throw e;
      }
      if (!data.private) {
        return {
          ok: false,
          isPrivate: false,
          canWrite,
          hasDatabase,
          message: 'Il repository è PUBBLICO: i dati sarebbero visibili a tutti. Usa un repository privato.',
        };
      }
      if (!canWrite) {
        return {
          ok: false,
          isPrivate: true,
          canWrite,
          hasDatabase,
          message: 'Il token non ha il permesso di scrittura (Contents: Read and write).',
        };
      }
      return {
        ok: true,
        isPrivate: true,
        canWrite,
        hasDatabase,
        message: hasDatabase
          ? 'Connessione riuscita. Dati esistenti trovati.'
          : 'Connessione riuscita. Il registro verrà creato al primo salvataggio.',
      };
    } catch (e) {
      const s = status(e);
      if (s === 404) {
        return fail(
          'Repository non trovato: controlla utente e nome, e che il token abbia accesso a questo repository.',
        );
      }
      if (s === 401) return fail('Token non valido o scaduto.');
      throw wrap(e);
    }
  }

  async read(): Promise<RemoteSnapshot | null> {
    await this.ensurePrivate();
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        ...this.repoParams,
        path: DB_PATH,
        ref: this.branch,
      });
      if (Array.isArray(data) || data.type !== 'file') throw new Error(`${DB_PATH} non è un file valido.`);
      const text =
        data.content && data.encoding === 'base64' ? base64ToUtf8(data.content) : await this.readRaw();
      return { db: normalizeDatabase(JSON.parse(text)), version: data.sha };
    } catch (e) {
      if (status(e) === 404) return null;
      throw wrap(e);
    }
  }

  /** File oltre 1 MB: la Contents API non include il contenuto, si scarica in formato raw. */
  private async readRaw(): Promise<string> {
    const ref = this.branch ? `?ref=${encodeURIComponent(this.branch)}` : '';
    const url = `https://api.github.com/repos/${encodeURIComponent(this.conn.owner)}/${encodeURIComponent(
      this.conn.repo,
    )}/contents/${DB_PATH}${ref}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.conn.token}`,
        Accept: 'application/vnd.github.raw',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) throw new AuthError();
    if (!res.ok) throw new Error(`Impossibile scaricare il registro (HTTP ${res.status}).`);
    return res.text();
  }

  async write(db: Database, baseVersion: string | null): Promise<string> {
    await this.ensurePrivate();
    try {
      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
        ...this.repoParams,
        path: DB_PATH,
        branch: this.branch,
        message: `Aggiornamento registro ${new Date().toISOString()}`,
        content: utf8ToBase64(JSON.stringify(db, null, 1)),
        ...(baseVersion ? { sha: baseVersion } : {}),
      });
      return data.content?.sha ?? '';
    } catch (e) {
      const s = status(e);
      // 409: SHA non aggiornato · 422: file creato da un altro dispositivo senza SHA
      if (s === 409 || s === 422) throw new ConflictError();
      throw wrap(e);
    }
  }
}

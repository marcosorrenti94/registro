/**
 * Configurazione della connessione al repository dati privato.
 * Salvata SOLO nel localStorage di questo dispositivo: non viene mai inviata altrove se non a api.github.com.
 */
export interface GitHubConnection {
  kind: 'github';
  owner: string;
  repo: string;
  token: string;
  branch?: string;
}

/** Dati solo su questo dispositivo (anteprima/prova). Disponibile solo nelle build di sviluppo. */
export interface LocalConnection {
  kind: 'local';
}

export type Connection = GitHubConnection | LocalConnection;

const KEY = 'registro.connection.v1';

export const LOCAL_MODE_AVAILABLE = import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL === 'true';

export function loadConnection(): Connection | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<Omit<GitHubConnection, 'kind'>> & { kind?: string };
    if (c.kind === 'local') return LOCAL_MODE_AVAILABLE ? { kind: 'local' } : null;
    if (!c.owner || !c.repo || !c.token) return null;
    return { kind: 'github', owner: c.owner, repo: c.repo, token: c.token, ...(c.branch ? { branch: c.branch } : {}) };
  } catch {
    return null;
  }
}

export function saveConnection(c: Connection): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage non disponibile: la connessione vale solo per questa sessione */
  }
}

export function clearConnection(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

export function connectionKey(c: Connection): string {
  return c.kind === 'local' ? 'local' : `${c.owner.toLowerCase()}/${c.repo.toLowerCase()}`;
}

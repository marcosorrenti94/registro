import { AccessFileError, parseAccessFile, type AccessFile } from './accessFile';

export type AccessFileState =
  { status: 'ok'; file: AccessFile } | { status: 'missing' } | { status: 'error'; message: string };

/** Scarica il file di accesso pubblicato con l'app (mai dalla cache: può essere stato rinnovato). */
export async function loadAccessFile(): Promise<AccessFileState> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}accesso.json`, { cache: 'no-store' });
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok)
      return { status: 'error', message: `Impossibile scaricare il file di accesso (HTTP ${res.status}).` };
    const text = await res.text();
    // Il server di sviluppo risponde con la pagina dell'app ai file mancanti
    if (text.trimStart().startsWith('<')) return { status: 'missing' };
    return { status: 'ok', file: parseAccessFile(text) };
  } catch (e) {
    if (e instanceof AccessFileError) return { status: 'error', message: e.message };
    return { status: 'error', message: 'Serve la connessione a internet per il primo accesso.' };
  }
}

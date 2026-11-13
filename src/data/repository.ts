import type { Database } from '@/domain/types';

export class ConflictError extends Error {
  constructor() {
    super('I dati sono stati modificati da un altro dispositivo.');
    this.name = 'ConflictError';
  }
}

export class AuthError extends Error {
  constructor(message = 'Token non valido o permessi insufficienti.') {
    super(message);
    this.name = 'AuthError';
  }
}

/** Il repository dei dati non è più privato: la sincronizzazione si ferma per non esporre i dati. */
export class PrivacyError extends Error {
  constructor() {
    super(
      'Il repository dei dati risulta PUBBLICO: la sincronizzazione è sospesa e le modifiche restano su questo dispositivo. Rendilo di nuovo privato su GitHub (Settings → General → Change visibility).',
    );
    this.name = 'PrivacyError';
  }
}

export interface RemoteSnapshot {
  db: Database;
  /** Versione remota (SHA su GitHub): serve a rilevare le modifiche concorrenti. */
  version: string;
}

/**
 * Archivio remoto del database. La UI non conosce l'implementazione: oggi GitHub (repo privato),
 * domani ad esempio un backend SQLite + API su un home server, senza riscrivere le schermate.
 */
export interface RemoteRepository {
  /** Legge il database; null se non esiste ancora. */
  read(): Promise<RemoteSnapshot | null>;
  /**
   * Scrive il database a partire dalla versione `baseVersion` (null = creazione).
   * Se nel frattempo la versione remota è cambiata solleva ConflictError. Restituisce la nuova versione.
   */
  write(db: Database, baseVersion: string | null): Promise<string>;
}

/** Archivio "remoto" fittizio per la modalità solo dispositivo: la cache locale è l'unica copia. */
export class DeviceOnlyRepository implements RemoteRepository {
  async read(): Promise<RemoteSnapshot | null> {
    return null;
  }
  async write(): Promise<string> {
    return 'local';
  }
}

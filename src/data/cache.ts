import Dexie, { type Table } from 'dexie';
import type { Database, IsoDate } from '@/domain/types';

/** Copia locale del registro in IndexedDB: avvio istantaneo e uso offline. */
export interface CachedState {
  connectionKey: string;
  db: Database;
  /** Ultima versione remota conosciuta. */
  version: string | null;
  /** true se ci sono modifiche locali non ancora inviate. */
  dirty: boolean;
  /** Versione remota su cui si basano le modifiche locali (per la fusione in caso di conflitto). */
  base: Database | null;
  savedAt: string;
}

/** Bozza del giorno in compilazione, salvata mentre si scrive. */
export interface DraftRecord {
  key: string;
  connectionKey: string;
  date: IsoDate;
  payload: string;
  savedAt: string;
}

class CacheDb extends Dexie {
  state!: Table<CachedState, string>;
  drafts!: Table<DraftRecord, string>;

  constructor() {
    super('registro');
    this.version(1).stores({ state: 'connectionKey', drafts: 'key, connectionKey' });
  }
}

let instance: CacheDb | null = null;
function db(): CacheDb {
  instance ??= new CacheDb();
  return instance;
}

export async function readCache(connectionKey: string): Promise<CachedState | null> {
  try {
    return (await db().state.get(connectionKey)) ?? null;
  } catch {
    return null;
  }
}

export async function writeCache(state: CachedState): Promise<void> {
  try {
    await db().state.put(state);
  } catch {
    /* IndexedDB non disponibile (es. navigazione privata): si continua senza cache */
  }
}

export async function clearCache(): Promise<void> {
  try {
    await db().state.clear();
    await db().drafts.clear();
  } catch {
    /* ignora */
  }
}

const draftKey = (connectionKey: string, date: IsoDate) => `${connectionKey}|${date}`;

export async function readDraft(connectionKey: string, date: IsoDate): Promise<string | null> {
  try {
    return (await db().drafts.get(draftKey(connectionKey, date)))?.payload ?? null;
  } catch {
    return null;
  }
}

export async function writeDraft(connectionKey: string, date: IsoDate, payload: string): Promise<void> {
  try {
    await db().drafts.put({
      key: draftKey(connectionKey, date),
      connectionKey,
      date,
      payload,
      savedAt: new Date().toISOString(),
    });
  } catch {
    /* ignora */
  }
}

export async function deleteDraft(connectionKey: string, date: IsoDate): Promise<void> {
  try {
    await db().drafts.delete(draftKey(connectionKey, date));
  } catch {
    /* ignora */
  }
}

/** Chiede al browser di non cancellare i dati locali in caso di poco spazio. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted()))
      await navigator.storage.persist();
  } catch {
    /* non supportato */
  }
}

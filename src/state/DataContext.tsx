import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type { Database } from '@/domain/types';
import { emptyDatabase } from '@/domain/defaults';
import { readCache, requestPersistentStorage, writeCache } from '@/data/cache';
import { connectionKey, type Connection } from '@/data/connection';
import { GitHubRepository } from '@/data/github';
import { mergeDatabases } from '@/data/merge';
import { ConflictError, DeviceOnlyRepository, type RemoteRepository } from '@/data/repository';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface DataContextValue {
  connection: Connection;
  connectionKey: string;
  db: Database;
  loading: boolean;
  status: SyncStatus;
  /** Modifiche salvate sul dispositivo ma non ancora inviate. */
  pending: boolean;
  lastSync: string | null;
  error: string | null;
  /** Applica una modifica: la salva subito sul dispositivo e poi la sincronizza. */
  update: (mutator: (draft: Database) => Database | undefined, successMessage?: string) => Promise<boolean>;
  syncNow: () => Promise<void>;
  disconnect: () => void;
}

const Ctx = createContext<DataContextValue | null>(null);

const touch = (db: Database): Database => ({ ...db, updatedAt: new Date().toISOString() });

export function DataProvider({
  connection,
  onDisconnect,
  children,
}: {
  connection: Connection;
  onDisconnect: () => void;
  children: ReactNode;
}) {
  const key = connectionKey(connection);
  const deviceOnly = connection.kind === 'local';
  const remote = useMemo<RemoteRepository>(
    () => (connection.kind === 'github' ? new GitHubRepository(connection) : new DeviceOnlyRepository()),
    [connection],
  );

  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pending, setPending] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dbRef = useRef<Database | null>(null);
  const versionRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const baseRef = useRef<Database | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const commitLocal = useCallback(
    async (next: Database, version: string | null, dirty: boolean, base: Database | null) => {
      dbRef.current = next;
      versionRef.current = version;
      dirtyRef.current = dirty;
      baseRef.current = base;
      setDb(next);
      setPending(dirty);
      await writeCache({
        connectionKey: key,
        db: next,
        version,
        dirty,
        base,
        savedAt: new Date().toISOString(),
      });
    },
    [key],
  );

  const markSynced = useCallback(() => {
    setStatus('synced');
    setError(null);
    setLastSync(new Date().toISOString());
  }, []);

  const handleError = useCallback((e: unknown) => {
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    setStatus('error');
    setError(msg);
    toast.error('Errore di sincronizzazione', { description: msg });
  }, []);

  const pull = useCallback(async () => {
    if (deviceOnly) {
      await commitLocal(dbRef.current ?? emptyDatabase(), 'local', false, null);
      return;
    }
    const snap = await remote.read();
    if (snap) {
      await commitLocal(snap.db, snap.version, false, snap.db);
    } else {
      const initial = touch(dbRef.current ?? emptyDatabase());
      const version = await remote.write(initial, null);
      await commitLocal(initial, version, false, initial);
    }
  }, [remote, commitLocal, deviceOnly]);

  /**
   * Invia le modifiche locali. Se un altro dispositivo ha salvato nel frattempo, scarica la versione
   * remota, ci fonde sopra le modifiche locali e riprova: nessuna modifica va persa.
   */
  const pushWithMerge = useCallback(async (): Promise<string[] | null> => {
    const conflicts = new Set<string>();
    let merged = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = dbRef.current;
      if (!current) return null;
      try {
        const version = await remote.write(current, versionRef.current);
        await commitLocal(current, version, false, current);
        return merged ? [...conflicts] : null;
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e;
        merged = true;
        const snap = await remote.read();
        if (!snap) {
          await commitLocal(current, null, true, null);
          continue;
        }
        const result = mergeDatabases(baseRef.current, current, snap.db);
        result.conflicts.forEach((c) => conflicts.add(c));
        await commitLocal(touch(result.db), snap.version, true, snap.db);
      }
    }
    throw new ConflictError();
  }, [remote, commitLocal]);

  const notifyMerge = useCallback((conflicts: string[] | null) => {
    if (!conflicts) return;
    if (!conflicts.length) {
      toast.info('Dati uniti con le modifiche di un altro dispositivo');
      return;
    }
    toast.warning('Modifiche in conflitto', {
      description: `Un altro dispositivo aveva modificato gli stessi dati: ho tenuto la versione di questo dispositivo per ${conflicts.join(', ')}.`,
      duration: 15_000,
    });
  }, []);

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const sync = useCallback(
    () =>
      enqueue(async () => {
        if (deviceOnly) {
          await pull();
          markSynced();
          return;
        }
        if (!navigator.onLine) {
          setStatus('offline');
          return;
        }
        setStatus('syncing');
        try {
          if (dirtyRef.current && dbRef.current) {
            const conflicts = await pushWithMerge();
            toast.success('Modifiche offline sincronizzate');
            notifyMerge(conflicts);
          } else {
            await pull();
          }
          markSynced();
        } catch (e) {
          handleError(e);
        }
      }),
    [enqueue, pushWithMerge, notifyMerge, pull, markSynced, handleError, deviceOnly],
  );

  // Avvio: cache locale (istantanea) → sincronizzazione
  useEffect(() => {
    let cancelled = false;
    void requestPersistentStorage();
    void (async () => {
      const cached = await readCache(key);
      if (cancelled) return;
      if (cached) {
        dbRef.current = cached.db;
        versionRef.current = cached.version;
        dirtyRef.current = cached.dirty;
        baseRef.current = cached.base ?? (cached.dirty ? null : cached.db);
        setDb(cached.db);
        setPending(cached.dirty);
        setLoading(false);
      }
      await sync();
      if (cancelled) return;
      // Primo avvio offline senza copia locale: si parte vuoti, senza nulla da inviare
      if (!dbRef.current) await commitLocal(emptyDatabase(), null, false, null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si riavvia solo cambiando connessione
  }, [key]);

  useEffect(() => {
    if (deviceOnly) return;
    const onOnline = () => void sync();
    const onOffline = () => setStatus('offline');
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void sync();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sync, deviceOnly]);

  const update = useCallback<DataContextValue['update']>(
    (mutator, successMessage) =>
      enqueue(async () => {
        const draft = structuredClone(dbRef.current ?? emptyDatabase());
        const next = touch(mutator(draft) ?? draft);
        await commitLocal(next, versionRef.current, !deviceOnly, baseRef.current);
        if (deviceOnly) {
          markSynced();
          if (successMessage) toast.success(successMessage);
          return true;
        }
        if (!navigator.onLine) {
          setStatus('offline');
          toast.info('Salvato sul dispositivo', { description: 'Verrà sincronizzato appena torni online.' });
          return true;
        }
        setStatus('syncing');
        try {
          const conflicts = await pushWithMerge();
          markSynced();
          if (successMessage) toast.success(successMessage);
          notifyMerge(conflicts);
          return true;
        } catch (e) {
          // La modifica resta sul dispositivo e verrà reinviata alla prossima sincronizzazione
          handleError(e);
          return false;
        }
      }),
    [enqueue, commitLocal, pushWithMerge, notifyMerge, markSynced, handleError, deviceOnly],
  );

  const value: DataContextValue = {
    connection,
    connectionKey: key,
    db: db ?? emptyDatabase(),
    loading,
    status,
    pending,
    lastSync,
    error,
    update,
    syncNow: sync,
    disconnect: onDisconnect,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData deve essere usato dentro DataProvider');
  return ctx;
}

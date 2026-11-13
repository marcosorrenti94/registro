import type { Database } from '@/domain/types';
import { normalizeDatabase } from '@/domain/defaults';
import { isIsoDate } from '@/lib/dates';

export interface BackupFile {
  app: 'registro';
  schemaVersion: 1;
  exportedAt: string;
  data: Database;
}

export function createBackup(db: Database, now: Date = new Date()): string {
  const file: BackupFile = { app: 'registro', schemaVersion: 1, exportedAt: now.toISOString(), data: db };
  return JSON.stringify(file, null, 2);
}

export class BackupError extends Error {}

/** Legge e controlla un backup. Rifiuta file di altre app o con dati incoerenti. */
export function parseBackup(text: string): { db: Database; exportedAt: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Il file non è un backup valido (JSON non leggibile).');
  }
  const f = raw as Partial<BackupFile>;
  if (!f || f.app !== 'registro' || !f.data) {
    throw new BackupError('Il file non è un backup del Registro.');
  }
  if (f.schemaVersion !== 1) throw new BackupError('Versione del backup non supportata.');
  const db = normalizeDatabase(f.data);
  for (const [key, d] of Object.entries(db.days)) {
    if (key !== d.date || !isIsoDate(d.date)) throw new BackupError(`Giorno non valido nel backup: ${key}.`);
    for (const v of [d.contantiCents, d.cartaCents, d.varieCents]) {
      if (!Number.isSafeInteger(v) || v < 0) throw new BackupError(`Importo non valido nel giorno ${key}.`);
    }
  }
  for (const e of Object.values(db.expenses)) {
    if (!isIsoDate(e.date) || !Number.isSafeInteger(e.amountCents) || e.amountCents < 0) {
      throw new BackupError(`Uscita non valida nel backup (${e.id}).`);
    }
  }
  return { db, exportedAt: f.exportedAt ?? '' };
}

import type { Database } from '@/domain/types';
import { emptyDatabase } from '@/domain/defaults';
import { formatDateIt } from '@/lib/dates';

/**
 * Fusione a tre vie (base comune · locale · remoto) del registro, usata quando un altro dispositivo
 * ha salvato nel frattempo. Granularità: singolo giorno, singola voce di uscita, singola categoria,
 * impostazioni nel loro insieme.
 * - modificato solo in locale → vince il locale
 * - modificato solo in remoto → vince il remoto
 * - modificato in entrambi in modo diverso → vince il locale e il conflitto viene segnalato
 */
export interface MergeResult {
  db: Database;
  conflicts: string[];
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b);

function mergeValue<T>(
  base: T | undefined,
  local: T | undefined,
  remote: T | undefined,
): { value: T | undefined; conflict: boolean } {
  if (same(local, base)) return { value: remote, conflict: false };
  if (same(remote, base) || same(remote, local)) return { value: local, conflict: false };
  return { value: local, conflict: true };
}

function mergeRecords<T>(
  base: Record<string, T>,
  local: Record<string, T>,
  remote: Record<string, T>,
  describe: (key: string, value: T) => string,
  conflicts: string[],
): Record<string, T> {
  const out: Record<string, T> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const key of [...keys].sort()) {
    const { value, conflict } = mergeValue(base[key], local[key], remote[key]);
    const sample = local[key] ?? remote[key] ?? base[key];
    if (conflict && sample !== undefined) conflicts.push(describe(key, sample));
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function mergeDatabases(base: Database | null, local: Database, remote: Database): MergeResult {
  const conflicts: string[] = [];
  // Senza una base comune (dispositivo mai sincronizzato) si parte dai valori predefiniti: ciò che
  // in locale è ancora predefinito non deve sovrascrivere le personalizzazioni remote
  const b = base ?? emptyDatabase();
  const settings = mergeValue(b.settings, local.settings, remote.settings);
  if (settings.conflict) conflicts.push('Impostazioni');
  const db: Database = {
    ...remote,
    settings: settings.value ?? local.settings,
    categories: mergeRecords(b.categories, local.categories, remote.categories, (_k, c) => `Categoria ${c.name}`, conflicts),
    days: mergeRecords(b.days, local.days, remote.days, (k) => `Entrate del ${formatDateIt(k)}`, conflicts),
    expenses: mergeRecords(
      b.expenses,
      local.expenses,
      remote.expenses,
      (_k, e) => `Uscita del ${formatDateIt(e.date)}`,
      conflicts,
    ),
  };
  return { db, conflicts };
}

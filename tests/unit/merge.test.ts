import { describe, expect, it } from 'vitest';
import { emptyDatabase } from '@/domain/defaults';
import type { Database } from '@/domain/types';
import { mergeDatabases } from '@/data/merge';

const day = (date: string, contanti: number) => ({
  date,
  contantiCents: contanti,
  cartaCents: 0,
  varieCents: 0,
  updatedAt: 'x',
});

function withDays(...days: ReturnType<typeof day>[]): Database {
  const db = emptyDatabase();
  for (const d of days) db.days[d.date] = d;
  return db;
}

describe('mergeDatabases', () => {
  it('unisce giorni diversi inseriti su due dispositivi', () => {
    const base = withDays(day('2026-01-13', 100));
    const local = withDays(day('2026-01-13', 100), day('2026-01-14', 200));
    const remote = withDays(day('2026-01-13', 100), day('2026-01-15', 300));
    const r = mergeDatabases(base, local, remote);
    expect(Object.keys(r.db.days).sort()).toEqual(['2026-01-13', '2026-01-14', '2026-01-15']);
    expect(r.conflicts).toEqual([]);
  });

  it('rispetta le eliminazioni fatte su un solo dispositivo', () => {
    const base = withDays(day('2026-01-13', 100), day('2026-01-14', 200));
    const local = withDays(day('2026-01-13', 100));
    const remote = withDays(day('2026-01-13', 100), day('2026-01-14', 200));
    expect(Object.keys(mergeDatabases(base, local, remote).db.days)).toEqual(['2026-01-13']);
  });

  it('in caso di modifica dello stesso giorno vince il locale e lo segnala', () => {
    const base = withDays(day('2026-01-13', 100));
    const r = mergeDatabases(base, withDays(day('2026-01-13', 150)), withDays(day('2026-01-13', 175)));
    expect(r.db.days['2026-01-13']?.contantiCents).toBe(150);
    expect(r.conflicts).toEqual(['Entrate del 13/01/2026']);
  });

  it('prende le modifiche remote non toccate in locale', () => {
    const base = withDays(day('2026-01-13', 100));
    const remote = withDays(day('2026-01-13', 175));
    remote.settings.vatRateBps = 1000;
    const r = mergeDatabases(base, withDays(day('2026-01-13', 100)), remote);
    expect(r.db.days['2026-01-13']?.contantiCents).toBe(175);
    expect(r.db.settings.vatRateBps).toBe(1000);
  });
});

describe('mergeDatabases senza base comune', () => {
  it('un dispositivo nuovo non sovrascrive impostazioni e categorie personalizzate', () => {
    const remote = withDays(day('2026-01-13', 100));
    remote.settings.vatRateBps = 1000;
    remote.categories.altro = { ...remote.categories.altro!, name: 'Varie spese' };
    // Dispositivo nuovo: valori predefiniti più un giorno inserito offline
    const local = withDays(day('2026-01-14', 200));
    const r = mergeDatabases(null, local, remote);
    expect(r.db.settings.vatRateBps).toBe(1000);
    expect(r.db.categories.altro?.name).toBe('Varie spese');
    expect(Object.keys(r.db.days).sort()).toEqual(['2026-01-13', '2026-01-14']);
    expect(r.conflicts).toEqual([]);
  });
});

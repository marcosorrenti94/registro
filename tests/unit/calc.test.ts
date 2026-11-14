/**
 * Logica di calcolo su dati inventati. I numeri reali dell'attività sono solo nei test di
 * accettazione, che li leggono da tests/fixtures/private (escluso da git).
 */
import { describe, expect, it } from 'vitest';
import { emptyDatabase } from '@/domain/defaults';
import type { Database, DailyEntry, Expense } from '@/domain/types';
import {
  availableYears,
  computeVat,
  ricavoNetto,
  dayStatus,
  monthRows,
  monthlySummaries,
  previousYearMonth,
  summarize,
} from '@/lib/calc';
import { monthRange } from '@/lib/dates';

const T = '2026-01-01T00:00:00.000Z';

function entry(date: string, contanti: number, carta: number, varie: number): DailyEntry {
  return {
    date,
    contantiCents: contanti * 100,
    cartaCents: carta * 100,
    varieCents: varie * 100,
    updatedAt: T,
  };
}

function expense(id: string, date: string, categoryId: string, cents: number): Expense {
  return { id, date, categoryId, amountCents: cents, updatedAt: T };
}

function db(entries: DailyEntry[], expenses: Expense[] = []): Database {
  const base = emptyDatabase();
  return {
    ...base,
    days: Object.fromEntries(entries.map((e) => [e.date, e])),
    expenses: Object.fromEntries(expenses.map((e) => [e.id, e])),
  };
}

describe('computeVat', () => {
  const iva22 = { vatRateBps: 2200 };

  // IVA = (contanti + carta) × 22%, arrotondata al centesimo; netto dopo IVA = (contanti + carta) − IVA
  it.each([
    [122000, 26840, 95160],
    [100000, 22000, 78000],
    [12345, 2716, 9629],
    [99999, 22000, 77999],
  ])('su %i centesimi → IVA %i, netto dopo IVA %i', (lordo, iva, netto) => {
    const r = computeVat(lordo, iva22);
    expect(r.iva).toBe(iva);
    expect(r.nettoDopoIva).toBe(netto);
    expect(r.nettoDopoIva + r.iva).toBe(lordo);
  });

  it('gestisce aliquote diverse e importi nulli', () => {
    expect(computeVat(11000, { vatRateBps: 1000 }).iva).toBe(1100);
    expect(computeVat(0, iva22)).toEqual({ lordoImponibile: 0, iva: 0, nettoDopoIva: 0 });
  });

  it('ricavo netto = netto dopo IVA + varie', () => {
    // contanti 300 + carta 700 = 1.000 → IVA 220 → netto dopo IVA 780 → + varie 150 = 930
    expect(ricavoNetto(30000, 70000, 15000, iva22)).toBe(93000);
  });
});

describe('summarize', () => {
  const data = db(
    [entry('2026-01-13', 110, 70, 45), entry('2026-01-14', 10, 190, 30), entry('2026-02-03', 140, 0, 60)],
    [
      expense('a', '2026-01-12', 'pulizie', 4000),
      expense('b', '2026-01-14', 'prodotti', 31847),
      expense('c', '2026-01-14', 'prodotti', 1000),
    ],
  );

  it('somma entrate, uscite e netto del periodo', () => {
    const s = summarize(data, monthRange(2026, 1));
    expect(s.contanti).toBe(12000);
    expect(s.carta).toBe(26000);
    expect(s.varie).toBe(7500);
    expect(s.entrate).toBe(45500);
    expect(s.uscite).toBe(36847);
    // (38000 − 8360) + varie 7500: le uscite non vengono sottratte
    expect(s.netto).toBe(37140);
    expect(s.uscitePerCategoria).toEqual({ pulizie: 4000, prodotti: 32847 });
  });

  it("esclude Varie dall'IVA", () => {
    const s = summarize(data, monthRange(2026, 1));
    expect(s.lordoImponibile).toBe(38000);
    expect(s.iva).toBe(8360);
    expect(s.nettoDopoIva).toBe(29640);
    expect(s.netto).toBe(s.nettoDopoIva + s.varie);
  });

  it('calcola incasso medio giornaliero e giorni compilati', () => {
    const s = summarize(data, monthRange(2026, 1));
    expect(s.giorniConEntrate).toBe(2);
    expect(s.incassoMedioGiornaliero).toBe(22750);
    // 12/01 ha solo uscite: compilato ma non conta per la media
    expect(s.giorniCompilati).toBe(3);
  });

  it('non divide per zero senza dati', () => {
    const s = summarize(emptyDatabase());
    expect(s.incassoMedioGiornaliero).toBe(0);
    expect(s.percVarie).toBe(0);
    expect(s.entrate).toBe(0);
  });

  it('senza intervallo considera tutto lo storico', () => {
    expect(summarize(data).entrate).toBe(65500);
  });
});

describe('mesi e anni', () => {
  const data = db([entry('2025-04-10', 100, 0, 0), entry('2026-04-02', 50, 180, 40)]);

  it('produce sempre 12 mesi', () => {
    const months = monthlySummaries(data, 2026);
    expect(months).toHaveLength(12);
    expect(months[3]?.summary.entrate).toBe(27000);
    expect(months[2]?.summary.entrate).toBe(0);
  });

  it('confronta con lo stesso mese dell’anno precedente solo se ci sono dati', () => {
    expect(previousYearMonth(data, 2026, 4)?.entrate).toBe(10000);
    expect(previousYearMonth(data, 2026, 5)).toBeNull();
  });

  it('elenca gli anni disponibili', () => {
    expect(availableYears(data, '2026-11-13')).toEqual([2025, 2026]);
    expect(availableYears(emptyDatabase(), '2027-01-02')).toEqual([2027]);
  });
});

describe('stato dei giorni', () => {
  const settings = { closedWeekdays: [0, 1] };

  it('distingue compilato, chiuso, mancante e futuro', () => {
    expect(dayStatus('2026-01-13', true, settings, '2026-11-13')).toBe('compilato');
    expect(dayStatus('2026-01-11', false, settings, '2026-11-13')).toBe('chiuso'); // domenica
    expect(dayStatus('2026-01-12', false, settings, '2026-11-13')).toBe('chiuso'); // lunedì
    expect(dayStatus('2026-03-03', false, settings, '2026-11-13')).toBe('mancante'); // martedì
    expect(dayStatus('2026-12-01', false, settings, '2026-11-13')).toBe('futuro');
  });

  it('genera una riga per ogni giorno del mese', () => {
    const rows = monthRows(db([entry('2026-02-03', 140, 0, 60)]), 2026, 2, '2026-11-13');
    expect(rows).toHaveLength(28);
    expect(rows[2]?.entrate).toBe(20000);
    expect(rows[2]?.status).toBe('compilato');
  });
});

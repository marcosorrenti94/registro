/**
 * Test di accettazione (§6 delle specifiche): l'import del registro reale deve produrre
 * esattamente i valori attesi. Sia il registro sia i valori attesi sono dati reali dell'attività
 * e NON sono nel repository: vanno in tests/fixtures/private/ (cartella esclusa da git):
 *   - registro.xlsx  il registro Excel
 *   - expected.json      i totali attesi
 * Senza questi file i test vengono saltati.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, emptyDatabase } from '@/domain/defaults';
import type { Database } from '@/domain/types';
import { monthlySummaries, yearSummary } from '@/lib/calc';
import { applyImport, buildImportPlan, parseRegistroXlsx, type ImportResult } from '@/io/importXlsx';

const PRIVATE = '../fixtures/private/';
const FIXTURE = fileURLToPath(new URL(`${PRIVATE}registro.xlsx`, import.meta.url));
const EXPECTED = fileURLToPath(new URL(`${PRIVATE}expected.json`, import.meta.url));
const available = existsSync(FIXTURE) && existsSync(EXPECTED);

interface MonthExpected {
  month: number;
  entrate: number;
  contanti: number;
  carta: number;
  varie: number;
  uscite: number;
  netto: number;
  nettoDopoIva: number;
  lordo: number;
  iva: number;
}

interface Expected {
  anno: number;
  mesi: MonthExpected[];
  mesiVuoti: number[];
  totaleAnno: Omit<MonthExpected, 'month'>;
  giorniConEntrate: number;
  incassoMedio: number;
  percVarie: string;
  uscitePerCategoria: Record<string, number>;
}

const eur = (euros: number) => Math.round(euros * 100);

describe.skipIf(!available)('import del registro reale', () => {
  let result: ImportResult;
  let db: Database;
  let exp: Expected;

  beforeAll(async () => {
    exp = JSON.parse(readFileSync(EXPECTED, 'utf8')) as Expected;
    result = await parseRegistroXlsx(readFileSync(FIXTURE), DEFAULT_CATEGORIES);
    db = applyImport(emptyDatabase(), buildImportPlan(emptyDatabase(), result), false).db;
  });

  it('legge i 12 fogli mensili senza avvisi', () => {
    expect(result.sheets).toHaveLength(12);
    expect(result.warnings).toEqual([]);
  });

  it('i mesi con dati coincidono con i valori attesi', () => {
    const months = monthlySummaries(db, exp.anno);
    for (const row of exp.mesi) {
      const s = months[row.month - 1]!.summary;
      expect({
        entrate: s.entrate,
        contanti: s.contanti,
        carta: s.carta,
        varie: s.varie,
        uscite: s.uscite,
        netto: s.netto,
        nettoDopoIva: s.nettoDopoIva,
        lordo: s.lordoImponibile,
        iva: s.iva,
      }).toEqual({
        entrate: eur(row.entrate),
        contanti: eur(row.contanti),
        carta: eur(row.carta),
        varie: eur(row.varie),
        uscite: eur(row.uscite),
        netto: eur(row.netto),
        nettoDopoIva: eur(row.nettoDopoIva),
        lordo: eur(row.lordo),
        iva: eur(row.iva),
      });
    }
  });

  it('i mesi senza dati sono vuoti', () => {
    const months = monthlySummaries(db, exp.anno);
    for (const m of exp.mesiVuoti) expect(months[m - 1]!.summary.giorniCompilati).toBe(0);
  });

  it('totali annuali', () => {
    const y = yearSummary(db, exp.anno);
    const t = exp.totaleAnno;
    expect([
      y.entrate,
      y.contanti,
      y.carta,
      y.varie,
      y.uscite,
      y.netto,
      y.nettoDopoIva,
      y.lordoImponibile,
      y.iva,
    ]).toEqual(
      [t.entrate, t.contanti, t.carta, t.varie, t.uscite, t.netto, t.nettoDopoIva, t.lordo, t.iva].map(eur),
    );
  });

  it('ricavo netto = netto dopo IVA + varie, senza sottrarre le uscite', () => {
    const y = yearSummary(db, exp.anno);
    expect(y.netto).toBe(y.nettoDopoIva + y.varie);
    expect(y.nettoDopoIva).toBe(y.lordoImponibile - y.iva);
  });

  it('incasso medio giornaliero e % Varie', () => {
    const y = yearSummary(db, exp.anno);
    expect(y.giorniConEntrate).toBe(exp.giorniConEntrate);
    expect(y.incassoMedioGiornaliero).toBe(eur(exp.incassoMedio));
    expect((y.percVarie * 100).toFixed(2)).toBe(exp.percVarie);
  });

  it('uscite annuali per categoria', () => {
    const y = yearSummary(db, exp.anno);
    const byCat = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, y.uscitePerCategoria[c.id] ?? 0]));
    expect(byCat).toEqual(
      Object.fromEntries(Object.entries(exp.uscitePerCategoria).map(([k, v]) => [k, eur(v)])),
    );
  });

  it('un secondo import riconosce i giorni identici e non duplica nulla', () => {
    const plan = buildImportPlan(db, result);
    expect(plan.every((p) => p.state === 'identico')).toBe(true);
    const again = applyImport(db, plan, true);
    expect(again.written).toBe(0);
    expect(yearSummary(again.db, exp.anno).entrate).toBe(eur(exp.totaleAnno.entrate));
  });
});

describe('import: conflitti con giorni esistenti', () => {
  const imported: ImportResult = {
    sheets: ['Gennaio'],
    warnings: [],
    days: [
      { date: '2026-01-13', contantiCents: 11000, cartaCents: 7000, varieCents: 4500, expenses: [] },
      {
        date: '2026-01-14',
        contantiCents: 1000,
        cartaCents: 0,
        varieCents: 0,
        expenses: [{ categoryId: 'altro', amountCents: 100 }],
      },
    ],
  };
  const base = emptyDatabase();
  base.days['2026-01-13'] = {
    date: '2026-01-13',
    contantiCents: 1,
    cartaCents: 0,
    varieCents: 0,
    updatedAt: 'x',
  };

  it('segnala i giorni diversi e li salta se non si sovrascrive', () => {
    const plan = buildImportPlan(base, imported);
    expect(plan.map((p) => p.state)).toEqual(['diverso', 'nuovo']);
    const r = applyImport(base, plan, false);
    expect(r.written).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.db.days['2026-01-13']?.contantiCents).toBe(1);
  });

  it('sovrascrive entrate e uscite del giorno se richiesto', () => {
    const r = applyImport(base, buildImportPlan(base, imported), true);
    expect(r.written).toBe(2);
    expect(r.db.days['2026-01-13']?.contantiCents).toBe(11000);
    expect(Object.values(r.db.expenses).filter((e) => e.date === '2026-01-14')).toHaveLength(1);
  });
});

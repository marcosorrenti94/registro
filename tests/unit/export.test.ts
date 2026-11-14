import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { DEFAULT_CATEGORIES, emptyDatabase } from '@/domain/defaults';
import type { Database } from '@/domain/types';
import { yearSummary } from '@/lib/calc';
import { BackupError, createBackup, parseBackup } from '@/io/backupJson';
import { exportMovementsCsv } from '@/io/exportCsv';
import { colLetter, exportYearXlsx } from '@/io/exportXlsx';
import { applyImport, buildImportPlan, parseRegistroXlsx } from '@/io/importXlsx';

function sample(): Database {
  const db = emptyDatabase();
  const day = (date: string, c: number, k: number, v: number, note?: string) => {
    db.days[date] = {
      date,
      contantiCents: c,
      cartaCents: k,
      varieCents: v,
      updatedAt: 't',
      ...(note ? { note } : {}),
    };
  };
  day('2026-01-13', 11000, 7000, 4500, 'Nota; con "virgolette"');
  day('2026-01-14', 1000, 19000, 3000);
  day('2026-04-30', 0, 16000, 0);
  db.expenses.a = { id: 'a', date: '2026-01-12', categoryId: 'pulizie', amountCents: 4000, updatedAt: 't' };
  db.expenses.b = {
    id: 'b',
    date: '2026-04-30',
    categoryId: 'prodotti',
    amountCents: 31847,
    updatedAt: 't',
    note: 'Fornitore X',
  };
  db.expenses.c = { id: 'c', date: '2026-04-30', categoryId: 'prodotti', amountCents: 1153, updatedAt: 't' };
  return db;
}

describe('export Excel', () => {
  it('ha la struttura del registro: Dashboard + 12 fogli mensili', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await exportYearXlsx(sample(), 2026));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Dashboard Annuale',
      'Gennaio',
      'Febbraio',
      'Marzo',
      'Aprile',
      'Maggio',
      'Giugno',
      'Luglio',
      'Agosto',
      'Settembre',
      'Ottobre',
      'Novembre',
      'Dicembre',
    ]);
    // Riga TOTALI dopo l'ultimo giorno, come nell'originale (33 / 32 / 30)
    expect(wb.getWorksheet('Gennaio')!.getCell('A33').value).toBe('TOTALI');
    expect(wb.getWorksheet('Aprile')!.getCell('A32').value).toBe('TOTALI');
    expect(wb.getWorksheet('Febbraio')!.getCell('A30').value).toBe('TOTALI');
  });

  it('usa formule vere e non valori fissi', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await exportYearXlsx(sample(), 2026));
    const gen = wb.getWorksheet('Gennaio')!;
    const formula = (v: unknown) => (v as { formula?: string }).formula;
    expect(formula(gen.getCell('E14').value)).toBe('IF(SUM(B14:D14)=0,"",SUM(B14:D14))');
    expect(formula(gen.getCell('B33').value)).toBe('SUM(B2:B32)');
    expect(formula(gen.getCell('O13').value)).toBe('IF(SUM(G13:N13)=0,"",SUM(G13:N13))');
    // Ricavo netto = netto dopo IVA + varie; IVA = (contanti + carta) × aliquota; netto dopo IVA = lordo − IVA
    expect(formula(gen.getCell('R7').value)).toBe('R12+R5');
    expect(formula(gen.getCell('R10').value)).toBe('B33+C33');
    expect(formula(gen.getCell('R11').value)).toBe("ROUND(R10*'Dashboard Annuale'!$B$12,2)");
    expect(formula(gen.getCell('R12').value)).toBe('R10-R11');
    const dash = wb.getWorksheet('Dashboard Annuale')!;
    expect(formula(dash.getCell('B15').value)).toBe("'Gennaio'!$R$2");
    expect(formula(dash.getCell('B27').value)).toBe('SUM(B15:B26)');
    expect(dash.getCell('B12').value).toBeCloseTo(0.22);
  });

  it('reimportato restituisce gli stessi dati', async () => {
    const db = sample();
    const buf = await exportYearXlsx(db, 2026);
    const result = await parseRegistroXlsx(buf, DEFAULT_CATEGORIES);
    expect(result.warnings).toEqual([]);
    const back = applyImport(emptyDatabase(), buildImportPlan(emptyDatabase(), result), false).db;
    const a = yearSummary(db, 2026);
    const b = yearSummary(back, 2026);
    expect(b.entrate).toBe(a.entrate);
    expect(b.uscite).toBe(a.uscite);
    expect(b.iva).toBe(a.iva);
    expect(b.uscitePerCategoria).toEqual(a.uscitePerCategoria);
    // Due uscite della stessa categoria nello stesso giorno diventano una cella sommata
    expect(back.expenses['imp-2026-04-30-prodotti-0']?.amountCents).toBe(33000);
  });

  it('aggiunge le colonne delle categorie nuove dopo le 8 originali', async () => {
    const db = sample();
    db.categories.formazione = {
      id: 'formazione',
      name: 'Formazione',
      color: '#8a8390',
      order: 8,
      archived: false,
    };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await exportYearXlsx(db, 2026));
    const gen = wb.getWorksheet('Gennaio')!;
    expect(gen.getCell(`${colLetter(15)}1`).value).toBe('Formazione');
    expect(gen.getCell(`${colLetter(16)}1`).value).toBe('Totale Uscite');
  });
});

describe('backup JSON', () => {
  it('va e torna senza perdite', () => {
    const db = sample();
    expect(parseBackup(createBackup(db)).db).toEqual(db);
  });

  it('rifiuta file estranei o corrotti', () => {
    expect(() => parseBackup('non json')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(BackupError);
    const bad = JSON.parse(createBackup(sample()));
    bad.data.days['2026-01-13'].contantiCents = -5;
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/Importo non valido/);
  });
});

describe('export CSV', () => {
  it('elenca i movimenti in ordine, all’italiana', () => {
    const lines = exportMovementsCsv(sample()).replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('Data;Tipo;Voce;Importo;Nota');
    expect(lines[1]).toBe('12/01/2026;Uscita;Pulizie;-40,00;');
    expect(lines[2]).toBe('13/01/2026;Entrata;Contanti;110,00;"Nota; con ""virgolette"""');
    expect(lines).toContain('30/04/2026;Uscita;Prodotti;-318,47;Fornitore X');
  });
});

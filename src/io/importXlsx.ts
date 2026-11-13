import type { CellValue, Worksheet } from 'exceljs';
import type { Category, Database, DailyEntry, Expense, IsoDate } from '@/domain/types';
import { MONTH_NAMES, formatDateIt, isIsoDate, parseDateIt, toIso } from '@/lib/dates';
import { eurosToCents, parseAmount } from '@/lib/money';
import { loadExcelJs } from './exceljs';

/** Dati letti da un giorno del file Excel. */
export interface ImportedDay {
  date: IsoDate;
  contantiCents: number;
  cartaCents: number;
  varieCents: number;
  /** Una voce per ogni cella di uscita non vuota. */
  expenses: { categoryId: string; amountCents: number }[];
}

export interface ImportResult {
  days: ImportedDay[];
  sheets: string[];
  warnings: string[];
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');

/** Intestazioni del registro originale → id delle categorie predefinite. */
const HEADER_ALIASES: Record<string, string> = {
  affitto: 'affitto',
  bollettegas: 'gas',
  gas: 'gas',
  bolletteluce: 'luce',
  luce: 'luce',
  prodotti: 'prodotti',
  commercialista: 'commercialista',
  pulizie: 'pulizie',
  telefonointernet: 'telefono',
  telefono: 'telefono',
  internet: 'telefono',
  altro: 'altro',
};

function plainValue(v: CellValue): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return v.result; // formula: si usa il risultato calcolato
    if ('formula' in v || 'sharedFormula' in v) return undefined;
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return v.text;
  }
  return v;
}

function cellText(v: CellValue): string {
  const p = plainValue(v);
  return p == null ? '' : String(p).trim();
}

function readDate(v: CellValue): IsoDate | null {
  const p = plainValue(v);
  if (p instanceof Date) {
    // exceljs restituisce le date a mezzanotte UTC
    return toIso(p.getUTCFullYear(), p.getUTCMonth() + 1, p.getUTCDate());
  }
  if (typeof p === 'number' && p > 20000 && p < 80000) {
    // Numero seriale Excel (giorni dal 30/12/1899)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(p) * 86_400_000);
    return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (typeof p === 'string') {
    const s = p.trim();
    if (isIsoDate(s.slice(0, 10))) return s.slice(0, 10);
    return parseDateIt(s);
  }
  return null;
}

/** Importo di una cella in centesimi; null se vuota, NaN se non valida. */
function readAmount(v: CellValue): number | null {
  const p = plainValue(v);
  if (p == null || p === '') return null;
  if (typeof p === 'number') return Number.isFinite(p) ? eurosToCents(p) : Number.NaN;
  if (typeof p === 'string') {
    const parsed = parseAmount(p);
    return parsed === null ? Number.NaN : parsed || null;
  }
  return Number.NaN;
}

interface ColumnMap {
  date: number;
  contanti?: number;
  carta?: number;
  varie?: number;
  expenses: { col: number; categoryId: string }[];
}

function mapColumns(ws: Worksheet, categories: Category[], warnings: string[]): ColumnMap | null {
  const header = ws.getRow(1);
  const byName = new Map(categories.map((c) => [normalize(c.name), c.id]));
  const map: ColumnMap = { date: 0, expenses: [] };
  header.eachCell((cell, col) => {
    const key = normalize(cellText(cell.value));
    if (!key) return;
    if (key === 'data') map.date = col;
    else if (key === 'contanti') map.contanti = col;
    else if (key.startsWith('carta')) map.carta = col;
    else if (key === 'varie' || key === 'nero') map.varie = col;
    else if (key.startsWith('totale') || key.startsWith('riepilogo')) return;
    else {
      const categoryId = byName.get(key) ?? HEADER_ALIASES[key];
      if (categoryId) map.expenses.push({ col, categoryId });
      else if (col <= 15)
        warnings.push(`Foglio ${ws.name}: colonna «${cellText(cell.value)}» non riconosciuta, ignorata.`);
    }
  });
  return map.date ? map : null;
}

/**
 * Legge i fogli mensili del registro Excel. Salta le righe senza data, la riga TOTALI
 * e i giorni completamente vuoti. Le colonne vengono riconosciute dall'intestazione.
 */
export async function parseRegistroXlsx(
  data: ArrayBuffer | Uint8Array,
  categories: Category[],
): Promise<ImportResult> {
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ArrayBuffer);
  const monthNames = new Set(MONTH_NAMES.map((m) => normalize(m)));
  const warnings: string[] = [];
  const sheets: string[] = [];
  const days = new Map<IsoDate, ImportedDay>();

  for (const ws of wb.worksheets) {
    if (!monthNames.has(normalize(ws.name.replace(/\d+/g, '')))) continue;
    const cols = mapColumns(ws, categories, warnings);
    if (!cols) {
      warnings.push(`Foglio ${ws.name}: colonna «Data» non trovata, foglio ignorato.`);
      continue;
    }
    sheets.push(ws.name);

    ws.eachRow((row, r) => {
      if (r === 1) return;
      const first = cellText(row.getCell(cols.date).value);
      if (/^totali?$/i.test(first)) return;
      const date = readDate(row.getCell(cols.date).value);
      if (!date) return;

      const where = `${ws.name} riga ${r} (${formatDateIt(date)})`;
      const amount = (col: number | undefined, label: string): number => {
        if (!col) return 0;
        const v = readAmount(row.getCell(col).value);
        if (v === null) return 0;
        if (Number.isNaN(v) || v < 0) {
          warnings.push(`${where}: valore non valido in «${label}», ignorato.`);
          return 0;
        }
        return v;
      };

      const day: ImportedDay = {
        date,
        contantiCents: amount(cols.contanti, 'Contanti'),
        cartaCents: amount(cols.carta, 'Carta'),
        varieCents: amount(cols.varie, 'Varie'),
        expenses: [],
      };
      for (const { col, categoryId } of cols.expenses) {
        const v = amount(col, categoryId);
        if (v > 0) day.expenses.push({ categoryId, amountCents: v });
      }
      const empty = !day.contantiCents && !day.cartaCents && !day.varieCents && day.expenses.length === 0;
      if (empty) return;
      if (days.has(date)) warnings.push(`${where}: data ripetuta, tenuta l'ultima riga.`);
      days.set(date, day);
    });
  }

  if (!sheets.length) warnings.push('Nessun foglio mensile (Gennaio … Dicembre) trovato nel file.');
  return { days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)), sheets, warnings };
}

export type ImportDayState = 'nuovo' | 'identico' | 'diverso';

export interface ImportPlanItem {
  day: ImportedDay;
  state: ImportDayState;
}

function dayFingerprint(
  contanti: number,
  carta: number,
  varie: number,
  expenses: { categoryId: string; amountCents: number }[],
): string {
  const ex = expenses
    .map((e) => `${e.categoryId}:${e.amountCents}`)
    .sort()
    .join('|');
  return `${contanti}/${carta}/${varie}/${ex}`;
}

/** Confronta i giorni importati con quelli già presenti, per l'anteprima. */
export function buildImportPlan(db: Database, result: ImportResult): ImportPlanItem[] {
  const existingExpenses = new Map<IsoDate, Expense[]>();
  for (const e of Object.values(db.expenses)) {
    existingExpenses.set(e.date, [...(existingExpenses.get(e.date) ?? []), e]);
  }
  return result.days.map((day) => {
    const entry = db.days[day.date];
    const exp = existingExpenses.get(day.date) ?? [];
    if (!entry && exp.length === 0) return { day, state: 'nuovo' };
    const current = dayFingerprint(
      entry?.contantiCents ?? 0,
      entry?.cartaCents ?? 0,
      entry?.varieCents ?? 0,
      exp,
    );
    const incoming = dayFingerprint(day.contantiCents, day.cartaCents, day.varieCents, day.expenses);
    return { day, state: current === incoming ? 'identico' : 'diverso' };
  });
}

/**
 * Applica l'import. I giorni nuovi vengono sempre aggiunti; quelli già presenti e diversi
 * vengono sovrascritti solo se `overwrite` è true (sostituendo entrate e tutte le uscite del giorno).
 * Restituisce il nuovo database e quanti giorni sono stati scritti.
 */
export function applyImport(
  db: Database,
  plan: ImportPlanItem[],
  overwrite: boolean,
  now: string = new Date().toISOString(),
): { db: Database; written: number; skipped: number } {
  const next: Database = { ...db, days: { ...db.days }, expenses: { ...db.expenses } };
  let written = 0;
  let skipped = 0;
  for (const { day, state } of plan) {
    if (state === 'identico' || (state === 'diverso' && !overwrite)) {
      skipped++;
      continue;
    }
    for (const [id, e] of Object.entries(next.expenses)) if (e.date === day.date) delete next.expenses[id];
    const hasIncome = day.contantiCents || day.cartaCents || day.varieCents;
    if (hasIncome) {
      const entry: DailyEntry = {
        date: day.date,
        contantiCents: day.contantiCents,
        cartaCents: day.cartaCents,
        varieCents: day.varieCents,
        updatedAt: now,
      };
      next.days[day.date] = entry;
    } else {
      delete next.days[day.date];
    }
    day.expenses.forEach((e, i) => {
      const id = `imp-${day.date}-${e.categoryId}-${i}`;
      next.expenses[id] = {
        id,
        date: day.date,
        categoryId: e.categoryId,
        amountCents: e.amountCents,
        updatedAt: now,
      };
    });
    written++;
  }
  return { db: next, written, skipped };
}

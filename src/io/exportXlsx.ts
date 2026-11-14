import type { Workbook, Worksheet } from 'exceljs';
import type { Category, Database } from '@/domain/types';
import { expensesByDate } from '@/lib/calc';
import { MONTH_NAMES, daysInMonth, toIso } from '@/lib/dates';
import { loadExcelJs } from './exceljs';

const EURO = '#,##0.00 [$€-410];-#,##0.00 [$€-410]';
const PLUM = 'FF6D2F57';

/** Lettera di colonna Excel (1 → A, 27 → AA). */
export function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Struttura delle colonne di un foglio mensile, ricavata dalle categorie (8 nel registro originale). */
export interface MonthLayout {
  /** Colonne B, C, D. */
  income: { contanti: number; carta: number; varie: number };
  totalIncome: number;
  firstExpense: number;
  expenseCols: { col: number; category: Category }[];
  totalExpense: number;
  labelCol: number;
  valueCol: number;
}

export function monthLayout(categories: Category[]): MonthLayout {
  const firstExpense = 7; // G
  const expenseCols = categories.map((category, i) => ({ col: firstExpense + i, category }));
  const totalExpense = firstExpense + categories.length;
  return {
    income: { contanti: 2, carta: 3, varie: 4 },
    totalIncome: 5,
    firstExpense,
    expenseCols,
    totalExpense,
    labelCol: totalExpense + 2,
    valueCol: totalExpense + 3,
  };
}

/** Righe del riepilogo mensile (colonne Q–R nel file originale). */
export const SUMMARY_ROWS = {
  entrate: 2,
  contanti: 3,
  carta: 4,
  varie: 5,
  uscite: 6,
  netto: 7,
  lordo: 10,
  iva: 11,
  nettoDopoIva: 12,
  firstCategory: 16,
} as const;

function styleHeader(ws: Worksheet, row: number, from: number, to: number) {
  for (let c = from; c <= to; c++) {
    const cell = ws.getRow(row).getCell(c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLUM } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
}

function buildMonthSheet(wb: Workbook, db: Database, year: number, month: number, categories: Category[]) {
  const name = MONTH_NAMES[month - 1] ?? String(month);
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  const L = monthLayout(categories);
  const days = daysInMonth(year, month);
  const totalRow = days + 2;
  const lastData = days + 1;
  const byDate = expensesByDate(db.expenses);
  const C = colLetter;

  // Intestazione
  const header: Record<number, string> = {
    1: 'Data',
    [L.income.contanti]: 'Contanti',
    [L.income.carta]: 'Carta di Credito',
    [L.income.varie]: 'Varie',
    [L.totalIncome]: 'Totale Entrate',
    [L.totalExpense]: 'Totale Uscite',
  };
  for (const { col, category } of L.expenseCols) header[col] = category.name;
  for (const [col, text] of Object.entries(header)) ws.getRow(1).getCell(Number(col)).value = text;
  styleHeader(ws, 1, 1, L.totalExpense);
  ws.getRow(1).height = 32;

  // Una riga per giorno, con le formule di totale come nell'originale
  for (let d = 1; d <= days; d++) {
    const r = d + 1;
    const date = toIso(year, month, d);
    const row = ws.getRow(r);
    row.getCell(1).value = new Date(Date.UTC(year, month - 1, d));
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    const entry = db.days[date];
    if (entry) {
      if (entry.contantiCents) row.getCell(L.income.contanti).value = entry.contantiCents / 100;
      if (entry.cartaCents) row.getCell(L.income.carta).value = entry.cartaCents / 100;
      if (entry.varieCents) row.getCell(L.income.varie).value = entry.varieCents / 100;
    }
    const sums = new Map<string, number>();
    for (const e of byDate.get(date) ?? [])
      sums.set(e.categoryId, (sums.get(e.categoryId) ?? 0) + e.amountCents);
    for (const { col, category } of L.expenseCols) {
      const v = sums.get(category.id);
      if (v) row.getCell(col).value = v / 100;
    }
    row.getCell(L.totalIncome).value = {
      formula: `IF(SUM(B${r}:D${r})=0,"",SUM(B${r}:D${r}))`,
    };
    const ex = `${C(L.firstExpense)}${r}:${C(L.totalExpense - 1)}${r}`;
    row.getCell(L.totalExpense).value = { formula: `IF(SUM(${ex})=0,"",SUM(${ex}))` };
    for (let c = 2; c <= L.totalExpense; c++) row.getCell(c).numFmt = EURO;
  }

  // Riga TOTALI
  const tot = ws.getRow(totalRow);
  tot.getCell(1).value = 'TOTALI';
  for (let c = 2; c <= L.totalExpense; c++) {
    if (c === L.totalIncome + 1) continue; // colonna F vuota
    tot.getCell(c).value = { formula: `SUM(${C(c)}2:${C(c)}${lastData})` };
    tot.getCell(c).numFmt = EURO;
  }
  tot.font = { bold: true };

  // Riepilogo mensile
  const lab = L.labelCol;
  const val = L.valueCol;
  const V = (r: number) => `${C(val)}${r}`;
  const T = (c: number) => `${C(c)}${totalRow}`;
  const put = (r: number, label: string, formula: string, bold = false) => {
    ws.getRow(r).getCell(lab).value = label;
    ws.getRow(r).getCell(val).value = { formula };
    ws.getRow(r).getCell(val).numFmt = EURO;
    if (bold) {
      ws.getRow(r).getCell(lab).font = { bold: true };
      ws.getRow(r).getCell(val).font = { bold: true };
    }
  };
  ws.getRow(1).getCell(lab).value = 'RIEPILOGO MENSILE';
  ws.getRow(1).getCell(lab).font = { bold: true };
  put(SUMMARY_ROWS.entrate, 'Totale Entrate', T(L.totalIncome), true);
  put(SUMMARY_ROWS.contanti, 'Totale Contanti', T(L.income.contanti));
  put(SUMMARY_ROWS.carta, 'Totale Carta', T(L.income.carta));
  put(SUMMARY_ROWS.varie, 'Totale Varie', T(L.income.varie));
  put(SUMMARY_ROWS.uscite, 'Totale Uscite', T(L.totalExpense));
  // Ricavo netto = Netto dopo IVA + Varie (le uscite non vengono sottratte)
  put(SUMMARY_ROWS.netto, 'RICAVO NETTO', `${V(SUMMARY_ROWS.nettoDopoIva)}+${V(SUMMARY_ROWS.varie)}`, true);

  const rateRef = `'Dashboard Annuale'!$B$12`;
  ws.getRow(9).getCell(lab).value = 'CALCOLATORE IVA';
  ws.getRow(9).getCell(lab).font = { bold: true };
  put(SUMMARY_ROWS.lordo, 'Contanti + Carta', `${T(L.income.contanti)}+${T(L.income.carta)}`);
  put(SUMMARY_ROWS.iva, 'IVA', `ROUND(${V(SUMMARY_ROWS.lordo)}*${rateRef},2)`);
  put(SUMMARY_ROWS.nettoDopoIva, 'Netto dopo IVA', `${V(SUMMARY_ROWS.lordo)}-${V(SUMMARY_ROWS.iva)}`);

  ws.getRow(15).getCell(lab).value = 'USCITE PER CATEGORIA';
  ws.getRow(15).getCell(lab).font = { bold: true };
  L.expenseCols.forEach(({ col, category }, i) => put(SUMMARY_ROWS.firstCategory + i, category.name, T(col)));

  ws.getColumn(1).width = 12;
  for (let c = 2; c <= L.totalExpense; c++) ws.getColumn(c).width = 13;
  ws.getColumn(lab).width = 26;
  ws.getColumn(val).width = 15;
  return { name, L };
}

function buildDashboard(ws: Worksheet, db: Database, year: number, categories: Category[]) {
  const L = monthLayout(categories);
  const R = (row: number) => `$${colLetter(L.valueCol)}$${row}`;
  const ref = (month: number, row: number) => `'${MONTH_NAMES[month - 1]}'!${R(row)}`;
  const C = colLetter;

  ws.getCell('A1').value = `${db.settings.businessName}: dashboard ${year}`;
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: PLUM } };

  // Tabella mensile (righe 15–26) e totale (27), come nell'originale
  const first = 15;
  const totalRow = first + 12;
  const heads = [
    'Mese',
    'Totale Entrate',
    'Contanti',
    'Carta',
    'Varie',
    'Totale Uscite',
    'Ricavo Netto',
    'Netto dopo IVA',
    'IVA',
  ];
  ws.getCell('A13').value = 'RIEPILOGO MENSILE';
  ws.getCell('A13').font = { bold: true };
  heads.forEach((h, i) => (ws.getRow(14).getCell(i + 1).value = h));
  styleHeader(ws, 14, 1, heads.length);
  const sources = [
    SUMMARY_ROWS.entrate,
    SUMMARY_ROWS.contanti,
    SUMMARY_ROWS.carta,
    SUMMARY_ROWS.varie,
    SUMMARY_ROWS.uscite,
    SUMMARY_ROWS.netto,
    SUMMARY_ROWS.nettoDopoIva,
    SUMMARY_ROWS.iva,
  ];
  for (let m = 1; m <= 12; m++) {
    const row = ws.getRow(first + m - 1);
    row.getCell(1).value = MONTH_NAMES[m - 1];
    sources.forEach((src, i) => {
      row.getCell(i + 2).value = { formula: ref(m, src) };
      row.getCell(i + 2).numFmt = EURO;
    });
  }
  const tot = ws.getRow(totalRow);
  tot.getCell(1).value = 'TOTALE ANNUALE';
  for (let c = 2; c <= heads.length; c++) {
    tot.getCell(c).value = { formula: `SUM(${C(c)}${first}:${C(c)}${totalRow - 1})` };
    tot.getCell(c).numFmt = EURO;
  }
  tot.font = { bold: true };

  // KPI (righe 3–12)
  ws.getCell('A3').value = 'INDICATORI';
  ws.getCell('A3').font = { bold: true };
  const kpi = (r: number, label: string, formula: string, fmt = EURO) => {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`B${r}`).value = { formula };
    ws.getCell(`B${r}`).numFmt = fmt;
  };
  kpi(4, 'Incasso Totale Annuale', `B${totalRow}`);
  kpi(5, 'Spese Totali Annuali', `F${totalRow}`);
  kpi(6, 'Ricavo Netto Annuale', `G${totalRow}`);
  kpi(7, 'Contanti + Carta', `C${totalRow}+D${totalRow}`);
  kpi(8, 'IVA Totale', `I${totalRow}`);
  kpi(9, 'Netto dopo IVA', `H${totalRow}`);
  kpi(10, 'Percentuale Varie', `IFERROR(E${totalRow}/B${totalRow},0)`, '0.00%');

  // Incasso medio giornaliero: somma dei totali giornalieri > 0 / giorni con entrate
  const ranges = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `'${MONTH_NAMES[i]}'!$E$2:$E$${daysInMonth(year, m) + 1}`;
  });
  ws.getCell('D4').value = 'Incasso medio giornaliero';
  ws.getCell('E4').value = {
    formula: `IFERROR((${ranges.map((r) => `SUMIF(${r},">0")`).join('+')})/(${ranges
      .map((r) => `COUNTIF(${r},">0")`)
      .join('+')}),0)`,
  };
  ws.getCell('E4').numFmt = EURO;
  ws.getCell('D5').value = 'Totale Contanti';
  ws.getCell('E5').value = { formula: `C${totalRow}` };
  ws.getCell('E5').numFmt = EURO;
  ws.getCell('D6').value = 'Totale Carta';
  ws.getCell('E6').value = { formula: `D${totalRow}` };
  ws.getCell('E6').numFmt = EURO;

  ws.getCell('A12').value = 'Aliquota IVA';
  ws.getCell('B12').value = db.settings.vatRateBps / 10_000;
  ws.getCell('B12').numFmt = '0.00%';
  ws.getCell('C12').value = 'Modifica l’aliquota qui: tutte le formule si aggiornano.';
  ws.getCell('C12').font = { italic: true, color: { argb: 'FF6E6575' } };

  // Uscite annuali per categoria
  const catStart = totalRow + 3;
  ws.getCell(`A${catStart - 1}`).value = 'DISTRIBUZIONE USCITE ANNUALI';
  ws.getCell(`A${catStart - 1}`).font = { bold: true };
  L.expenseCols.forEach(({ category }, i) => {
    const r = catStart + i;
    ws.getCell(`A${r}`).value = category.name;
    ws.getCell(`B${r}`).value = {
      formula: Array.from({ length: 12 }, (_, m) => ref(m + 1, SUMMARY_ROWS.firstCategory + i)).join('+'),
    };
    ws.getCell(`B${r}`).numFmt = EURO;
  });

  // Confronto metodi di pagamento
  const payStart = catStart + L.expenseCols.length + 2;
  ws.getCell(`A${payStart}`).value = 'CONFRONTO METODI DI PAGAMENTO';
  ws.getCell(`A${payStart}`).font = { bold: true };
  ['Mese', 'Contanti', 'Carta', 'Varie'].forEach(
    (h, i) => (ws.getRow(payStart + 1).getCell(i + 1).value = h),
  );
  styleHeader(ws, payStart + 1, 1, 4);
  for (let m = 1; m <= 12; m++) {
    const row = ws.getRow(payStart + 1 + m);
    row.getCell(1).value = MONTH_NAMES[m - 1];
    [SUMMARY_ROWS.contanti, SUMMARY_ROWS.carta, SUMMARY_ROWS.varie].forEach((src, i) => {
      row.getCell(i + 2).value = { formula: ref(m, src) };
      row.getCell(i + 2).numFmt = EURO;
    });
  }

  ws.getColumn(1).width = 30;
  for (let c = 2; c <= 9; c++) ws.getColumn(c).width = 15;
  ws.getColumn(4).width = 26;
}

/**
 * Esporta un anno con la stessa struttura del registro originale (12 fogli mensili + Dashboard
 * Annuale) e formule vere. Le categorie archiviate compaiono solo se usate nell'anno.
 */
export async function exportYearXlsx(db: Database, year: number): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Registro';
  wb.created = new Date();
  // Le celle non hanno valori precalcolati: Excel ricalcola tutte le formule all'apertura
  wb.calcProperties.fullCalcOnLoad = true;
  const used = new Set(
    Object.values(db.expenses)
      .filter((e) => e.date.startsWith(`${year}-`))
      .map((e) => e.categoryId),
  );
  const categories = Object.values(db.categories)
    .filter((c) => !c.archived || used.has(c.id))
    .sort((a, b) => a.order - b.order);
  // Uscite di categorie cancellate: finiscono in una colonna a parte per non perdere importi
  const known = new Set(categories.map((c) => c.id));
  for (const id of used) {
    if (!known.has(id))
      categories.push({ id, name: 'Categoria eliminata', color: '#8a8390', order: 999, archived: true });
  }

  const dash = wb.addWorksheet('Dashboard Annuale');
  for (let m = 1; m <= 12; m++) buildMonthSheet(wb, db, year, m, categories);
  buildDashboard(dash, db, year, categories);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

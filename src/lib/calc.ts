/**
 * Logica di calcolo pura del registro: giorno → mese → anno, KPI e IVA.
 * Tutti gli importi sono in centesimi interi. Nessuna dipendenza dalla UI.
 */
import type { Cents, Database, DailyEntry, Expense, IsoDate, Settings } from '@/domain/types';
import { divRound } from './money';
import { monthDates, monthRange, parseIso, todayIso, weekday, yearRange } from './dates';

export type CalcInput = Pick<Database, 'days' | 'expenses' | 'settings'>;

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export interface VatResult {
  /** Contanti + Carta (Varie esclusa). */
  lordoImponibile: Cents;
  /** Base imponibile: in scorporo è il netto IVA, in aggiunta coincide con il lordo. */
  imponibile: Cents;
  iva: Cents;
  /** In aggiunta: imponibile + IVA. In scorporo coincide con il lordo (l'IVA è già inclusa). */
  totaleConIva: Cents;
}

export interface PeriodSummary extends VatResult {
  contanti: Cents;
  carta: Cents;
  varie: Cents;
  entrate: Cents;
  uscite: Cents;
  /** Totale Entrate − Totale Uscite (come nell'Excel). */
  netto: Cents;
  /** Ricavo Netto − IVA. */
  nettoDopoIva: Cents;
  /** Fatturato Dichiarato = imponibile. */
  fatturatoDichiarato: Cents;
  giorniConEntrate: number;
  /** Σ totali giornalieri > 0 / n° giorni con entrate > 0 (0 se non ci sono giorni). */
  incassoMedioGiornaliero: Cents;
  /** Varie / Totale Entrate (0 se non ci sono entrate). */
  percVarie: number;
  uscitePerCategoria: Record<string, Cents>;
  /** Giorni con entrate o uscite registrate. */
  giorniCompilati: number;
}

/** Calcolo IVA secondo l'aliquota e la modalità delle Impostazioni. */
export function computeVat(
  lordoImponibile: Cents,
  settings: Pick<Settings, 'vatRateBps' | 'vatMode'>,
): VatResult {
  const bps = settings.vatRateBps;
  if (settings.vatMode === 'aggiunta') {
    const iva = divRound(lordoImponibile * bps, 10_000);
    return { lordoImponibile, imponibile: lordoImponibile, iva, totaleConIva: lordoImponibile + iva };
  }
  const imponibile = divRound(lordoImponibile * 10_000, 10_000 + bps);
  return { lordoImponibile, imponibile, iva: lordoImponibile - imponibile, totaleConIva: lordoImponibile };
}

export function entryIncome(entry: DailyEntry | undefined): Cents {
  return entry ? entry.contantiCents + entry.cartaCents + entry.varieCents : 0;
}

function inRange(date: IsoDate, range: DateRange | undefined): boolean {
  return !range || (date >= range.from && date <= range.to);
}

/** Uscite raggruppate per data (ordinate per categoria e inserimento). */
export function expensesByDate(expenses: Database['expenses']): Map<IsoDate, Expense[]> {
  const map = new Map<IsoDate, Expense[]>();
  for (const e of Object.values(expenses)) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  for (const list of map.values()) list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return map;
}

export function summarize(input: CalcInput, range?: DateRange): PeriodSummary {
  let contanti = 0;
  let carta = 0;
  let varie = 0;
  let giorniConEntrate = 0;
  let sommaGiorniConEntrate = 0;
  const compiled = new Set<IsoDate>();

  for (const entry of Object.values(input.days)) {
    if (!inRange(entry.date, range)) continue;
    contanti += entry.contantiCents;
    carta += entry.cartaCents;
    varie += entry.varieCents;
    compiled.add(entry.date);
    const tot = entryIncome(entry);
    if (tot > 0) {
      giorniConEntrate++;
      sommaGiorniConEntrate += tot;
    }
  }

  let uscite = 0;
  const uscitePerCategoria: Record<string, Cents> = {};
  for (const e of Object.values(input.expenses)) {
    if (!inRange(e.date, range)) continue;
    uscite += e.amountCents;
    uscitePerCategoria[e.categoryId] = (uscitePerCategoria[e.categoryId] ?? 0) + e.amountCents;
    compiled.add(e.date);
  }

  const entrate = contanti + carta + varie;
  const netto = entrate - uscite;
  const vat = computeVat(contanti + carta, input.settings);
  return {
    contanti,
    carta,
    varie,
    entrate,
    uscite,
    netto,
    ...vat,
    nettoDopoIva: netto - vat.iva,
    fatturatoDichiarato: vat.imponibile,
    giorniConEntrate,
    incassoMedioGiornaliero: giorniConEntrate ? divRound(sommaGiorniConEntrate, giorniConEntrate) : 0,
    percVarie: entrate ? varie / entrate : 0,
    uscitePerCategoria,
    giorniCompilati: compiled.size,
  };
}

export interface MonthSummary {
  year: number;
  /** 1–12 */
  month: number;
  summary: PeriodSummary;
}

/** Riepilogo dei 12 mesi di un anno (stesso contenuto della tabella della Dashboard Excel). */
export function monthlySummaries(input: CalcInput, year: number): MonthSummary[] {
  return Array.from({ length: 12 }, (_, i) => ({
    year,
    month: i + 1,
    summary: summarize(input, monthRange(year, i + 1)),
  }));
}

export function yearSummary(input: CalcInput, year: number): PeriodSummary {
  return summarize(input, yearRange(year));
}

/** Anni che contengono almeno un dato, più l'anno corrente, in ordine crescente. */
export function availableYears(
  input: Pick<Database, 'days' | 'expenses'>,
  today: IsoDate = todayIso(),
): number[] {
  const years = new Set<number>([parseIso(today).year]);
  for (const d of Object.keys(input.days)) years.add(parseIso(d).year);
  for (const e of Object.values(input.expenses)) years.add(parseIso(e.date).year);
  return [...years].sort((a, b) => a - b);
}

export type DayStatus = 'compilato' | 'mancante' | 'chiuso' | 'futuro';

export interface DayRow {
  date: IsoDate;
  entry: DailyEntry | undefined;
  expenses: Expense[];
  contanti: Cents;
  carta: Cents;
  varie: Cents;
  entrate: Cents;
  uscite: Cents;
  status: DayStatus;
}

/**
 * Stato di un giorno: compilato se ha entrate o uscite registrate; altrimenti chiuso (giorno di
 * chiusura settimanale), futuro, oppure mancante (giorno lavorativo passato senza dati).
 */
export function dayStatus(
  date: IsoDate,
  hasData: boolean,
  settings: Pick<Settings, 'closedWeekdays'>,
  today: IsoDate = todayIso(),
): DayStatus {
  if (hasData) return 'compilato';
  if (date > today) return 'futuro';
  if (settings.closedWeekdays.includes(weekday(date))) return 'chiuso';
  return 'mancante';
}

export function dayRow(
  input: CalcInput,
  date: IsoDate,
  byDate: Map<IsoDate, Expense[]> = expensesByDate(input.expenses),
  today: IsoDate = todayIso(),
): DayRow {
  const entry = input.days[date];
  const expenses = byDate.get(date) ?? [];
  const uscite = expenses.reduce((s, e) => s + e.amountCents, 0);
  return {
    date,
    entry,
    expenses,
    contanti: entry?.contantiCents ?? 0,
    carta: entry?.cartaCents ?? 0,
    varie: entry?.varieCents ?? 0,
    entrate: entryIncome(entry),
    uscite,
    status: dayStatus(date, Boolean(entry) || expenses.length > 0, input.settings, today),
  };
}

export function monthRows(
  input: CalcInput,
  year: number,
  month: number,
  today: IsoDate = todayIso(),
): DayRow[] {
  const byDate = expensesByDate(input.expenses);
  return monthDates(year, month).map((d) => dayRow(input, d, byDate, today));
}

/** Variazione relativa rispetto a un valore precedente (null se il precedente è 0). */
export function relativeChange(current: Cents, previous: Cents): number | null {
  return previous === 0 ? null : (current - previous) / Math.abs(previous);
}

/** Riepilogo dello stesso mese dell'anno precedente, solo se in quel mese ci sono dati. */
export function previousYearMonth(input: CalcInput, year: number, month: number): PeriodSummary | null {
  const prev = summarize(input, monthRange(year - 1, month));
  return prev.giorniCompilati > 0 ? prev : null;
}

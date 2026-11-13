import type { IsoDate } from '@/domain/types';

export const MONTH_NAMES = [
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
] as const;

export const MONTH_SHORT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
] as const;

/** Nomi dei giorni con la settimana che inizia di lunedì. */
export const WEEKDAY_SHORT_MON_FIRST = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const;
export const WEEKDAY_NAMES = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
] as const;

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function toIso(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function isIsoDate(s: string): s is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { year, month, day } = parseIso(s);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseIso(date: IsoDate): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { year: y ?? 0, month: m ?? 0, day: d ?? 0 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = domenica … 6 = sabato. */
export function weekday(date: IsoDate): number {
  const { year, month, day } = parseIso(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Indice del giorno con settimana che inizia di lunedì: 0 = lunedì … 6 = domenica. */
export function weekdayMonFirst(date: IsoDate): number {
  return (weekday(date) + 6) % 7;
}

export function addDays(date: IsoDate, delta: number): IsoDate {
  const { year, month, day } = parseIso(date);
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** "gg/mm/aaaa" */
export function formatDateIt(date: IsoDate): string {
  const { year, month, day } = parseIso(date);
  return `${pad(day)}/${pad(month)}/${pad(year, 4)}`;
}

/** "Venerdì 13 novembre 2026" */
export function formatDateLong(date: IsoDate): string {
  const { year, month, day } = parseIso(date);
  return `${WEEKDAY_NAMES[weekday(date)]} ${day} ${MONTH_NAMES[month - 1]?.toLowerCase()} ${year}`;
}

/** "14 gennaio 2026" */
export function formatDayMonthYear(date: IsoDate): string {
  const { year, month, day } = parseIso(date);
  return `${day} ${MONTH_NAMES[month - 1]?.toLowerCase()} ${year}`;
}

/** Interpreta "gg/mm/aaaa" (anche "g/m/aaaa"). */
export function parseDateIt(s: string): IsoDate | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const iso = toIso(Number(m[3]), Number(m[2]), Number(m[1]));
  return isIsoDate(iso) ? iso : null;
}

export function monthDates(year: number, month: number): IsoDate[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => toIso(year, month, i + 1));
}

export function monthRange(year: number, month: number): { from: IsoDate; to: IsoDate } {
  return { from: toIso(year, month, 1), to: toIso(year, month, daysInMonth(year, month)) };
}

export function yearRange(year: number): { from: IsoDate; to: IsoDate } {
  return { from: toIso(year, 1, 1), to: toIso(year, 12, 31) };
}

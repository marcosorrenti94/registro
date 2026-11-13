import type { Cents } from '@/domain/types';

/** Divisione intera con arrotondamento al più vicino (metà lontano da zero). */
export function divRound(numerator: number, denominator: number): number {
  if (denominator === 0) throw new RangeError('Divisione per zero');
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const q = Math.floor(n / d);
  const r = n - q * d;
  return sign * (2 * r >= d ? q + 1 : q);
}

/** Converte un numero di euro (anche con decimali float, es. da Excel) in centesimi interi. */
export function eurosToCents(euros: number): Cents {
  return Math.round(euros * 100 + (euros >= 0 ? 1e-9 : -1e-9));
}

/**
 * Interpreta un importo scritto dall'utente. Accetta sia "," sia "." come separatore decimale
 * e il punto come separatore delle migliaia: "12", "12,5", "12.50", "1.234,56", "1234.56".
 * Restituisce i centesimi, oppure null se il testo non è un importo valido (≥ 0, max 2 decimali).
 * Una stringa vuota vale 0.
 */
export function parseAmount(input: string): Cents | null {
  // \s comprende anche lo spazio non separabile usato da Intl
  let s = input.trim().replace(/€/g, '').replace(/\s/g, '');
  if (s === '') return 0;
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let decimalSep: ',' | '.' | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimalSep = s.indexOf(',') === lastComma ? ',' : null;
    if (decimalSep === null) return null; // più virgole senza punto: non valido
  } else if (lastDot >= 0) {
    const dots = s.split('.').length - 1;
    const after = s.length - lastDot - 1;
    // "1.234" o "1.234.567": punto delle migliaia all'italiana; "12.5" / "12.50": decimale
    decimalSep = dots === 1 && after !== 3 ? '.' : null;
  }

  let intPart = s;
  let decPart = '';
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx);
    decPart = s.slice(idx + 1);
  }
  const thousandsSep = decimalSep === ',' ? '.' : decimalSep === '.' ? ',' : '.';
  if (intPart.includes(thousandsSep)) {
    const groups = intPart.split(thousandsSep);
    if (groups.some((g, i) => (i === 0 ? g.length < 1 || g.length > 3 : g.length !== 3))) return null;
    intPart = groups.join('');
  }
  if (/[.,]/.test(intPart) || /[.,]/.test(decPart)) return null;
  if (decPart.length > 2) return null;
  if (intPart === '') intPart = '0';
  s = `${intPart}${decPart.padEnd(2, '0')}`;
  const value = Number(s);
  return Number.isSafeInteger(value) ? value : null;
}

const numberFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

/** Formatta i centesimi come "€ 1.234,56" (negativi: "-€ 1.234,56"). */
export function formatEuro(cents: Cents): string {
  const abs = numberFormat.format(Math.abs(cents) / 100);
  return cents < 0 ? `-€ ${abs}` : `€ ${abs}`;
}

/** Formatta senza simbolo: "1.234,56". */
export function formatAmount(cents: Cents): string {
  const abs = numberFormat.format(Math.abs(cents) / 100);
  return cents < 0 ? `-${abs}` : abs;
}

/** Valore da mostrare in un campo di input: "" per zero, altrimenti "12,50". */
export function centsToInput(cents: Cents): string {
  if (!cents) return '';
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest ? `${euros},${String(rest).padStart(2, '0')}` : String(euros);
}

const percentFormat = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formatta un rapporto (0,25) come "25,00%". */
export function formatPercent(ratio: number): string {
  return `${percentFormat.format(ratio * 100)}%`;
}

/** Aliquota in punti base (2200) come "22%" o "10,5%". */
export function formatRate(bps: number): string {
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(bps / 100)}%`;
}

const wholeFormat = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });

/** Euro interi arrotondati, per spazi stretti (es. celle del calendario): "1.236". */
export function formatWhole(cents: Cents): string {
  return wholeFormat.format(Math.round(cents / 100));
}

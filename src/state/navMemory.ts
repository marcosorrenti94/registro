/**
 * L'app installata su iPhone non ha il tasto Indietro: ricordiamo l'ultimo mese aperto, così
 * dopo aver modificato un giorno dal calendario la scheda "Mese" riporta allo stesso mese.
 */
let lastMonth: { year: number; month: number } | null = null;

export function rememberMonth(year: number, month: number): void {
  lastMonth = { year, month };
}

export function lastMonthPath(): string {
  return lastMonth ? `/mese/${lastMonth.year}/${lastMonth.month}` : '/mese';
}

import type { Database } from '@/domain/types';
import { formatDateIt } from '@/lib/dates';

/** Importo con virgola decimale, come lo legge Excel in italiano. */
const amount = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

function cell(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * CSV di tutti i movimenti, una riga per entrata (per metodo) o uscita.
 * Separatore ";" e BOM UTF-8, così si apre correttamente in Excel italiano.
 */
export function exportMovementsCsv(db: Database): string {
  const rows: string[][] = [['Data', 'Tipo', 'Voce', 'Importo', 'Nota']];
  const lines: { date: string; order: number; row: string[] }[] = [];
  for (const d of Object.values(db.days)) {
    const note = d.note ?? '';
    const add = (voce: string, cents: number, order: number) => {
      if (cents)
        lines.push({
          date: d.date,
          order,
          row: [formatDateIt(d.date), 'Entrata', voce, amount(cents), note],
        });
    };
    add('Contanti', d.contantiCents, 0);
    add('Carta', d.cartaCents, 1);
    add('Varie', d.varieCents, 2);
  }
  for (const e of Object.values(db.expenses)) {
    const name = db.categories[e.categoryId]?.name ?? e.categoryId;
    lines.push({
      date: e.date,
      order: 10 + (db.categories[e.categoryId]?.order ?? 99),
      row: [formatDateIt(e.date), 'Uscita', name, amount(-e.amountCents), e.note ?? ''],
    });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  rows.push(...lines.map((l) => l.row));
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

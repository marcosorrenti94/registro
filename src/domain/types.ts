/** Data ISO locale "YYYY-MM-DD" (nessun fuso orario). */
export type IsoDate = string;

/** Importo in centesimi interi: mai float per i soldi. */
export type Cents = number;

/** Entrate di un giorno. Un giorno può anche non averle (solo uscite). */
export interface DailyEntry {
  date: IsoDate;
  contantiCents: Cents;
  cartaCents: Cents;
  /** Entrata già tassata altrove: esclusa da imponibile e IVA. */
  varieCents: Cents;
  note?: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  date: IsoDate;
  categoryId: string;
  amountCents: Cents;
  note?: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
  archived: boolean;
}

export type VatMode = 'scorporo' | 'aggiunta';

export interface Settings {
  /** Aliquota IVA in punti base: 2200 = 22%. Intero per evitare errori di arrotondamento. */
  vatRateBps: number;
  vatMode: VatMode;
  businessName: string;
  /** Giorni di chiusura settimanale (0 = domenica … 6 = sabato). */
  closedWeekdays: number[];
}

/** Documento unico salvato nel repository privato (data/db.json) e nella cache locale. */
export interface Database {
  schemaVersion: 1;
  settings: Settings;
  categories: Record<string, Category>;
  /** Chiave: data ISO. */
  days: Record<IsoDate, DailyEntry>;
  /** Chiave: id della voce di uscita. */
  expenses: Record<string, Expense>;
  updatedAt: string;
}

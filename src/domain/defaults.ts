import type { Category, Database, Settings } from './types';

export const INCOME_LABELS = {
  contanti: 'Contanti',
  carta: 'Carta',
  varie: 'Varie',
} as const;

export type IncomeKind = keyof typeof INCOME_LABELS;

/** Le 8 categorie del registro Excel, nello stesso ordine delle colonne G–N. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'affitto', name: 'Affitto', color: '#2a78d6', order: 0, archived: false },
  { id: 'gas', name: 'Bollette Gas', color: '#eb6834', order: 1, archived: false },
  { id: 'luce', name: 'Bollette Luce', color: '#1baf7a', order: 2, archived: false },
  { id: 'prodotti', name: 'Prodotti', color: '#eda100', order: 3, archived: false },
  { id: 'commercialista', name: 'Commercialista', color: '#e87ba4', order: 4, archived: false },
  { id: 'pulizie', name: 'Pulizie', color: '#008300', order: 5, archived: false },
  { id: 'telefono', name: 'Telefono/Internet', color: '#6250d6', order: 6, archived: false },
  { id: 'altro', name: 'Altro', color: '#e34948', order: 7, archived: false },
];

export const DEFAULT_SETTINGS: Settings = {
  vatRateBps: 2200,
  businessName: 'Parrucchieria',
  closedWeekdays: [0, 1],
};

export function emptyDatabase(): Database {
  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS, closedWeekdays: [...DEFAULT_SETTINGS.closedWeekdays] },
    categories: Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, { ...c }])),
    days: {},
    expenses: {},
    updatedAt: new Date(0).toISOString(),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Completa un database letto da file/remoto con i valori di default mancanti. */
export function normalizeDatabase(raw: unknown): Database {
  const base = emptyDatabase();
  if (!isRecord(raw)) return base;
  const settings = isRecord(raw.settings) ? (raw.settings as Partial<Settings>) : {};
  return {
    schemaVersion: 1,
    // Solo i campi noti: i valori di versioni precedenti (es. la vecchia modalità IVA) vengono scartati
    settings: {
      vatRateBps: typeof settings.vatRateBps === 'number' ? settings.vatRateBps : base.settings.vatRateBps,
      businessName:
        typeof settings.businessName === 'string' ? settings.businessName : base.settings.businessName,
      closedWeekdays: Array.isArray(settings.closedWeekdays)
        ? settings.closedWeekdays
        : base.settings.closedWeekdays,
    },
    categories: isRecord(raw.categories) ? (raw.categories as Database['categories']) : base.categories,
    days: isRecord(raw.days) ? (raw.days as Database['days']) : {},
    expenses: isRecord(raw.expenses) ? (raw.expenses as Database['expenses']) : {},
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
}

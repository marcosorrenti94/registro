/**
 * Colori dei grafici, validati (chiaro e scuro) con lo strumento di verifica della palette:
 * banda di luminosità, croma minimo, separazione per daltonismo, contrasto sulla superficie.
 * Ogni entità ha sempre lo stesso colore in tutti i grafici.
 */
export interface ModeColor {
  light: string;
  dark: string;
}

export const INCOME_COLOR = {
  contanti: { light: '#1a8458', dark: '#2fa774' },
  carta: { light: '#3d6fb4', dark: '#5b8ee0' },
  varie: { light: '#a8771f', dark: '#b8862a' },
} satisfies Record<string, ModeColor>;

/** Andamento mensile. Netto usa anche la linea tratteggiata (codifica secondaria). */
export const TREND_COLOR = {
  entrate: { light: '#6250d6', dark: '#9085e9' },
  uscite: { light: '#d04848', dark: '#e66767' },
  netto: { light: '#12946b', dark: '#199e70' },
} satisfies Record<string, ModeColor>;

/** Palette categoriale a 8 posizioni, assegnate in ordine fisso (mai ciclate). */
export const CATEGORY_SLOTS: ModeColor[] = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#e87ba4', dark: '#d55181' },
  { light: '#008300', dark: '#008300' },
  { light: '#6250d6', dark: '#9085e9' },
  { light: '#e34948', dark: '#e66767' },
];

/** Colore per le categorie oltre l'ottava, raggruppate in "Altre categorie". */
export const OTHER_COLOR: ModeColor = { light: '#8a8390', dark: '#8f8794' };

/** Il colore di una categoria è salvato in versione chiara: qui si ricava la versione scura. */
export function categoryColor(lightHex: string, dark: boolean): string {
  if (!dark) return lightHex;
  const slot = CATEGORY_SLOTS.find((s) => s.light.toLowerCase() === lightHex.toLowerCase());
  return slot ? slot.dark : lightHex;
}

export const pick = (c: ModeColor, dark: boolean) => (dark ? c.dark : c.light);

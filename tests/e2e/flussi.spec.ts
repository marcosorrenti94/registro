import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Dati reali dell'attività: solo in locale, cartella esclusa da git
const FIXTURE = fileURLToPath(new URL('../fixtures/private/registro.xlsx', import.meta.url));
const EXPECTED = fileURLToPath(new URL('../fixtures/private/expected.json', import.meta.url));

async function startLocal(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prova senza account' }).click();
  await expect(page.getByText('Incasso del giorno')).toBeVisible();
}

test('inserimento di un giorno → mese e dashboard aggiornati', async ({ page }) => {
  await startLocal(page);
  await page.goto('/#/giorno/2026-03-03');
  await expect(page.getByRole('heading', { name: '3 marzo 2026' })).toBeVisible();
  await expect(page.getByText('Da compilare')).toBeVisible();

  await page.getByLabel('Contanti').fill('120');
  await page.getByLabel('Carta').fill('85,50');
  await page.getByLabel('Varie').fill('30');
  await expect(page.getByText('€ 235,50').first()).toBeVisible();

  await page.getByRole('button', { name: /^Uscite/ }).click();
  await page.getByRole('button', { name: 'Prodotti' }).click();
  await page.getByLabel('Prodotti', { exact: true }).fill('42.30');
  await page.getByRole('button', { name: 'Salva il giorno' }).click();
  await expect(page.getByText('Giorno salvato')).toBeVisible();
  await expect(page.getByText('Già compilato')).toBeVisible();

  // Il calendario del mese mostra il giorno compilato
  await page.goto('/#/mese/2026/3');
  await expect(page.getByRole('link', { name: /^3: entrate € 235,50, uscite € 42,30/ })).toBeVisible();

  // La dashboard si aggiorna da sola
  await page.goto('/#/dashboard/2026');
  const kpi = page.getByRole('region', { name: 'Indicatori principali' });
  await expect(kpi).toContainText('€ 235,50');
  await expect(kpi).toContainText('€ 42,30');
  await expect(kpi).toContainText('€ 190,29');
  if (test.info().project.name === 'mobile') {
    // Su telefono la tabella diventa un elenco di mesi toccabili
    await expect(
      page.getByRole('link', { name: 'Marzo: entrate € 235,50, uscite € 42,30, netto € 190,29' }),
    ).toBeVisible();
  } else {
    const marzo = page.getByRole('row', { name: /^Marzo/ });
    await expect(marzo).toContainText('235,50');
    await expect(marzo).toContainText('-42,30');
  }

  // La scheda Mese riporta all'ultimo mese aperto (su iPhone non c'è il tasto Indietro)
  await page.goto('/#/giorno/2026-03-03');
  await page.getByRole('link', { name: 'Calendario di marzo' }).click();
  await expect(page.getByRole('heading', { name: 'Marzo 2026' })).toBeVisible();
  await page.getByRole('link', { name: 'Oggi' }).first().click();
  await page.getByRole('link', { name: 'Mese' }).first().click();
  await expect(page.getByRole('heading', { name: 'Marzo 2026' })).toBeVisible();
});

test('eliminazione di un giorno chiede conferma', async ({ page }) => {
  await startLocal(page);
  await page.goto('/#/giorno/2026-03-04');
  await page.getByLabel('Contanti').fill('50');
  await page.getByRole('button', { name: 'Salva il giorno' }).click();
  await expect(page.getByText('Già compilato')).toBeVisible();

  await page.getByRole('button', { name: 'Elimina il giorno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Eliminare il giorno?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Annulla' }).click();
  await expect(page.getByText('Già compilato')).toBeVisible();

  await page.getByRole('button', { name: 'Elimina il giorno' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina il giorno' }).click();
  await expect(page.getByText('Giorno eliminato')).toBeVisible();
  await expect(page.getByText('Da compilare')).toBeVisible();
});

test('import del registro Excel reale → numeri di accettazione', async ({ page }) => {
  test.skip(
    !existsSync(FIXTURE) || !existsSync(EXPECTED),
    'Registro reale o valori attesi non presenti in tests/fixtures/private',
  );
  const exp = JSON.parse(readFileSync(EXPECTED, 'utf8')) as {
    anno: number;
    giorniImportati: number;
    schermo: Record<
      'incasso' | 'spese' | 'netto' | 'iva' | 'nettoDopoIva' | 'incassoMedio' | 'percVarie',
      string
    >;
  };
  const n = exp.giorniImportati;
  const v = exp.schermo;
  await startLocal(page);
  await page.goto('/#/impostazioni');
  await page.locator('input[type=file][accept*=".xlsx"]').setInputFiles(FIXTURE);

  const dialog = page.getByRole('dialog', { name: "Anteprima dell'import" });
  await expect(dialog).toContainText(`${n} giorni con dati`);
  await dialog.getByRole('button', { name: `Importa ${n} giorni` }).click();
  await expect(page.getByText(`Importati ${n} giorni`)).toBeVisible();

  await page.goto(`/#/dashboard/${exp.anno}`);
  const kpi = page.getByRole('region', { name: 'Indicatori principali' });
  await expect(kpi).toContainText(v.incasso);
  await expect(kpi).toContainText(v.spese);
  await expect(kpi).toContainText(v.netto);
  await expect(page.getByText(v.iva).first()).toBeVisible();
  await expect(page.getByText(v.nettoDopoIva).first()).toBeVisible();
  await expect(page.getByText(v.incassoMedio).first()).toBeVisible();
  await expect(page.getByText(v.percVarie).first()).toBeVisible();
});

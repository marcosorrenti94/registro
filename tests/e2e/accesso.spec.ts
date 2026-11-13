import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { buildAccessFile, parseAccessFile, unlockAccess } from '../../src/data/accessFile';

const OWNER = 'utente-prova';
const REPO = 'registro-data';
const TOKEN = 'github_pat_prova_e2e';

/** Finta API GitHub: repository privato, file db.json creato al primo salvataggio. */
async function fakeGitHub(page: Page) {
  const state = {
    file: null as { sha: string; content: string } | null,
    auth: new Set<string>(),
    paths: new Set<string>(),
  };
  let n = 0;
  await page.route('https://api.github.com/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = decodeURIComponent(url.pathname);
    state.auth.add(req.headers()['authorization'] ?? '');
    state.paths.add(path);
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === `/repos/${OWNER}/${REPO}` && req.method() === 'GET') {
      return json(200, { private: true, default_branch: 'main', permissions: { push: true } });
    }
    if (path === `/repos/${OWNER}/${REPO}/contents/data/db.json`) {
      if (req.method() === 'GET') {
        return state.file
          ? json(200, { type: 'file', sha: state.file.sha, encoding: 'base64', content: state.file.content })
          : json(404, { message: 'Not Found' });
      }
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData() ?? '{}') as { content: string };
        state.file = { sha: `sha-${++n}`, content: body.content };
        return json(200, { content: { sha: state.file.sha } });
      }
    }
    return json(404, { message: 'Not Found' });
  });
  return state;
}

test('accesso con password: sbagliata respinta, giusta entra e salva nel repository privato', async ({
  page,
}) => {
  const password = 'Prova-e2e-Kq7mZ-3tRxw';
  const file = await buildAccessFile(
    [{ secret: { label: 'Titolare', owner: OWNER, repo: REPO, token: TOKEN }, password }],
    100_000,
  );
  await page.route('**/accesso.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(file) }),
  );
  const gh = await fakeGitHub(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Accedi' })).toBeVisible();
  await page.getByLabel('Nome').fill('Titolare');
  await page.getByLabel('Password', { exact: true }).fill('password-sbagliata-123');
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Password non corretta');

  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page.getByText('Incasso del giorno')).toBeVisible();

  await page.goto('/#/giorno/2026-03-10');
  await page.getByLabel('Contanti').fill('50');
  await page.getByRole('button', { name: 'Salva il giorno' }).click();
  await expect(page.getByText('Giorno salvato')).toBeVisible();

  // Le richieste vanno solo al repository dati, con il token sbloccato dalla password
  expect([...gh.paths].every((p) => p.startsWith(`/repos/${OWNER}/${REPO}`))).toBe(true);
  expect(
    [...gh.auth].every((a) => a.toLowerCase() === `token ${TOKEN}` || a.toLowerCase() === `bearer ${TOKEN}`),
  ).toBe(true);
  const saved = JSON.parse(Buffer.from(gh.file!.content, 'base64').toString('utf8')) as {
    days: Record<string, { contantiCents: number }>;
  };
  expect(saved.days['2026-03-10']?.contantiCents).toBe(5000);
});

test('configurazione: verifica il repository e crea un file che si apre con la password generata', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route('**/accesso.json', (route) => route.fulfill({ status: 404, body: '' }));
  await fakeGitHub(page);

  await page.goto('/');
  await expect(page.getByText("L'accesso non è ancora configurato")).toBeVisible();
  await page.getByRole('button', { name: "Configura l'accesso" }).click();

  await page.getByLabel('Proprietario (utente o organizzazione)').fill(OWNER);
  await expect(page.getByLabel('Nome del repository privato')).toHaveValue(REPO);
  await page.getByLabel(/^Token/).fill(TOKEN);
  await expect(page.getByRole('button', { name: 'Crea il file di accesso' })).toBeDisabled();
  await page.getByRole('button', { name: 'Verifica il repository' }).click();
  await expect(page.getByText('Connessione riuscita')).toBeVisible();

  await page.getByLabel('Nome', { exact: true }).fill('Titolare');
  const password = await page.getByLabel('Password', { exact: true }).inputValue();
  expect(password).toMatch(/^[a-zA-Z2-9]{5}(-[a-zA-Z2-9]{5}){3}$/);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Crea il file di accesso' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('accesso.json');
  await expect(page.getByText('File accesso.json scaricato')).toBeVisible();

  const access = parseAccessFile(readFileSync((await file.path())!, 'utf8'));
  expect(access.kdf.iterations).toBe(600_000);
  expect(await unlockAccess(access, password)).toEqual({
    label: 'Titolare',
    owner: OWNER,
    repo: REPO,
    token: TOKEN,
  });
  expect(JSON.stringify(access)).not.toContain(TOKEN);
});

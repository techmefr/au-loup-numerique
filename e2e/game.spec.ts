import { expect, test } from '@playwright/test';

test('deux joueurs agrandissent puis vident le troupeau', async ({ browser }) => {
  test.setTimeout(90000);
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto('/');
  await host.fill('#name', 'Alice');
  await host.click('#create');
  await expect(host.getByText(/^Salle [A-Z]{4}$/)).toBeVisible();
  const code = (await host.locator('h2').first().innerText()).replace('Salle ', '');
  await expect(host.locator('img[alt^="QR code"]')).toBeVisible();

  await guest.goto(`/room/${code}`);
  await guest.fill('#name', 'Bob');
  await guest.click('#join');
  await expect(host.locator('.score li', { hasText: 'Bob' })).toBeVisible();

  await host.click('#start');
  await expect(host.getByText('À toi de jouer !')).toBeVisible();
  await expect(guest.getByText('Alice choisit ses cartes…')).toBeVisible();
  expect(await guest.locator('#hand .card').count()).toBe(10);

  const initialFlock = Number(await host.locator('#chips .gold b').innerText());
  await host.getByRole('button', { name: 'Mouton', exact: true }).first().click();
  await host.click('#play');
  await expect(guest.locator('#pile')).toBeVisible();
  await expect(guest.locator('.reveal')).toHaveCount(0);
  await expect.poll(() => guest.evaluate(() => Boolean((window as any).loup.meadow.screenOf('arrival-0')))).toBe(true);

  await guest.click('#vt');
  await expect(host.getByRole('heading', { name: 'Regarde le portail…' })).toBeVisible();
  await expect(host.locator('#chips .gold b')).toHaveText(String(initialFlock));
  await expect(host.locator('.reveal')).toBeVisible({ timeout: 10000 });
  await expect(host.locator('.result-panel')).toHaveAttribute('data-mood', 'success');
  await expect(host.locator('.result-panel')).toHaveClass(/result-enter/);
  await expect(guest.locator('.reveal')).toBeVisible({ timeout: 10000 });
  await expect(host.locator('#chips .gold b')).toHaveText(String(initialFlock + 1));

  await host.click('#next');
  await expect(guest.getByText('À toi de jouer !')).toBeVisible();
  await guest.locator('#hand .card').first().click();
  await guest.click('#play');
  await host.click('#vw');
  await expect(host.getByRole('heading', { name: 'Regarde le portail…' })).toBeVisible();
  await expect(host.locator('#chips .gold b')).toHaveText(String(initialFlock + 1));
  await expect(host.locator('.reveal')).toBeVisible({ timeout: 10000 });
  await expect(host.locator('#chips .gold b')).toHaveText('0');
  await expect(guest.locator('#chips .gold b')).toHaveText('0', { timeout: 10000 });
  const moods = await Promise.all([host, guest].map((page) => page.locator('.result-panel').getAttribute('data-mood')));
  expect(moods.sort()).toEqual(['setback', 'success']);
  await Promise.all([host.context().close(), guest.context().close()]);
});

test('la prairie 3D se dessine sans erreur', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/accueil.png' });
  expect(errors).toEqual([]);
  await expect(page.locator('#scene canvas')).toBeVisible();
});

test('capture d une partie en cours', async ({ browser }) => {
  test.setTimeout(60000);
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto('/');
  await a.fill('#name', 'Alice');
  await a.click('#create');
  const code = (await a.locator('h2').first().innerText()).replace('Salle ', '');
  await b.goto(`/room/${code}`);
  await b.fill('#name', 'Bob');
  await b.click('#join');
  await a.click('#start');
  await expect(a.getByText('À toi de jouer !')).toBeVisible();
  await a.locator('#hand .card').nth(1).click();
  await a.locator('#hand .card').nth(2).click();
  await a.waitForTimeout(500);
  await a.screenshot({ path: 'test-results/main.png' });
  await a.click('#play');
  await b.click('#vt');
  await a.waitForTimeout(2300);
  await a.screenshot({ path: 'test-results/revelation.png' });
  await Promise.all([a.context().close(), b.context().close()]);
});

test('solo contre l ordinateur : les bots votent et la manche se résout', async ({ browser }) => {
  test.setTimeout(90000);
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.fill('#name', 'Alice');
  await page.click('#solo');
  await expect(page.getByText('À toi de jouer !')).toBeVisible();
  expect(await page.locator('#hand .card').count()).toBe(10);
  await page.locator('#hand .card').first().click();
  await page.locator('#hand .card').nth(1).click();
  await page.click('#play');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/solo-vote.png' });
  await expect(page.locator('.reveal')).toBeVisible({ timeout: 12000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/solo-rev0.png' });
  await page.waitForTimeout(900);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/solo-revelation.png' });
  await page.waitForTimeout(0);
  await page.waitForTimeout(5500);
  await page.screenshot({ path: 'test-results/solo-fin.png' });
  await page.locator('#scene canvas').click({ position: { x: 640, y: 200 } });
  expect(errors).toEqual([]);
});

test('le menu entoure le mouton et remplace les cartes sur mobile', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.fill('#name', 'Alice');
  await expect(page.locator('#mute')).toBeChecked();
  await page.click('#solo');
  const cards = page.locator('#hand .card');
  await cards.first().click();

  const sheep = page.locator('[data-sheep]').first();
  const sheepId = await sheep.getAttribute('data-sheep');
  const canvas = page.locator('#scene canvas');
  const position = await page.evaluate((id) => (window as any).loup.meadow.screenOf(id), sheepId);
  await canvas.click({ position });
  const radial = page.getByRole('group', { name: 'Actions du mouton' });
  await expect(radial).toBeInViewport({ ratio: 1 });
  await expect(radial.getByRole('button')).toHaveCount(6);
  await expect(page.locator('#hand')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Revenir aux cartes' })).toBeVisible();

  await radial.getByRole('button', { name: 'Bêler' }).click();
  await expect(page.locator('#toast')).toHaveText('Bêêê !');
  await expect(radial).toHaveCount(0);
  await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
});

test('mode Compte tes moutons : annonce chiffrée, vote, résolution', async ({ browser }) => {
  test.setTimeout(90000);
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.fill('#name', 'Alice');
  await page.check('input[name=mode][value=compte]');
  await page.click('#solo');
  await expect(page.getByText('À toi de jouer !')).toBeVisible();
  await expect(page.locator('#cc')).toBeVisible();
  await page.locator('#hand .card').first().click();
  await page.locator('#hand .card').nth(1).click();
  await page.fill('#cc', '2');
  await page.click('#play');
  await expect(page.getByText('2 mouton(s) vont rentrer !')).toBeVisible();
  await expect(page.locator('.reveal')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/compte.png' });
  const verdict = await page.locator('.verdict').first().innerText();
  const cards = await page.locator('.reveal-row .card').count();
  console.log('verdict', verdict, 'cartes', cards, await page.locator('.reveal p').first().innerText());
  expect(cards).toBe(2);
  expect(errors).toEqual([]);
});

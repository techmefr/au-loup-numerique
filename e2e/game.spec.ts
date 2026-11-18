import { expect, test } from '@playwright/test';

test('deux joueurs jouent une manche complète', async ({ browser }) => {
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

  await host.locator('#hand .card').first().click();
  await host.click('#play');
  await expect(guest.locator('#pile')).toBeVisible();
  await expect(guest.locator('.reveal')).toHaveCount(0);

  await guest.click('#vt');
  await expect(host.locator('.reveal')).toBeVisible();
  await expect(guest.locator('.reveal')).toBeVisible();

  await host.click('#next');
  await expect(guest.getByText('Bob choisit') .or(guest.getByText('À toi de jouer !'))).toBeVisible();
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
});

test('solo contre l ordinateur : les bots votent et la manche se résout', async ({ browser }) => {
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

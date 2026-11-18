import { expect, test } from '@playwright/test';

test('version GitHub Pages : solo dans le navigateur, sans serveur de jeu', async ({ page }) => {
  test.setTimeout(90000);
  const bad: string[] = [];
  page.on('pageerror', (e) => bad.push(e.message));
  page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('http://localhost:4173/au-loup-numerique/?local=1');
  await expect(page.locator('#create')).toHaveCount(0);
  await page.fill('#name', 'Alice');
  await page.click('#solo');
  await expect(page.getByText('À toi de jouer !')).toBeVisible();
  expect(await page.locator('#hand .card').count()).toBe(10);
  await page.locator('#hand .card').first().click();
  await page.click('#play');
  await expect(page.locator('.reveal')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/pages.png' });
  await page.locator('#hand, .reveal').first().waitFor();
  expect(bad).toEqual([]);
});

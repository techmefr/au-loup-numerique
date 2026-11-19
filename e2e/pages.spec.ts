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

test('splash, choix du mode expliqué, bouton partager', async ({ page }) => {
  await page.goto('http://localhost:4173/au-loup-numerique/?splash=1');
  await expect(page.locator('#splash')).toBeVisible();
  await page.click('#splash-play');
  await expect(page.locator('#splash')).toBeHidden();
  await expect(page.locator('.mode')).toHaveCount(6);
  await expect(page.locator('#share')).toBeVisible();
  await page.click('#rules-home');
  await expect(page.locator('#rules')).toBeVisible();
});

test('les quatre autres modes du livret sont jouables en solo', async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const home = 'http://localhost:4173/au-loup-numerique/?local=1';
  const startMode = async (mode: string) => {
    await page.goto(home);
    await page.fill('#name', 'Alice');
    await page.locator(`input[name=mode][value=${mode}]`).check();
  };

  await startMode('loup-parmi-nous');
  await expect(page.locator('#bots option').first()).toHaveAttribute('value', '2');
  await page.click('#solo');
  await expect(page.getByText(/Ton camp secret/)).toBeVisible();
  await page.locator('#hand .card').first().click();
  await page.fill('#announcement', 'Je mène le troupeau');
  await page.click('#variant-play');
  await expect(page.getByText(/Je mène le troupeau/)).toBeVisible();
  await expect(page.locator('#next')).toBeVisible({ timeout: 12000 });

  await startMode('passe-ton-loup');
  await page.selectOption('#bots', '1');
  await page.click('#solo');
  await page.getByRole('button', { name: /^(Loup|Chien) déguisé$/ }).first().click();
  await page.click('#variant-play');
  await expect(page.getByText(/perd la manche avec un loup et un chien/)).toBeVisible();
  await expect(page.locator('.result-panel')).toHaveAttribute('data-mood', 'success');
  await expect(page.locator('.result-panel')).not.toHaveClass(/result-enter/);
  await expect(page.locator('.result-particles')).toHaveCount(0);

  await startMode('troupeau-de-tete');
  await expect(page.locator('#bots option').last()).toHaveAttribute('value', '5');
  await page.click('#solo');
  await page.locator('#hand .card').first().click();
  await page.locator('#flock-target').selectOption({ index: 1 });
  await page.click('#variant-play');
  await expect(page.getByText(/Bella · [1-3] carte/)).toBeVisible();

  await startMode('qui-sy-frotte');
  await page.click('#solo');
  await expect(page.locator('#variant-stop')).toBeDisabled();
  await page.click('#variant-draw');
  await expect(page.locator('.reveal-row .card')).toHaveCount(1);
  await page.click('#variant-stop');
  await expect(page.getByText(/Alice marque [01] point/)).toBeVisible();
  await expect(page.locator('#next')).toBeVisible();
});

test('les règles intégrées restent lisibles et navigables sur petit écran', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('http://localhost:4173/au-loup-numerique/?local=1');
  await page.locator('[name=mode][value=compte]').check();
  const trigger = page.locator('#rules-home');
  await trigger.click();

  const guide = page.getByRole('dialog', { name: 'Règles du jeu' });
  await expect(guide.getByRole('heading', { name: 'Compte tes moutons !' })).toBeVisible();
  const modes = guide.getByLabel('Mode de jeu');
  await expect(modes.locator('option')).toHaveCount(6);
  await modes.selectOption('loup-parmi-nous');
  await expect(guide.getByText(/Les Moutons gagnent avec 15/)).toBeVisible();
  await expect(guide.locator('.rules-cards img')).toHaveCount(3);
  expect(await guide.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(318);
  await guide.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(guide.getByRole('button', { name: 'Fermer' })).toBeInViewport();

  await page.setViewportSize({ width: 1280, height: 800 });
  await modes.selectOption('qui-sy-frotte');
  await expect(guide.getByRole('heading', { name: 'Qui s’y frotte s’y pique !' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  await expect(trigger).toBeFocused();
});

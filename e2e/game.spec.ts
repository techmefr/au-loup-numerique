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
  await expect(host.getByText('Bob 🟢')).toBeVisible();

  await host.click('#start');
  await expect(host.getByText('À toi de jouer !')).toBeVisible();
  await expect(guest.getByText('Alice choisit ses cartes…')).toBeVisible();
  expect(await guest.locator('#hand .card').count()).toBe(5);

  await host.locator('#hand .card').first().click();
  await host.click('#play');
  await expect(guest.locator('#pile')).toBeVisible();
  await expect(guest.locator('.reveal')).toHaveCount(0);

  await guest.click('#vt');
  await expect(host.locator('.reveal')).toBeVisible();
  await expect(guest.locator('.reveal')).toBeVisible();
  await expect(host.locator('.stage')).toBeVisible();

  await host.click('#next');
  await expect(guest.getByText('Bob choisit') .or(guest.getByText('À toi de jouer !'))).toBeVisible();
});

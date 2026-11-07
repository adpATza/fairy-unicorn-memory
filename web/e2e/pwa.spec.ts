import type { Page } from '@playwright/test';
import { VIEWPORTS, card, expect, pictureOf, playPerfectRound, test, usePrefs } from './helpers';
import { ReleaseServer } from './static-server';

test.use({ viewport: VIEWPORTS['phone portrait'] });

async function controlledByServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null && navigator.serviceWorker?.controller !== undefined);
}

async function appCaches(page: Page): Promise<{ name: string; entries: number }[]> {
  return page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('memory-card-game-'));
    return Promise.all(names.map(async (name) => ({ name, entries: (await (await caches.open(name)).keys()).length })));
  });
}

test('manifest, icons and service worker are served', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  expect((await request.get('icons/apple-touch-icon.png')).ok()).toBe(true);
  const sw = await (await request.get('sw.js')).text();
  expect(sw).toMatch(/const VERSION = "[0-9a-f]{16}";/);
});

test('after the first visit the whole game works offline', async ({ page, context }) => {
  await usePrefs(page, { pairs: 3 });
  await page.goto('./?seed=3');
  await controlledByServiceWorker(page);
  await expect(page.getByRole('status').filter({ hasText: 'Ready to play offline.' })).toBeVisible();
  const precache = JSON.parse(/const PRECACHE = (\[.*\]);/.exec(await (await page.request.get('sw.js')).text())![1]!) as string[];
  await expect.poll(() => appCaches(page)).toEqual([expect.objectContaining({ entries: precache.length })]);
  expect(precache.filter((path) => path.endsWith('.svg')).length).toBeGreaterThanOrEqual(181);

  await context.setOffline(true);
  await page.clock.install();
  await page.goto('./?seed=11');
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
  await expect(page.locator('.sample-front img').first()).toHaveJSProperty('complete', true);
  // Other decks' pictures are cached too.
  await page.getByRole('combobox', { name: 'Subject' }).selectOption('Robots');
  await page.getByRole('combobox', { name: 'Complexity' }).selectOption('Hard');
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.locator('.card')).toHaveCount(6);
  await card(page, 0).click();
  await pictureOf(page, 0);
  await expect.poll(() => card(page, 0).locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.clock.runFor(2000);
  await playPerfectRound(page);
  await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
});

test.describe('updates', () => {
  // Each test publishes its own "new release" on a private copy of the build.
  let server: ReleaseServer;
  test.beforeEach(async () => {
    server = new ReleaseServer();
    await server.start();
  });
  test.afterEach(async () => server.stop());

  test('a new version waits until the round is over, then updates on request', async ({ page }) => {
    await usePrefs(page, { pairs: 6 });
    await page.goto(server.url);
    await controlledByServiceWorker(page);
    await expect.poll(async () => (await appCaches(page)).length).toBe(1);
    const [before] = await appCaches(page);
    await page.getByRole('button', { name: 'OK' }).click();

    await page.getByRole('button', { name: 'Let’s play' }).click();
    await expect(page.locator('.card')).toHaveCount(12);
    server.publishUpdate('next');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.waiting != null);
    const prompt = page.getByRole('status').filter({ hasText: 'A new version is ready.' });
    await page.waitForTimeout(300);
    await expect(prompt, 'no prompt during a round').toHaveCount(0);
    await expect(page.locator('.card')).toHaveCount(12);

    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Return to setup' }).click();
    await page.getByRole('dialog', { name: 'Leave this round?' }).getByRole('button', { name: 'Leave game' }).click();
    await expect(prompt).toBeVisible();

    const reloaded = page.waitForEvent('load');
    await prompt.getByRole('button', { name: 'Update now' }).click();
    await reloaded;
    await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
    await expect.poll(async () => (await appCaches(page)).map((c) => c.name)).toEqual([`${before!.name}-next`]);
  });

  test('choosing Later keeps the current version for this visit', async ({ page }) => {
    await page.goto(server.url);
    await controlledByServiceWorker(page);
    server.publishUpdate('later');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    const prompt = page.getByRole('status').filter({ hasText: 'A new version is ready.' });
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: 'Later' }).click();
    await expect(prompt).toHaveCount(0);
    await page.getByRole('button', { name: 'Let’s play' }).click();
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Return to setup' }).click();
    await page.getByRole('dialog', { name: 'Leave this round?' }).getByRole('button', { name: 'Leave game' }).click();
    await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
    await expect(prompt).toHaveCount(0);
  });

  test('a release is served from cache when offline, on a GitHub Pages-like server', async ({ page, context }) => {
    await page.goto(server.url);
    await controlledByServiceWorker(page);
    await context.setOffline(true);
    await page.goto(`${server.url}?seed=2`);
    await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
  });
});

test('the Install button appears only when the browser offers installation', async ({ page }) => {
  await page.goto('./');
  const install = page.getByRole('button', { name: 'Install app' });
  await expect(install).toBeHidden();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        (window as unknown as { prompted: boolean }).prompted = true;
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
  });
  await expect(install).toBeVisible();
  await install.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  await expect(install).toBeHidden();
});

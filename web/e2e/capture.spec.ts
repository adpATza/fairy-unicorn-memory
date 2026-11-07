import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { file, pictures, png } from './fixtures';
import { VIEWPORTS, card, expect, playPerfectRound, startRound, test, usePrefs } from './helpers';

// Screenshots for verification/web/. Run with: npm run screenshots
test.skip(!process.env.CAPTURE, 'Set CAPTURE=1 (npm run screenshots) to capture verification screenshots');
// No service worker: keeps the one-off "Ready to play offline" note out of the pictures.
test.use({ serviceWorkers: 'block' });

const OUT = new URL('../../verification/web/screenshots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: new URL(`${name}.png`, OUT).pathname, fullPage });

async function addDeck(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Deck library' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose pictures' }).click();
  await (await chooser).setFiles([...pictures(13, 'garden'), file('wide.png', png(220, 80, (x) => (x < 110 ? [255, 118, 55, 255] : [36, 91, 255, 255]))), file('broken.png', Buffer.from('x'))]);
  await expect(page.getByRole('heading', { name: 'Create a deck' })).toBeVisible();
}

for (const [size, viewport] of [['desktop', VIEWPORTS.laptop], ['phone', VIEWPORTS['phone portrait']]] as const) {
  test(`setup, library, import and guide (${size})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await usePrefs(page, { players: 2 });
    await page.goto('./');
    await expect(page.locator('#pair-advice')).not.toBeEmpty();
    await shot(page, `setup-${size}`);
    await addDeck(page);
    await page.locator('.tile').nth(3).click();
    await page.getByLabel('Deck name').fill('Garden friends');
    await page.getByLabel('Domain / subject').fill('Plants');
    await shot(page, `import-${size}`);
    await page.getByRole('button', { name: 'Save deck' }).click();
    await expect(page.locator('.deck-title', { hasText: 'Garden friends' })).toBeVisible();
    await shot(page, `library-${size}`, size === 'phone');
    await page.getByRole('button', { name: 'Artwork & import guide' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Playing together' })).toBeVisible();
    await shot(page, `guide-${size}`);
  });
}

const boards = [
  ['game-laptop-4-players-30-pairs', VIEWPORTS.laptop, { players: 4, pairs: 30 }],
  ['game-desktop-1080p-2-players-24-pairs', VIEWPORTS.desktop, { players: 2, pairs: 24 }],
  ['game-tablet-portrait-3-players-24-pairs', VIEWPORTS['tablet portrait'], { players: 3, pairs: 24 }],
  ['game-phone-portrait-12-pairs', VIEWPORTS['phone portrait'], { players: 1, pairs: 12 }],
  ['game-phone-landscape-2-players-16-pairs', VIEWPORTS['phone landscape'], { players: 2, pairs: 16 }],
  ['game-small-phone-30-pairs-grid', VIEWPORTS['small phone portrait'], { players: 1, pairs: 30, layout: 'grid' as const }],
] as const;

for (const [name, viewport, prefs] of boards) {
  test(name, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startRound(page, { ...prefs, names: ['Alice', 'Ben', 'Cara', 'Duke'] }, 5);
    await shot(page, name);
  });
}

test('revealed, paused and results (phone and desktop)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS['phone portrait']);
  await page.clock.install();
  await startRound(page, { pairs: 12 }, 5);
  await card(page, 0).click();
  await card(page, 1).click();
  await shot(page, 'revealed-cards-phone');
  await page.getByRole('button', { name: 'Pause' }).click();
  await shot(page, 'paused-phone');
  await page.getByRole('button', { name: 'Continue playing' }).click();
  await page.clock.runFor(2000);
  await playPerfectRound(page);
  await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
  await shot(page, 'results-solo-phone');
});

test('multiplayer results (desktop)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.laptop);
  await page.clock.install();
  await startRound(page, { pairs: 4, players: 4, names: ['Alex the explorer', 'カラフルなロボットの世界', 'Cara', 'Duke'] }, 5);
  await playPerfectRound(page);
  await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
  await shot(page, 'results-multiplayer-desktop');
});

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { pictures } from './fixtures';
import { VIEWPORTS, card, expect, playPerfectRound, startRound, test, usePrefs } from './helpers';

// Automated accessibility checks (axe-core) on every screen and dialog, at
// desktop and phone sizes: WCAG 2.2 A and AA plus axe best practices.

async function expectAccessible(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n  ')}`);
  expect(summary, `${label}: accessibility violations`).toEqual([]);
}

for (const [size, viewport] of [['desktop', VIEWPORTS.laptop], ['phone', VIEWPORTS['phone portrait']]] as const) {
  test.describe(size, () => {
    test.use({ viewport });

    test('setup, deck library, import and guide', async ({ page }) => {
      await usePrefs(page, { players: 3 });
      await page.goto('./');
      await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
      await expectAccessible(page, 'setup');
      await page.getByRole('spinbutton', { name: 'Pairs' }).fill('30');
      await page.getByRole('spinbutton', { name: 'Pairs' }).blur();
      await expectAccessible(page, 'setup with small-card advice');

      await page.getByRole('button', { name: 'Deck library' }).click();
      await expectAccessible(page, 'library');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Choose pictures' }).click();
      await (await chooser).setFiles([...pictures(4), { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('x') }]);
      await expect(page.getByRole('heading', { name: 'Create a deck' })).toBeVisible();
      await expectAccessible(page, 'import review');
      await page.getByLabel('Deck name').fill('Circles');
      await page.getByRole('button', { name: 'Save deck' }).click();
      await expect(page.locator('.deck-title', { hasText: 'Circles' })).toBeVisible();
      await expectAccessible(page, 'library with a custom deck');
      await page.getByRole('button', { name: 'Rename Circles' }).click();
      await expectAccessible(page, 'rename dialog');
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Artwork & import guide' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Playing together' })).toBeVisible();
      await expectAccessible(page, 'guide');
    });

    test('gameplay, pause, confirmation and results', async ({ page }) => {
      await page.clock.install();
      await startRound(page, { pairs: 3, players: 2 });
      await expectAccessible(page, 'gameplay');
      await card(page, 0).click();
      await card(page, 1).click();
      await expectAccessible(page, 'gameplay with revealed cards');
      await page.getByRole('button', { name: 'Pause' }).click();
      await expectAccessible(page, 'pause dialog');
      await page.getByRole('button', { name: 'Return to setup' }).click();
      await expectAccessible(page, 'leave confirmation');
      await page.getByRole('dialog', { name: 'Leave this round?' }).getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'Continue playing' }).click();
      await page.clock.runFor(2000);
      await playPerfectRound(page);
      await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
      await expectAccessible(page, 'multiplayer results');
    });

    test('solo results and the printable guide', async ({ page }) => {
      await page.clock.install();
      await startRound(page, { pairs: 2 });
      await playPerfectRound(page);
      await expect(page.getByRole('heading', { name: 'You matched them all!' })).toBeVisible();
      await expectAccessible(page, 'solo results');
      await page.goto('./guide.html');
      await expectAccessible(page, 'printable guide');
    });
  });
}

test.describe('screen changes', () => {
  test.use({ viewport: VIEWPORTS['phone portrait'] });

  test('each screen has a title and receives focus on its heading after a tap', async ({ page }) => {
    await usePrefs(page, { pairs: 2 });
    await page.goto('./');
    await expect(page).toHaveTitle('Memory Card Game');
    const focusedHeading = () => page.evaluate(() => (document.activeElement?.tagName === 'H1' ? document.activeElement.textContent : null));
    await page.getByRole('button', { name: 'Deck library' }).click();
    await expect(page).toHaveTitle('Deck library · Memory Card Game');
    await expect.poll(focusedHeading).toBe('Deck library');
    await page.getByRole('button', { name: 'Artwork & import guide' }).click();
    await expect(page).toHaveTitle('Adult guide · Memory Card Game');
    await expect.poll(focusedHeading).toBe('Artwork & custom decks');
    await page.getByRole('button', { name: 'Return to setup' }).click();
    await page.getByRole('button', { name: 'Let’s play' }).click();
    await expect(page).toHaveTitle('Playing · Memory Card Game');
    // On phones the game title is visually hidden but still the screen's heading.
    await expect.poll(focusedHeading).toBe('Memory Card Game');
    await expect(page.getByRole('heading', { level: 1, name: 'Memory Card Game' })).toBeAttached();
  });

  test('setup, guide and results reflow at 320 pixels without sideways scrolling', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS['small phone portrait']);
    await page.clock.install();
    await usePrefs(page, { pairs: 2, players: 4, names: ['Alexandra the Great', 'Bartholomew', 'Cara', 'Duke'] });
    await page.goto('./');
    const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(await sideways()).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Adult guide' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Playing together' })).toBeVisible();
    expect(await sideways()).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Return to setup' }).click();
    await page.getByRole('button', { name: 'Let’s play' }).click();
    await playPerfectRound(page);
    await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
    expect(await sideways()).toBeLessThanOrEqual(0);
  });
});

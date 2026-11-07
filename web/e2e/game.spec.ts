import { VIEWPORTS, card, expect, pictureOf, playPerfectRound, startRound, test, usePrefs } from './helpers';

test.use({ viewport: VIEWPORTS.laptop });

test('a solo round plays through to results, then plays again', async ({ page }) => {
  await page.clock.install();
  await startRound(page, { pairs: 3 });
  await expect(page.locator('.remaining')).toHaveText('3 pairs left');
  let attempts = 0;
  await playPerfectRound(page, async () => {
    attempts++;
  });
  await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You matched them all!' })).toBeVisible();
  await expect(page.locator('.result-detail')).toHaveText(`3 pairs found in ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}`);
  await expect(page.locator('.result-time')).toHaveText(/^\d\d:\d\d$/);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.card')).toHaveCount(6);
  await expect(page.locator('.clock')).toContainText('0 attempts');
});

test('multiplayer turns follow the extra-turn rule and results mark winners', async ({ page }) => {
  await page.clock.install();
  await startRound(page, { pairs: 4, players: 2, extraTurn: false });
  await expect(page.locator('.turn')).toHaveText('Alice’s turn');
  await expect(page.locator('.score.active .score-name')).toHaveText('Alice');
  let expected = 'Alice';
  let checked = 0;
  await playPerfectRound(page, async () => {
    // The attempt belongs to the expected player; with the extra-turn rule
    // off, every completed attempt then passes the turn.
    await expect(page.locator('.turn')).toHaveText(`${expected}’s turn`);
    expected = expected === 'Alice' ? 'Ben' : 'Alice';
    checked++;
  });
  expect(checked).toBeGreaterThanOrEqual(4);
  await expect(page.getByRole('heading', { name: /We have a winner!|It’s a tie!/ })).toBeVisible();
  await expect(page.locator('.result-scores li')).toHaveCount(2);
  await expect(page.locator('.result-scores li.winner').first()).toContainText('★');
});

test('a match keeps the turn when the extra-turn rule is on', async ({ page }) => {
  await page.clock.install();
  await startRound(page, { pairs: 2, players: 2, extraTurn: true });
  const turns: string[] = [];
  await playPerfectRound(page, async (matched) => {
    turns.push(`${matched ? 'match' : 'miss'}:${await page.locator('.turn').textContent()}`);
  });
  // Every turn record is taken before resolution; after a match the next record shows the same player.
  for (let i = 1; i < turns.length; i++) {
    if (turns[i - 1]!.startsWith('match')) expect(turns[i]!.split(':')[1]).toBe(turns[i - 1]!.split(':')[1]);
  }
  await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
});

test('a mismatch stays visible for 1.5 seconds, then turns face down in place', async ({ page }) => {
  await page.clock.install();
  await startRound(page, { pairs: 12 });
  await card(page, 0).click();
  const first = await pictureOf(page, 0);
  let other = 1;
  for (;; other++) {
    await card(page, other).click();
    if ((await pictureOf(page, other)) !== first) break;
    await page.clock.runFor(700);
    await card(page, 0).click();
  }
  const before = await card(page, other).boundingBox();
  await expect(page.locator('.hint')).toHaveText('Take a moment to remember these two.');
  await page.clock.runFor(1400);
  await expect(card(page, other)).toHaveClass(/revealed/);
  await page.clock.runFor(200);
  await expect(card(page, other)).not.toHaveClass(/revealed/);
  await expect(card(page, other)).toHaveAttribute('aria-label', /^Face-down card \d+$/);
  expect(await card(page, other).boundingBox()).toEqual(before);
});

test('pause conceals artwork, freezes the clock and restores the selection', async ({ page }) => {
  await page.clock.install();
  await startRound(page, { pairs: 12 });
  await page.clock.runFor(3000);
  await card(page, 0).click();
  await expect(card(page, 0)).toHaveClass(/revealed/);
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog', { name: 'Time out!' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.card.revealed')).toHaveCount(0);
  await expect(page.locator('.card img[src]')).toHaveCount(0);
  const clock = await page.locator('.clock').textContent();
  await page.clock.runFor(10_000);
  await expect(page.locator('.clock')).toHaveText(clock!);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card(page, 0)).toHaveClass(/revealed/);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Continue playing' }).click();
  await expect(dialog).toBeHidden();
});

test('hiding the app pauses the round', async ({ page }) => {
  await startRound(page, { pairs: 6 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('dialog', { name: 'Time out!' })).toBeVisible();
});

test('leaving or restarting an unfinished round asks first', async ({ page }) => {
  await startRound(page, { pairs: 6 });
  await page.getByRole('button', { name: 'Setup' }).click();
  const confirm = page.getByRole('dialog', { name: 'Leave this round?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Time out!' })).toBeHidden();
  await expect(page.locator('.card')).toHaveCount(12);

  await page.getByRole('button', { name: 'New round' }).click();
  await page.getByRole('dialog', { name: 'Start a new round?' }).getByRole('button', { name: 'New round' }).click();
  await expect(page.locator('.card')).toHaveCount(12);

  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Return to setup' }).click();
  await page.getByRole('dialog', { name: 'Leave this round?' }).getByRole('button', { name: 'Leave game' }).click();
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('the Back button asks before leaving a round', async ({ page }) => {
  await startRound(page, { pairs: 6 });
  await page.goBack();
  const confirm = page.getByRole('dialog', { name: 'Leave this round?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.card')).toHaveCount(12);
  await page.goBack();
  await page.getByRole('dialog', { name: 'Leave this round?' }).getByRole('button', { name: 'Leave game' }).click();
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
});

test('keyboard: Enter starts, arrows move between cards, Space reveals', async ({ page }) => {
  await usePrefs(page, { pairs: 12 });
  await page.goto('./?seed=7');
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: 'Let’s play' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.card')).toHaveCount(24);
  const focusedLabel = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  await expect.poll(focusedLabel).toBe('Face-down card 1');
  await page.keyboard.press('ArrowRight');
  const moved = await focusedLabel();
  expect(moved).toMatch(/^Face-down card \d+$/);
  expect(moved).not.toBe('Face-down card 1');
  await page.keyboard.press('Space');
  await expect.poll(focusedLabel).toMatch(/^Revealed card \d+$/);
  await expect(page.locator('.hint')).toHaveText('Now choose a second card.');
});

test('hidden cards expose no picture names', async ({ page }) => {
  await startRound(page, { pairs: 30 });
  const labels = await page.locator('.card').evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')));
  expect(labels.every((l) => /^Face-down card \d+$/.test(l ?? ''))).toBe(true);
  await expect(page.locator('.card img[src]')).toHaveCount(0);
});

test('sounds play without errors when enabled', async ({ page }) => {
  await page.clock.install();
  await startRound(page, { pairs: 2, sound: true });
  await playPerfectRound(page);
  await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
});

test('hovering a face-down card keeps its card back', async ({ page }) => {
  await startRound(page, { pairs: 6 });
  await card(page, 2).hover();
  const background = await card(page, 2).evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(background).toMatch(/^url\(/);
});

test.describe('adult guide', () => {
  test('opens from setup and the library, and links to the printable page', async ({ page }) => {
    await usePrefs(page);
    await page.goto('./');
    await page.getByRole('button', { name: 'Adult guide' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Artwork & custom decks' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Installing, storage & backup' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Reusable generation prompt' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open printable guide' })).toHaveAttribute('href', 'guide.html');
    await page.getByRole('button', { name: 'Go to deck library' }).click();
    await page.getByRole('button', { name: 'Artwork & import guide' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Artwork & custom decks' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
  });

  test('the printable guide works offline and leads back to the game', async ({ page, context }) => {
    await page.goto('./');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.goto('./guide.html');
    await expect(page.getByRole('heading', { level: 1, name: 'Memory Card Game' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to the game' }).click();
    await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
    await page.getByRole('button', { name: 'Adult guide' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Playing together' })).toBeVisible();
  });
});

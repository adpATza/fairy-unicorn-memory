import { VIEWPORTS, expect, test, usePrefs } from './helpers';

test('setup remembers choices across reloads', async ({ page }) => {
  await usePrefs(page);
  await page.goto('./');
  await page.getByRole('combobox', { name: 'Number of players' }).selectOption('2 players');
  await page.getByRole('textbox', { name: 'Name for player 2' }).fill('Zoë');
  await page.getByRole('textbox', { name: 'Name for player 2' }).blur();
  await page.getByRole('combobox', { name: 'Subject' }).selectOption('Robots');
  await page.getByRole('combobox', { name: 'Complexity' }).selectOption('Hard');
  await page.getByLabel('Card layout').selectOption('Grid');
  await page.getByRole('button', { name: 'More pairs' }).click();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Number of players' })).toHaveValue('2 players');
  await expect(page.getByRole('textbox', { name: 'Name for player 2' })).toHaveValue('Zoë');
  await expect(page.getByRole('combobox', { name: 'Deck' })).toHaveValue('Robot Replay');
  await expect(page.getByLabel('Card layout')).toHaveValue('Grid');
  await expect(page.getByRole('spinbutton', { name: 'Pairs' })).toHaveValue('13');
  await expect(page.locator('.sample-deck')).toHaveText('Robot Replay');
});

test('only installed deck combinations are offered', async ({ page }) => {
  await usePrefs(page);
  await page.goto('./');
  const options = (name: string) => page.getByRole('combobox', { name }).locator('option').allTextContents();
  expect(await options('Subject')).toEqual(['Mix & Match', 'Animals', 'Vehicles', 'Robots']);
  await page.getByRole('combobox', { name: 'Subject' }).selectOption('Robots');
  expect(await options('Complexity')).toEqual(['Easy', 'Medium', 'Hard']);
  await page.getByRole('combobox', { name: 'Subject' }).selectOption('Animals');
  expect(await options('Complexity')).toEqual(['Easy']);
});

test('pairs stay between 2 and the deck size', async ({ page }) => {
  await usePrefs(page, { pairs: 2 });
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Fewer pairs' })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Pairs' }).fill('99');
  await page.getByRole('spinbutton', { name: 'Pairs' }).blur();
  await expect(page.getByRole('spinbutton', { name: 'Pairs' })).toHaveValue('30');
  await expect(page.getByRole('button', { name: 'More pairs' })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Pairs' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Pairs' }).blur();
  await expect(page.getByRole('spinbutton', { name: 'Pairs' })).toHaveValue('2');
});

test.describe('pair recommendation', () => {
  test('a desktop fits every pair comfortably', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.laptop);
    await usePrefs(page, { pairs: 30 });
    await page.goto('./');
    await expect(page.locator('#pair-advice')).toHaveText('Recommended up to 30 pairs on this screen.');
  });

  test('a phone warns about small cards but still allows them, and updates on rotation', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS['phone portrait']);
    await usePrefs(page, { pairs: 30 });
    await page.goto('./');
    const advice = page.locator('#pair-advice');
    await expect(advice).toHaveClass(/warning/);
    await expect(advice).toContainText('Cards will be small on this screen');
    await expect(page.getByRole('button', { name: 'Let’s play' })).toBeEnabled();
    await page.getByRole('spinbutton', { name: 'Pairs' }).fill('6');
    await page.getByRole('spinbutton', { name: 'Pairs' }).blur();
    await expect(advice).not.toHaveClass(/warning/);
    const portrait = await advice.textContent();
    await page.setViewportSize(VIEWPORTS['tablet landscape']);
    await expect(advice).not.toHaveText(portrait!);
    await expect(advice).toHaveText('Recommended up to 30 pairs on this screen.');
  });
});

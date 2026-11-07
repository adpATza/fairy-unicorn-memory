import { test as base, expect, type Page } from '@playwright/test';

export interface Prefs {
  players: number;
  names: string[];
  domain: string;
  style: string;
  complexity: string;
  deckId: string;
  pairs: number;
  layout: 'scattered' | 'grid';
  extraTurn: boolean;
  sound: boolean;
  reducedMotion: boolean;
}

export const DEFAULTS: Prefs = {
  players: 1,
  names: ['Alice', 'Ben', 'Cara', 'Duke'],
  domain: 'Mix & Match',
  style: 'Illustrated',
  complexity: 'Easy',
  deckId: 'mix_easy',
  pairs: 12,
  layout: 'scattered',
  extraTurn: true,
  sound: false,
  reducedMotion: true,
};

export const VIEWPORTS = {
  'small phone portrait': { width: 320, height: 568 },
  'phone portrait': { width: 390, height: 844 },
  'phone landscape': { width: 844, height: 390 },
  'tablet portrait': { width: 768, height: 1024 },
  'tablet landscape': { width: 1024, height: 768 },
  laptop: { width: 1280, height: 720 },
  desktop: { width: 1920, height: 1080 },
} as const;

/** Fails any test that logs a page error or console error. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await use(errors);
      expect(errors, 'no page or console errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Seeds saved preferences before the app loads (only on the first load of the page). */
export async function usePrefs(page: Page, prefs: Partial<Prefs> = {}): Promise<void> {
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('memory-card-game/preferences/v1', value);
      sessionStorage.setItem('seeded', '1');
    }
  }, JSON.stringify({ ...DEFAULTS, ...prefs }));
}

export async function startRound(page: Page, prefs: Partial<Prefs> = {}, seed = 7): Promise<void> {
  await usePrefs(page, prefs);
  await page.goto(`./?seed=${seed}`);
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.locator('.card')).toHaveCount((prefs.pairs ?? DEFAULTS.pairs) * 2);
}

export function card(page: Page, index: number) {
  return page.locator('.card').nth(index);
}

/** Picture shown by a revealed card. */
export async function pictureOf(page: Page, index: number): Promise<string> {
  const src = await card(page, index).locator('img').getAttribute('src');
  if (!src) throw new Error(`Card ${index} is not revealed`);
  return src;
}

/**
 * Plays a whole round like a player with perfect memory: every card is
 * learned only by revealing it. Requires page.clock to be installed.
 */
export async function playPerfectRound(page: Page, onTurn?: (matched: boolean) => Promise<void>): Promise<void> {
  const count = await page.locator('.card').count();
  const seen = new Map<number, string>();
  const removed = async (i: number) => (await card(page, i).getAttribute('class'))!.includes('removed');
  const reveal = async (i: number) => {
    await card(page, i).click();
    const src = await pictureOf(page, i);
    seen.set(i, src);
    return src;
  };
  const partnerOf = async (i: number, src: string) => {
    for (const [j, other] of seen) if (j !== i && other === src && !(await removed(j))) return j;
    return -1;
  };
  for (;;) {
    let first = -1;
    // Prefer a pair already known; otherwise reveal an unseen card.
    for (const [i, src] of seen) {
      if (!(await removed(i)) && (await partnerOf(i, src)) >= 0) {
        first = i;
        break;
      }
    }
    if (first < 0) {
      for (let i = 0; i < count; i++) {
        if (!seen.has(i) && !(await removed(i))) {
          first = i;
          break;
        }
      }
    }
    if (first < 0) break;
    const src = await reveal(first);
    let second = await partnerOf(first, src);
    if (second >= 0) {
      await card(page, second).click();
    } else {
      second = [...Array(count).keys()].find((i) => i !== first && !seen.has(i)) ?? -1;
      if (second < 0) throw new Error('No card left to reveal');
      await reveal(second);
    }
    const matched = seen.get(second) === src;
    await onTurn?.(matched);
    await page.clock.runFor(matched ? 700 : 1600);
    if (matched && (await page.locator('.screen.results').count())) break;
  }
}

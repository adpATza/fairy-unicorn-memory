import { VIEWPORTS, card, expect, startRound, test } from './helpers';

// Requirement: at 100% zoom every card is visible without scrolling, on every
// screen, for every pair count. Resizing scales the board and never moves cards.

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(name, () => {
    test.use({ viewport });
    for (const players of [1, 4]) {
      for (const layout of ['scattered', 'grid'] as const) {
        for (const pairs of [2, 12, 30]) {
          test(`${players} player(s), ${pairs} pairs, ${layout}: everything fits without scrolling`, async ({ page }) => {
            await startRound(page, { players, pairs, layout });
            // Reveal two cards: the longest hint must not widen the screen either.
            await card(page, 0).click();
            await card(page, 1).click();
            const metrics = await page.evaluate(() => {
              const box = (el: Element) => el.getBoundingClientRect().toJSON() as DOMRect;
              return {
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
                width: innerWidth,
                height: innerHeight,
                cards: [...document.querySelectorAll('.card')].map(box),
                controls: [...document.querySelectorAll('.hud button, .hud-foot button, .turn, .remaining, .hint, .clock')]
                  .filter((el) => getComputedStyle(el).display !== 'none')
                  .map(box),
              };
            });
            expect(metrics.scrollWidth, 'no horizontal scrolling').toBeLessThanOrEqual(metrics.width);
            expect(metrics.scrollHeight, 'no vertical scrolling').toBeLessThanOrEqual(metrics.height);
            for (const [i, r] of [...metrics.cards, ...metrics.controls].entries()) {
              expect(r.left, `item ${i} left`).toBeGreaterThanOrEqual(-0.5);
              expect(r.top, `item ${i} top`).toBeGreaterThanOrEqual(-0.5);
              expect(r.right, `item ${i} right`).toBeLessThanOrEqual(metrics.width + 0.5);
              expect(r.bottom, `item ${i} bottom`).toBeLessThanOrEqual(metrics.height + 0.5);
            }
            const cards = metrics.cards;
            for (let i = 0; i < cards.length; i++) {
              for (let j = 0; j < i; j++) {
                const a = cards[i]!;
                const b = cards[j]!;
                const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
                expect(overlap, `cards ${i} and ${j} overlap`).toBe(false);
              }
            }
          });
        }
      }
    }
  });
}

test.describe('resizing', () => {
  test.use({ viewport: VIEWPORTS['phone portrait'] });

  test('rotating scales the board uniformly and never moves cards', async ({ page }) => {
    await startRound(page, { pairs: 30, players: 2 });
    const boxes = () => page.locator('.card').evaluateAll((cards) => cards.map((c) => c.getBoundingClientRect().toJSON() as DOMRect));
    const before = await boxes();
    for (const viewport of [VIEWPORTS['phone landscape'], VIEWPORTS.desktop, VIEWPORTS['phone portrait']]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const after = await boxes();
      const scale = after[0]!.width / before[0]!.width;
      for (const [i, box] of after.entries()) {
        expect(Math.abs(box.x - (after[0]!.x + (before[i]!.x - before[0]!.x) * scale)), `card ${i} keeps its place`).toBeLessThan(1);
        expect(Math.abs(box.y - (after[0]!.y + (before[i]!.y - before[0]!.y) * scale)), `card ${i} keeps its place`).toBeLessThan(1);
        expect(box.right).toBeLessThanOrEqual(viewport.width + 0.5);
        expect(box.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
      }
    }
  });
});

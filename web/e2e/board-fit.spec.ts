import { expect, test, type Page } from '@playwright/test';

// Requirement: at 100% zoom every card is visible without scrolling, on every
// screen, for every pair count. Resizing scales the board and never moves cards.

const VIEWPORTS: Record<string, { width: number; height: number }> = {
  'small phone portrait': { width: 320, height: 568 },
  'phone portrait': { width: 390, height: 844 },
  'phone landscape': { width: 844, height: 390 },
  'tablet portrait': { width: 768, height: 1024 },
  'tablet landscape': { width: 1024, height: 768 },
  laptop: { width: 1280, height: 720 },
  desktop: { width: 1920, height: 1080 },
};

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function cardBoxes(page: Page): Promise<Box[]> {
  return page.locator('.card').evaluateAll((cards) =>
    cards.map((card) => {
      const r = card.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(name, () => {
    test.use({ viewport });

    for (const layout of ['scattered', 'grid'] as const) {
      for (const pairs of [2, 12, 30]) {
        test(`${pairs} pairs, ${layout}: all cards visible without scrolling`, async ({ page }) => {
          await page.goto(`./?pairs=${pairs}&layout=${layout}&seed=1`);
          await expect(page.locator('.card')).toHaveCount(pairs * 2);
          await expect(page.locator('#status')).toContainText('recommended up to');

          const scroll = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            viewWidth: window.innerWidth,
            viewHeight: window.innerHeight,
          }));
          expect(scroll.width, 'no horizontal scrolling').toBeLessThanOrEqual(scroll.viewWidth);
          expect(scroll.height, 'no vertical scrolling').toBeLessThanOrEqual(scroll.viewHeight);

          const boxes = await cardBoxes(page);
          for (const [i, box] of boxes.entries()) {
            expect(box.x, `card ${i} left edge`).toBeGreaterThanOrEqual(0);
            expect(box.y, `card ${i} top edge`).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width, `card ${i} right edge`).toBeLessThanOrEqual(viewport.width);
            expect(box.y + box.height, `card ${i} bottom edge`).toBeLessThanOrEqual(viewport.height);
            for (const [j, other] of boxes.slice(0, i).entries()) {
              const overlap =
                box.x < other.x + other.width && other.x < box.x + box.width && box.y < other.y + other.height && other.y < box.y + box.height;
              expect(overlap, `cards ${i} and ${j} overlap`).toBe(false);
            }
          }
        });
      }
    }
  });
}

test.describe('resizing', () => {
  test.use({ viewport: VIEWPORTS['phone portrait']! });

  test('rotating scales the board uniformly and never moves cards', async ({ page }) => {
    await page.goto('./?pairs=30&layout=scattered&seed=9');
    await expect(page.locator('.card')).toHaveCount(60);
    const before = await cardBoxes(page);
    const status = await page.locator('#status').textContent();

    for (const viewport of [VIEWPORTS['phone landscape']!, VIEWPORTS.desktop!, VIEWPORTS['phone portrait']!]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('#status')).toHaveText(status!);
      await page.waitForFunction(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
      const after = await cardBoxes(page);
      expect(after).toHaveLength(before.length);
      const scale = after[0]!.width / before[0]!.width;
      for (const [i, box] of after.entries()) {
        const expectedX = after[0]!.x + (before[i]!.x - before[0]!.x) * scale;
        const expectedY = after[0]!.y + (before[i]!.y - before[0]!.y) * scale;
        expect(Math.abs(box.x - expectedX), `card ${i} x keeps its place`).toBeLessThan(1);
        expect(Math.abs(box.y - expectedY), `card ${i} y keeps its place`).toBeLessThan(1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
      }
    }
  });
});

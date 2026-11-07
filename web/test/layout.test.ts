import { describe, expect, it } from 'vitest';
import {
  MAX_SIDE,
  RECOMMENDED_MIN_SIDE,
  cardSide,
  encloses,
  fitTransform,
  gapFor,
  generate,
  grow,
  intersects,
  recommendedMaxPairs,
  type LayoutKind,
  type Rect,
} from '../src/layout';
import { createRng } from '../src/rng';

// Port of tests/test_runner.gd::_test_layouts, extended to the board shapes the
// web edition meets on phones, tablets and desktops.

/** Board rectangles (CSS px) left for cards after the game screen's header and footer. */
const BOARDS: Record<string, [number, number]> = {
  'Godot reference 1212×490': [1212, 490],
  'small phone portrait (320×568)': [304, 420],
  'phone portrait (390×844)': [374, 600],
  'phone landscape (844×390)': [790, 250],
  'tablet portrait (768×1024)': [736, 840],
  'tablet landscape (1024×768)': [990, 590],
  'desktop (1920×1080)': [1860, 880],
};

function assertValidBoard(rects: Rect[], count: number, width: number, height: number, layout: LayoutKind): void {
  const area = { x: 0, y: 0, w: width, h: height };
  const gap = gapFor(width, height, count);
  expect(rects).toHaveLength(count);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    expect(encloses(area, r), 'no clipping').toBe(true);
    expect(r.w, 'square cards').toBeCloseTo(r.h, 9);
    expect(r.w, 'never larger than the cap').toBeLessThanOrEqual(MAX_SIDE + 1e-9);
    expect(r.w, 'cards have a size').toBeGreaterThan(0);
    for (let j = 0; j < i; j++) {
      // The Godot suite checks 9.8 px separation for its 10 px gap.
      if (intersects(grow(r, gap * 0.49), grow(rects[j]!, gap * 0.49))) {
        throw new Error(`Cards ${i} and ${j} are closer than the ${gap.toFixed(2)} px gap (${layout}, ${width}×${height})`);
      }
    }
  }
  if (layout === 'scattered') {
    expect(rects.some((r) => Math.abs(r.y - rects[0]!.y) > 1), 'scattered positions are irregular').toBe(true);
  }
}

describe('generate on the Godot reference board', () => {
  const [width, height] = BOARDS['Godot reference 1212×490']!;
  for (const layout of ['scattered', 'grid'] as const) {
    it(`${layout}: 2–30 pairs, 50 seeds each`, () => {
      let smallest = Infinity;
      for (let pairs = 2; pairs <= 30; pairs++) {
        for (let seed = 0; seed < 50; seed++) {
          const rects = generate({ count: pairs * 2, layout, seed, width, height });
          assertValidBoard(rects, pairs * 2, width, height, layout);
          smallest = Math.min(smallest, cardSide(rects));
        }
      }
      // The Godot edition's dense scattered boards keep cards around 70 px or more.
      expect(smallest).toBeGreaterThanOrEqual(layout === 'grid' ? 75 : 62);
    });
  }
});

describe('generate on device-shaped boards', () => {
  for (const [name, [width, height]] of Object.entries(BOARDS)) {
    for (const layout of ['scattered', 'grid'] as const) {
      it(`${name}, ${layout}: 2–30 pairs, 8 seeds each`, () => {
        for (let pairs = 2; pairs <= 30; pairs++) {
          for (let seed = 100; seed < 108; seed++) {
            assertValidBoard(generate({ count: pairs * 2, layout, seed, width, height }), pairs * 2, width, height, layout);
          }
        }
      });
    }
  }
});

describe('generate on random board shapes', () => {
  it('always fits every card without overlap, even on extreme aspect ratios', () => {
    const rng = createRng(20261107);
    for (let n = 0; n < 400; n++) {
      const width = Math.round(rng.randfRange(60, 2400));
      const height = Math.round(rng.randfRange(60, 1600));
      const count = rng.randiRange(2, 30) * 2;
      const layout: LayoutKind = rng.randf() < 0.5 ? 'scattered' : 'grid';
      const rects = generate({ count, layout, seed: n, width, height });
      expect(rects).toHaveLength(count);
      const area = { x: 0, y: 0, w: width, h: height };
      const gap = gapFor(width, height, count);
      for (let i = 0; i < rects.length; i++) {
        expect(encloses(area, rects[i]!)).toBe(true);
        for (let j = 0; j < i; j++) expect(intersects(grow(rects[i]!, gap * 0.49), grow(rects[j]!, gap * 0.49))).toBe(false);
      }
    }
  });
});

describe('generate details', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const board = (seed: number) => generate({ count: 24, layout: 'scattered', seed, width: 990, height: 590 });
    expect(board(7)).toEqual(board(7));
    expect(board(7)).not.toEqual(board(8));
  });

  it('grid ignores the seed', () => {
    const board = (seed: number) => generate({ count: 24, layout: 'grid', seed, width: 990, height: 590 });
    expect(board(1)).toEqual(board(2));
  });

  it('chooses the grid shape that gives the largest cards', () => {
    // A portrait phone: the Godot formula would give ~42 px; trying every column count gives more.
    const rects = generate({ count: 60, layout: 'grid', seed: 0, width: 374, height: 660 });
    expect(cardSide(rects)).toBeGreaterThan(50);
  });

  it('keeps cards inside very wide and very tall boards', () => {
    for (const [width, height] of [[2400, 60], [60, 1600], [1600, 90]] as const) {
      assertValidBoard(generate({ count: 4, layout: 'scattered', seed: 3, width, height }), 4, width, height, 'scattered');
    }
  });

  it('scales the gap with density', () => {
    expect(gapFor(1212, 490, 4)).toBe(10);
    expect(gapFor(300, 300, 60)).toBe(4);
  });

  it('rejects invalid requests', () => {
    expect(() => generate({ count: 3, layout: 'grid', seed: 0, width: 500, height: 500 })).toThrow(RangeError);
    expect(() => generate({ count: 62, layout: 'grid', seed: 0, width: 500, height: 500 })).toThrow(RangeError);
    expect(() => generate({ count: 5, layout: 'grid', seed: 0, width: 500, height: 500 })).toThrow(RangeError);
    expect(() => generate({ count: 4, layout: 'grid', seed: 0, width: 59, height: 500 })).toThrow(RangeError);
    expect(() => generate({ count: 4, layout: 'grid', seed: 0, width: 500, height: Number.NaN })).toThrow(RangeError);
  });
});

describe('fitTransform', () => {
  it('scales a stored board uniformly into resized views without changing it', () => {
    const fixed = generate({ count: 60, layout: 'scattered', seed: 87234, width: 374, height: 660 });
    const before = structuredClone(fixed);
    for (const [vw, vh] of [[374, 660], [790, 250], [1860, 880], [300, 300], [2560, 1080]] as const) {
      const t = fitTransform(374, 660, vw, vh);
      for (const r of fixed) {
        const mapped = { x: t.x + r.x * t.scale, y: t.y + r.y * t.scale, w: r.w * t.scale, h: r.h * t.scale };
        expect(encloses({ x: 0, y: 0, w: vw, h: vh }, mapped, 1e-6), 'resize stays in view').toBe(true);
        expect(mapped.w).toBeCloseTo(mapped.h, 9);
      }
    }
    expect(fixed, 'resize never changes stored coordinates').toEqual(before);
  });

  it('centres the letterboxed board', () => {
    expect(fitTransform(100, 100, 300, 100)).toEqual({ scale: 1, x: 100, y: 0 });
    expect(fitTransform(200, 100, 100, 100)).toEqual({ scale: 0.5, x: 0, y: 25 });
  });
});

describe('recommendedMaxPairs', () => {
  for (const layout of ['scattered', 'grid'] as const) {
    it(`${layout}: recommendation keeps cards at least ${RECOMMENDED_MIN_SIDE} px and is as large as possible`, () => {
      for (const [name, [width, height]] of Object.entries(BOARDS)) {
        const pairs = recommendedMaxPairs(width, height, layout);
        expect(pairs, name).toBeGreaterThanOrEqual(2);
        expect(pairs, name).toBeLessThanOrEqual(30);
        const seeds = layout === 'grid' ? [0] : [1, 2, 3];
        const sideAt = (p: number) => Math.min(...seeds.map((seed) => cardSide(generate({ count: p * 2, layout, seed, width, height }))));
        expect(sideAt(pairs), name).toBeGreaterThanOrEqual(RECOMMENDED_MIN_SIDE);
        if (pairs < 30) expect(sideAt(pairs + 1), name).toBeLessThan(RECOMMENDED_MIN_SIDE);
      }
    });
  }

  it('recommends more pairs on bigger screens', () => {
    for (const layout of ['scattered', 'grid'] as const) {
      const phone = recommendedMaxPairs(...BOARDS['small phone portrait (320×568)']!, layout);
      const tablet = recommendedMaxPairs(...BOARDS['tablet landscape (1024×768)']!, layout);
      expect(phone).toBeLessThan(30);
      expect(tablet).toBe(30);
    }
  });

  it('never exceeds the deck size', () => {
    expect(recommendedMaxPairs(1860, 880, 'grid', 12)).toBe(12);
    expect(recommendedMaxPairs(1860, 880, 'scattered', 1)).toBe(2);
  });

  it('falls back to the minimum when even two pairs would be small', () => {
    expect(recommendedMaxPairs(100, 100, 'grid')).toBe(2);
  });
});

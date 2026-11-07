import { createRng, type Rng } from './rng';
import { MAX_PAIRS, MIN_PAIRS } from './session';

/**
 * Card placement, ported from scripts/board_layout.gd.
 *
 * The Godot edition places cards in a fixed 1212 × 490 area of a letterboxed
 * 1280 × 720 canvas. Here the area is the board's own size at round start, so
 * phones in portrait, tablets and desktops each get a board shaped to fit.
 * Positions are generated once per round. Resizing only scales the whole board
 * uniformly (see fitTransform); cards never move during a round.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LayoutKind = 'scattered' | 'grid';

export interface LayoutRequest {
  /** Number of cards (twice the number of pairs). */
  count: number;
  layout: LayoutKind;
  seed: number;
  /** Board width in CSS pixels at round start. */
  width: number;
  /** Board height in CSS pixels at round start. */
  height: number;
}

export const MIN_CARDS = MIN_PAIRS * 2;
export const MAX_CARDS = MAX_PAIRS * 2;
/** Largest card edge, as in the Godot edition. */
export const MAX_SIDE = 184;
/** Smallest board edge the layout accepts. */
export const MIN_BOARD_EDGE = 60;
/** Card edge, in CSS pixels, below which setup warns that cards are small. */
export const RECOMMENDED_MIN_SIDE = 56;
/** Layout uses its own random stream, separate from the shuffle. */
const LAYOUT_STREAM = 0x3f2a9c17;

/** Separation between cards: 10 px on roomy boards, down to 4 px on dense ones. */
export function gapFor(width: number, height: number, count: number): number {
  return Math.min(10, Math.max(4, Math.sqrt((width * height) / count) * 0.1));
}

export function generate({ count, layout, seed, width, height }: LayoutRequest): Rect[] {
  if (!Number.isInteger(count) || count % 2 !== 0 || count < MIN_CARDS || count > MAX_CARDS) {
    throw new RangeError(`Cannot lay out ${count} cards`);
  }
  if (!(width >= MIN_BOARD_EDGE && height >= MIN_BOARD_EDGE && Number.isFinite(width) && Number.isFinite(height))) {
    throw new RangeError(`Board ${width} × ${height} is too small`);
  }
  const area: Rect = { x: 0, y: 0, w: width, h: height };
  const gap = gapFor(width, height, count);
  if (layout === 'grid') return grid(count, area, gap);
  return scattered(count, area, gap, createRng((seed ^ LAYOUT_STREAM) >>> 0));
}

function scattered(count: number, area: Rect, gap: number, rng: Rng): Rect[] {
  // A card must also fit across the board's shorter edge (very wide or tall boards).
  let side = Math.min(MAX_SIDE, Math.sqrt((area.w * area.h) / count) * 0.78 - gap * 0.5, Math.min(area.w, area.h) - gap - 0.02);
  // The free-space subdivision below always succeeds at this card size.
  const guaranteed = subdivisionSide(count, area, gap, side);
  // Sparse boards use unstructured dart throwing directly. Darts may shrink
  // when random packing jams, but never below the guaranteed size: smaller
  // cards would be harder to tap than the subdivision fallback's.
  if (count <= 40) {
    const smallest = guaranteed;
    let trial = side;
    for (let attempt = 0; attempt < 7; attempt++) {
      const darts: Rect[] = [];
      for (let i = 0; i < count; i++) {
        let placed = false;
        for (let tries = 0; tries < 240; tries++) {
          const candidate = square(rng.randfRange(area.x, area.x + area.w - trial), rng.randfRange(area.y, area.y + area.h - trial), trial);
          if (isClear(candidate, darts, gap * 0.5)) {
            darts.push(candidate);
            placed = true;
            break;
          }
        }
        if (!placed) break;
      }
      if (darts.length === count) return darts;
      trial = Math.max(smallest, trial * 0.94);
    }
  }
  // Random binary free-space subdivision avoids dart throwing's tiny-card jam.
  // Leaves have different dimensions and independently randomised positions:
  // there are no rows, columns, snapped coordinates, or visible rotations.
  // Capacity grows as cards shrink, so this always finishes.
  side = guaranteed;
  for (let pass = 0; pass < 400; pass++) {
    const slot = side + gap + 0.01;
    if (Math.floor(area.w / slot) * Math.floor(area.h / slot) >= count) {
      const cells: Rect[] = [];
      scatterCells(area, count, slot, rng, cells);
      const positions: Rect[] = [];
      for (const cell of cells) {
        const candidate = square(
          rng.randfRange(cell.x + gap * 0.5, cell.x + cell.w - side - gap * 0.5),
          rng.randfRange(cell.y + gap * 0.5, cell.y + cell.h - side - gap * 0.5),
          side,
        );
        if (!encloses(area, candidate) || !isClear(candidate, positions, gap * 0.499)) break;
        positions.push(candidate);
      }
      if (positions.length === count) {
        mixPositions(positions, side, gap, area, rng);
        return positions;
      }
    }
    side *= 0.96;
  }
  throw new Error('Scattered placement exhausted its bounded retries');
}

/** Largest side, shrinking from `side` in 4% steps, whose slots can hold every card. */
function subdivisionSide(count: number, area: Rect, gap: number, side: number): number {
  const capacity = (s: number) => Math.floor(area.w / (s + gap + 0.01)) * Math.floor(area.h / (s + gap + 0.01));
  while (capacity(side) < count) side *= 0.96;
  return side;
}

/**
 * Free-space random walks remove the bands a capacity-conscious subdivision
 * can leave. All movement happens during generation, before any card is shown.
 */
function mixPositions(positions: Rect[], side: number, gap: number, area: Rect, rng: Rng): void {
  for (let sweep = 0; sweep < 48; sweep++) {
    for (let i = 0; i < positions.length; i++) {
      const current = positions[i]!;
      const candidate =
        sweep % 12 === 0
          ? square(rng.randfRange(area.x, area.x + area.w - side), rng.randfRange(area.y, area.y + area.h - side), side)
          : square(current.x + rng.randfRange(-side * 0.7, side * 0.7), current.y + rng.randfRange(-side * 0.7, side * 0.7), side);
      if (!encloses(area, candidate)) continue;
      let clear = true;
      for (let j = 0; j < positions.length; j++) {
        if (j !== i && intersects(grow(candidate, gap * 0.499), grow(positions[j]!, gap * 0.499))) {
          clear = false;
          break;
        }
      }
      if (clear) positions[i] = candidate;
    }
  }
}

/** Every leaf is at least one slot square, so each holds one separated card. */
function scatterCells(area: Rect, count: number, slot: number, rng: Rng, output: Rect[]): void {
  if (count === 1) {
    output.push(area);
    return;
  }
  const columns = Math.floor(area.w / slot);
  const rows = Math.floor(area.h / slot);
  const vertical = columns > 1 && (rows < 2 || rng.randf() < area.w / (area.w + area.h));
  const capacityAxis = vertical ? columns : rows;
  const across = vertical ? rows : columns;
  const splitSlots = rng.randiRange(1, capacityAxis - 1);
  const extent = vertical ? area.w : area.h;
  const cut = rng.randfRange(splitSlots * slot, extent - (capacityAxis - splitSlots) * slot);
  const leftCapacity = splitSlots * across;
  const rightCapacity = (capacityAxis - splitSlots) * across;
  const desired = Math.round((count * cut) / extent);
  const leftCount = Math.min(Math.max(desired, Math.max(1, count - rightCapacity)), Math.min(count - 1, leftCapacity));
  const left = { ...area };
  const right = { ...area };
  if (vertical) {
    left.w = cut;
    right.x += cut;
    right.w -= cut;
  } else {
    left.h = cut;
    right.y += cut;
    right.h -= cut;
  }
  scatterCells(left, leftCount, slot, rng, output);
  scatterCells(right, count - leftCount, slot, rng, output);
}

/** Centred grid. Tries every column count and keeps the largest cards. */
function grid(count: number, area: Rect, gap: number): Rect[] {
  let best = 0;
  let columns = 1;
  for (let c = 1; c <= count; c++) {
    const r = Math.ceil(count / c);
    const side = Math.min((area.w - gap * (c - 1)) / c, (area.h - gap * (r - 1)) / r);
    if (side > best + 1e-9) {
      best = side;
      columns = c;
    }
  }
  if (best <= 0) throw new Error('Grid placement does not fit');
  const side = Math.min(MAX_SIDE, best);
  const rows = Math.ceil(count / columns);
  const originX = area.x + (area.w - (columns * side + (columns - 1) * gap)) / 2;
  const originY = area.y + (area.h - (rows * side + (rows - 1) * gap)) / 2;
  const result: Rect[] = [];
  for (let i = 0; i < count; i++) {
    result.push(square(originX + (i % columns) * (side + gap), originY + Math.floor(i / columns) * (side + gap), side));
  }
  return result;
}

/** Uniform scale and centring offset that fits a generated board into a resized one. */
export function fitTransform(boardWidth: number, boardHeight: number, viewWidth: number, viewHeight: number): { scale: number; x: number; y: number } {
  const scale = Math.min(viewWidth / boardWidth, viewHeight / boardHeight);
  return { scale, x: (viewWidth - boardWidth * scale) / 2, y: (viewHeight - boardHeight * scale) / 2 };
}

/** Smallest card edge in a layout. */
export function cardSide(rects: readonly Rect[]): number {
  return Math.min(...rects.map((r) => Math.min(r.w, r.h)));
}

/**
 * Largest pair count, up to `maxPairs`, whose cards stay at least `minSide`
 * CSS pixels on a board of this size. A recommendation only: players may
 * choose more pairs and accept smaller cards. Scattered boards are random, so
 * a few fixed seeds are sampled and the smallest result is used.
 */
export function recommendedMaxPairs(width: number, height: number, layout: LayoutKind, maxPairs: number = MAX_PAIRS, minSide: number = RECOMMENDED_MIN_SIDE): number {
  const limit = Math.max(MIN_PAIRS, Math.min(MAX_PAIRS, Math.floor(maxPairs)));
  const seeds = layout === 'grid' ? [0] : [1, 2, 3];
  const fits = (pairs: number) => seeds.every((seed) => cardSide(generate({ count: pairs * 2, layout, seed, width, height })) >= minSide);
  if (fits(limit)) return limit;
  let low = MIN_PAIRS;
  let high = limit;
  if (!fits(low)) return MIN_PAIRS;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}

function square(x: number, y: number, side: number): Rect {
  return { x, y, w: side, h: side };
}

export function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

/** Strict overlap: rectangles that only touch do not intersect (as in Godot). */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function encloses(outer: Rect, inner: Rect, epsilon = 1e-9): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.w <= outer.x + outer.w + epsilon &&
    inner.y + inner.h <= outer.y + outer.h + epsilon
  );
}

function isClear(candidate: Rect, placed: readonly Rect[], margin: number): boolean {
  const grown = grow(candidate, margin);
  return placed.every((r) => !intersects(grown, grow(r, margin)));
}

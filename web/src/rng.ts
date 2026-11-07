/**
 * Small seeded random number generator (mulberry32).
 *
 * The Godot edition uses RandomNumberGenerator (PCG32). Exact sequences do not
 * need to match: both editions shuffle randomly each round, and only the
 * deterministic-per-seed property matters for layout stability and tests.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  randf(): number;
  /** Uniform float in [from, to). */
  randfRange(from: number, to: number): number;
  /** Uniform integer in [from, to], both inclusive. */
  randiRange(from: number, to: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const randf = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    randf,
    randfRange: (from, to) => from + (to - from) * randf(),
    randiRange: (from, to) => from + Math.floor(randf() * (to - from + 1)),
  };
}

/** A fresh, unpredictable 32-bit round seed. */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0]!;
}

/** In-place Fisher–Yates shuffle, matching the Godot edition's algorithm. */
export function shuffle<T>(items: T[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.randiRange(0, i);
    const temp = items[i]!;
    items[i] = items[j]!;
    items[j] = temp;
  }
}

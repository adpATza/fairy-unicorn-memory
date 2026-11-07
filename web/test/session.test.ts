import { describe, expect, it } from 'vitest';
import { MATCH_SECONDS, MISMATCH_SECONDS, MemorySession, type PairSource } from '../src/session';

// Port of tests/test_runner.gd::_test_sessions, plus web-specific edge cases.

const entries: PairSource[] = Array.from({ length: 30 }, (_, i) => ({
  pairId: `mix_easy_${String(i + 1).padStart(2, '0')}`,
  image: `${String(i + 1).padStart(2, '0')}.svg`,
}));

function findPair(session: MemorySession, wanted: boolean): [number, number] {
  const { cards } = session;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i]!.matched) continue;
    for (let j = i + 1; j < cards.length; j++) {
      if (!cards[j]!.matched && (cards[i]!.pairId === cards[j]!.pairId) === wanted) return [i, j];
    }
  }
  throw new Error(`No ${wanted ? 'matching' : 'mismatching'} pair left`);
}

describe('MemorySession complete rounds', () => {
  let rounds = 0;
  for (let playerCount = 1; playerCount <= 4; playerCount++) {
    for (const keepTurn of [true, false]) {
      it(`${playerCount} player(s), extra turn ${keepTurn ? 'on' : 'off'}, all pair counts`, () => {
        for (let pairs = 2; pairs <= 30; pairs++) {
          const s = new MemorySession();
          s.start(entries, pairs, ['A', 'B', 'C', 'D'].slice(0, playerCount), keepTurn, 39471 + pairs);

          const counts = new Map<string, number>();
          for (const card of s.cards) counts.set(card.pairId, (counts.get(card.pairId) ?? 0) + 1);
          expect(counts.size, 'requested number of distinct pairs').toBe(pairs);
          expect(s.cards.length).toBe(pairs * 2);
          expect([...counts.values()].every((n) => n === 2), 'exactly two cards per pair ID').toBe(true);
          expect(s.select(-1) || s.select(s.cards.length) || s.select(0.5), 'ignore invalid selections').toBe(false);

          // Four mismatches exercise player wraparound, timing and rapid input.
          for (let attempt = 0; attempt < 4; attempt++) {
            const [a, b] = findPair(s, false);
            const active = s.activePlayer;
            expect(s.select(a), 'first card accepted').toBe(true);
            expect(s.select(a), 'repeated click ignored').toBe(false);
            expect(s.state).toBe('second');
            expect(s.select(b), 'second different card accepted').toBe(true);
            expect(s.select((b + 1) % s.cards.length), 'rapid third click blocked during resolution').toBe(false);
            s.tick(1.49);
            expect(s.state === 'resolving' && s.visibleCard(a), 'mismatch visible for full 1.5 seconds').toBe(true);
            const elapsed = s.elapsed;
            const remaining = s.resolutionLeft;
            s.setPaused(true);
            s.tick(100);
            expect(s.elapsed, 'pause freezes elapsed').toBe(elapsed);
            expect(s.resolutionLeft, 'pause freezes resolution').toBe(remaining);
            expect(s.visibleCard(a), 'pause conceals artwork').toBe(false);
            expect(s.select(a), 'pause blocks selection').toBe(false);
            s.setPaused(false);
            s.tick(0.011);
            expect(s.state === 'first' && s.selections.length === 0, 'mismatch clears at original positions').toBe(true);
            expect(s.activePlayer, 'mismatch advances and wraps player').toBe((active + 1) % playerCount);
          }

          while (s.remaining > 0) {
            const [a, b] = findPair(s, true);
            const active = s.activePlayer;
            const oldScores = [...s.scores];
            s.select(a);
            s.select(b);
            s.tick(0.64);
            expect(s.cards[a]!.matched, 'match briefly remains visible').toBe(false);
            s.tick(0.011);
            expect(s.cards[a]!.matched && s.cards[b]!.matched, 'match removes exactly the pair').toBe(true);
            expect(s.scores[active], 'match scores one').toBe(oldScores[active]! + 1);
            expect(s.activePlayer, 'match turn rule').toBe(keepTurn ? active : (active + 1) % playerCount);
            expect(s.scores.reduce((sum, n) => sum + n, 0), 'scores equal matched pairs').toBe(pairs - s.remaining);
          }

          expect(s.state, 'final pair ends the round').toBe('finished');
          expect(s.attempts, 'attempts correct').toBe(pairs + 4);
          expect(s.select(0), 'input closed').toBe(false);
          const doneTime = s.elapsed;
          s.tick(20);
          expect(s.elapsed, 'final completion clock stops').toBe(doneTime);

          s.start(entries, pairs, ['Solo'], true, 999);
          expect(s.attempts === 0 && s.elapsed === 0 && s.selections.length === 0 && s.state === 'first', 'restart fully resets pending resolution').toBe(true);
          rounds++;
        }
      });
    }
  }
  it('covered 232 complete rounds', () => expect(rounds).toBe(232));
});

describe('MemorySession details', () => {
  it('reports all tied winners', () => {
    const tied = new MemorySession();
    tied.start(entries, 2, ['A', 'B', 'C', 'D'], true, 1);
    tied.scores = [3, 1, 3, 0];
    expect(tied.winners()).toEqual(['A', 'C']);
  });

  it('uses the Godot edition resolution timings', () => {
    expect(MATCH_SECONDS).toBe(0.65);
    expect(MISMATCH_SECONDS).toBe(1.5);
  });

  it('stops the clock exactly when the final pair resolves', () => {
    const s = new MemorySession();
    s.start(entries, 2, ['Solo'], true, 5);
    let [a, b] = findPair(s, true);
    s.select(a);
    s.select(b);
    s.tick(1);
    [a, b] = findPair(s, true);
    s.tick(2);
    s.select(a);
    s.select(b);
    const before = s.elapsed;
    s.tick(10);
    expect(s.state).toBe('finished');
    expect(s.elapsed).toBeCloseTo(before + MATCH_SECONDS, 10);
  });

  it('ignores negative time deltas', () => {
    const s = new MemorySession();
    s.start(entries, 2, ['Solo'], true, 5);
    s.tick(-3);
    expect(s.elapsed).toBe(0);
  });

  it('is deterministic for a seed and different across seeds', () => {
    const order = (seed: number) => {
      const s = new MemorySession();
      s.start(entries, 12, ['Solo'], true, seed);
      return s.cards.map((c) => c.pairId).join();
    };
    expect(order(42)).toBe(order(42));
    expect(order(42)).not.toBe(order(43));
  });

  it('draws the requested pairs from across the whole deck', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const s = new MemorySession();
      s.start(entries, 2, ['Solo'], true, seed);
      for (const card of s.cards) seen.add(card.pairId);
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('does not share card objects with the source deck', () => {
    const s = new MemorySession();
    const source = entries.map((e) => ({ ...e }));
    s.start(source, 2, ['Solo'], true, 1);
    s.cards[0]!.pairId = 'changed';
    expect(source.some((e) => e.pairId === 'changed')).toBe(false);
  });

  it('rejects invalid round settings', () => {
    const s = new MemorySession();
    expect(() => s.start(entries, 1, ['A'], true, 1)).toThrow(RangeError);
    expect(() => s.start(entries, 31, ['A'], true, 1)).toThrow(RangeError);
    expect(() => s.start(entries.slice(0, 5), 6, ['A'], true, 1)).toThrow(RangeError);
    expect(() => s.start(entries, 2.5, ['A'], true, 1)).toThrow(RangeError);
    expect(() => s.start(entries, 2, [], true, 1)).toThrow(RangeError);
    expect(() => s.start(entries, 2, ['A', 'B', 'C', 'D', 'E'], true, 1)).toThrow(RangeError);
  });

  it('emits changed, pairResolved and completed events', () => {
    const s = new MemorySession();
    const log: string[] = [];
    s.on('changed', () => log.push('changed'));
    s.on('pairResolved', (matched, indices) => log.push(`resolved:${matched}:${indices.length}`));
    const off = s.on('completed', () => log.push('completed'));
    s.start(entries, 2, ['Solo'], true, 3);
    for (let n = 0; n < 2; n++) {
      const [a, b] = findPair(s, true);
      s.select(a);
      s.select(b);
      s.tick(1);
    }
    expect(log.filter((e) => e === 'completed')).toHaveLength(1);
    expect(log.filter((e) => e === 'resolved:true:2')).toHaveLength(2);
    off();
    s.start(entries, 2, ['Solo'], true, 3);
    for (let n = 0; n < 2; n++) {
      const [a, b] = findPair(s, true);
      s.select(a);
      s.select(b);
      s.tick(1);
    }
    expect(log.filter((e) => e === 'completed')).toHaveLength(1);
  });
});

import { createRng, shuffle } from './rng';

/**
 * Pure round state, ported from scripts/game_session.gd.
 * No timers or animations: tick() is the only clock.
 */
export type SessionState = 'first' | 'second' | 'resolving' | 'finished';

/** One picture from a deck. Each becomes exactly two cards. */
export interface PairSource {
  pairId: string;
  image: string;
}

export interface Card {
  pairId: string;
  image: string;
  matched: boolean;
}

export const MIN_PAIRS = 2;
export const MAX_PAIRS = 30;
export const MAX_PLAYERS = 4;
/** A match stays visible briefly before its cards are removed. */
export const MATCH_SECONDS = 0.65;
/** A mismatch stays visible for 1.5 seconds. */
export const MISMATCH_SECONDS = 1.5;

interface SessionEvents {
  changed: [];
  pairResolved: [matched: boolean, indices: number[]];
  completed: [];
}

type Listener<K extends keyof SessionEvents> = (...args: SessionEvents[K]) => void;

export class MemorySession {
  state: SessionState = 'first';
  cards: Card[] = [];
  selections: number[] = [];
  names: string[] = [];
  scores: number[] = [];
  activePlayer = 0;
  attempts = 0;
  elapsed = 0;
  remaining = 0;
  resolutionLeft = 0;
  extraTurn = true;
  paused = false;
  seed = 0;

  private listeners: { [K in keyof SessionEvents]: Set<Listener<K>> } = {
    changed: new Set(),
    pairResolved: new Set(),
    completed: new Set(),
  };

  /** Subscribe to an event; returns an unsubscribe function. */
  on<K extends keyof SessionEvents>(event: K, listener: Listener<K>): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  private emit<K extends keyof SessionEvents>(event: K, ...args: SessionEvents[K]): void {
    for (const listener of [...this.listeners[event]]) listener(...args);
  }

  start(entries: readonly PairSource[], pairs: number, players: readonly string[], keepTurn: boolean, roundSeed: number): void {
    if (!Number.isInteger(pairs) || pairs < MIN_PAIRS || pairs > MAX_PAIRS || pairs > entries.length) {
      throw new RangeError(`Cannot start a round with ${pairs} pairs from ${entries.length} pictures`);
    }
    if (players.length < 1 || players.length > MAX_PLAYERS) {
      throw new RangeError(`Cannot start a round with ${players.length} players`);
    }
    this.state = 'first';
    this.selections = [];
    this.names = [...players];
    this.scores = players.map(() => 0);
    this.activePlayer = 0;
    this.attempts = 0;
    this.elapsed = 0;
    this.remaining = pairs;
    this.resolutionLeft = 0;
    this.extraTurn = keepTurn;
    this.paused = false;
    this.seed = roundSeed;
    const rng = createRng(roundSeed);
    const pool = entries.map((entry) => ({ ...entry }));
    shuffle(pool, rng);
    this.cards = [];
    for (const entry of pool.slice(0, pairs)) {
      for (let copy = 0; copy < 2; copy++) {
        this.cards.push({ pairId: entry.pairId, image: entry.image, matched: false });
      }
    }
    shuffle(this.cards, rng);
    this.emit('changed');
  }

  select(index: number): boolean {
    if (this.paused || this.state === 'resolving' || this.state === 'finished') return false;
    const card = this.cards[index];
    if (!Number.isInteger(index) || !card || card.matched || this.selections.includes(index)) return false;
    this.selections.push(index);
    if (this.state === 'first') {
      this.state = 'second';
    } else {
      this.state = 'resolving';
      this.attempts += 1;
      this.resolutionLeft = this.isMatch() ? MATCH_SECONDS : MISMATCH_SECONDS;
    }
    this.emit('changed');
    return true;
  }

  /** True while two selected cards share a pair ID. */
  isMatch(): boolean {
    const [a, b] = this.selections;
    return this.selections.length === 2 && this.cards[a!]!.pairId === this.cards[b!]!.pairId;
  }

  tick(delta: number): void {
    if (this.paused || this.state === 'finished') return;
    const dt = Math.max(delta, 0);
    // The clock stops when the final pair is found, not after its display.
    const finalMatch = this.state === 'resolving' && this.remaining === 1 && this.isMatch();
    this.elapsed += finalMatch ? Math.min(dt, this.resolutionLeft) : dt;
    if (this.state !== 'resolving') return;
    this.resolutionLeft -= dt;
    if (this.resolutionLeft > 0) return;
    const matched = this.isMatch();
    const resolved = [...this.selections];
    if (matched) {
      this.scores[this.activePlayer]! += 1;
      this.remaining -= 1;
      for (const index of this.selections) this.cards[index]!.matched = true;
    }
    if (!matched || !this.extraTurn) {
      this.activePlayer = (this.activePlayer + 1) % this.names.length;
    }
    this.selections = [];
    this.state = this.remaining === 0 ? 'finished' : 'first';
    this.emit('pairResolved', matched, resolved);
    this.emit('changed');
    if (this.state === 'finished') this.emit('completed');
  }

  setPaused(value: boolean): void {
    this.paused = value;
    this.emit('changed');
  }

  /** Whether a card's artwork is shown. Pause conceals everything. */
  visibleCard(index: number): boolean {
    return !this.paused && this.selections.includes(index);
  }

  winners(): string[] {
    const best = Math.max(...this.scores);
    return this.names.filter((_, i) => this.scores[i] === best);
  }
}

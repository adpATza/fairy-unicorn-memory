import { describe, expect, it } from 'vitest';
import { builtinDecks } from '../src/decks';
import { STORAGE_KEY, defaultPreferences, loadPreferences, parsePreferences, savePreferences, withValidDeck } from '../src/preferences';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const defaults = defaultPreferences();

describe('preferences', () => {
  it('matches the Godot defaults', () => {
    expect(defaults).toMatchObject({ players: 1, pairs: 12, deckId: 'mix_easy', domain: 'Mix & Match', layout: 'scattered', extraTurn: true, sound: true, reducedMotion: false });
    expect(defaultPreferences(true).reducedMotion).toBe(true);
  });

  it('round-trips through storage', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const changed = { ...defaults, players: 3, names: ['Alice', 'Ben', 'Cara', 'Duke'], pairs: 20, layout: 'grid' as const, sound: false };
    expect(savePreferences(storage, changed)).toBe(true);
    expect(loadPreferences(storage, defaults)).toEqual(changed);
  });

  it('ignores values of the wrong type and clamps ranges', () => {
    const parsed = parsePreferences({ players: 9, pairs: 1, sound: 'yes', layout: 'spiral', names: ['A', 'B'], deckId: 7, extraTurn: false }, defaults);
    expect(parsed.players).toBe(4);
    expect(parsed.pairs).toBe(2);
    expect(parsed.sound).toBe(true);
    expect(parsed.layout).toBe('scattered');
    expect(parsed.names).toEqual(defaults.names);
    expect(parsed.deckId).toBe('mix_easy');
    expect(parsed.extraTurn).toBe(false);
    expect(parsePreferences({ pairs: Number.NaN, players: 2.6 }, defaults)).toMatchObject({ pairs: 12, players: 3 });
  });

  it('shortens over-long names', () => {
    expect(parsePreferences({ names: ['x'.repeat(40), 'B', 'C', 'D'] }, defaults).names[0]).toHaveLength(18);
  });

  it('survives corrupt or blocked storage', () => {
    const corrupt = new MemoryStorage();
    corrupt.data.set(STORAGE_KEY, '{not json');
    expect(loadPreferences(corrupt as unknown as Storage, defaults)).toEqual(defaults);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
    expect(loadPreferences(blocked, defaults)).toEqual(defaults);
    expect(savePreferences(blocked, defaults)).toBe(false);
    expect(loadPreferences(null, defaults)).toEqual(defaults);
  });

  it('falls back to Mix & Match when the saved deck is gone, and caps pairs to the deck', () => {
    const { decks } = builtinDecks();
    expect(withValidDeck({ ...defaults, deckId: 'unicorns_hard', domain: 'Unicorns' }, decks)).toMatchObject({ deckId: 'mix_easy', domain: 'Mix & Match', style: 'Illustrated', complexity: 'Easy' });
    const robots = withValidDeck({ ...defaults, deckId: 'robots_hard', domain: 'x' }, decks);
    expect(robots).toMatchObject({ deckId: 'robots_hard', domain: 'Robots', complexity: 'Hard' });
    const small = { ...decks[0]!, id: 'small', images: decks[0]!.images.slice(0, 5) };
    expect(withValidDeck({ ...defaults, deckId: 'small', pairs: 20 }, [small]).pairs).toBe(5);
  });
});

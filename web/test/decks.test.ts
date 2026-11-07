import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { builtinDecks } from '../src/decks';
import { deckFromManifest, safeRelativePath, validManifest } from '../src/manifest';

// Port of tests/test_runner.gd::_test_decks and the manifest guards in deck_library.gd.

const valid = () => ({
  version: 1,
  id: 'custom_0123456789abcdef01234567',
  title: 'Garden',
  domain: 'Plants',
  style: 'Illustrated',
  complexity: 'Easy',
  images: [
    { pair_id: 'a', path: '01.png' },
    { pair_id: 'b', path: '02.png' },
  ],
});

describe('built-in decks', () => {
  const { decks, errors } = builtinDecks();

  it('loads the six starter decks in library order without errors', () => {
    expect(errors).toEqual([]);
    expect(decks.map((d) => d.id)).toEqual(['mix_easy', 'animals_easy', 'vehicles_easy', 'robots_easy', 'robots_medium', 'robots_hard']);
  });

  it('defaults to the neutral mixed collection', () => {
    expect(decks[0]!.id).toBe('mix_easy');
    expect(decks[0]!.domain).toBe('Mix & Match');
  });

  it('has 30 pictures per deck, 180 distinct pictures in total', () => {
    const hashes = new Set<string>();
    for (const deck of decks) {
      expect(deck.builtin).toBe(true);
      expect(['Mix & Match', 'Animals', 'Vehicles', 'Robots']).toContain(deck.domain);
      expect(deck.images).toHaveLength(30);
      for (const image of deck.images) {
        expect(image.url).toMatch(/\.svg$/);
        const file = fileURLToPath(new URL(`../../assets/decks/${deck.id}/${image.path}`, import.meta.url));
        hashes.add(createHash('sha256').update(readFileSync(file)).digest('hex'));
      }
    }
    expect(hashes.size).toBe(180);
  });
});

describe('validManifest', () => {
  it('accepts a valid version 1 manifest, including the legacy style', () => {
    expect(validManifest(valid())).toBe(true);
    expect(validManifest({ ...valid(), style: 'Realistic fantasy' })).toBe(true);
  });

  it.each([
    ['wrong version', { version: 2 }],
    ['blank title', { title: '  ' }],
    ['missing domain', { domain: undefined }],
    ['unknown style', { style: 'Watercolour' }],
    ['unknown complexity', { complexity: 'Extreme' }],
    ['one image', { images: [{ pair_id: 'a', path: '01.png' }] }],
    ['31 images', { images: Array.from({ length: 31 }, (_, i) => ({ pair_id: `p${i}`, path: `${i}.png` })) }],
    ['duplicate pair ID', { images: [{ pair_id: 'a', path: '01.png' }, { pair_id: 'a', path: '02.png' }] }],
    ['duplicate path', { images: [{ pair_id: 'a', path: '01.png' }, { pair_id: 'b', path: '01.png' }] }],
    ['traversal', { images: [{ pair_id: 'a', path: '../01.png' }, { pair_id: 'b', path: '02.png' }] }],
    ['absolute path', { images: [{ pair_id: 'a', path: '/etc/01.png' }, { pair_id: 'b', path: '02.png' }] }],
    ['drive letter', { images: [{ pair_id: 'a', path: 'C:01.png' }, { pair_id: 'b', path: '02.png' }] }],
    ['backslash', { images: [{ pair_id: 'a', path: 'x\\01.png' }, { pair_id: 'b', path: '02.png' }] }],
    ['non-object entry', { images: ['01.png', '02.png'] }],
  ])('rejects %s', (_name, change) => {
    expect(validManifest({ ...valid(), ...change })).toBe(false);
  });

  it('rejects non-objects', () => {
    for (const value of [null, [], 'manifest', 1]) expect(validManifest(value)).toBe(false);
  });

  it('checks relative paths', () => {
    expect(safeRelativePath('01.svg')).toBe(true);
    for (const bad of ['', '/a', 'a/../b', 'res://x', 'a\\b']) expect(safeRelativePath(bad)).toBe(false);
  });
});

describe('deckFromManifest', () => {
  it('presents the legacy style as Realistic and resolves image URLs', () => {
    const deck = deckFromManifest({ ...valid(), style: 'Realistic fantasy' } as never, false, (p) => `blob:${p}`);
    expect(deck?.style).toBe('Realistic');
    expect(deck?.images[1]).toEqual({ pairId: 'b', path: '02.png', url: 'blob:02.png' });
  });

  it('rejects a deck with a missing picture', () => {
    expect(deckFromManifest(valid() as never, false, (p) => (p === '02.png' ? null : p))).toBeNull();
  });
});

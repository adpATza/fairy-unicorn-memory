import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { Manifest } from '../src/manifest';
import { CUSTOM_ID, DeckStore, newDeckId, type StoredImage } from '../src/storage';

const picture = (byte: number): StoredImage => new Blob([new Uint8Array([137, 80, 78, 71, byte])], { type: 'image/png' });

function deck(id = newDeckId(), count = 3): { manifest: Manifest; images: Map<string, StoredImage> } {
  const images = new Map<string, StoredImage>();
  const entries = Array.from({ length: count }, (_, i) => {
    const path = `${String(i + 1).padStart(2, '0')}.png`;
    images.set(path, picture(i));
    return { pair_id: `${id}_${String(i + 1).padStart(2, '0')}`, path };
  });
  return { manifest: { version: 1, id, title: 'Garden', domain: 'Plants', style: 'Illustrated', complexity: 'Easy', images: entries }, images };
}

const open = () => DeckStore.open(new IDBFactory());

describe('DeckStore', () => {
  it('creates Godot-compatible custom deck IDs', () => {
    const id = newDeckId();
    expect(id).toMatch(CUSTOM_ID);
    expect(id).toHaveLength(31);
    expect(newDeckId()).not.toBe(id);
  });

  it('saves, lists and reads back a deck with its pictures', async () => {
    const store = await open();
    const { manifest, images } = deck();
    await store.save(manifest, images);
    const listed = await store.list();
    expect(listed.map((d) => d.manifest)).toEqual([manifest]);
    expect(await store.has(manifest.id)).toBe(true);
    const stored = await store.images(manifest.id);
    expect([...stored.keys()].sort()).toEqual(['01.png', '02.png', '03.png']);
    expect(new Uint8Array(await stored.get('02.png')!.arrayBuffer())).toEqual(new Uint8Array(await images.get('02.png')!.arrayBuffer()));
    expect((await store.image(manifest.id, '03.png'))?.type).toBe('image/png');
  });

  it('keeps decks apart and lists them oldest first', async () => {
    const store = await open();
    const a = deck('custom_aaaaaaaaaaaaaaaaaaaaaaaa');
    const b = deck('custom_aaaaaaaaaaaaaaaaaaaaaaab', 2);
    await store.save(a.manifest, a.images);
    await new Promise((r) => setTimeout(r, 2));
    await store.save(b.manifest, b.images);
    expect((await store.list()).map((d) => d.id)).toEqual([a.manifest.id, b.manifest.id]);
    expect((await store.images(a.manifest.id)).size).toBe(3);
    expect((await store.images(b.manifest.id)).size).toBe(2);
  });

  it('never overwrites an existing deck and leaves nothing behind on failure', async () => {
    const store = await open();
    const { manifest, images } = deck();
    await store.save(manifest, images);
    const changed = { ...manifest, title: 'Other' };
    await expect(store.save(changed, images)).rejects.toBeTruthy();
    expect((await store.list())[0]!.manifest.title).toBe('Garden');
  });

  it('rejects invalid manifests, foreign IDs and missing pictures', async () => {
    const store = await open();
    const { manifest, images } = deck();
    await expect(store.save({ ...manifest, id: 'mix_easy' }, images)).rejects.toThrow('Invalid');
    await expect(store.save({ ...manifest, images: manifest.images.slice(0, 1) }, images)).rejects.toThrow('Invalid');
    const missing = new Map(images);
    missing.delete('02.png');
    await expect(store.save(manifest, missing)).rejects.toThrow('Missing picture');
    expect(await store.list()).toEqual([]);
  });

  it('renames a custom deck, trimming and limiting the title', async () => {
    const store = await open();
    const { manifest, images } = deck();
    await store.save(manifest, images);
    expect(await store.rename(manifest.id, '  Renamed 魔法 collection  ')).toBe(true);
    expect((await store.list())[0]!.manifest.title).toBe('Renamed 魔法 collection');
    expect(await store.rename(manifest.id, 'x'.repeat(80))).toBe(true);
    expect((await store.list())[0]!.manifest.title).toHaveLength(64);
    expect(await store.rename(manifest.id, '   ')).toBe(false);
    expect(await store.rename('mix_easy', 'Nope')).toBe(false);
    expect(await store.rename(newDeckId(), 'Missing')).toBe(false);
  });

  it('deletes a deck and only its pictures; built-in IDs are refused', async () => {
    const store = await open();
    const a = deck('custom_aaaaaaaaaaaaaaaaaaaaaaaa');
    const b = deck('custom_aaaaaaaaaaaaaaaaaaaaaaab');
    await store.save(a.manifest, a.images);
    await store.save(b.manifest, b.images);
    expect(await store.delete('mix_easy')).toBe(false);
    expect(await store.delete(a.manifest.id)).toBe(true);
    expect(await store.delete(a.manifest.id)).toBe(false);
    expect((await store.list()).map((d) => d.id)).toEqual([b.manifest.id]);
    expect((await store.images(a.manifest.id)).size).toBe(0);
    expect((await store.images(b.manifest.id)).size).toBe(3);
  });

  it('persists across connections', async () => {
    const factory = new IDBFactory();
    const first = await DeckStore.open(factory);
    const { manifest, images } = deck();
    await first.save(manifest, images);
    first.close();
    const second = await DeckStore.open(factory);
    expect((await second.list()).map((d) => d.id)).toEqual([manifest.id]);
  });
});

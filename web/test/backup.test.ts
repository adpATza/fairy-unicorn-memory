import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, backupFileName, createBackup, findSavedDecks, imageType, type SavedDeck } from '../src/backup';
import type { Manifest } from '../src/manifest';
import { crc32, readZip, writeZip } from '../src/zip';

const PNG = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n]);
const encode = (text: string) => new TextEncoder().encode(text);

function savedDeck(id: string, count = 2): SavedDeck {
  const manifest: Manifest = {
    version: 1,
    id,
    title: 'Family pets',
    domain: 'Animals',
    style: 'Realistic',
    complexity: 'Medium',
    images: Array.from({ length: count }, (_, i) => ({ pair_id: `${id}_${String(i + 1).padStart(2, '0')}`, path: `${String(i + 1).padStart(2, '0')}.png` })),
  };
  const images = new Map(manifest.images.map((entry, i) => [entry.path, new Blob([PNG(i) as BlobPart], { type: 'image/png' })]));
  return { manifest, images };
}

/** A ZIP with deflated entries, as Windows or macOS would make. */
function deflatedZip(files: Record<string, Uint8Array>): Uint8Array {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [path, data] of Object.entries(files)) {
    const name = Buffer.from(path);
    const packed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    parts.push(local, name, packed);
    central.push(entry, name);
    offset += 30 + name.length + packed.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, centralBytes, end]));
}

const asBlobs = (files: Map<string, Uint8Array>) => new Map([...files].map(([path, data]) => [path, new Blob([data as BlobPart])]));

describe('zip', () => {
  it('computes standard CRC-32', () => {
    expect(crc32(encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('round-trips files with UTF-8 names', async () => {
    const files = new Map([
      ['a.txt', encode('hello')],
      ['folder/魔法 ü.png', PNG(7)],
      ['empty', new Uint8Array()],
    ]);
    const zip = writeZip([...files].map(([path, data]) => ({ path, data })));
    expect(await readZip(zip)).toEqual(files);
  });

  it('reads deflated archives and skips folder entries', async () => {
    const big = encode('memory '.repeat(500));
    const zip = deflatedZip({ 'decks/': new Uint8Array(), 'decks/notes.txt': big });
    const files = await readZip(zip);
    expect([...files.keys()]).toEqual(['decks/notes.txt']);
    expect(files.get('decks/notes.txt')).toEqual(big);
  });

  it('rejects non-ZIP and damaged files', async () => {
    await expect(readZip(encode('not a zip at all, sorry'))).rejects.toThrow('not a ZIP');
    const zip = writeZip([{ path: 'a.txt', data: encode('hello world') }]);
    zip[35] ^= 0xff; // corrupt the stored bytes
    await expect(readZip(zip)).rejects.toThrow('damaged');
  });
});

describe('backups', () => {
  const a = savedDeck('custom_0123456789abcdef01234567');
  const b = savedDeck('custom_89abcdef0123456789abcdef', 3);

  it('lays decks out like the Windows data folder, with preferences and a README', async () => {
    const files = await readZip(await createBackup([a, b], { players: 2 }, new Date(2026, 10, 7, 10, 0)));
    expect([...files.keys()].sort()).toEqual([
      'Memory Card Game/README.txt',
      'Memory Card Game/backup.json',
      'Memory Card Game/decks/custom_0123456789abcdef01234567/01.png',
      'Memory Card Game/decks/custom_0123456789abcdef01234567/02.png',
      'Memory Card Game/decks/custom_0123456789abcdef01234567/manifest.json',
      'Memory Card Game/decks/custom_89abcdef0123456789abcdef/01.png',
      'Memory Card Game/decks/custom_89abcdef0123456789abcdef/02.png',
      'Memory Card Game/decks/custom_89abcdef0123456789abcdef/03.png',
      'Memory Card Game/decks/custom_89abcdef0123456789abcdef/manifest.json',
    ]);
    const meta = JSON.parse(new TextDecoder().decode(files.get('Memory Card Game/backup.json')));
    expect(meta).toMatchObject({ format: BACKUP_FORMAT, version: 1, decks: 2, preferences: { players: 2 } });
    expect(new TextDecoder().decode(files.get('Memory Card Game/README.txt'))).toContain('%APPDATA%\\Memory Card Game\\');
  });

  it('restores what it backed up', async () => {
    const found = await findSavedDecks(asBlobs(await readZip(await createBackup([a, b], { sound: false }))));
    expect(found.issues).toEqual([]);
    expect(found.meta?.preferences).toEqual({ sound: false });
    expect(found.decks.map((d) => d.manifest)).toEqual([a.manifest, b.manifest]);
    expect(new Uint8Array(await found.decks[1]!.images.get('03.png')!.arrayBuffer())).toEqual(PNG(2));
    expect(found.decks[1]!.images.get('03.png')!.type).toBe('image/png');
  });

  it('finds decks in a Windows decks folder, a single deck folder or a deflated ZIP', async () => {
    const manifest = encode(JSON.stringify(a.manifest, null, '\t'));
    const windows = new Map([
      ['decks/custom_0123456789abcdef01234567/manifest.json', manifest],
      ['decks/custom_0123456789abcdef01234567/01.png', PNG(0)],
      ['decks/custom_0123456789abcdef01234567/02.png', PNG(1)],
    ]);
    expect((await findSavedDecks(asBlobs(windows))).decks).toHaveLength(1);
    const single = new Map([...windows].map(([path, data]) => [path.replace('decks/', ''), data]));
    expect((await findSavedDecks(asBlobs(single))).decks).toHaveLength(1);
    const zipped = await readZip(deflatedZip(Object.fromEntries(windows)));
    expect((await findSavedDecks(asBlobs(zipped))).decks[0]!.manifest.id).toBe(a.manifest.id);
  });

  it('reports invalid decks with reasons and ignores ordinary folders', async () => {
    const files = new Map<string, Uint8Array>([
      // Folder name does not match the manifest ID.
      ['custom_ffffffffffffffffffffffff/manifest.json', encode(JSON.stringify(a.manifest))],
      ['custom_ffffffffffffffffffffffff/01.png', PNG(0)],
      // Missing picture.
      ['custom_0123456789abcdef01234567/manifest.json', encode(JSON.stringify(a.manifest))],
      ['custom_0123456789abcdef01234567/01.png', PNG(0)],
      // Not a picture.
      ['custom_89abcdef0123456789abcdef/manifest.json', encode(JSON.stringify(savedDeck('custom_89abcdef0123456789abcdef').manifest))],
      ['custom_89abcdef0123456789abcdef/01.png', encode('not an image')],
      ['custom_89abcdef0123456789abcdef/02.png', PNG(1)],
      // Corrupt JSON.
      ['custom_aaaaaaaaaaaaaaaaaaaaaaaa/manifest.json', encode('{')],
      // Not a custom deck folder: ignored silently.
      ['holiday/manifest.json', encode('{}')],
      ['holiday/beach.png', PNG(3)],
    ]);
    const found = await findSavedDecks(asBlobs(files));
    expect(found.decks).toEqual([]);
    expect(found.issues).toEqual([
      'A saved deck has missing or unreadable pictures: Family pets',
      'A saved deck has missing or unreadable pictures: Family pets',
      'A saved deck has an invalid manifest: custom_aaaaaaaaaaaaaaaaaaaaaaaa',
      'A saved deck has an invalid manifest: custom_ffffffffffffffffffffffff',
    ]);
  });

  it('rejects traversal in manifest paths', async () => {
    const bad = { ...a.manifest, images: [{ pair_id: 'x', path: '../01.png' }, { pair_id: 'y', path: '02.png' }] };
    const files = new Map([
      [`${a.manifest.id}/manifest.json`, encode(JSON.stringify(bad))],
      ['01.png', PNG(0)],
      [`${a.manifest.id}/02.png`, PNG(1)],
    ]);
    const found = await findSavedDecks(asBlobs(files));
    expect(found.decks).toEqual([]);
    expect(found.issues).toHaveLength(1);
  });

  it('recognises PNG, JPEG and WebP signatures only', () => {
    expect(imageType(PNG(0))).toBe('image/png');
    expect(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(imageType(encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(imageType(encode('GIF89a'))).toBeNull();
  });

  it('names backups by date', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('Memory Card Game backup 2026-01-05.zip');
  });
});

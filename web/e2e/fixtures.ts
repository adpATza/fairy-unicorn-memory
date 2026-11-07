import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

type Pixel = (x: number, y: number) => [number, number, number, number];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([length, body, sum]);
}

/** Encodes an RGBA PNG. `level` changes the bytes without changing the pixels. */
export function png(width: number, height: number, pixel: Pixel, level = 6): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level })), chunk('IEND', Buffer.alloc(0))]);
}

/** A distinct, colourful picture: a coloured disc whose hue and size vary with n. */
export function picture(n: number, size = 64, level = 6): Buffer {
  const hue = (n * 47) % 360;
  const [r, g, b] = hsl(hue);
  const radius = size * (0.25 + (n % 5) * 0.04);
  return png(size, size, (x, y) => ((x - size / 2) ** 2 + (y - size / 2) ** 2 < radius ** 2 ? [r, g, b, 255] : [255, 255, 255, 255]), level);
}

function hsl(hue: number): [number, number, number] {
  const f = (k: number) => {
    const n = (k + hue / 30) % 12;
    return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(n - 3, 9 - n, 1))));
  };
  return [f(0), f(8), f(4)];
}

export interface FixtureFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export const file = (name: string, buffer: Buffer, mimeType = 'image/png'): FixtureFile => ({ name, mimeType, buffer });

export function pictures(count: number, prefix = 'picture'): FixtureFile[] {
  return Array.from({ length: count }, (_, i) => file(`${prefix}-${String(i + 1).padStart(2, '0')}.png`, picture(i)));
}

/** A Windows-edition data folder with one saved deck, as written by deck_library.gd. */
export function windowsDecksFolder(id: string, title: string, count = 3, style = 'Realistic fantasy'): string {
  const root = mkdtempSync(join(tmpdir(), 'memory-card-game-windows-'));
  const folder = join(root, 'decks', id);
  mkdirSync(folder, { recursive: true });
  const images = Array.from({ length: count }, (_, i) => ({ pair_id: `${id}_${String(i + 1).padStart(2, '0')}`, path: `${String(i + 1).padStart(2, '0')}.png` }));
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify({ version: 1, id, title, domain: 'Places', style, complexity: 'Hard', images }, null, '\t'));
  images.forEach((image, i) => writeFileSync(join(folder, image.path), picture(100 + i, 96)));
  return join(root, 'decks');
}

/** A plain folder of pictures, with a nested folder that must be ignored. */
export function picturesFolder(count: number): string {
  const root = mkdtempSync(join(tmpdir(), 'memory-card-game-pictures-'));
  const folder = join(root, 'Holiday');
  mkdirSync(join(folder, 'nested'), { recursive: true });
  for (let i = 0; i < count; i++) writeFileSync(join(folder, `photo-${i + 1}.png`), picture(200 + i));
  writeFileSync(join(folder, 'nested', 'ignored.png'), picture(299));
  return folder;
}

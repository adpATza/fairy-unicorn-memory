import type { Manifest } from './manifest';
import { COMPLEXITIES, STYLES } from './manifest';
import { newDeckId, type DeckStore } from './storage';

/**
 * Picture import, ported from MemoryDeckLibrary.scan_folder / save_import.
 *
 * Pictures are decoded in the browser, exact duplicates are found by hashing
 * the decoded pixels, and saved pictures are fitted onto a white 1024-pixel
 * square with a safe margin, never stretched or cropped. Originals are only
 * read.
 */
export const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
export const MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const NORMALIZED_EDGE = 1024;
export const PREVIEW_EDGE = 160;
export const MAX_PICTURES = 30;
export const MIN_PICTURES = 2;
/** Canvas area limit on iOS Safari; larger pictures are hashed at a fixed reduced size. */
const MAX_HASH_PIXELS = 16_777_216;

export interface Candidate {
  file: File;
  filename: string;
  hash: string;
  /** Object URL of a small square preview. */
  preview: string;
}

export interface ScanResult {
  accepted: Candidate[];
  rejected: string[];
}

export type Progress = (done: number, total: number) => void;

export function isPicture(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSIONS.includes(extension) || MIME_TYPES.includes(file.type);
}

export async function decode(blob: Blob): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(blob);
  if (bitmap.width === 0 || bitmap.height === 0) {
    bitmap.close();
    throw new Error('Empty image');
  }
  return bitmap;
}

function context(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable');
  return ctx;
}

/** SHA-256 of "w,h:" and the decoded RGBA pixels, like decoded_hash in Godot. */
export async function decodedHash(bitmap: ImageBitmap): Promise<string> {
  let source: ImageBitmap = bitmap;
  let { width, height } = bitmap;
  if (width * height > MAX_HASH_PIXELS) {
    const factor = Math.sqrt(MAX_HASH_PIXELS / (width * height));
    width = Math.max(1, Math.floor(width * factor));
    height = Math.max(1, Math.floor(height * factor));
    source = await createImageBitmap(bitmap, { resizeWidth: width, resizeHeight: height, resizeQuality: 'pixelated' });
  }
  const ctx = context(width, height);
  ctx.drawImage(source, 0, 0);
  if (source !== bitmap) source.close();
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const header = new TextEncoder().encode(`${bitmap.width},${bitmap.height}:`);
  const message = new Uint8Array(header.length + pixels.length);
  message.set(header);
  message.set(pixels, header.length);
  const digest = await crypto.subtle.digest('SHA-256', message);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The picture fitted at 90% onto a white square, centred, aspect ratio kept. */
export function normalize(bitmap: ImageBitmap, edge: number = NORMALIZED_EDGE): HTMLCanvasElement {
  const ctx = context(edge, edge);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, edge, edge);
  const factor = (edge * 0.9) / Math.max(bitmap.width, bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * factor));
  const height = Math.max(1, Math.round(bitmap.height * factor));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, Math.floor((edge - width) / 2), Math.floor((edge - height) / 2), width, height);
  return ctx.canvas;
}

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the picture'))), 'image/png'));
}

/** Reads the chosen pictures: accepted ones get previews, others a reason. */
export async function scanPictures(files: readonly File[], progress?: Progress): Promise<ScanResult> {
  const result: ScanResult = { accepted: [], rejected: [] };
  const seen = new Map<string, string>();
  const pictures = files.filter(isPicture).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const [i, file] of pictures.entries()) {
    progress?.(i, pictures.length);
    let bitmap: ImageBitmap;
    try {
      bitmap = await decode(file);
    } catch {
      result.rejected.push(`${file.name}: unreadable or corrupt image.`);
      continue;
    }
    try {
      const hash = await decodedHash(bitmap);
      const first = seen.get(hash);
      if (first !== undefined) {
        result.rejected.push(`${file.name}: identical decoded pixels to ${first}. Select one copy per object.`);
        continue;
      }
      seen.set(hash, file.name);
      const preview = URL.createObjectURL(await toPng(normalize(bitmap, PREVIEW_EDGE)));
      result.accepted.push({ file, filename: file.name, hash, preview });
    } catch {
      result.rejected.push(`${file.name}: unreadable or corrupt image.`);
    } finally {
      bitmap.close();
    }
  }
  progress?.(pictures.length, pictures.length);
  return result;
}

export function releasePreviews(candidates: readonly Candidate[]): void {
  for (const candidate of candidates) URL.revokeObjectURL(candidate.preview);
}

export interface DeckDetails {
  title: string;
  domain: string;
  style: string;
  complexity: string;
}

/**
 * Checks, normalises and saves the selected pictures as a new deck, with the
 * Godot edition's validation and messages. Returns the new deck's ID or an error.
 */
export async function saveImport(store: DeckStore, details: DeckDetails, selected: readonly Candidate[], progress?: Progress): Promise<{ id: string } | { error: string }> {
  const title = details.title.trim();
  const domain = details.domain.trim();
  if (!title || !domain) return { error: 'Enter a deck name and domain.' };
  if (selected.length < MIN_PICTURES || selected.length > MAX_PICTURES) return { error: 'Select between 2 and 30 unique images.' };
  if (!(STYLES as readonly string[]).includes(details.style) || !(COMPLEXITIES as readonly string[]).includes(details.complexity)) {
    return { error: 'Choose a supported style and complexity.' };
  }
  const id = newDeckId();
  const images = new Map<string, Blob>();
  const entries: Manifest['images'] = [];
  const seen = new Set<string>();
  for (const [i, candidate] of selected.entries()) {
    progress?.(i, selected.length);
    let bitmap: ImageBitmap;
    try {
      bitmap = await decode(candidate.file);
    } catch {
      return { error: 'A picture can no longer be read. Choose the pictures again.' };
    }
    try {
      const hash = await decodedHash(bitmap);
      if (seen.has(hash) || hash !== candidate.hash) return { error: 'A picture changed or is duplicated. Choose the pictures again.' };
      seen.add(hash);
      const path = `${String(i + 1).padStart(2, '0')}.png`;
      images.set(path, await toPng(normalize(bitmap)));
      entries.push({ pair_id: `${id}_${String(i + 1).padStart(2, '0')}`, path });
    } catch {
      return { error: 'Could not prepare a picture. Try again, or choose fewer or smaller pictures.' };
    } finally {
      bitmap.close();
    }
  }
  progress?.(selected.length, selected.length);
  const manifest: Manifest = {
    version: 1,
    id,
    title: title.slice(0, 64),
    domain: domain.slice(0, 40),
    style: details.style as Manifest['style'],
    complexity: details.complexity as Manifest['complexity'],
    images: entries,
  };
  try {
    await store.save(manifest, images);
  } catch {
    return { error: 'Could not save the deck. Check that this device has free space.' };
  }
  return { id };
}

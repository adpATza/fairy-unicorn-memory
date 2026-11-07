/**
 * Deck manifest version 1, shared with the Godot edition
 * (see MemoryDeckLibrary.valid_manifest in scripts/deck_library.gd).
 */
export const MANIFEST_VERSION = 1;
export const STYLES = ['Illustrated', 'Realistic', 'Other'] as const;
export const COMPLEXITIES = ['Easy', 'Medium', 'Hard'] as const;
/** Older Godot decks used this style; it is presented as Realistic. */
const LEGACY_STYLE = 'Realistic fantasy';

export type Style = (typeof STYLES)[number];
export type Complexity = (typeof COMPLEXITIES)[number];

export interface ManifestImage {
  pair_id: string;
  path: string;
}

export interface Manifest {
  version: 1;
  id: string;
  title: string;
  domain: string;
  style: Style | typeof LEGACY_STYLE;
  complexity: Complexity;
  images: ManifestImage[];
}

export interface DeckImage {
  pairId: string;
  /** Path relative to the deck folder, as written in the manifest. */
  path: string;
  /** URL the browser loads the picture from. */
  url: string;
}

export interface Deck {
  id: string;
  title: string;
  domain: string;
  style: Style;
  complexity: Complexity;
  images: DeckImage[];
  builtin: boolean;
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

export function validManifest(data: unknown): data is Manifest {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const m = data as Record<string, unknown>;
  if (m.version !== MANIFEST_VERSION) return false;
  if (![m.id, m.title, m.domain, m.style, m.complexity].every(nonEmpty)) return false;
  if (![...STYLES, LEGACY_STYLE].includes(m.style as string) || !COMPLEXITIES.includes(m.complexity as Complexity)) return false;
  if (!Array.isArray(m.images) || m.images.length < 2 || m.images.length > 30) return false;
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const entry of m.images as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return false;
    const { pair_id: pairId, path } = entry as Record<string, unknown>;
    if (typeof pairId !== 'string' || typeof path !== 'string') return false;
    if (pairId === '' || ids.has(pairId) || paths.has(path) || !safeRelativePath(path)) return false;
    ids.add(pairId);
    paths.add(path);
  }
  return true;
}

/** Rejects empty, absolute, drive-letter, backslash and traversal paths. */
export function safeRelativePath(path: string): boolean {
  return path !== '' && !path.startsWith('/') && !path.includes(':') && !path.includes('..') && !path.includes('\\');
}

/** Builds a deck from a valid manifest. `resolve` maps an image path to a URL, or null when missing. */
export function deckFromManifest(manifest: Manifest, builtin: boolean, resolve: (path: string) => string | null): Deck | null {
  const images: DeckImage[] = [];
  for (const entry of manifest.images) {
    const url = resolve(entry.path);
    if (url === null) return null;
    images.push({ pairId: entry.pair_id, path: entry.path, url });
  }
  return {
    id: manifest.id,
    title: manifest.title,
    domain: manifest.domain,
    style: manifest.style === LEGACY_STYLE ? 'Realistic' : manifest.style,
    complexity: manifest.complexity,
    images,
    builtin,
  };
}

import { deckFromManifest, validManifest, type Deck } from './manifest';

/**
 * Built-in decks, read from the Godot project's assets/decks folder at build
 * time. The order comes from assets/decks/library.json, as in the Godot edition.
 */
const index = import.meta.glob<string[]>('../../assets/decks/library.json', { eager: true, import: 'default' });
const manifests = import.meta.glob<unknown>('../../assets/decks/*/manifest.json', { eager: true, import: 'default' });
const pictures = import.meta.glob<string>('../../assets/decks/*/*.svg', { eager: true, query: '?url', import: 'default' });

const ROOT = '../../assets/decks/';

export interface Catalogue {
  decks: Deck[];
  errors: string[];
}

export function builtinDecks(): Catalogue {
  const decks: Deck[] = [];
  const errors: string[] = [];
  const order = Object.values(index)[0] ?? [];
  for (const entry of order) {
    // Entries look like "res://assets/decks/mix_easy/manifest.json".
    const folder = /^res:\/\/assets\/decks\/([a-z0-9_]+)\/manifest\.json$/.exec(String(entry))?.[1];
    const data = folder ? manifests[`${ROOT}${folder}/manifest.json`] : undefined;
    if (!folder || !validManifest(data)) {
      errors.push(`Skipped invalid deck manifest: ${String(entry)}`);
      continue;
    }
    const deck = deckFromManifest(data, true, (path) => pictures[`${ROOT}${folder}/${path}`] ?? null);
    if (deck) decks.push(deck);
    else errors.push(`Deck has a missing image: ${data.title}`);
  }
  return { decks, errors };
}

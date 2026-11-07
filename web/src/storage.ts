import { validManifest, type Manifest } from './manifest';

/**
 * Custom decks in IndexedDB: the web counterpart of user://decks/custom_*.
 *
 * A deck's manifest and all its pictures are written in one transaction, so a
 * save either completes or leaves nothing behind (the Godot edition uses a
 * staging folder for the same guarantee). Pictures are stored as Blobs, which
 * browsers keep on disk and hand back as cheap file-backed handles, so a large
 * library does not have to be loaded into memory.
 */
const DB_NAME = 'memory-card-game';
const DB_VERSION = 1;
const DECKS = 'decks';
const IMAGES = 'images';

/** Same pattern as the Godot edition's custom folder names. */
export const CUSTOM_ID = /^custom_[0-9a-f]{24}$/;

/** A picture as stored: a Blob whose type is image/png, image/jpeg or image/webp. */
export type StoredImage = Blob;

export interface StoredDeck {
  id: string;
  manifest: Manifest;
  savedAt: number;
}

export function newDeckId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `custom_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const imageKey = (deckId: string, path: string) => `${deckId}/${path}`;

function done(request: IDBRequest): Promise<unknown>;
function done(transaction: IDBTransaction): Promise<void>;
function done(target: IDBRequest | IDBTransaction): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if ('objectStoreNames' in target) {
      const transaction = target as IDBTransaction;
      transaction.oncomplete = () => resolve(undefined);
      // The failing request's error arrives before the transaction's is set.
      transaction.onerror = (event) => reject((event.target as IDBRequest | null)?.error ?? transaction.error ?? new Error('IndexedDB request failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'));
    } else {
      const request = target as IDBRequest;
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }
  });
}

export class DeckStore {
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static async open(factory: IDBFactory = globalThis.indexedDB): Promise<DeckStore> {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DECKS)) db.createObjectStore(DECKS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
    };
    const db = (await done(request)) as IDBDatabase;
    return new DeckStore(db);
  }

  close(): void {
    this.db.close();
  }

  async list(): Promise<StoredDeck[]> {
    const decks = (await done(this.db.transaction(DECKS).objectStore(DECKS).getAll())) as StoredDeck[];
    return decks.sort((a, b) => a.savedAt - b.savedAt);
  }

  async has(id: string): Promise<boolean> {
    return (await done(this.db.transaction(DECKS).objectStore(DECKS).getKey(id))) !== undefined;
  }

  async image(deckId: string, path: string): Promise<StoredImage | undefined> {
    return (await done(this.db.transaction(IMAGES).objectStore(IMAGES).get(imageKey(deckId, path)))) as StoredImage | undefined;
  }

  /** All pictures of a deck, by manifest path. */
  async images(deckId: string): Promise<Map<string, StoredImage>> {
    const store = this.db.transaction(IMAGES).objectStore(IMAGES);
    const range = IDBKeyRange.bound(`${deckId}/`, `${deckId}/￿`);
    const [keys, values] = (await Promise.all([done(store.getAllKeys(range)), done(store.getAll(range))])) as [string[], StoredImage[]];
    return new Map(keys.map((key, i) => [key.slice(deckId.length + 1), values[i]!]));
  }

  /**
   * Saves a new deck and its pictures atomically. Fails, changing nothing, if
   * the manifest is invalid, a picture is missing, or the ID already exists.
   */
  async save(manifest: Manifest, images: ReadonlyMap<string, StoredImage>): Promise<void> {
    if (!validManifest(manifest) || !CUSTOM_ID.test(manifest.id)) throw new Error('Invalid custom deck manifest');
    for (const entry of manifest.images) if (!images.has(entry.path)) throw new Error(`Missing picture ${entry.path}`);
    const transaction = this.db.transaction([DECKS, IMAGES], 'readwrite');
    const finished = done(transaction);
    transaction.objectStore(DECKS).add({ id: manifest.id, manifest, savedAt: Date.now() } satisfies StoredDeck);
    const pictures = transaction.objectStore(IMAGES);
    for (const entry of manifest.images) pictures.put(images.get(entry.path)!, imageKey(manifest.id, entry.path));
    await finished;
  }

  async rename(id: string, title: string): Promise<boolean> {
    const name = title.trim().slice(0, 64);
    if (!CUSTOM_ID.test(id) || name === '') return false;
    const transaction = this.db.transaction(DECKS, 'readwrite');
    const finished = done(transaction);
    const store = transaction.objectStore(DECKS);
    const deck = (await done(store.get(id))) as StoredDeck | undefined;
    if (!deck) return false;
    store.put({ ...deck, manifest: { ...deck.manifest, title: name } });
    await finished;
    return true;
  }

  /** Deletes only an app-owned custom deck and its pictures. */
  async delete(id: string): Promise<boolean> {
    if (!CUSTOM_ID.test(id) || !(await this.has(id))) return false;
    const transaction = this.db.transaction([DECKS, IMAGES], 'readwrite');
    const finished = done(transaction);
    transaction.objectStore(DECKS).delete(id);
    transaction.objectStore(IMAGES).delete(IDBKeyRange.bound(`${id}/`, `${id}/￿`));
    await finished;
    return true;
  }
}

export type Persistence = 'persisted' | 'best-effort' | 'unsupported';

/** Asks the browser not to clear saved decks when space runs low. */
export async function requestPersistence(): Promise<Persistence> {
  const storage = globalThis.navigator?.storage;
  if (!storage?.persist) return 'unsupported';
  try {
    if (await storage.persisted()) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

export async function persistence(): Promise<Persistence> {
  const storage = globalThis.navigator?.storage;
  if (!storage?.persisted) return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

/** Bytes used by this site, when the browser reports it. */
export async function usage(): Promise<number | null> {
  try {
    return (await globalThis.navigator?.storage?.estimate?.())?.usage ?? null;
  } catch {
    return null;
  }
}

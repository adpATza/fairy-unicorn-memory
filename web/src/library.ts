import { backupFileName, createBackup, findSavedDecks, type SavedDeck } from './backup';
import { builtinDecks } from './decks';
import { deckFromManifest, validManifest, type Deck } from './manifest';
import { CUSTOM_ID, DeckStore, requestPersistence } from './storage';
import { readZip } from './zip';

export interface RestoreReport {
  added: string[];
  skipped: string[];
  issues: string[];
  preferences: unknown;
  found: boolean;
}

/**
 * All decks: the built-in ones plus custom decks saved on this device
 * (MemoryDeckLibrary in the Godot edition).
 */
export class Library {
  readonly builtin: Deck[];
  custom: Deck[] = [];
  errors: string[] = [];
  readonly store: DeckStore | null;
  /** Why custom decks are unavailable, when the browser blocks storage. */
  readonly storeError: string | null;
  private urls: string[] = [];

  private constructor(store: DeckStore | null, storeError: string | null) {
    const catalogue = builtinDecks();
    this.builtin = catalogue.decks;
    this.errors = [...catalogue.errors];
    this.store = store;
    this.storeError = storeError;
  }

  static async create(): Promise<Library> {
    let library: Library;
    try {
      if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable');
      library = new Library(await DeckStore.open(), null);
    } catch {
      library = new Library(null, 'Saving your own decks is unavailable in this browser. Private browsing can block storage.');
    }
    await library.reload();
    return library;
  }

  get decks(): Deck[] {
    return [...this.builtin, ...this.custom];
  }

  /** Re-reads custom decks from storage. */
  async reload(): Promise<void> {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls = [];
    this.custom = [];
    this.errors = builtinDecks().errors;
    if (!this.store) return;
    for (const stored of await this.store.list()) {
      if (!validManifest(stored.manifest) || !CUSTOM_ID.test(stored.manifest.id)) {
        this.errors.push(`Skipped invalid deck manifest: ${stored.id}`);
        continue;
      }
      const images = await this.store.images(stored.manifest.id);
      const deck = deckFromManifest(stored.manifest, false, (path) => {
        const blob = images.get(path);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        this.urls.push(url);
        return url;
      });
      if (deck) this.custom.push(deck);
      else this.errors.push(`Deck has a missing image: ${stored.manifest.title}`);
    }
  }

  async rename(deck: Deck, title: string): Promise<boolean> {
    if (deck.builtin || !this.store) return false;
    const renamed = await this.store.rename(deck.id, title);
    await this.reload();
    return renamed;
  }

  async delete(deck: Deck): Promise<boolean> {
    if (deck.builtin || !this.store) return false;
    const deleted = await this.store.delete(deck.id);
    await this.reload();
    return deleted;
  }

  /** A ZIP of every custom deck plus the given preferences. */
  async backup(preferences: unknown): Promise<{ blob: Blob; name: string; decks: number }> {
    const decks: SavedDeck[] = [];
    if (this.store) {
      for (const stored of await this.store.list()) decks.push({ manifest: stored.manifest, images: await this.store.images(stored.id) });
    }
    const bytes = await createBackup(decks, preferences);
    return { blob: new Blob([bytes as BlobPart], { type: 'application/zip' }), name: backupFileName(), decks: decks.length };
  }

  /** Adds saved decks from a backup ZIP. Decks already on this device win. */
  async restoreZip(file: Blob): Promise<RestoreReport> {
    const files = await readZip(new Uint8Array(await file.arrayBuffer()));
    return this.restoreFiles(new Map([...files].map(([path, data]) => [path, new Blob([data as BlobPart])])));
  }

  /** Adds saved decks found in a file tree (a backup or a Windows decks folder). */
  async restoreFiles(files: ReadonlyMap<string, Blob>): Promise<RestoreReport> {
    const found = await findSavedDecks(files);
    const report: RestoreReport = { added: [], skipped: [], issues: [...found.issues], preferences: found.meta?.preferences, found: found.decks.length > 0 || found.meta !== null };
    if (!this.store) {
      report.issues.push(this.storeError ?? 'Saving decks is unavailable.');
      return report;
    }
    for (const deck of found.decks) {
      if (await this.store.has(deck.manifest.id)) {
        report.skipped.push(deck.manifest.title);
        continue;
      }
      try {
        await this.store.save(deck.manifest, deck.images);
        report.added.push(deck.manifest.title);
      } catch {
        report.issues.push(`A saved deck could not be copied: ${deck.manifest.title}`);
      }
    }
    if (report.added.length) {
      await this.reload();
      void requestPersistence();
    }
    return report;
  }
}

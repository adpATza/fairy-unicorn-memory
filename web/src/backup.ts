import { safeRelativePath, validManifest, type Manifest } from './manifest';
import { CUSTOM_ID, type StoredImage } from './storage';
import { writeZip, type ZipEntry } from './zip';

/**
 * Backups and Windows-edition decks.
 *
 * A backup is a ZIP laid out like the Windows edition's data folder:
 *
 *   Memory Card Game/backup.json
 *   Memory Card Game/decks/custom_<24 hex>/manifest.json
 *   Memory Card Game/decks/custom_<24 hex>/01.png …
 *
 * so its decks folder can be copied into %APPDATA%\Memory Card Game\. The
 * reader is lenient about where deck folders sit, so a ZIP (or folder) of the
 * Windows decks folder, or a single deck folder, restores too.
 */
export const BACKUP_FORMAT = 'memory-card-game-backup';
export const BACKUP_ROOT = 'Memory Card Game';

export interface SavedDeck {
  manifest: Manifest;
  images: Map<string, StoredImage>;
}

export interface BackupMeta {
  format: typeof BACKUP_FORMAT;
  version: 1;
  created: string;
  decks: number;
  preferences?: unknown;
}

/** Picture type from its first bytes: PNG, JPEG or WebP. */
export function imageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

const README = `Memory Card Game backup
=======================

Restore this file in the web edition: Deck library → Restore backup.
Decks already on the device are kept; only missing decks are added.

Windows edition: close the game, then copy the "decks" folder into
%APPDATA%\\Memory Card Game\\ . Decks that already exist there are kept.
`;

export async function createBackup(decks: readonly SavedDeck[], preferences: unknown, created = new Date()): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const meta: BackupMeta = { format: BACKUP_FORMAT, version: 1, created: created.toISOString(), decks: decks.length, preferences };
  const entries: ZipEntry[] = [
    { path: `${BACKUP_ROOT}/README.txt`, data: encoder.encode(README.replaceAll('\n', '\r\n')) },
    { path: `${BACKUP_ROOT}/backup.json`, data: encoder.encode(JSON.stringify(meta, null, 2)) },
  ];
  for (const deck of decks) {
    const folder = `${BACKUP_ROOT}/decks/${deck.manifest.id}`;
    entries.push({ path: `${folder}/manifest.json`, data: encoder.encode(JSON.stringify(deck.manifest, null, '\t')) });
    for (const image of deck.manifest.images) {
      const stored = deck.images.get(image.path);
      if (stored) entries.push({ path: `${folder}/${image.path}`, data: new Uint8Array(await stored.arrayBuffer()) });
    }
  }
  return writeZip(entries, created);
}

export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Memory Card Game backup ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}

export interface FoundDecks {
  decks: SavedDeck[];
  issues: string[];
  meta: BackupMeta | null;
}

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

/**
 * Finds saved custom decks in a file tree (paths use "/"). A deck is a folder
 * named custom_<24 hex> holding a valid manifest whose ID matches the folder,
 * with every listed picture beside it — the rules the Godot edition's
 * upgrade copy applies.
 */
export async function findSavedDecks(files: ReadonlyMap<string, Blob>): Promise<FoundDecks> {
  const decks: SavedDeck[] = [];
  const issues: string[] = [];
  let meta: BackupMeta | null = null;
  for (const [path, blob] of files) {
    if (path === `${BACKUP_ROOT}/backup.json` || path === 'backup.json') {
      try {
        const data = JSON.parse(new TextDecoder().decode(await bytesOf(blob)));
        if (data?.format === BACKUP_FORMAT && data.version === 1) meta = data;
      } catch {
        issues.push('The backup description could not be read.');
      }
    }
  }
  const manifests = [...files.keys()].filter((path) => path === 'manifest.json' || path.endsWith('/manifest.json')).sort();
  for (const manifestPath of manifests) {
    const folderPath = manifestPath.slice(0, -'manifest.json'.length);
    const folder = folderPath.replace(/\/$/, '').split('/').pop() ?? '';
    if (!CUSTOM_ID.test(folder)) continue;
    let data: unknown;
    try {
      data = JSON.parse(new TextDecoder().decode(await bytesOf(files.get(manifestPath)!)));
    } catch {
      data = null;
    }
    if (!validManifest(data) || data.id !== folder) {
      issues.push(`A saved deck has an invalid manifest: ${folder}`);
      continue;
    }
    const images = new Map<string, StoredImage>();
    let valid = true;
    for (const entry of data.images) {
      const file = files.get(folderPath + entry.path);
      // Saved decks are flat folders, as in the Godot edition.
      if (!safeRelativePath(entry.path) || entry.path.includes('/') || !file) {
        valid = false;
        break;
      }
      const bytes = await bytesOf(file);
      const type = imageType(bytes);
      if (!type) {
        valid = false;
        break;
      }
      images.set(entry.path, new Blob([bytes as BlobPart], { type }));
    }
    if (!valid) {
      issues.push(`A saved deck has missing or unreadable pictures: ${data.title}`);
      continue;
    }
    if (decks.some((deck) => deck.manifest.id === data.id)) continue;
    decks.push({ manifest: { ...data, style: data.style === 'Realistic fantasy' ? 'Realistic' : data.style }, images });
  }
  return { decks, issues, meta };
}

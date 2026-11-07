import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export const SERVICE_WORKER = 'sw.js';

/** Every built file except the service worker itself and source maps, sorted. */
export function precacheList(files: readonly string[]): string[] {
  return files.filter((file) => file !== SERVICE_WORKER && !file.endsWith('.map') && !file.startsWith('.')).sort();
}

/** A short digest of every precached file's path and bytes. */
export function contentVersion(files: readonly { path: string; content: Uint8Array }[]): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    hash.update(file.path).update('\0').update(file.content).update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

export function serviceWorkerSource(template: string, version: string, precache: readonly string[]): string {
  if (!template.includes("'__VERSION__'") || !template.includes("'__PRECACHE__'")) throw new Error('Service worker template is missing its placeholders');
  return template.replace("'__VERSION__'", JSON.stringify(version)).replace("'__PRECACHE__'", JSON.stringify(precache));
}

function walk(root: string, folder = root): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? walk(root, path) : [relative(root, path).split(sep).join('/')];
  });
}

/** Writes dist/sw.js after a production build. */
export function pwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'memory-card-game:pwa',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle: {
      order: 'post',
      handler() {
        const outDir = config.build.outDir;
        const precache = precacheList(walk(outDir));
        const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');
        // The worker's own code is part of the version, so changing it alone also refreshes the cache.
        const files = precache.map((path) => ({ path, content: readFileSync(join(outDir, path)) }));
        const version = contentVersion([...files, { path: SERVICE_WORKER, content: Buffer.from(template) }]);
        writeFileSync(join(outDir, SERVICE_WORKER), serviceWorkerSource(template, version, precache));
        config.logger.info(`PWA: ${SERVICE_WORKER} precaches ${precache.length} files (version ${version})`);
      },
    },
  };
}

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Serves a private copy of the production build, so a test can publish a
 * "new release" by changing files without affecting other tests.
 */
export class ReleaseServer {
  private server: Server | null = null;
  private readonly root = mkdtempSync(join(tmpdir(), 'memory-card-game-release-'));
  url = '';

  async start(): Promise<void> {
    cpSync(new URL('../dist', import.meta.url), this.root, { recursive: true });
    this.server = createServer((request, response) => {
      const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)).replace(/^([/\\])+/, '');
      const file = join(this.root, path === '' || path.endsWith('/') ? `${path}index.html` : path);
      try {
        const body = readFileSync(file);
        // Like GitHub Pages: short HTTP caching and a Vary header.
        response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600', Vary: 'Accept-Encoding' });
        response.end(body);
      } catch {
        response.writeHead(404).end('Not found');
      }
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.url = `http://127.0.0.1:${(this.server!.address() as AddressInfo).port}/`;
  }

  /** Publishes a new release: same app, different service worker bytes. */
  publishUpdate(note: string): void {
    const sw = join(this.root, 'sw.js');
    writeFileSync(sw, `${readFileSync(sw, 'utf8').replace(/const VERSION = "([0-9a-f]+)";/, `const VERSION = "$1-${note}";`)}\n`);
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    rmSync(this.root, { recursive: true, force: true });
  }
}

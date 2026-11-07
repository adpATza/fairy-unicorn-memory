import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentVersion, precacheList, serviceWorkerSource } from '../build/pwa';

const file = (path: string) => new URL(`../${path}`, import.meta.url);

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(file(path));
  expect(bytes.subarray(0, 8).toString('hex'), `${path} is a PNG`).toBe('89504e470d0a1a0a');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('web app manifest', () => {
  const manifest = JSON.parse(readFileSync(file('public/manifest.webmanifest'), 'utf8'));

  it('describes an installable standalone app scoped to its folder', () => {
    expect(manifest).toMatchObject({ name: 'Memory Card Game', id: './', start_url: './', scope: './', display: 'standalone', background_color: '#f2f7fe', theme_color: '#f2f7fe' });
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('lists icons that exist at their stated sizes, including a maskable one', () => {
    for (const icon of manifest.icons) {
      const [w, h] = pngSize(`public/${icon.src}`);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
    expect(manifest.icons.some((i: { purpose: string; sizes: string }) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true);
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '192x192')).toBe(true);
    expect(pngSize('public/icons/apple-touch-icon.png')).toEqual([180, 180]);
  });

  it('icons are up to date with assets/icon.svg (run npm run icons after changing it)', () => {
    const record = JSON.parse(readFileSync(file('scripts/icons-source.json'), 'utf8'));
    expect(record.sha256).toBe(createHash('sha256').update(readFileSync(file('../assets/icon.svg'))).digest('hex'));
  });
});

describe('service worker build', () => {
  it('precaches every built file except the worker, source maps and dotfiles', () => {
    expect(precacheList(['sw.js', 'index.html', 'assets/a.js', 'assets/a.js.map', '.vite/manifest.json', 'icons/i.png'])).toEqual(['assets/a.js', 'icons/i.png', 'index.html']);
  });

  it('versions by path and content, independent of order', () => {
    const a = { path: 'a', content: new Uint8Array([1]) };
    const b = { path: 'b', content: new Uint8Array([2]) };
    expect(contentVersion([a, b])).toBe(contentVersion([b, a]));
    expect(contentVersion([a, b])).not.toBe(contentVersion([a, { ...b, content: new Uint8Array([3]) }]));
    expect(contentVersion([a, b])).not.toBe(contentVersion([a, { ...b, path: 'c' }]));
    expect(contentVersion([a])).toMatch(/^[0-9a-f]{16}$/);
  });

  it('fills the template placeholders', () => {
    const template = readFileSync(file('build/service-worker.js'), 'utf8');
    const source = serviceWorkerSource(template, 'abc123', ['index.html', 'assets/x.svg']);
    expect(source).toContain('const VERSION = "abc123";');
    expect(source).toContain('const PRECACHE = ["index.html","assets/x.svg"];');
    expect(source).not.toContain('__VERSION__');
    expect(() => serviceWorkerSource('nothing here', 'v', [])).toThrow();
  });

  it('keeps generated files out of the source tree', () => {
    expect(existsSync(file('public/sw.js'))).toBe(false);
  });
});

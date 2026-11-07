import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { pwa } from './build/pwa.ts';

// Artwork, manifests and icons stay in the Godot project's assets/ folder.
// The web edition reads them from there so both editions share one source.
const assets = fileURLToPath(new URL('../assets', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [pwa()],
  resolve: {
    alias: { '@assets': assets },
  },
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
    // Deck pictures stay separate files: they load only when a deck is used
    // and are cached individually. Tiny interface assets may be inlined.
    assetsInlineLimit: (file) => (file.replaceAll('\\', '/').includes('/assets/decks/') ? false : undefined),
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});

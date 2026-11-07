import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Artwork, manifests and icons stay in the Godot project's assets/ folder.
// The web edition reads them from there so both editions share one source.
const assets = fileURLToPath(new URL('../assets', import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: { '@assets': assets },
  },
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});

// Renders the web app icons from ../assets/icon.svg with Playwright's Chromium.
// Run after changing the icon: npm run icons
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const source = new URL('../../assets/icon.svg', import.meta.url);
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url);
const svg = readFileSync(source, 'utf8');
const NAVY = '#172c49';

// Full-bleed variants: the navy tile fills the square and the artwork sits in
// the central safe zone, so Android masks and iOS corner rounding never clip it.
const fullBleed = (scale) => {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const offset = (256 - 256 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${NAVY}"/><g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g></svg>`;
};

const icons = [
  { name: 'icon-192.png', size: 192, svg, transparent: true },
  { name: 'icon-512.png', size: 512, svg, transparent: true },
  { name: 'icon-maskable-512.png', size: 512, svg: fullBleed(0.8), transparent: false },
  { name: 'apple-touch-icon.png', size: 180, svg: fullBleed(0.86), transparent: false },
];

const browser = await chromium.launch();
for (const icon of icons) {
  const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
  const data = `data:image/svg+xml;base64,${Buffer.from(icon.svg).toString('base64')}`;
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="${data}" width="${icon.size}" height="${icon.size}">`);
  await page.locator('img').evaluate((img) => img.decode());
  await page.screenshot({ path: out(icon.name).pathname, omitBackground: icon.transparent });
  await page.close();
  console.log(`icons/${icon.name} (${icon.size}×${icon.size})`);
}
await browser.close();

// Records which icon.svg the PNGs came from; a unit test flags stale icons.
const digest = createHash('sha256').update(readFileSync(source)).digest('hex');
writeFileSync(new URL('./icons-source.json', import.meta.url), `${JSON.stringify({ source: 'assets/icon.svg', sha256: digest }, null, 2)}\n`);

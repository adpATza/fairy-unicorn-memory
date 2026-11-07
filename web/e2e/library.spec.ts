import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { file, picture, pictures, picturesFolder, png, windowsDecksFolder, type FixtureFile } from './fixtures';
import { VIEWPORTS, card, expect, playPerfectRound, test, usePrefs } from './helpers';

test.use({ viewport: VIEWPORTS.laptop });

async function openLibrary(page: Page): Promise<void> {
  await page.goto('./?seed=4');
  await page.getByRole('button', { name: 'Deck library' }).click();
  await expect(page.getByRole('heading', { name: 'Deck library' })).toBeVisible();
}

async function choosePictures(page: Page, files: FixtureFile[]): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose pictures' }).click();
  await (await chooser).setFiles(files);
  await expect(page.getByRole('heading', { name: 'Create a deck' })).toBeVisible();
}

async function importDeck(page: Page, files: FixtureFile[], name: string, domain = 'Plants'): Promise<void> {
  await choosePictures(page, files);
  await page.getByLabel('Deck name').fill(name);
  await page.getByLabel('Domain / subject').fill(domain);
  await page.getByRole('button', { name: 'Save deck' }).click();
  await expect(page.getByRole('heading', { name: 'Deck library' })).toBeVisible();
  await expect(page.locator('.deck-title', { hasText: name })).toBeVisible();
}

async function chooseDeck(page: Page, domain: string, deck: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Subject' }).selectOption(domain);
  await expect(page.getByRole('combobox', { name: 'Deck' })).toHaveValue(deck);
}

test('importing pictures rejects duplicates and corrupt files, then the deck saves and plays', async ({ page }) => {
  await page.clock.install();
  await usePrefs(page);
  await openLibrary(page);
  await choosePictures(page, [
    file('a.png', picture(1)),
    file('b.png', picture(2)),
    file('wide.png', png(220, 80, (x) => (x < 110 ? [255, 118, 55, 255] : [36, 91, 255, 255]))),
    file('copy of a.png', picture(1)),
    file('z re-saved.png', picture(1, 64, 9)),
    file('broken.png', Buffer.from('this is not a picture')),
    file('notes.txt', Buffer.from('ignored'), 'text/plain'),
  ]);
  await expect(page.locator('.selected-count')).toHaveText('3 selected from 3 unique pictures');
  await expect(page.locator('.tile')).toHaveCount(3);
  await page.getByRole('button', { name: '3 rejected files' }).click();
  const rejected = page.getByRole('dialog', { name: 'Rejected files' });
  await expect(rejected).toContainText('copy of a.png: identical decoded pixels to a.png. Select one copy per object.');
  await expect(rejected).toContainText('z re-saved.png: identical decoded pixels to a.png.');
  await expect(rejected).toContainText('broken.png: unreadable or corrupt image.');
  await rejected.getByRole('button', { name: 'OK' }).click();

  // A name is required.
  await page.getByRole('button', { name: 'Save deck' }).click();
  await expect(page.getByRole('dialog', { name: 'Deck library' })).toContainText('Enter a deck name and domain.');
  await page.getByRole('dialog', { name: 'Deck library' }).getByRole('button', { name: 'OK' }).click();

  await page.getByLabel('Deck name').fill('Garden friends');
  await page.getByLabel('Domain / subject').fill('Plants');
  await page.getByLabel('Artwork style').selectOption('Realistic');
  await page.getByLabel('Complexity').selectOption('Medium');
  await page.getByRole('button', { name: 'Save deck' }).click();
  const row = page.locator('.deck-row', { hasText: 'Garden friends' });
  await expect(row).toContainText('Plants  /  Realistic  /  Medium');
  await expect(row).toContainText('3 images  •  your collection');

  // Saved pictures are 1024-pixel white squares; the wide one is fitted, not cropped or stretched.
  const geometry = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll<HTMLImageElement>('.deck-row img')].map((img) => img.src);
    const img = new Image();
    img.src = urls[urls.length - 1]!; // Thumbnails show each deck's first picture: a.png.
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  });
  expect(geometry).toEqual({ width: 1024, height: 1024 });

  await page.getByRole('button', { name: 'Return to setup' }).click();
  await chooseDeck(page, 'Plants', 'Garden friends');
  await expect(page.locator('.sample-deck')).toHaveText('Garden friends');
  await page.getByRole('spinbutton', { name: 'Pairs' }).fill('30');
  await page.getByRole('spinbutton', { name: 'Pairs' }).blur();
  await expect(page.getByRole('spinbutton', { name: 'Pairs' })).toHaveValue('3');
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.locator('.card')).toHaveCount(6);
  await card(page, 0).click();
  await expect.poll(() => card(page, 0).locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1024);
  await card(page, 1).click();
  await page.clock.runFor(2000);
  await playPerfectRound(page);
  await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();

  // Saved decks survive a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Deck library' }).click();
  await expect(page.locator('.deck-title', { hasText: 'Garden friends' })).toBeVisible();
});

test('a non-square picture is fitted onto a white square without cropping', async ({ page }) => {
  await usePrefs(page);
  await openLibrary(page);
  await importDeck(page, [file('a-wide.png', png(220, 80, () => [36, 91, 255, 255])), file('b.png', picture(5))], 'Shapes');
  const result = await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>('.deck-row:last-child img')!;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, maxX = -1, minY = canvas.height, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i]! < 200) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return { size: canvas.width, corner: [...data.slice(0, 4)], ratio: (maxX - minX + 1) / (maxY - minY + 1), width: maxX - minX + 1 };
  });
  expect(result.size).toBe(1024);
  expect(result.corner).toEqual([255, 255, 255, 255]);
  expect(Math.abs(result.ratio - 220 / 80)).toBeLessThan(0.03);
  expect(Math.abs(result.width - 1024 * 0.9)).toBeLessThan(3);
});

test('more than 30 pictures need a manual subset of 2–30', async ({ page }) => {
  await usePrefs(page);
  await openLibrary(page);
  await choosePictures(page, pictures(31));
  const save = page.getByRole('button', { name: 'Save deck' });
  await expect(page.locator('.selected-count')).toHaveText('0 selected from 31 unique pictures');
  await expect(save).toBeDisabled();
  await page.locator('.tile').nth(0).click();
  await expect(save).toBeDisabled();
  await page.locator('.tile').nth(1).click();
  await expect(save).toBeEnabled();
  await expect(page.locator('.tile[aria-pressed="true"]')).toHaveCount(2);
  for (let i = 2; i < 31; i++) await page.locator('.tile').nth(i).click();
  await expect(page.locator('.selected-count')).toHaveText('31 selected from 31 unique pictures');
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.locator('.tile[aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel import' }).click();
  await expect(page.getByRole('heading', { name: 'Deck library' })).toBeVisible();
});

test('custom decks can be renamed and deleted; included decks cannot', async ({ page }) => {
  await usePrefs(page);
  await openLibrary(page);
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
  await importDeck(page, pictures(4), 'Old name');
  await page.getByRole('button', { name: 'Rename Old name' }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename deck' });
  await dialog.getByLabel('Deck name').fill('Renamed 魔法 collection');
  await dialog.getByRole('button', { name: 'Save name' }).click();
  await expect(page.locator('.deck-title', { hasText: 'Renamed 魔法 collection' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete Renamed 魔法 collection' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete this custom deck?' });
  await expect(confirm).toContainText('Your original pictures stay untouched.');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.deck-row')).toHaveCount(7);
  await page.getByRole('button', { name: 'Delete Renamed 魔法 collection' }).click();
  await page.getByRole('dialog', { name: 'Delete this custom deck?' }).getByRole('button', { name: 'Delete deck' }).click();
  await expect(page.locator('.deck-row')).toHaveCount(6);
  await page.reload();
  await page.getByRole('button', { name: 'Deck library' }).click();
  await expect(page.locator('.deck-row')).toHaveCount(6);
});

test('a deleted deck that was selected falls back to Mix & Match', async ({ page }) => {
  await usePrefs(page);
  await openLibrary(page);
  await importDeck(page, pictures(3), 'Temporary', 'Temps');
  await page.getByRole('button', { name: 'Return to setup' }).click();
  await chooseDeck(page, 'Temps', 'Temporary');
  await page.getByRole('button', { name: 'Deck library' }).click();
  await page.getByRole('button', { name: 'Delete Temporary' }).click();
  await page.getByRole('dialog', { name: 'Delete this custom deck?' }).getByRole('button', { name: 'Delete deck' }).click();
  await page.getByRole('button', { name: 'Return to setup' }).click();
  await expect(page.getByRole('combobox', { name: 'Deck' })).toHaveValue('Mix & Match');
});

test('a backup restores decks and settings on another device, keeping existing decks', async ({ page, browser }) => {
  await usePrefs(page, { players: 3 });
  await openLibrary(page);
  await importDeck(page, pictures(3, 'pet'), 'Family pets', 'Pets');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up decks' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^Memory Card Game backup \d{4}-\d\d-\d\d\.zip$/);
  const zip = readFileSync((await download.path())!);

  // A different device: fresh storage, default settings.
  const other = await browser.newContext({ viewport: VIEWPORTS['phone portrait'] });
  const phone = await other.newPage();
  await phone.goto('./');
  await phone.getByRole('button', { name: 'Deck library' }).click();
  const restore = async () => {
    const chooser = phone.waitForEvent('filechooser');
    await phone.getByRole('button', { name: 'Restore backup' }).click();
    await (await chooser).setFiles({ name: download.suggestedFilename(), mimeType: 'application/zip', buffer: zip });
    return phone.getByRole('dialog', { name: 'Restore backup' });
  };
  let report = await restore();
  await expect(report).toContainText('Added 1 deck: Family pets.');
  await expect(report).toContainText('Your saved settings were restored too.');
  await report.getByRole('button', { name: 'OK' }).click();
  await expect(phone.locator('.deck-title', { hasText: 'Family pets' })).toBeVisible();
  report = await restore();
  await expect(report).toContainText('Already in your library, kept as they are: Family pets.');
  await report.getByRole('button', { name: 'OK' }).click();
  await phone.getByRole('button', { name: 'Return to setup' }).click();
  await expect(phone.getByRole('combobox', { name: 'Number of players' })).toHaveValue('3 players');
  await other.close();
});

test('saved decks from the Windows edition can be added from its decks folder', async ({ page }) => {
  await page.clock.install();
  await usePrefs(page);
  await openLibrary(page);
  const folder = windowsDecksFolder('custom_0123456789abcdef01234567', 'Landmarks from Windows');
  await page.locator('input[webkitdirectory]').setInputFiles(folder);
  const report = page.getByRole('dialog', { name: 'Add saved decks' });
  await expect(report).toContainText('Added 1 deck: Landmarks from Windows.');
  await report.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.deck-row', { hasText: 'Landmarks from Windows' })).toContainText('Places  /  Realistic  /  Hard');
  await page.getByRole('button', { name: 'Return to setup' }).click();
  await chooseDeck(page, 'Places', 'Landmarks from Windows');
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.locator('.card')).toHaveCount(6);
  await playPerfectRound(page);
  await expect(page.getByRole('heading', { name: 'Every pair found' })).toBeVisible();
});

test('a folder of pictures becomes a new deck; nested folders are not scanned', async ({ page }) => {
  await usePrefs(page);
  await openLibrary(page);
  await page.locator('input[webkitdirectory]').setInputFiles(picturesFolder(4));
  await expect(page.getByRole('heading', { name: 'Create a deck' })).toBeVisible();
  await expect(page.locator('.selected-count')).toHaveText('4 selected from 4 unique pictures');
  await expect(page.locator('.tile-name')).toHaveText(['photo-1.png', 'photo-2.png', 'photo-3.png', 'photo-4.png']);
});

test('JPEG and WebP pictures are accepted', async ({ page }) => {
  await usePrefs(page);
  await openLibrary(page);
  const encoded = await page.evaluate(async () => {
    const make = async (type: string, colour: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 30;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, 40, 30);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), type, 0.9));
      return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
    };
    return { jpeg: await make('image/jpeg', '#ff7637'), webp: await make('image/webp', '#00b89c') };
  });
  await importDeck(page, [file('photo.jpg', Buffer.from(encoded.jpeg, 'base64'), 'image/jpeg'), file('art.webp', Buffer.from(encoded.webp, 'base64'), 'image/webp')], 'Mixed formats');
  await expect(page.locator('.deck-row', { hasText: 'Mixed formats' })).toContainText('2 images');
});

test('pictures and backups can be dropped onto the library', async ({ page }) => {
  await usePrefs(page);
  await openLibrary(page);
  const files = pictures(3, 'dropped').map((f) => ({ name: f.name, data: f.buffer.toString('base64') }));
  const transfer = await page.evaluateHandle((items) => {
    const data = new DataTransfer();
    for (const item of items) data.items.add(new File([Uint8Array.from(atob(item.data), (c) => c.charCodeAt(0))], item.name, { type: 'image/png' }));
    return data;
  }, files);
  await page.locator('.build').dispatchEvent('dragover', { dataTransfer: transfer });
  await page.locator('.build').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByRole('heading', { name: 'Create a deck' })).toBeVisible();
  await expect(page.locator('.selected-count')).toHaveText('3 selected from 3 unique pictures');
});

test('custom decks play offline', async ({ page, context }) => {
  await usePrefs(page);
  await openLibrary(page);
  await importDeck(page, pictures(3, 'offline'), 'Offline friends', 'Offline');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.goto('./?seed=4');
  await chooseDeck(page, 'Offline', 'Offline friends');
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await card(page, 0).click();
  await expect.poll(() => card(page, 0).locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1024);
});

for (const [name, viewport] of [['small phone portrait', VIEWPORTS['small phone portrait']], ['phone portrait', VIEWPORTS['phone portrait']]] as const) {
  test(`library and import screens fit a ${name} without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await usePrefs(page);
    await openLibrary(page);
    await importDeck(page, pictures(3, 'narrow'), 'A rather long deck name for a small screen');
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(await wide()).toBeLessThanOrEqual(0);
    await choosePictures(page, pictures(12, 'many'));
    expect(await wide()).toBeLessThanOrEqual(0);
  });
}

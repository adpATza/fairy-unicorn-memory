import type { App, Screen } from '../app';
import { notice, progressDialog } from '../dialogs';
import { h } from '../dom';
import { MAX_PICTURES, MIN_PICTURES, releasePreviews, saveImport, type ScanResult } from '../imports';
import { COMPLEXITIES, STYLES } from '../manifest';
import { requestPersistence } from '../storage';

/** Port of the import view in library_screen.gd: review previews, describe, save. */
export function createImportScreen(app: App, scan: ScanResult): Screen {
  // Small sets start fully selected; larger ones need a manual subset.
  const chosen = new Set<number>(scan.accepted.length <= MAX_PICTURES ? scan.accepted.map((_, i) => i) : []);
  const title = h('input', { type: 'text', id: 'deck-title', maxlength: 64, placeholder: 'My awesome collection', autocomplete: 'off' });
  const domain = h('input', { type: 'text', id: 'deck-domain', maxlength: 40, value: 'My collection', placeholder: 'Animals, vehicles, places…', autocomplete: 'off' });
  const style = h('select', { id: 'deck-style' }, ...STYLES.map((s) => h('option', { value: s }, s)));
  const complexity = h('select', { id: 'deck-complexity' }, ...COMPLEXITIES.map((c) => h('option', { value: c }, c)));
  const count = h('p', { class: 'selected-count', 'aria-live': 'polite' });
  const save = h('button', { type: 'submit', class: 'primary large' }, 'Save deck');
  let released = false;

  const tiles = scan.accepted.map((item, i) => {
    const tile = h(
      'button',
      { type: 'button', class: 'tile', 'aria-pressed': String(chosen.has(i)), title: `${item.filename} — fitted without cropping` },
      h('img', { src: item.preview, alt: '' }),
      h('span', { class: 'tile-name' }, item.filename),
    );
    tile.addEventListener('click', () => {
      if (chosen.has(i)) chosen.delete(i);
      else chosen.add(i);
      tile.setAttribute('aria-pressed', String(chosen.has(i)));
      update();
    });
    return tile;
  });

  const form = h(
    'form',
    { class: 'import-form', novalidate: true },
    h('label', { for: 'deck-title' }, 'Deck name'),
    title,
    h('label', { for: 'deck-domain' }, 'Domain / subject'),
    domain,
    h('label', { for: 'deck-style' }, 'Artwork style'),
    style,
    h('label', { for: 'deck-complexity' }, 'Complexity'),
    complexity,
    h('p', { class: 'muted small' }, 'Tags describe your artwork. They don’t change the pictures.'),
    save,
  );

  const element = h(
    'div',
    { class: 'screen import', 'data-screen': 'import' },
    h(
      'header',
      { class: 'page-head' },
      h('h1', {}, 'Create a deck'),
      h('button', { type: 'button', onclick: () => app.showLibrary() }, 'Cancel import'),
      h('p', { class: 'tagline' }, 'Review the square previews, then select 2–30 unique pictures.'),
    ),
    h(
      'main',
      { class: 'import-body' },
      h(
        'section',
        { class: 'import-pictures', 'aria-label': 'Pictures' },
        scan.accepted.length
          ? h('div', { class: 'tiles', role: 'group', 'aria-label': 'Select pictures' }, ...tiles)
          : h('p', { class: 'empty-note' }, 'No readable unique pictures were found. Choose PNG, JPEG or WebP pictures.'),
        h(
          'div',
          { class: 'import-status' },
          count,
          h('button', { type: 'button', onclick: clearSelection, disabled: scan.accepted.length === 0 }, 'Clear selection'),
          scan.rejected.length
            ? h('button', { type: 'button', onclick: () => notice('Rejected files', scan.rejected.join('\n').slice(0, 4500)) }, `${scan.rejected.length} rejected ${scan.rejected.length === 1 ? 'file' : 'files'}`)
            : null,
        ),
      ),
      form,
    ),
  );

  function clearSelection(): void {
    chosen.clear();
    for (const tile of tiles) tile.setAttribute('aria-pressed', 'false');
    update();
  }

  function update(): void {
    const valid = chosen.size >= MIN_PICTURES && chosen.size <= MAX_PICTURES;
    count.textContent = `${chosen.size} selected from ${scan.accepted.length} unique ${scan.accepted.length === 1 ? 'picture' : 'pictures'}`;
    count.classList.toggle('invalid', !valid);
    save.disabled = !valid || !app.library.store;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const store = app.library.store;
    if (!store) return;
    const selected = [...chosen].sort((a, b) => a - b).map((i) => scan.accepted[i]!);
    const progress = progressDialog('Saving deck');
    const result = await saveImport(store, { title: title.value, domain: domain.value, style: style.value, complexity: complexity.value }, selected, (done, total) =>
      progress.update(`Preparing picture ${Math.min(done + 1, total)} of ${total}…`),
    );
    if ('error' in result) {
      progress.close();
      notice('Deck library', result.error);
      return;
    }
    progress.update('Finishing…');
    await app.library.reload();
    // Saved decks matter: ask the browser to keep them when space runs low.
    await requestPersistence();
    progress.close();
    app.showLibrary();
  });

  update();
  return {
    element,
    title: 'Create a deck',
    mounted() {
      if (app.shouldAutoFocus()) title.focus();
    },
    destroy() {
      if (!released) releasePreviews(scan.accepted);
      released = true;
    },
  };
}

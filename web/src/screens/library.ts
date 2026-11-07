import type { App, Screen } from '../app';
import { confirmAction, notice, progressDialog, promptText } from '../dialogs';
import { h } from '../dom';
import { isPicture, scanPictures, type ScanResult } from '../imports';
import type { RestoreReport } from '../library';
import type { Deck } from '../manifest';
import { persistence, usage } from '../storage';

const SAVED_DECK = /(^|\/)custom_[0-9a-f]{24}\/manifest\.json$/;

/** Port of library_screen.gd, plus backups and Windows deck import. */
export function createLibraryScreen(app: App): Screen {
  const library = app.library;
  const pictureInput = h('input', { type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp', hidden: true });
  const folderInput = h('input', { type: 'file', hidden: true });
  folderInput.webkitdirectory = true;
  const restoreInput = h('input', { type: 'file', accept: '.zip,application/zip', hidden: true });
  // Folder picking needs a desktop-style file dialog; touch-only phones and tablets lack one.
  const folderSupported = 'webkitdirectory' in folderInput && (globalThis.matchMedia?.('(any-pointer: fine)').matches ?? true);
  const storageNote = h('p', { class: 'storage-note muted' });
  const list = h('ul', { class: 'deck-list', 'aria-label': 'Decks' });
  const backup = h('button', { type: 'button' }, 'Back up decks');
  const build = h(
    'section',
    { class: 'library-panel build', 'aria-labelledby': 'build-title' },
    h('h2', { id: 'build-title' }, 'Build your own deck'),
    h('p', {}, 'Animals, vehicles, places, people, or your own artwork. Choose 2–30 unique pictures, review the square previews, then save and start matching.'),
    h('button', { type: 'button', class: 'primary large', onclick: () => pictureInput.click() }, 'Choose pictures'),
    folderSupported ? h('button', { type: 'button', onclick: () => folderInput.click() }, 'Choose a folder') : null,
    h('p', { class: 'drop-hint muted' }, 'Or drop pictures, a saved deck folder or a backup here.'),
    library.storeError ? h('p', { class: 'warning-text' }, library.storeError) : null,
  );
  const element = h(
    'div',
    { class: 'screen library', 'data-screen': 'library' },
    h('header', { class: 'page-head' }, h('h1', {}, 'Deck library'), h('button', { type: 'button', onclick: () => app.showSetup() }, 'Return to setup')),
    h('p', { class: 'tagline' }),
    h(
      'div',
      { class: 'library-body' },
      list,
      h(
        'aside',
        { class: 'library-side' },
        build,
        h(
          'section',
          { class: 'library-panel keep', 'aria-labelledby': 'keep-title' },
          h('h2', { id: 'keep-title' }, 'Keep your decks safe'),
          storageNote,
          h('div', { class: 'button-row' }, backup, h('button', { type: 'button', onclick: () => restoreInput.click(), disabled: !library.store }, 'Restore backup')),
        ),
      ),
    ),
    h('div', { class: 'library-warnings' }),
    pictureInput,
    folderInput,
    restoreInput,
  );
  const tagline = element.querySelector<HTMLElement>('.tagline')!;
  const warnings = element.querySelector<HTMLElement>('.library-warnings')!;

  function render(): void {
    const count = library.decks.length;
    tagline.textContent = count === 6 ? 'Six bold collections. Your next favourite is in here.' : `${count} collections. Your next favourite is in here.`;
    list.replaceChildren(...library.decks.map(row));
    backup.disabled = library.custom.length === 0;
    backup.title = library.custom.length === 0 ? 'Save a deck first' : '';
    warnings.replaceChildren(
      library.errors.length ? h('button', { type: 'button', onclick: () => notice('Deck library', library.errors.join('\n')) }, 'Review library warnings') : '',
    );
    void describeStorage();
  }

  function row(deck: Deck): HTMLElement {
    return h(
      'li',
      { class: 'deck-row' },
      h('img', { class: 'deck-thumb', src: deck.images[0]!.url, alt: '' }),
      h(
        'div',
        { class: 'deck-text' },
        h('h2', { class: 'deck-title' }, deck.title),
        h('p', { class: 'muted' }, `${deck.domain}  /  ${deck.style}  /  ${deck.complexity}`),
        h('p', { class: 'muted' }, `${deck.images.length} images  •  ${deck.builtin ? 'included' : 'your collection'}`),
      ),
      deck.builtin
        ? null
        : h(
            'div',
            { class: 'deck-actions' },
            h('button', { type: 'button', 'aria-label': `Rename ${deck.title}`, onclick: () => rename(deck) }, 'Rename'),
            h('button', { type: 'button', 'aria-label': `Delete ${deck.title}`, onclick: () => remove(deck) }, 'Delete'),
          ),
    );
  }

  async function describeStorage(): Promise<void> {
    if (!library.store) {
      storageNote.textContent = 'Saving decks is unavailable in this browser.';
      return;
    }
    const [state, bytes] = await Promise.all([persistence(), usage()]);
    const size = bytes === null ? '' : ` They use about ${formatBytes(bytes)} with the game.`;
    storageNote.textContent =
      library.custom.length === 0
        ? 'Decks you make are saved on this device. Back them up to keep them safe or move them to another device.'
        : state === 'persisted'
          ? `Your decks are saved on this device and protected from automatic clean-up.${size}`
          : `Your decks are saved on this device. The browser may remove them if space runs low, so keep a backup.${size}`;
  }

  function rename(deck: Deck): void {
    promptText({
      title: 'Rename deck',
      label: 'Deck name',
      value: deck.title,
      maxLength: 64,
      accept: 'Save name',
      onAccept: async (title) => {
        if (!(await library.rename(deck, title))) notice('Deck library', 'Enter a deck name and check that this device has free space.');
        render();
      },
    });
  }

  function remove(deck: Deck): void {
    confirmAction({
      title: 'Delete this custom deck?',
      detail: `Delete “${deck.title}” from this game?\nYour original pictures stay untouched.`,
      accept: 'Delete deck',
      onAccept: async () => {
        if (!(await library.delete(deck))) notice('Deck library', 'Could not delete this deck.');
        render();
      },
    });
  }

  async function scan(files: File[]): Promise<void> {
    const progress = progressDialog('Reading pictures');
    let result: ScanResult;
    try {
      result = await scanPictures(files, (done, total) => progress.update(`Reading ${Math.min(done + 1, total)} of ${total}…`));
    } finally {
      progress.close();
    }
    app.showImport(result);
  }

  async function restore(task: () => Promise<RestoreReport>, title: string): Promise<void> {
    const progress = progressDialog(title);
    progress.update('Checking saved decks…');
    let report: RestoreReport;
    try {
      report = await task();
    } catch (error) {
      progress.close();
      notice(title, error instanceof Error ? `${error.message}.` : 'This file could not be read.');
      return;
    }
    progress.close();
    const restoredSettings = app.restorePreferences(report.preferences);
    const lines: string[] = [];
    if (!report.found && report.issues.length === 0) lines.push('No saved decks were found. Choose a backup ZIP or a saved deck folder (custom_…) from the Windows edition.');
    if (report.added.length) lines.push(`Added ${report.added.length === 1 ? '1 deck' : `${report.added.length} decks`}: ${report.added.join(', ')}.`);
    if (report.skipped.length) lines.push(`Already in your library, kept as they are: ${report.skipped.join(', ')}.`);
    if (restoredSettings) lines.push('Your saved settings were restored too.');
    if (report.found && !report.added.length && !report.skipped.length && !report.issues.length) lines.push('The backup contains no custom decks.');
    if (report.issues.length) lines.push(`Some decks could not be added:\n${report.issues.join('\n')}`);
    render();
    notice(title, lines.join('\n\n'));
  }

  /** A folder holds either saved decks (Windows edition or backup) or pictures for a new deck. */
  async function openFolder(files: File[]): Promise<void> {
    const tree = new Map(files.map((file) => [file.webkitRelativePath || file.name, file as Blob]));
    if ([...tree.keys()].some((path) => SAVED_DECK.test(path))) {
      await restore(() => library.restoreFiles(tree), 'Add saved decks');
      return;
    }
    // Like the Godot edition, nested folders are not scanned.
    await scan(files.filter((file) => (file.webkitRelativePath || file.name).split('/').length <= 2));
  }

  async function downloadBackup(): Promise<void> {
    const progress = progressDialog('Back up decks');
    progress.update('Preparing your backup…');
    try {
      const { blob, name } = await library.backup(app.preferences);
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: name, hidden: true });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      progress.close();
    }
  }

  pictureInput.addEventListener('change', () => {
    const files = [...(pictureInput.files ?? [])];
    pictureInput.value = '';
    if (files.length) void scan(files);
  });
  folderInput.addEventListener('change', () => {
    const files = [...(folderInput.files ?? [])];
    folderInput.value = '';
    if (files.length) void openFolder(files);
  });
  restoreInput.addEventListener('change', () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = '';
    if (file) void restore(() => library.restoreZip(file), 'Restore backup');
  });
  backup.addEventListener('click', () => void downloadBackup());

  // Drag and drop pictures, a backup ZIP, or (where supported) folders.
  element.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    build.classList.add('dropping');
  });
  element.addEventListener('dragleave', (event) => {
    if (event.target === element || !element.contains(event.relatedTarget as Node)) build.classList.remove('dropping');
  });
  element.addEventListener('drop', (event) => {
    event.preventDefault();
    build.classList.remove('dropping');
    const files = [...(event.dataTransfer?.files ?? [])];
    const zip = files.find((file) => /\.zip$/i.test(file.name) || file.type === 'application/zip');
    if (zip) void restore(() => library.restoreZip(zip), 'Restore backup');
    else if (files.some(isPicture)) void scan(files);
  });

  render();
  return { element };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

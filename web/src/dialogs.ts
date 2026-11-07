import { h, uniqueId } from './dom';

interface ConfirmOptions {
  title: string;
  detail: string;
  accept?: string;
  onAccept: () => void;
  onCancel?: () => void;
}

/** A modal confirmation. Escape, Cancel or the backdrop's close all cancel. */
export function confirmAction({ title, detail, accept = 'Leave game', onAccept, onCancel }: ConfirmOptions): HTMLDialogElement {
  const titleId = uniqueId('confirm-title');
  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': titleId },
    h(
      'form',
      { method: 'dialog' },
      h('h2', { id: titleId }, title),
      h('p', {}, detail),
      h('div', { class: 'dialog-actions' }, h('button', { value: 'cancel', autofocus: true }, 'Cancel'), h('button', { value: 'accept', class: 'primary' }, accept)),
    ),
  );
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (dialog.returnValue === 'accept') onAccept();
    else onCancel?.();
  });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/** A modal message with an OK button. */
export function notice(title: string, message: string): HTMLDialogElement {
  const titleId = uniqueId('notice-title');
  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': titleId },
    h('form', { method: 'dialog' }, h('h2', { id: titleId }, title), h('p', { class: 'pre-line' }, message), h('div', { class: 'dialog-actions' }, h('button', { class: 'primary', autofocus: true }, 'OK'))),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function anyDialogOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

interface PromptOptions {
  title: string;
  label: string;
  value: string;
  maxLength: number;
  accept: string;
  onAccept: (value: string) => void;
}

/** A modal single-line text prompt (used for renaming decks). */
export function promptText({ title, label, value, maxLength, accept, onAccept }: PromptOptions): HTMLDialogElement {
  const titleId = uniqueId('prompt-title');
  const inputId = uniqueId('prompt-input');
  const input = h('input', { type: 'text', id: inputId, value, maxlength: maxLength, autocomplete: 'off', required: true });
  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': titleId },
    h(
      'form',
      { method: 'dialog' },
      h('h2', { id: titleId }, title),
      h('label', { for: inputId, class: 'field-label' }, label),
      input,
      h('div', { class: 'dialog-actions' }, h('button', { value: 'cancel', formnovalidate: true }, 'Cancel'), h('button', { value: 'accept', class: 'primary' }, accept)),
    ),
  );
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (dialog.returnValue === 'accept' && input.value.trim()) onAccept(input.value);
  });
  document.body.append(dialog);
  dialog.showModal();
  input.select();
  return dialog;
}

/** A modal progress message that the player cannot dismiss; call the result to close it. */
export function progressDialog(title: string): { update: (text: string) => void; close: () => void } {
  const titleId = uniqueId('progress-title');
  const status = h('p', { role: 'status' });
  const dialog = h('dialog', { class: 'dialog progress', 'aria-labelledby': titleId }, h('h2', { id: titleId }, title), status);
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  document.body.append(dialog);
  dialog.showModal();
  return {
    update: (text) => (status.textContent = text),
    close: () => {
      dialog.close();
      dialog.remove();
    },
  };
}

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

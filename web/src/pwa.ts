import { h } from './dom';

/** Chromium's install prompt event (not yet in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Message = 'offline' | 'update';

/**
 * Service worker registration, update prompts and installation.
 *
 * A new version never interrupts a round: it installs in the background and
 * the "Update now" prompt waits until the player is on setup or results.
 */
export class Pwa {
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private readonly installListeners = new Set<() => void>();
  private waiting: ServiceWorker | null = null;
  private pending: Message | null = null;
  private dismissed = false;
  private reloadOnControllerChange = false;
  private toast: HTMLElement | null = null;
  private toastTimer = 0;
  private readonly roundInProgress: () => boolean;

  constructor(roundInProgress: () => boolean) {
    this.roundInProgress = roundInProgress;
    addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event as BeforeInstallPromptEvent;
      this.notifyInstall();
    });
    addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.notifyInstall();
    });
  }

  /** Registers the service worker in production builds. */
  start(): void {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const container = navigator.serviceWorker;
    const hadController = container.controller !== null;
    container.addEventListener('controllerchange', () => {
      if (this.reloadOnControllerChange) location.reload();
    });
    container
      .register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then((registration) => {
        if (registration.waiting && container.controller) this.updateFound(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && container.controller) this.updateFound(worker);
            if (worker.state === 'activated' && !hadController) this.show('offline');
          });
        });
        const check = () => void registration.update().catch(() => undefined);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        setInterval(check, 60 * 60 * 1000);
      })
      .catch(() => undefined);
  }

  canInstall(): boolean {
    return this.installPrompt !== null;
  }

  onInstallChange(listener: () => void): () => void {
    this.installListeners.add(listener);
    return () => this.installListeners.delete(listener);
  }

  async install(): Promise<void> {
    const prompt = this.installPrompt;
    if (!prompt) return;
    this.installPrompt = null;
    this.notifyInstall();
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
  }

  /** Called on every screen change: prompts wait while a round is in progress. */
  screenChanged(): void {
    if (this.roundInProgress()) this.hideToast();
    else if (this.pending) this.show(this.pending);
  }

  private notifyInstall(): void {
    for (const listener of this.installListeners) listener();
  }

  private updateFound(worker: ServiceWorker): void {
    this.waiting = worker;
    this.show('update');
  }

  private show(message: Message): void {
    if (message === 'update' && this.dismissed) return;
    this.pending = message;
    if (this.roundInProgress()) return;
    this.hideToast();
    // "Later" hides the update prompt for this visit; the new version still
    // starts by itself the next time the app is opened.
    const close = (action?: () => void) => () => {
      this.pending = null;
      if (message === 'update' && !action) this.dismissed = true;
      this.hideToast();
      action?.();
    };
    const toast =
      message === 'update'
        ? h(
            'div',
            { class: 'toast', role: 'status' },
            h('p', {}, 'A new version is ready.'),
            h('div', { class: 'toast-actions' }, h('button', { type: 'button', onclick: close() }, 'Later'), h('button', { type: 'button', class: 'primary', onclick: close(() => this.applyUpdate()) }, 'Update now')),
          )
        : h('div', { class: 'toast', role: 'status' }, h('p', {}, 'Ready to play offline.'), h('div', { class: 'toast-actions' }, h('button', { type: 'button', onclick: close() }, 'OK')));
    this.toast = toast;
    document.body.append(toast);
    if (message === 'offline') {
      this.pending = null;
      this.toastTimer = window.setTimeout(() => this.hideToast(), 8000);
    }
  }

  private hideToast(): void {
    clearTimeout(this.toastTimer);
    this.toast?.remove();
    this.toast = null;
  }

  private applyUpdate(): void {
    const worker = this.waiting;
    if (!worker) return;
    this.reloadOnControllerChange = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  }
}

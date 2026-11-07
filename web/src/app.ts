import { Sounds } from './audio';
import type { LayoutKind } from './layout';
import type { Deck } from './manifest';
import type { ScanResult } from './imports';
import type { Library } from './library';
import { browserStorage, defaultPreferences, loadPreferences, parsePreferences, savePreferences, withValidDeck, type Preferences } from './preferences';
import { Pwa } from './pwa';
import { randomSeed } from './rng';
import { createGameplayScreen, type GameplayScreen } from './screens/gameplay';
import { createGuideScreen } from './screens/guide';
import { createImportScreen } from './screens/import';
import { createLibraryScreen } from './screens/library';
import { createResultsScreen, type RoundResult } from './screens/results';
import { createSetupScreen } from './screens/setup';

/** Settings chosen on the setup screen for one round. */
export interface RoundConfig {
  players: number;
  names: string[];
  domain: string;
  style: string;
  complexity: string;
  deckId: string;
  pairs: number;
  layout: LayoutKind;
  extraTurn: boolean;
}

export interface Screen {
  element: HTMLElement;
  /** Shown before the app name in the window title, e.g. "Deck library". */
  title?: string;
  /** Called once the element is in the document and has a size. */
  mounted?(): void;
  destroy?(): void;
}

/** Setup is the base history entry; every other screen shares one entry above it. */
type HistoryScreen = 'setup' | 'away';

/** Navigation, preferences and shared services (main.gd in the Godot edition). */
export class App {
  readonly library: Library;
  readonly sounds = new Sounds();
  /** Service worker updates wait while a round is in progress. */
  readonly pwa = new Pwa(() => this.game !== null && !this.game.finished());
  preferences: Preferences;
  game: GameplayScreen | null = null;
  private screen: Screen | null = null;
  private readonly storage = browserStorage();
  /** `?seed=` fixes every round's shuffle and layout, for tests and bug reports. */
  private readonly fixedSeed: number | null;
  private ignoreNextPop = false;
  private readonly root: HTMLElement;
  /** Most recent input: keyboard users get focus moved for them; touch users do not see stray focus rings. */
  private lastInput: 'keyboard' | 'pointer' | null = null;
  private readonly defaults: Preferences;

  constructor(root: HTMLElement, library: Library) {
    this.root = root;
    this.library = library;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.defaults = defaultPreferences(reduced);
    this.preferences = withValidDeck(loadPreferences(this.storage, this.defaults), this.decks);
    const seed = new URLSearchParams(location.search).get('seed');
    this.fixedSeed = seed !== null && /^\d+$/.test(seed) ? Number(seed) >>> 0 : null;
    addEventListener('keydown', (event) => {
      if (!event.altKey && !event.ctrlKey && !event.metaKey) this.lastInput = 'keyboard';
    }, true);
    addEventListener('pointerdown', () => (this.lastInput = 'pointer'), true);
    history.replaceState({ screen: 'setup' satisfies HistoryScreen }, '');
    addEventListener('popstate', () => this.onPopState());
  }

  /** Built-in decks followed by custom decks. */
  get decks(): Deck[] {
    return this.library.decks;
  }

  /** Whether to move focus automatically when a screen opens. */
  shouldAutoFocus(): boolean {
    if (this.lastInput !== null) return this.lastInput === 'keyboard';
    return !(globalThis.matchMedia?.('(pointer: coarse)').matches ?? false);
  }

  savePreferences(): void {
    savePreferences(this.storage, this.preferences);
  }

  roundSeed(): number {
    return this.fixedSeed ?? randomSeed();
  }

  showSetup(): void {
    this.game = null;
    this.preferences = withValidDeck(this.preferences, this.decks);
    if (this.historyScreen() === 'away') {
      // Return to the setup entry so Back from setup leaves the app as usual.
      this.ignoreNextPop = true;
      history.back();
    }
    this.mount(createSetupScreen(this));
  }

  startRound(config: RoundConfig, deck: Deck): void {
    this.preferences = { ...this.preferences, ...config, names: [...config.names] };
    this.savePreferences();
    this.leaveSetupEntry();
    const game = createGameplayScreen(this, { ...config, names: [...config.names] }, deck);
    this.game = game;
    this.mount(game);
  }

  showResults(result: RoundResult): void {
    this.game = null;
    this.mount(createResultsScreen(this, result));
  }

  showLibrary(): void {
    this.game = null;
    this.leaveSetupEntry();
    this.mount(createLibraryScreen(this));
  }

  showGuide(): void {
    this.game = null;
    this.leaveSetupEntry();
    this.mount(createGuideScreen(this));
  }

  showImport(scan: ScanResult): void {
    this.game = null;
    this.leaveSetupEntry();
    this.mount(createImportScreen(this, scan));
  }

  /**
   * Applies backed-up settings only while this device still has the default
   * settings, so a restore never overwrites choices made here.
   */
  restorePreferences(preferences: unknown): boolean {
    const unchanged = JSON.stringify(this.preferences) === JSON.stringify(withValidDeck(this.defaults, this.decks));
    if (preferences === undefined || !unchanged) return false;
    this.preferences = withValidDeck(parsePreferences(preferences, this.preferences), this.decks);
    this.savePreferences();
    return true;
  }

  private leaveSetupEntry(): void {
    if (this.historyScreen() !== 'away') history.pushState({ screen: 'away' satisfies HistoryScreen }, '');
  }

  private historyScreen(): HistoryScreen | undefined {
    return (history.state as { screen?: HistoryScreen } | null)?.screen;
  }

  /** Back button or gesture: leaving an unfinished round asks first. */
  private onPopState(): void {
    if (this.ignoreNextPop) {
      this.ignoreNextPop = false;
      return;
    }
    if (this.game && !this.game.finished()) {
      history.pushState({ screen: 'away' satisfies HistoryScreen }, '');
      this.game.requestLeave(() => this.showSetup());
      return;
    }
    if (this.historyScreen() !== 'away') {
      this.game = null;
      this.preferences = withValidDeck(this.preferences, this.decks);
      this.mount(createSetupScreen(this));
    }
  }

  private mount(next: Screen): void {
    this.screen?.destroy?.();
    this.screen = next;
    this.root.replaceChildren(next.element);
    document.documentElement.dataset.screen = next.element.dataset.screen ?? '';
    document.title = next.title ? `${next.title} · Memory Card Game` : 'Memory Card Game';
    next.mounted?.();
    // Screen-reader and keyboard users land on the new screen: when nothing in
    // it has focus yet, focus its heading (browsers draw no ring after a tap).
    if (!next.element.contains(document.activeElement)) {
      const heading = next.element.querySelector<HTMLElement>('h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
    this.pwa.screenChanged();
  }
}

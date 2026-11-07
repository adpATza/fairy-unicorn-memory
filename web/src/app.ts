import { Sounds } from './audio';
import { builtinDecks } from './decks';
import type { LayoutKind } from './layout';
import type { Deck } from './manifest';
import { browserStorage, defaultPreferences, loadPreferences, savePreferences, withValidDeck, type Preferences } from './preferences';
import { Pwa } from './pwa';
import { randomSeed } from './rng';
import { createGameplayScreen, type GameplayScreen } from './screens/gameplay';
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
  /** Called once the element is in the document and has a size. */
  mounted?(): void;
  destroy?(): void;
}

type HistoryScreen = 'setup' | 'play';

/** Navigation, preferences and shared services (main.gd in the Godot edition). */
export class App {
  readonly decks: Deck[];
  readonly deckErrors: string[];
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

  constructor(root: HTMLElement) {
    this.root = root;
    const catalogue = builtinDecks();
    this.decks = catalogue.decks;
    this.deckErrors = catalogue.errors;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.preferences = withValidDeck(loadPreferences(this.storage, defaultPreferences(reduced)), this.decks);
    const seed = new URLSearchParams(location.search).get('seed');
    this.fixedSeed = seed !== null && /^\d+$/.test(seed) ? Number(seed) >>> 0 : null;
    addEventListener('keydown', (event) => {
      if (!event.altKey && !event.ctrlKey && !event.metaKey) this.lastInput = 'keyboard';
    }, true);
    addEventListener('pointerdown', () => (this.lastInput = 'pointer'), true);
    history.replaceState({ screen: 'setup' satisfies HistoryScreen }, '');
    addEventListener('popstate', () => this.onPopState());
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
    if (this.historyScreen() === 'play') {
      // Return to the setup entry so Back from setup leaves the app as usual.
      this.ignoreNextPop = true;
      history.back();
    }
    this.mount(createSetupScreen(this));
  }

  startRound(config: RoundConfig, deck: Deck): void {
    this.preferences = { ...this.preferences, ...config, names: [...config.names] };
    this.savePreferences();
    if (this.historyScreen() !== 'play') history.pushState({ screen: 'play' satisfies HistoryScreen }, '');
    const game = createGameplayScreen(this, { ...config, names: [...config.names] }, deck);
    this.game = game;
    this.mount(game);
  }

  showResults(result: RoundResult): void {
    this.game = null;
    this.mount(createResultsScreen(this, result));
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
      history.pushState({ screen: 'play' satisfies HistoryScreen }, '');
      this.game.requestLeave(() => this.showSetup());
      return;
    }
    if (this.historyScreen() !== 'play') {
      this.game = null;
      this.mount(createSetupScreen(this));
    }
  }

  private mount(next: Screen): void {
    this.screen?.destroy?.();
    this.screen = next;
    this.root.replaceChildren(next.element);
    document.documentElement.dataset.screen = next.element.dataset.screen ?? '';
    next.mounted?.();
    this.pwa.screenChanged();
  }
}

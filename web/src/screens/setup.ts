import cardBack from '@assets/card_back.svg?url';
import icon from '@assets/icon.svg?url';
import type { App, RoundConfig, Screen } from '../app';
import { h } from '../dom';
import { recommendedMaxPairs, type LayoutKind } from '../layout';
import type { Deck } from '../manifest';
import { NAME_LENGTH } from '../preferences';
import { MIN_PAIRS } from '../session';
import { createGameFrame } from './gameplay';

const PLAYER_LABELS = ['Just me', '2 players', '3 players', '4 players'];

/** Board size the game screen would give these players on the current screen. */
export function measureBoard(players: number): { width: number; height: number } {
  const frame = createGameFrame(Array.from({ length: players }, (_, i) => `Player ${i + 1}`), 'Measuring');
  const shell = h('div', { class: 'measure', 'aria-hidden': 'true', inert: true }, frame.root);
  document.body.append(shell);
  const size = { width: frame.area.clientWidth, height: frame.area.clientHeight };
  shell.remove();
  return size;
}

/** Port of setup_screen.gd, laid out for any screen size. */
export function createSetupScreen(app: App): Screen {
  const cfg = app.preferences;
  let candidates: Deck[] = [];

  const select = (label: string, items: readonly string[] = [], selected = '') => {
    const element = h('select', { 'aria-label': label });
    fill(element, items, selected);
    return element;
  };

  // Who's playing?
  const players = select('Number of players', PLAYER_LABELS, PLAYER_LABELS[cfg.players - 1]);
  const nameFields = cfg.names.map((name, i) =>
    h('input', { type: 'text', value: name, maxlength: NAME_LENGTH, placeholder: `Player ${i + 1}`, 'aria-label': `Name for player ${i + 1}`, autocomplete: 'off', enterkeyhint: 'done' }),
  );

  // Choose your deck.
  const domains = [...new Set(app.decks.map((d) => d.domain))];
  const domain = select('Subject', domains, cfg.domain);
  const style = select('Artwork style');
  const complexity = select('Complexity');
  const deckChoice = select('Deck');

  // Round options.
  const pairInput = h('input', { type: 'number', id: 'pairs', inputmode: 'numeric', min: MIN_PAIRS, max: 30, step: 1, value: cfg.pairs, 'aria-describedby': 'pair-advice' });
  const fewer = h('button', { type: 'button', class: 'step', 'aria-label': 'Fewer pairs' }, '−');
  const more = h('button', { type: 'button', class: 'step', 'aria-label': 'More pairs' }, '+');
  const layout = h('select', { id: 'layout' });
  fill(layout, ['Scattered', 'Grid'], cfg.layout === 'grid' ? 'Grid' : 'Scattered');
  const extra = h('input', { type: 'checkbox', checked: cfg.extraTurn });
  const advice = h('p', { class: 'pair-advice', id: 'pair-advice', 'aria-live': 'polite' });
  const start = h('button', { type: 'submit', class: 'primary large' }, 'Let’s play');

  // Preferences that apply immediately.
  const sound = h('input', { type: 'checkbox', checked: cfg.sound });
  const motion = h('input', { type: 'checkbox', checked: cfg.reducedMotion });

  const sample = h('div', { class: 'sample-body' });

  // Shown only where the browser offers installation (Chromium browsers).
  const install = h('button', { type: 'button', class: 'install' }, 'Install app');
  const actions = h('nav', { class: 'setup-actions', 'aria-label': 'App' }, install);
  const updateInstall = () => (actions.hidden = !app.pwa.canInstall());
  install.addEventListener('click', () => void app.pwa.install());

  const form = h(
    'form',
    { class: 'setup-form', novalidate: true },
    h('section', { class: 'field-group' }, h('h2', {}, 'Who’s playing?'), h('div', { class: 'players' }, players, h('div', { class: 'names' }, ...nameFields))),
    h('section', { class: 'field-group' }, h('h2', {}, 'Choose your deck'), h('div', { class: 'deck-filters' }, domain, style, complexity), deckChoice),
    h(
      'section',
      { class: 'round-options' },
      h('div', { class: 'option' }, h('label', { for: 'pairs' }, 'Pairs'), h('div', { class: 'stepper' }, fewer, pairInput, more)),
      h('div', { class: 'option' }, h('label', { for: 'layout' }, 'Card layout'), layout),
      h('label', { class: 'check extra' }, extra, h('span', {}, 'Another turn after a match')),
    ),
    advice,
    h('div', { class: 'start' }, start, h('p', { class: 'muted' }, 'Pick two. Find a match. Go again!')),
  );

  const element = h(
    'div',
    { class: 'screen setup', 'data-screen': 'setup' },
    h(
      'main',
      { class: 'setup-main' },
      h('header', { class: 'brand' }, h('img', { src: icon, alt: '', class: 'brand-icon' }), h('h1', {}, 'Memory ', h('br'), 'Card Game')),
      h('p', { class: 'tagline' }, 'Big colours. Sharp eyes. Great matches.'),
      form,
    ),
    actions,
    h('aside', { class: 'sample', 'aria-label': 'Deck preview' }, sample),
    h('div', { class: 'setup-prefs' }, h('label', { class: 'check' }, sound, 'Sound'), h('label', { class: 'check' }, motion, 'Reduced motion')),
  );

  function selectedDeck(): Deck | undefined {
    return candidates[deckChoice.selectedIndex];
  }

  function showNames(): void {
    nameFields.forEach((field, i) => (field.hidden = i > players.selectedIndex));
  }

  function filterStyles(): void {
    fill(style, unique(app.decks.filter((d) => d.domain === domain.value).map((d) => d.style)), cfg.style);
    filterComplexity();
  }

  function filterComplexity(): void {
    fill(complexity, unique(app.decks.filter((d) => d.domain === domain.value && d.style === style.value).map((d) => d.complexity)), cfg.complexity);
    filterDecks();
  }

  function filterDecks(): void {
    candidates = app.decks.filter((d) => d.domain === domain.value && d.style === style.value && d.complexity === complexity.value);
    fill(
      deckChoice,
      candidates.map((d) => d.title),
      '',
    );
    deckChoice.selectedIndex = Math.max(0, candidates.findIndex((d) => d.id === cfg.deckId));
    deckChanged();
  }

  function deckChanged(): void {
    const deck = selectedDeck();
    if (!deck) return;
    pairInput.max = String(deck.images.length);
    setPairs(Number(pairInput.value));
    renderSample(deck);
    refreshRecommendation();
  }

  function setPairs(value: number): void {
    const max = Number(pairInput.max);
    const next = Number.isFinite(value) ? Math.min(max, Math.max(MIN_PAIRS, Math.round(value))) : cfg.pairs;
    pairInput.value = String(next);
    fewer.disabled = next <= MIN_PAIRS;
    more.disabled = next >= max;
    renderAdvice();
  }

  let recommended = { current: 30, grid: 30 };
  let measured = false;

  function refreshRecommendation(): void {
    const deck = selectedDeck();
    if (!deck || !element.isConnected) return;
    const board = measureBoard(players.selectedIndex + 1);
    measured = board.width >= 60 && board.height >= 60;
    if (measured) {
      const kind: LayoutKind = layout.value === 'Grid' ? 'grid' : 'scattered';
      const current = recommendedMaxPairs(board.width, board.height, kind, deck.images.length);
      recommended = { current, grid: kind === 'grid' ? current : recommendedMaxPairs(board.width, board.height, 'grid', deck.images.length) };
    }
    renderAdvice();
  }

  function renderAdvice(): void {
    const chosen = Number(pairInput.value);
    advice.classList.toggle('warning', measured && chosen > recommended.current);
    if (!measured) {
      advice.textContent = '';
    } else if (chosen <= recommended.current) {
      advice.textContent = `Recommended up to ${recommended.current} pairs on this screen.`;
    } else {
      const better = layout.value !== 'Grid' && chosen <= recommended.grid ? 'Grid layout fits them at a comfortable size.' : 'A larger screen, or turning it sideways, can give bigger cards.';
      advice.textContent = `Cards will be small on this screen: up to ${recommended.current} pairs is recommended. ${better} Every card still fits without scrolling.`;
    }
  }

  function renderSample(deck: Deck): void {
    const picture = (index: number) => deck.images[index % deck.images.length]!.url;
    sample.replaceChildren(
      h('p', { class: 'sample-title' }, 'Ready, set, match!'),
      h(
        'div',
        { class: 'sample-cards', 'aria-hidden': 'true' },
        h('span', { class: 'blob yellow' }),
        h('span', { class: 'blob teal' }),
        h('img', { class: 'sample-back', src: cardBack, alt: '' }),
        h('span', { class: 'sample-front orange' }, h('img', { src: picture(4), alt: '' })),
        h('span', { class: 'sample-front' }, h('img', { src: picture(0), alt: '' })),
      ),
      h('p', { class: 'sample-deck' }, deck.title),
      h('p', { class: 'sample-meta' }, `${deck.style} artwork  /  ${deck.complexity.toLowerCase()}`),
      h('p', { class: 'sample-meta' }, `${deck.images.length} bold pictures to match`),
    );
  }

  function config(): RoundConfig {
    return {
      players: players.selectedIndex + 1,
      names: nameFields.map((field, i) => field.value.trim() || `Player ${i + 1}`),
      domain: domain.value,
      style: style.value,
      complexity: complexity.value,
      deckId: selectedDeck()?.id ?? cfg.deckId,
      pairs: Number(pairInput.value),
      layout: layout.value === 'Grid' ? 'grid' : 'scattered',
      extraTurn: extra.checked,
    };
  }

  /** Remember choices as they change, so closing the app keeps them. */
  function remember(): void {
    app.preferences = { ...app.preferences, ...config() };
    app.savePreferences();
  }

  players.addEventListener('change', () => {
    showNames();
    refreshRecommendation();
    remember();
  });
  domain.addEventListener('change', () => {
    filterStyles();
    remember();
  });
  style.addEventListener('change', () => {
    cfg.style = style.value;
    filterComplexity();
    remember();
  });
  complexity.addEventListener('change', () => {
    cfg.complexity = complexity.value;
    filterDecks();
    remember();
  });
  deckChoice.addEventListener('change', () => {
    deckChanged();
    remember();
  });
  layout.addEventListener('change', () => {
    refreshRecommendation();
    remember();
  });
  extra.addEventListener('change', remember);
  for (const field of nameFields) field.addEventListener('change', remember);
  pairInput.addEventListener('change', () => {
    setPairs(Number.parseInt(pairInput.value, 10));
    remember();
  });
  pairInput.addEventListener('input', renderAdvice);
  fewer.addEventListener('click', () => {
    setPairs(Number(pairInput.value) - 1);
    remember();
  });
  more.addEventListener('click', () => {
    setPairs(Number(pairInput.value) + 1);
    remember();
  });
  sound.addEventListener('change', () => {
    app.preferences.sound = sound.checked;
    app.savePreferences();
  });
  motion.addEventListener('change', () => {
    app.preferences.reducedMotion = motion.checked;
    app.savePreferences();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const deck = selectedDeck();
    if (!deck) return;
    setPairs(Number.parseInt(pairInput.value, 10));
    app.startRound(config(), deck);
  });

  // Rotating or resizing changes how many pairs fit comfortably.
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshRecommendation, 150);
  };

  showNames();
  filterStyles();
  updateInstall();
  const stopInstallUpdates = app.pwa.onInstallChange(updateInstall);

  return {
    element,
    mounted() {
      addEventListener('resize', onResize);
      refreshRecommendation();
      if (app.shouldAutoFocus()) start.focus({ preventScroll: true });
    },
    destroy() {
      stopInstallUpdates();
      removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    },
  };
}

function fill(element: HTMLSelectElement, items: readonly string[], preferred: string): void {
  element.replaceChildren(...items.map((item) => h('option', { value: item }, item)));
  const index = items.indexOf(preferred);
  element.selectedIndex = index >= 0 ? index : 0;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

import type { App, RoundConfig, Screen } from '../app';
import { anyDialogOpen, confirmAction } from '../dialogs';
import { formatTime, h, pairs } from '../dom';
import { fitTransform, generate, type Rect } from '../layout';
import type { Deck } from '../manifest';
import { MemorySession } from '../session';

/** The game screen's static structure, also used to measure the board in setup. */
export interface GameFrame {
  root: HTMLElement;
  area: HTMLElement;
  stage: HTMLElement;
  turn: HTMLElement;
  scores: { item: HTMLElement; count: HTMLElement; unit: HTMLElement }[];
  remaining: HTMLElement;
  hint: HTMLElement;
  clock: HTMLElement;
  live: HTMLElement;
  pauseButton: HTMLButtonElement;
  soundButton: HTMLButtonElement;
  setupButton: HTMLButtonElement;
  newRoundButton: HTMLButtonElement;
}

export function createGameFrame(names: readonly string[], subtitle: string): GameFrame {
  const scores = names.map((name) => {
    const count = h('span', { class: 'score-count' }, '0');
    const unit = h('span', { class: 'score-unit' }, ' pairs');
    const item = h('li', { class: 'score', title: name }, h('span', { class: 'score-name' }, name), h('span', { class: 'score-value' }, count, unit));
    return { item, count, unit };
  });
  const turn = h('p', { class: 'turn' });
  const remaining = h('p', { class: 'remaining' });
  const hint = h('p', { class: 'hint' });
  const clock = h('p', { class: 'clock' });
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const pauseButton = h('button', { type: 'button', class: 'pause-button' }, 'Pause');
  const soundButton = h('button', { type: 'button', class: 'sound-button' });
  const setupButton = h('button', { type: 'button', class: 'wide-only' }, 'Setup');
  const newRoundButton = h('button', { type: 'button', class: 'wide-only' }, 'New round');
  const stage = h('div', { class: 'stage' });
  const area = h('div', { class: 'board-area' }, stage);
  const root = h(
    'div',
    { class: 'screen game', 'data-screen': 'game' },
    h(
      'header',
      { class: 'hud' },
      h('div', { class: 'hud-title' }, h('h1', {}, 'Memory Card Game'), h('p', { class: 'deck-line' }, subtitle)),
      turn,
      names.length > 1 ? h('ol', { class: 'scores', 'aria-label': 'Scores' }, ...scores.map((s) => s.item)) : null,
      remaining,
      h('div', { class: 'hud-actions' }, pauseButton, soundButton),
    ),
    h('main', { class: 'board', 'aria-label': 'Cards' }, area),
    h('footer', { class: 'hud-foot' }, setupButton, newRoundButton, hint, clock),
    live,
  );
  return { root, area, stage, turn, scores, remaining, hint, clock, live, pauseButton, soundButton, setupButton, newRoundButton };
}

export interface GameplayScreen extends Screen {
  session: MemorySession;
  finished(): boolean;
  setPaused(value: boolean): void;
  requestLeave(action: () => void, title?: string, detail?: string, accept?: string): void;
}

interface CardView {
  button: HTMLButtonElement;
  image: HTMLImageElement;
  revealed: boolean;
}

export function createGameplayScreen(app: App, config: RoundConfig, deck: Deck): GameplayScreen {
  const names = config.names.slice(0, config.players);
  const layoutLabel = config.layout === 'grid' ? 'Grid' : 'Scattered';
  const frame = createGameFrame(names, `${deck.title}  /  ${deck.complexity}  /  ${layoutLabel}`);
  const session = new MemorySession();
  const seed = app.roundSeed();
  session.start(
    deck.images.map((image) => ({ pairId: image.pairId, image: image.url })),
    config.pairs,
    names,
    config.extraTurn,
    seed,
  );

  let cards: CardView[] = [];
  /** Card indices in reading order (top to bottom, then left to right). */
  let order: number[] = [];
  let rects: Rect[] = [];
  let base = { width: 0, height: 0 };
  let frameRequest = 0;
  let lastTime: number | null = null;
  let lastAnnouncement = '';
  let pauseDialog: HTMLDialogElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let destroyed = false;
  const preload: HTMLImageElement[] = [];
  const cleanups: (() => void)[] = [];

  const reducedMotion = () => app.preferences.reducedMotion || session.paused;
  const updateSoundLabel = () => (frame.soundButton.textContent = app.preferences.sound ? 'Sound on' : 'Sound off');
  const play = (kind: 'flip' | 'match' | 'miss') => {
    if (app.preferences.sound) app.sounds.play(kind);
  };

  function buildBoard(): void {
    const width = Math.max(frame.area.clientWidth, 60);
    const height = Math.max(frame.area.clientHeight, 60);
    base = { width, height };
    rects = generate({ count: session.cards.length, layout: config.layout, seed, width, height });
    frame.stage.style.width = `${width}px`;
    frame.stage.style.height = `${height}px`;
    const side = Math.min(...rects.map((r) => r.w));
    order = rects.map((_, i) => i).sort((a, b) => Math.floor(rects[a]!.y / side) - Math.floor(rects[b]!.y / side) || rects[a]!.x - rects[b]!.x);
    cards = session.cards.map((_, i) => {
      const image = h('img', { alt: '', draggable: 'false' });
      const button = h('button', { type: 'button', class: 'card' }, image);
      const rect = rects[i]!;
      button.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px`;
      button.addEventListener('click', () => {
        if (session.select(i)) play('flip');
      });
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      return { button, image, revealed: false };
    });
    frame.stage.replaceChildren(...order.map((i) => cards[i]!.button));
    order.forEach((i, position) => (cards[i]!.button.dataset.label = String(position + 1)));
    // Warm the cache so a revealed picture appears at once.
    for (const url of new Set(session.cards.map((card) => card.image))) {
      const img = new Image();
      img.src = url;
      preload.push(img);
    }
    fit();
  }

  /** Resizing scales the whole board; cards keep their positions. */
  function fit(): void {
    if (!base.width) return;
    const t = fitTransform(base.width, base.height, frame.area.clientWidth, frame.area.clientHeight);
    frame.stage.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
  }

  function updateCard(index: number): void {
    const view = cards[index]!;
    const card = session.cards[index]!;
    const show = session.visibleCard(index);
    const { button, image } = view;
    button.disabled = card.matched;
    button.classList.toggle('removed', card.matched);
    button.classList.toggle('revealed', show);
    button.setAttribute('aria-label', `${show ? 'Revealed' : 'Face-down'} card ${button.dataset.label}`);
    if (show) image.src = card.image;
    else image.removeAttribute('src');
    if (show !== view.revealed && !card.matched && !reducedMotion()) {
      button.classList.remove('flip');
      void button.offsetWidth;
      button.classList.add('flip');
    }
    view.revealed = show;
  }

  function hintText(): string {
    if (session.state === 'second') return 'Now choose a second card.';
    if (session.state === 'resolving') return session.isMatch() ? 'Match! Nice work.' : 'Take a moment to remember these two.';
    return 'Choose two cards and find a pair.';
  }

  function render(): void {
    const turn = config.players > 1 ? `${session.names[session.activePlayer]}’s turn` : 'Take your time. Find a pair.';
    frame.turn.classList.toggle('solo', config.players === 1);
    if (config.players > 1) frame.turn.textContent = turn;
    else if (!frame.turn.firstChild) frame.turn.append(h('span', { class: 'turn-extra' }, 'Take your time. '), 'Find a pair.');
    frame.remaining.textContent = `${pairs(session.remaining)} left`;
    frame.scores.forEach((score, i) => {
      score.count.textContent = String(session.scores[i]);
      score.unit.textContent = session.scores[i] === 1 ? ' pair' : ' pairs';
      score.item.classList.toggle('active', i === session.activePlayer);
      if (i === session.activePlayer) score.item.setAttribute('aria-current', 'true');
      else score.item.removeAttribute('aria-current');
    });
    cards.forEach((_, i) => updateCard(i));
    const hint = hintText();
    frame.hint.textContent = hint;
    const announcement = config.players > 1 && session.state === 'first' ? `${hint} ${turn}` : hint;
    if (announcement !== lastAnnouncement && !session.paused) {
      frame.live.textContent = announcement;
      lastAnnouncement = announcement;
    }
    updateClock();
  }

  function updateClock(): void {
    frame.clock.textContent = `${session.attempts} ${session.attempts === 1 ? 'attempt' : 'attempts'}   ${formatTime(session.elapsed)}`;
  }

  function loop(time: number): void {
    if (destroyed) return;
    // Long gaps (a hidden tab) are capped; the round also pauses when hidden.
    if (lastTime !== null) session.tick(Math.min((time - lastTime) / 1000, 0.5));
    lastTime = time;
    updateClock();
    frameRequest = requestAnimationFrame(loop);
  }

  function setPaused(value: boolean): void {
    if (session.state === 'finished' || destroyed) return;
    if (value === session.paused) return;
    session.setPaused(value);
    if (value) openPauseDialog();
    else closePauseDialog();
  }

  function openPauseDialog(): void {
    const motion = h('input', { type: 'checkbox', checked: app.preferences.reducedMotion });
    const sound = h('input', { type: 'checkbox', checked: app.preferences.sound });
    motion.addEventListener('change', () => {
      app.preferences.reducedMotion = motion.checked;
      app.savePreferences();
    });
    sound.addEventListener('change', () => {
      app.preferences.sound = sound.checked;
      app.savePreferences();
      updateSoundLabel();
    });
    const dialog = h(
      'dialog',
      { class: 'dialog pause', 'aria-labelledby': 'pause-title' },
      h('h2', { id: 'pause-title' }, 'Time out!'),
      h('p', { class: 'pre-line' }, 'Cards hidden. Clock stopped.\nReady when you are.'),
      h('button', { type: 'button', class: 'primary', autofocus: true, onclick: () => setPaused(false) }, 'Continue playing'),
      h('div', { class: 'pause-options' }, h('label', { class: 'check' }, sound, 'Sound'), h('label', { class: 'check' }, motion, 'Reduced motion')),
      h('div', { class: 'pause-actions' }, h('button', { type: 'button', onclick: requestNewRound }, 'New round'), h('button', { type: 'button', onclick: () => requestLeave(() => app.showSetup()) }, 'Return to setup')),
    );
    // Escape closes the dialog; treat any close we did not ask for as "continue".
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (pauseDialog === dialog) {
        pauseDialog = null;
        setPaused(false);
      }
    });
    pauseDialog = dialog;
    document.body.append(dialog);
    dialog.showModal();
  }

  function closePauseDialog(): void {
    const dialog = pauseDialog;
    pauseDialog = null;
    dialog?.close();
  }

  function requestLeave(action: () => void, title = 'Leave this round?', detail = 'Your current round will be lost. Your decks and settings are saved.', accept = 'Leave game'): void {
    const wasPaused = session.paused;
    setPaused(true);
    confirmAction({ title, detail, accept, onAccept: action, onCancel: () => setPaused(wasPaused) });
  }

  function requestNewRound(): void {
    requestLeave(() => app.startRound(config, deck), 'Start a new round?', 'Your current round will be lost. The new round has a fresh shuffle.', 'New round');
  }

  /** Arrow keys move focus to the nearest card in that direction (_move_focus). */
  function moveFocus(key: string): void {
    const current = cards.findIndex((card) => card.button === document.activeElement);
    const available = (i: number) => !session.cards[i]!.matched;
    if (current < 0) {
      const first = order.find(available);
      if (first !== undefined) cards[first]!.button.focus();
      return;
    }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key]!;
    const centre = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2];
    const [ox, oy] = centre(rects[current]!);
    let best = -1;
    let bestCost = Infinity;
    for (let i = 0; i < cards.length; i++) {
      if (i === current || !available(i)) continue;
      const [cx, cy] = centre(rects[i]!);
      const dx = cx! - ox!;
      const dy = cy! - oy!;
      const forward = dx * direction[0]! + dy * direction[1]!;
      if (forward <= 1) continue;
      const lateral = Math.abs(dx * direction[1]! - dy * direction[0]!);
      const cost = forward + lateral * 3;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    if (best >= 0) cards[best]!.button.focus();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (anyDialogOpen() || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      setPaused(!session.paused);
      event.preventDefault();
    } else if (!session.paused && event.key.startsWith('Arrow') && !event.altKey && !event.ctrlKey && !event.metaKey) {
      moveFocus(event.key);
      event.preventDefault();
    }
  }

  function listen<K extends keyof WindowEventMap>(target: Window, type: K, handler: (event: WindowEventMap[K]) => void): void;
  function listen<K extends keyof DocumentEventMap>(target: Document, type: K, handler: (event: DocumentEventMap[K]) => void): void;
  function listen(target: EventTarget, type: string, handler: (event: never) => void): void {
    target.addEventListener(type, handler as EventListener);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener));
  }

  cleanups.push(session.on('changed', render));
  cleanups.push(
    session.on('pairResolved', (matched, indices) => {
      play(matched ? 'match' : 'miss');
      // Keep keyboard focus on the board when the focused card disappears.
      if (matched && indices.some((i) => cards[i]!.button === document.activeElement)) {
        const next = order.find((i) => !session.cards[i]!.matched);
        if (next !== undefined) cards[next]!.button.focus();
      }
    }),
  );
  cleanups.push(
    session.on('completed', () => {
      // A restart or leave in the same frame invalidates this screen's result.
      setTimeout(() => {
        if (destroyed || app.game !== screen) return;
        app.showResults({ names: session.names, scores: session.scores, winners: session.winners(), attempts: session.attempts, elapsed: session.elapsed, config, deck });
      });
    }),
  );

  frame.pauseButton.addEventListener('click', () => setPaused(true));
  frame.soundButton.addEventListener('click', () => {
    app.preferences.sound = !app.preferences.sound;
    app.savePreferences();
    updateSoundLabel();
  });
  frame.setupButton.addEventListener('click', () => requestLeave(() => app.showSetup()));
  frame.newRoundButton.addEventListener('click', requestNewRound);
  updateSoundLabel();

  const screen: GameplayScreen = {
    element: frame.root,
    title: 'Playing',
    session,
    finished: () => session.state === 'finished',
    setPaused,
    requestLeave,
    mounted() {
      buildBoard();
      render();
      resizeObserver = new ResizeObserver(fit);
      resizeObserver.observe(frame.area);
      listen(document, 'keydown', onKeyDown);
      // Losing focus or hiding the app pauses, as NOTIFICATION_APPLICATION_FOCUS_OUT does.
      listen(document, 'visibilitychange', () => {
        if (document.visibilityState === 'hidden') setPaused(true);
      });
      listen(window, 'blur', () => setPaused(true));
      listen(window, 'pagehide', () => setPaused(true));
      listen(window, 'beforeunload', (event) => {
        if (session.state !== 'finished') event.preventDefault();
      });
      frameRequest = requestAnimationFrame(loop);
      const first = order[0];
      if (first !== undefined && app.shouldAutoFocus()) cards[first]!.button.focus({ preventScroll: true });
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameRequest);
      resizeObserver?.disconnect();
      for (const cleanup of cleanups) cleanup();
      const dialog = pauseDialog;
      pauseDialog = null;
      dialog?.close();
    },
  };
  return screen;
}

import cardBack from '@assets/card_back.svg?url';
import { cardSide, fitTransform, generate, recommendedMaxPairs, type LayoutKind } from './layout';
import { randomSeed } from './rng';
import { MAX_PAIRS, MIN_PAIRS } from './session';
import './styles.css';

// Phase 1 development page: a fitted board of face-down cards.
// Query parameters: pairs (2–30), layout (scattered | grid), seed.

const params = new URLSearchParams(location.search);
const requested = Number.parseInt(params.get('pairs') ?? '', 10);
const pairs = Number.isInteger(requested) ? Math.min(MAX_PAIRS, Math.max(MIN_PAIRS, requested)) : 12;
const layout: LayoutKind = params.get('layout') === 'grid' ? 'grid' : 'scattered';
let seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : randomSeed();

const area = document.querySelector<HTMLElement>('.board-area')!;
const status = document.querySelector<HTMLElement>('#status')!;
const stage = document.createElement('div');
stage.className = 'stage';
area.append(stage);

/** Board size when this round's layout was generated. */
let base = { width: 0, height: 0 };

function build(): void {
  const width = area.clientWidth;
  const height = area.clientHeight;
  base = { width, height };
  const rects = generate({ count: pairs * 2, layout, seed, width, height });
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.replaceChildren(
    ...rects.map((rect, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.setAttribute('aria-label', `Face-down card ${i + 1}`);
      card.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px;background-image:url("${cardBack}")`;
      return card;
    }),
  );
  fit();
  const recommended = recommendedMaxPairs(width, height, layout);
  status.textContent = `${pairs} pairs · ${layout} · ${Math.floor(cardSide(rects))} px cards · recommended up to ${recommended} pairs on this screen`;
}

/** Resizing scales the whole board; cards keep their positions. */
function fit(): void {
  if (!base.width) return;
  const t = fitTransform(base.width, base.height, area.clientWidth, area.clientHeight);
  stage.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
}

new ResizeObserver(fit).observe(area);
document.querySelector('#reshuffle')!.addEventListener('click', () => {
  seed = randomSeed();
  build();
});
build();

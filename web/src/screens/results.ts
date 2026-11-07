import type { App, RoundConfig, Screen } from '../app';
import { formatTime, h, pairs } from '../dom';
import type { Deck } from '../manifest';

export interface RoundResult {
  names: string[];
  scores: number[];
  winners: string[];
  attempts: number;
  elapsed: number;
  config: RoundConfig;
  deck: Deck;
}

/** Port of results_screen.gd. */
export function createResultsScreen(app: App, result: RoundResult): Screen {
  const best = Math.max(...result.scores);
  const playAgain = h('button', { type: 'button', class: 'primary large', onclick: () => app.startRound(result.config, result.deck) }, 'Play again');
  const summary =
    result.names.length === 1
      ? h(
          'div',
          { class: 'result-card' },
          h('h2', {}, 'You matched them all!'),
          h('p', { class: 'result-time' }, formatTime(result.elapsed)),
          h('p', { class: 'result-detail' }, `${pairs(result.scores[0]!)} found in ${result.attempts} ${result.attempts === 1 ? 'attempt' : 'attempts'}`),
          h('p', { class: 'muted' }, 'New shuffle. New challenge. Ready?'),
        )
      : h(
          'div',
          { class: 'result-card' },
          h('h2', {}, result.winners.length === 1 ? 'We have a winner!' : 'It’s a tie!'),
          h('p', { class: 'accent' }, 'Winning players are marked with a star.'),
          h(
            'ol',
            { class: 'result-scores' },
            ...result.names.map((name, i) =>
              h(
                'li',
                { class: result.scores[i] === best ? 'winner' : '' },
                h('span', { class: 'star', 'aria-label': result.scores[i] === best ? 'Winner' : null }, result.scores[i] === best ? '★' : ''),
                h('span', { class: 'result-name', title: name }, name),
                h('span', { class: 'result-score' }, pairs(result.scores[i]!)),
              ),
            ),
          ),
        );
  const element = h(
    'div',
    { class: 'screen results', 'data-screen': 'results' },
    h('main', { class: 'results-main' }, h('h1', {}, 'Every pair found'), h('p', { class: 'tagline' }, 'Sharp eyes. Great game!'), summary, h('div', { class: 'result-actions' }, playAgain, h('button', { type: 'button', class: 'large', onclick: () => app.showSetup() }, 'Return to setup'))),
  );
  return {
    element,
    mounted: () => {
      if (app.shouldAutoFocus()) playAgain.focus({ preventScroll: true });
    },
  };
}

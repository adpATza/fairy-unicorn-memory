import type { LayoutKind } from './layout';
import type { Deck } from './manifest';
import { MAX_PAIRS, MAX_PLAYERS, MIN_PAIRS } from './session';

/** Same settings as preferences.cfg in the Godot edition. */
export interface Preferences {
  players: number;
  names: string[];
  domain: string;
  style: string;
  complexity: string;
  deckId: string;
  pairs: number;
  layout: LayoutKind;
  extraTurn: boolean;
  sound: boolean;
  reducedMotion: boolean;
}

export const STORAGE_KEY = 'memory-card-game/preferences/v1';
export const NAME_LENGTH = 18;
export const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export function defaultPreferences(reducedMotion = false): Preferences {
  return {
    players: 1,
    names: [...DEFAULT_NAMES],
    domain: 'Mix & Match',
    style: 'Illustrated',
    complexity: 'Easy',
    deckId: 'mix_easy',
    pairs: 12,
    layout: 'scattered',
    extraTurn: true,
    sound: true,
    reducedMotion,
  };
}

/**
 * Accepts each stored value only when it has the default's type, then clamps
 * ranges, as load_preferences does in scripts/main.gd.
 */
export function parsePreferences(raw: unknown, defaults: Preferences): Preferences {
  const result: Preferences = { ...defaults, names: [...defaults.names] };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return result;
  const stored = raw as Record<string, unknown>;
  const target = result as unknown as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof Preferences)[]) {
    const value = stored[key];
    const fallback = defaults[key];
    if (Array.isArray(fallback)) {
      if (Array.isArray(value) && value.length === MAX_PLAYERS && value.every((name) => typeof name === 'string')) {
        target[key] = value.map((name: string) => name.slice(0, NAME_LENGTH));
      }
    } else if (typeof value === typeof fallback && (typeof value !== 'number' || Number.isFinite(value))) {
      target[key] = value;
    }
  }
  result.players = clampInteger(result.players, 1, MAX_PLAYERS);
  result.pairs = clampInteger(result.pairs, MIN_PAIRS, MAX_PAIRS);
  if (result.layout !== 'scattered' && result.layout !== 'grid') result.layout = defaults.layout;
  return result;
}

export function loadPreferences(storage: Storage | null, defaults: Preferences): Preferences {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return parsePreferences(text ? JSON.parse(text) : null, defaults);
  } catch {
    return parsePreferences(null, defaults);
  }
}

export function savePreferences(storage: Storage | null, preferences: Preferences): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
    return storage !== null;
  } catch {
    return false;
  }
}

/** Falls back to the first deck when the saved one is gone (_validate_deck_preference). */
export function withValidDeck(preferences: Preferences, decks: readonly Deck[]): Preferences {
  const deck = decks.find((d) => d.id === preferences.deckId) ?? decks[0];
  if (!deck) return preferences;
  return {
    ...preferences,
    deckId: deck.id,
    domain: deck.domain,
    style: deck.style,
    complexity: deck.complexity,
    pairs: Math.min(preferences.pairs, deck.images.length),
  };
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** localStorage, or null when the browser blocks it. */
export function browserStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

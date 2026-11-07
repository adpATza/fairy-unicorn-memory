type Child = Node | string | null | undefined | false;
type Attributes = Record<string, string | number | boolean | null | undefined | ((event: Event) => void)>;

/**
 * Creates an element. `class` sets className, `on*` functions become event
 * listeners, `true` sets an empty attribute, and false/null/undefined skip it.
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attributes: Attributes = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') element.className = String(value);
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  element.append(...children.filter((child): child is Node | string => child !== null && child !== undefined && child !== false));
  return element;
}

/** Plural helper for "1 pair" / "3 pairs". */
export function pairs(count: number): string {
  return `${count} ${count === 1 ? 'pair' : 'pairs'}`;
}

export function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

let nextId = 0;
export function uniqueId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

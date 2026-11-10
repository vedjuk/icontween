/**
 * The canvas's keyboard path (decision 021). With the canvas focused:
 *
 * - `]` / `[`: next / previous point of the selected element (the first element when
 *   none is selected).
 * - Shift + `]` / `[`: next / previous element.
 * - Arrow keys: nudge the selected point, or the element when no point is selected
 *   (0.1, or 1 with Shift).
 * - Esc: one level back (point → element → nothing).
 *
 * Kept free of React and the store so it can be tested on its own.
 */

export type CanvasKeyAction =
  | { type: 'nudge'; dx: number; dy: number }
  | { type: 'point'; step: 1 | -1 }
  | { type: 'element'; step: 1 | -1 }
  | { type: 'back' };

type KeyInfo = Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey'>;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Small and large nudge, in viewBox units. */
export const NUDGE = { small: 0.1, large: 1 } as const;

/** What a key does on the canvas, or null when the canvas leaves it alone. */
export function canvasKeyAction(e: KeyInfo): CanvasKeyAction | null {
  // Shortcuts with ⌘, Ctrl or Alt (undo, browser keys) are someone else's.
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === 'Escape') return { type: 'back' };
  const arrow = ARROWS[e.key];
  if (arrow) {
    const step = e.shiftKey ? NUDGE.large : NUDGE.small;
    return { type: 'nudge', dx: arrow[0] * step, dy: arrow[1] * step };
  }
  // By key, and by the physical key for layouts that put brackets elsewhere.
  const next = e.key === ']' || e.key === '}' || e.code === 'BracketRight';
  const previous = e.key === '[' || e.key === '{' || e.code === 'BracketLeft';
  if (!next && !previous) return null;
  const step = next ? 1 : -1;
  return e.shiftKey ? { type: 'element', step } : { type: 'point', step };
}

/** The next index in a list that wraps around; -1 (nothing selected) starts at either end. */
export function cycleIndex(current: number, length: number, step: 1 | -1): number {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return step > 0 ? 0 : length - 1;
  return (current + step + length) % length;
}

/**
 * Whether canvas keys apply where focus is: on the canvas, or nowhere in particular (the
 * page itself). Anywhere else, arrows and Esc keep their usual jobs: scrolling, moving
 * through a list, closing a dialog.
 */
export function isCanvasKeyTarget(
  target: { closest?: (selector: string) => unknown } | null,
  body: unknown,
): boolean {
  if (target === null || target === body) return true;
  return Boolean(target.closest?.('.canvas'));
}

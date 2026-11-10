/**
 * Undo/redo as a stack of snapshots. Edits replace the animation rather than mutate it,
 * so a snapshot is just a reference to the previous value, and the stack stays cheap.
 *
 * Rapid edits of the same thing (a point drag, a slider, arrow-key nudges, typing a
 * number) share a merge key and become one undo step.
 */

export interface History<T> {
  /** Older snapshots, oldest first. */
  past: T[];
  /** Snapshots undone, the next one to redo last. */
  future: T[];
  /** Merge key and time of the last recorded edit. */
  lastKey?: string;
  lastAt?: number;
}

export interface RecordOptions {
  /** Edits with the same key merge into one step while they keep coming. */
  key?: string;
  /** Time of the edit in ms (`Date.now()` or `performance.now()`). */
  at: number;
}

/** How long a run of same-key edits stays mergeable after the last one. */
export const MERGE_WINDOW_MS = 1000;
/** Undo steps kept; older ones are dropped. */
export const HISTORY_LIMIT = 200;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/**
 * Records an edit: `before` is the snapshot the edit started from. When it continues the
 * last edit (same key, inside the merge window), the step already recorded covers it.
 * Any new edit clears redo.
 */
export function recordEdit<T>(history: History<T>, before: T, options: RecordOptions): History<T> {
  const { key, at } = options;
  const merges =
    key !== undefined &&
    key === history.lastKey &&
    history.lastAt !== undefined &&
    at - history.lastAt <= MERGE_WINDOW_MS &&
    history.past.length > 0 &&
    history.future.length === 0;
  const past = merges ? history.past : [...history.past, before].slice(-HISTORY_LIMIT);
  return { past, future: [], ...(key !== undefined && { lastKey: key, lastAt: at }) };
}

/** Steps back: returns the snapshot to restore, or null when there is nothing to undo. */
export function undo<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = history.past[history.past.length - 1];
  if (value === undefined) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, current] },
    value,
  };
}

/** Steps forward again after an undo. */
export function redo<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = history.future[history.future.length - 1];
  if (value === undefined) return null;
  return {
    history: { past: [...history.past, current], future: history.future.slice(0, -1) },
    value,
  };
}

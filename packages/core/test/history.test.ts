import { describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  MERGE_WINDOW_MS,
  emptyHistory,
  recordEdit,
  redo,
  undo,
  type History,
} from '../src';

/** Applies edits 1..n to a counter, recording each like the editor does. */
function edit(h: History<number>, value: number, key?: string, at = 0) {
  return recordEdit(h, value, { key, at });
}

describe('history', () => {
  it('undoes and redoes edits in order', () => {
    let h = emptyHistory<number>();
    h = edit(h, 0); // 0 → 1
    h = edit(h, 1); // 1 → 2
    const u1 = undo(h, 2)!;
    expect(u1.value).toBe(1);
    const u2 = undo(u1.history, 1)!;
    expect(u2.value).toBe(0);
    expect(undo(u2.history, 0)).toBeNull();
    const r1 = redo(u2.history, 0)!;
    expect(r1.value).toBe(1);
    const r2 = redo(r1.history, 1)!;
    expect(r2.value).toBe(2);
    expect(redo(r2.history, 2)).toBeNull();
  });

  it('a new edit clears redo', () => {
    let h = edit(emptyHistory<number>(), 0);
    h = undo(h, 1)!.history;
    expect(h.future).toEqual([1]);
    h = edit(h, 0);
    expect(h.future).toEqual([]);
    expect(redo(h, 5)).toBeNull();
  });

  it('merges a run of same-key edits into one step', () => {
    let h = emptyHistory<number>();
    h = edit(h, 0, 'drag', 0);
    h = edit(h, 1, 'drag', 200);
    h = edit(h, 2, 'drag', 400);
    expect(h.past).toEqual([0]);
    expect(undo(h, 3)!.value).toBe(0);
  });

  it('keeps the run open while edits keep coming, then starts a new step', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < 5; i++) h = edit(h, i, 'slider', i * (MERGE_WINDOW_MS - 1));
    expect(h.past).toEqual([0]);
    h = edit(h, 5, 'slider', 4 * (MERGE_WINDOW_MS - 1) + MERGE_WINDOW_MS + 1);
    expect(h.past).toEqual([0, 5]);
  });

  it('does not merge different keys or unkeyed edits', () => {
    let h = emptyHistory<number>();
    h = edit(h, 0, 'a', 0);
    h = edit(h, 1, 'b', 10);
    h = edit(h, 2, undefined, 20);
    h = edit(h, 3, undefined, 30);
    expect(h.past).toEqual([0, 1, 2, 3]);
  });

  it('does not merge into a step after undo', () => {
    let h = edit(emptyHistory<number>(), 0, 'drag', 0);
    h = edit(h, 1, 'drag', 10);
    h = undo(h, 2)!.history;
    h = edit(h, 0, 'drag', 20);
    expect(h.past).toEqual([0]);
    expect(h.future).toEqual([]);
  });

  it('drops the oldest steps past the limit', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = edit(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(10);
  });
});

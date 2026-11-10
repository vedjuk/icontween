import { describe, expect, it } from 'vitest';
import { canvasKeyAction, cycleIndex, isCanvasKeyTarget, NUDGE } from './canvasKeys';

const key = (key: string, extra: Partial<KeyboardEvent> = {}) =>
  canvasKeyAction({
    key,
    code: '',
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    ...extra,
  });

describe('canvasKeyAction', () => {
  it('nudges with the arrow keys, more with Shift', () => {
    expect(key('ArrowLeft')).toEqual({ type: 'nudge', dx: -NUDGE.small, dy: 0 });
    expect(key('ArrowDown', { shiftKey: true })).toEqual({ type: 'nudge', dx: 0, dy: NUDGE.large });
  });

  it('steps through points with brackets, elements with Shift', () => {
    expect(key(']')).toEqual({ type: 'point', step: 1 });
    expect(key('[')).toEqual({ type: 'point', step: -1 });
    // Shift turns the brackets into braces on US keyboards.
    expect(key('}', { shiftKey: true })).toEqual({ type: 'element', step: 1 });
    expect(key('{', { shiftKey: true })).toEqual({ type: 'element', step: -1 });
  });

  it('knows the bracket keys by position on other layouts', () => {
    expect(key('đ', { code: 'BracketRight' })).toEqual({ type: 'point', step: 1 });
    expect(key('Š', { code: 'BracketLeft', shiftKey: true })).toEqual({
      type: 'element',
      step: -1,
    });
  });

  it('steps back with Escape', () => {
    expect(key('Escape')).toEqual({ type: 'back' });
  });

  it('leaves shortcuts and other keys alone', () => {
    expect(key('ArrowLeft', { metaKey: true })).toBeNull();
    expect(key(']', { ctrlKey: true })).toBeNull();
    expect(key('ArrowUp', { altKey: true })).toBeNull();
    expect(key('a')).toBeNull();
    expect(key('Tab')).toBeNull();
  });
});

describe('cycleIndex', () => {
  it('starts at either end when nothing is selected', () => {
    expect(cycleIndex(-1, 4, 1)).toBe(0);
    expect(cycleIndex(-1, 4, -1)).toBe(3);
  });

  it('wraps around', () => {
    expect(cycleIndex(3, 4, 1)).toBe(0);
    expect(cycleIndex(0, 4, -1)).toBe(3);
    expect(cycleIndex(1, 4, 1)).toBe(2);
  });

  it('has nothing to select in an empty list', () => {
    expect(cycleIndex(-1, 0, 1)).toBe(-1);
  });
});

describe('isCanvasKeyTarget', () => {
  const body = {};
  const inside = (match: boolean) => ({
    closest: (s: string) => (s === '.canvas' && match) || null,
  });

  it('applies on the canvas and when nothing has focus', () => {
    expect(isCanvasKeyTarget(inside(true), body)).toBe(true);
    expect(isCanvasKeyTarget(body, body)).toBe(true);
    expect(isCanvasKeyTarget(null, body)).toBe(true);
  });

  it('leaves buttons, lists and dialogs elsewhere alone', () => {
    expect(isCanvasKeyTarget(inside(false), body)).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { focusFirst, focusIsLost } from './focus';

const el = (isConnected: boolean) => ({ isConnected, focus: vi.fn() });

describe('focusFirst', () => {
  it('focuses the first candidate still in the page', () => {
    const gone = el(false);
    const next = el(true);
    const later = el(true);
    expect(focusFirst(null, gone, next, later)).toBe(true);
    expect(gone.focus).not.toHaveBeenCalled();
    expect(next.focus).toHaveBeenCalledOnce();
    expect(later.focus).not.toHaveBeenCalled();
  });

  it('does nothing when every candidate is gone', () => {
    expect(focusFirst(undefined, el(false))).toBe(false);
  });
});

describe('focusIsLost', () => {
  const body = {} as HTMLElement;
  it('is lost when the page or nothing has focus', () => {
    expect(focusIsLost({ activeElement: body, body })).toBe(true);
    expect(focusIsLost({ activeElement: null, body })).toBe(true);
  });

  it('is not lost when a control has focus', () => {
    expect(focusIsLost({ activeElement: {} as Element, body })).toBe(false);
  });
});

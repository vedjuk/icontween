import { describe, expect, it } from 'vitest';
import { cubicBezier, DEFAULT_TOKENS, linear, resolveDuration, resolveEasing } from '../src';

describe('cubicBezier', () => {
  it('hits the endpoints exactly', () => {
    const ease = cubicBezier(0.2, 0, 0, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-0.5)).toBe(0);
    expect(ease(1.5)).toBe(1);
  });

  it('returns linear for a straight curve', () => {
    expect(cubicBezier(0.3, 0.3, 0.7, 0.7)).toBe(linear);
  });

  it('matches CSS ease-in-out symmetry and known values', () => {
    const easeInOut = cubicBezier(0.42, 0, 0.58, 1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    for (const t of [0.1, 0.25, 0.4]) {
      expect(easeInOut(t) + easeInOut(1 - t)).toBeCloseTo(1, 6);
    }
    // CSS `ease` at t = 0.5 (reference value from the WebKit solver).
    expect(cubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3);
  });

  it('is monotonic for a steep ease-out', () => {
    const ease = cubicBezier(0.16, 1, 0.3, 1);
    let previous = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      const y = ease(t);
      expect(y).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = y;
    }
  });

  it('allows overshoot in y', () => {
    const backOut = cubicBezier(0.34, 1.56, 0.64, 1);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(backOut))).toBeGreaterThan(1);
  });
});

describe('tokens', () => {
  it('resolves easing tokens and falls back to standard', () => {
    const standard = resolveEasing({ type: 'token', name: 'standard' }, DEFAULT_TOKENS);
    const unknown = resolveEasing({ type: 'token', name: 'nope' }, DEFAULT_TOKENS);
    const spring = resolveEasing(
      { type: 'spring', stiffness: 100, damping: 10, mass: 1 },
      DEFAULT_TOKENS,
    );
    for (const t of [0.1, 0.5, 0.9]) {
      expect(unknown(t)).toBeCloseTo(standard(t), 9);
      expect(spring(t)).toBeCloseTo(standard(t), 9);
    }
  });

  it('resolves duration tokens and falls back to base', () => {
    expect(resolveDuration(120, DEFAULT_TOKENS)).toBe(120);
    expect(resolveDuration({ token: 'slow' }, DEFAULT_TOKENS)).toBe(400);
    expect(resolveDuration({ token: 'nope' }, DEFAULT_TOKENS)).toBe(250);
  });
});

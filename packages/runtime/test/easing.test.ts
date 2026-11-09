import { describe, expect, it } from 'vitest';
import {
  cubicBezier,
  DEFAULT_TOKENS,
  linear,
  resolveDuration,
  resolveEasing,
  resolveMotion,
  spring,
} from '../src';

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
    const broken = resolveEasing(
      { type: 'spring', stiffness: 0, damping: 1, mass: 1 },
      DEFAULT_TOKENS,
    );
    for (const t of [0.1, 0.5, 0.9]) {
      expect(unknown(t)).toBeCloseTo(standard(t), 9);
      expect(broken(t)).toBeCloseTo(standard(t), 9);
    }
  });

  it('gives springs their own duration and keeps curves on the transition duration', () => {
    const curve = resolveMotion({ type: 'token', name: 'standard' }, 300, DEFAULT_TOKENS);
    expect(curve).toMatchObject({ duration: 300, spring: false });
    const gentle = resolveMotion({ type: 'token', name: 'spring-gentle' }, 300, DEFAULT_TOKENS);
    expect(gentle.spring).toBe(true);
    expect(gentle.duration).toBe(spring(170, 26, 1).duration);
  });

  it('resolves duration tokens and falls back to base', () => {
    expect(resolveDuration(120, DEFAULT_TOKENS)).toBe(120);
    expect(resolveDuration({ token: 'slow' }, DEFAULT_TOKENS)).toBe(400);
    expect(resolveDuration({ token: 'nope' }, DEFAULT_TOKENS)).toBe(250);
  });
});

describe('spring', () => {
  const sample = (ease: (t: number) => number, n = 200) =>
    Array.from({ length: n + 1 }, (_, i) => ease(i / n));

  it('starts at 0, ends exactly at 1, and settles within its duration', () => {
    for (const [k, c, m] of [
      [170, 26, 1], // ≈ critical
      [300, 14, 1], // underdamped
      [100, 40, 1], // overdamped
      [100, 20, 1], // exactly critical
    ] as const) {
      const { ease, duration } = spring(k, c, m);
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      expect(duration).toBeGreaterThan(100);
      expect(duration).toBeLessThan(3000); // overdamped springs crawl in slowly
      // Just before the end it is already within the settle threshold.
      expect(Math.abs(1 - ease(0.999))).toBeLessThan(0.0011);
    }
  });

  it('overshoots when underdamped and never when (over)damped', () => {
    expect(Math.max(...sample(spring(300, 14, 1).ease))).toBeGreaterThan(1.1);
    for (const [k, c] of [
      [170, 26],
      [100, 20],
      [100, 40],
    ] as const) {
      const values = sample(spring(k, c, 1).ease);
      expect(Math.max(...values)).toBeLessThanOrEqual(1 + 1e-9);
      // Monotonic: no wobble.
      values.forEach((v, i) => i > 0 && expect(v).toBeGreaterThanOrEqual(values[i - 1]! - 1e-12));
    }
  });

  it('is continuous across the critical-damping boundary', () => {
    const below = spring(100, 19.9999, 1);
    const at = spring(100, 20, 1);
    const above = spring(100, 20.0001, 1);
    for (const t of [0.1, 0.3, 0.6]) {
      // Compare at the same absolute time.
      const ms = t * at.duration;
      expect(below.ease(ms / below.duration)).toBeCloseTo(at.ease(t), 3);
      expect(above.ease(ms / above.duration)).toBeCloseTo(at.ease(t), 3);
    }
  });

  it('stiffer springs settle sooner, heavier ones later', () => {
    const base = spring(170, 26, 1).duration;
    expect(spring(400, 40, 1).duration).toBeLessThan(base);
    expect(spring(170, 26, 3).duration).toBeGreaterThan(base);
  });

  it('cuts undamped springs off at 5 s', () => {
    const { ease, duration } = spring(100, 0, 1);
    expect(duration).toBe(5000);
    expect(ease(1)).toBe(1);
  });
});

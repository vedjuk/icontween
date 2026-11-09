/**
 * Easing curves. An easing maps time progress (0..1) to value progress.
 */
import type { Easing } from '@icontween/core';
import type { MotionTokens } from './tokens';

export type EasingFunction = (t: number) => number;

export const linear: EasingFunction = (t) => t;

/**
 * CSS-compatible cubic-bezier(x1, y1, x2, y2). Solves x(s) = t for the curve parameter s
 * with Newton's method, falling back to bisection where the slope is too flat.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  // Like CSS, x control points must stay in 0..1 so the curve is a function of time.
  x1 = clamp01(x1);
  x2 = clamp01(x2);
  if (x1 === y1 && x2 === y2) return linear;

  // Polynomial coefficients for B(s) = ((a·s + b)·s + c)·s
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;

  const solveS = (t: number) => {
    let s = t;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(s) - t;
      if (Math.abs(error) < 1e-7) return s;
      const slope = slopeX(s);
      if (Math.abs(slope) < 1e-6) break;
      s -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    while (hi - lo > 1e-7) {
      if (sampleX(s) < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };

  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : sampleY(solveS(t)));
}

/**
 * Turns an Easing from the data model into a function. Tokens are looked up in `tokens`
 * (one level deep). Springs arrive in M3; until then they use the `standard` curve.
 */
export function resolveEasing(easing: Easing, tokens: MotionTokens): EasingFunction {
  let e: Easing | undefined = easing;
  if (e.type === 'token') e = tokens.easings[e.name];
  if (e?.type === 'cubic-bezier') return cubicBezier(e.x1, e.y1, e.x2, e.y2);
  return STANDARD;
}

const STANDARD = cubicBezier(0.2, 0, 0, 1);

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

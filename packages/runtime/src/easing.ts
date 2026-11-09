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

/** A spring as an easing: progress over its own settle time, plus that time. */
export interface SpringCurve {
  ease: EasingFunction;
  /** Milliseconds until the spring has settled. */
  duration: number;
}

/** How close to the target (as a share of the distance) counts as settled. */
const SETTLED = 0.001;
/** Springs that would ring longer than this are cut off (ms). */
const SPRING_MAX = 5000;

/**
 * A damped spring released at rest, 0 → 1. Solved in closed form (no simulation), so it
 * looks the same at any frame rate. Stiffness, damping and mass use the usual units
 * (seconds), like Framer Motion or React Spring.
 */
export function spring(stiffness: number, damping: number, mass: number): SpringCurve {
  const w0 = Math.sqrt(stiffness / mass); // natural frequency
  const zeta = damping / (2 * Math.sqrt(stiffness * mass)); // damping ratio
  /** Signed distance from the target at t seconds, starting at -1. */
  let offset: (t: number) => number;
  if (Math.abs(zeta - 1) < 1e-6) {
    offset = (t) => -(1 + w0 * t) * Math.exp(-w0 * t);
  } else if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const k = (zeta * w0) / wd;
    offset = (t) => -Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + k * Math.sin(wd * t));
  } else {
    const root = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - root);
    const r2 = -w0 * (zeta + root);
    const a = -r2 / (r2 - r1);
    const b = r1 / (r2 - r1);
    offset = (t) => a * Math.exp(r1 * t) + b * Math.exp(r2 * t);
  }
  // Settle time: the last millisecond the spring is still visibly away from its target.
  let duration = 0;
  for (let ms = 1; ms <= SPRING_MAX; ms++) {
    if (Math.abs(offset(ms / 1000)) >= SETTLED) duration = ms;
  }
  duration = Math.max(duration, 1);
  const seconds = duration / 1000;
  return {
    ease: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + offset(t * seconds)),
    duration,
  };
}

/** A transition's easing and duration, resolved. Springs bring their own duration. */
export interface Motion {
  ease: EasingFunction;
  duration: number;
  /** True when the duration comes from a spring rather than the transition. */
  spring: boolean;
}

/**
 * Turns an Easing from the data model into a function and a duration. Tokens are looked up
 * in `tokens` (one level deep); unknown tokens and invalid springs use the `standard` curve.
 */
export function resolveMotion(easing: Easing, duration: number, tokens: MotionTokens): Motion {
  const e = easing.type === 'token' ? tokens.easings[easing.name] : easing;
  if (e?.type === 'cubic-bezier') {
    return { ease: cubicBezier(e.x1, e.y1, e.x2, e.y2), duration, spring: false };
  }
  if (e?.type === 'spring' && e.stiffness > 0 && e.mass > 0 && e.damping >= 0) {
    const key = `${e.stiffness} ${e.damping} ${e.mass}`;
    let curve = springs.get(key);
    if (!curve) springs.set(key, (curve = spring(e.stiffness, e.damping, e.mass)));
    return { ...curve, spring: true };
  }
  return { ease: STANDARD, duration, spring: false };
}

/** Springs are solved once per parameter set. */
const springs = new Map<string, SpringCurve>();

/** Just the easing function of `resolveMotion` (springs over their own settle time). */
export function resolveEasing(easing: Easing, tokens: MotionTokens): EasingFunction {
  return resolveMotion(easing, 0, tokens).ease;
}

const STANDARD = cubicBezier(0.2, 0, 0, 1);

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

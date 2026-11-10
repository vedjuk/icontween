/**
 * Easing math for exports that can't use the runtime (SVG + SMIL, decision 017).
 *
 * A copy of the runtime's cubic-bezier and spring solvers (packages/runtime/src/easing.ts):
 * the runtime has no dependencies and core doesn't depend on the runtime, so the formulas
 * live in both. A runtime test checks they give the same numbers.
 */
import type { Easing } from '../schema';

export type EasingFunction = (t: number) => number;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** CSS-compatible cubic-bezier(x1, y1, x2, y2), like the runtime's. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  x1 = clamp01(x1);
  x2 = clamp01(x2);
  if (x1 === y1 && x2 === y2) return (t) => t;
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

const SETTLED = 0.001;
const SPRING_MAX = 5000;

/** A damped spring released at rest, 0 → 1, over its own settle time (ms). Like the runtime's. */
export function spring(
  stiffness: number,
  damping: number,
  mass: number,
): { ease: EasingFunction; duration: number } {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
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
  let duration = 0;
  for (let ms = 1; ms <= SPRING_MAX; ms++) {
    if (Math.abs(offset(ms / 1000)) >= SETTLED) duration = ms;
  }
  duration = Math.max(duration, 1);
  const seconds = duration / 1000;
  return { ease: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + offset(t * seconds)), duration };
}

/** A transition's easing, resolved for export. */
export interface ExportMotion {
  ease: EasingFunction;
  /** Milliseconds: the transition's, or the spring's settle time. */
  duration: number;
  /**
   * The curve as SMIL keySplines control points, when it can be written exactly: a
   * cubic-bezier with every control point in 0..1 (SMIL's range). Otherwise null, and the
   * curve is sampled into keyframes.
   */
  spline: [number, number, number, number] | null;
}

const STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];
const springCache = new Map<string, { ease: EasingFunction; duration: number }>();

/**
 * Like the runtime's resolveMotion() for an easing without tokens (resolveTokens() first):
 * invalid springs and leftover tokens use the `standard` curve.
 */
export function exportMotion(easing: Easing, duration: number): ExportMotion {
  if (easing.type === 'cubic-bezier') {
    const { x1, y1, x2, y2 } = easing;
    const inRange = [y1, y2].every((y) => y >= 0 && y <= 1);
    return {
      ease: cubicBezier(x1, y1, x2, y2),
      duration,
      spline: inRange ? [clamp01(x1), y1, clamp01(x2), y2] : null,
    };
  }
  if (easing.type === 'spring' && easing.stiffness > 0 && easing.mass > 0 && easing.damping >= 0) {
    const key = `${easing.stiffness} ${easing.damping} ${easing.mass}`;
    let curve = springCache.get(key);
    if (!curve)
      springCache.set(key, (curve = spring(easing.stiffness, easing.damping, easing.mass)));
    return { ...curve, spline: null };
  }
  return { ease: cubicBezier(...STANDARD), duration, spline: STANDARD };
}

/**
 * Times (0..1, ending at 1) where a curve is sampled, so straight lines between the samples
 * stay within `tolerance` of it. More samples where it bends, few where it's straight.
 */
export function sampleCurve(ease: EasingFunction, tolerance: number): number[] {
  const out: number[] = [];
  const visit = (a: number, b: number, depth: number) => {
    const ea = ease(a);
    const eb = ease(b);
    let error = 0;
    for (let i = 1; i < 8; i++) {
      const t = a + ((b - a) * i) / 8;
      error = Math.max(error, Math.abs(ease(t) - (ea + ((eb - ea) * (t - a)) / (b - a))));
    }
    if (error > tolerance && depth < 10) {
      const m = (a + b) / 2;
      visit(a, m, depth + 1);
      visit(m, b, depth + 1);
    } else {
      out.push(b);
    }
  };
  visit(0, 1, 0);
  return out;
}

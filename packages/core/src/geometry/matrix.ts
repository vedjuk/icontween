/**
 * 2D affine matrices in SVG order: [a, b, c, d, e, f] maps (x, y) to
 * (a·x + c·y + e, b·x + d·y + f).
 */
import type { Segment } from '../schema';

export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Returns m1 × m2: applying the result equals applying m2 first, then m1. */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function isIdentity(m: Matrix): boolean {
  return m.every((v, i) => v === IDENTITY[i]);
}

export function applyToPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Applies a matrix to canonical segments. Exact for M/L/C because affine maps
 * send lines to lines and cubic Béziers to cubic Béziers (map the control points).
 */
export function transformSegments(segments: readonly Segment[], m: Matrix): Segment[] {
  if (isIdentity(m)) return segments.map((s) => ({ ...s }));
  return segments.map((s) => {
    switch (s.cmd) {
      case 'M':
      case 'L': {
        const [x, y] = applyToPoint(m, s.x, s.y);
        return { cmd: s.cmd, x, y };
      }
      case 'C': {
        const [x1, y1] = applyToPoint(m, s.x1, s.y1);
        const [x2, y2] = applyToPoint(m, s.x2, s.y2);
        const [x, y] = applyToPoint(m, s.x, s.y);
        return { cmd: 'C', x1, y1, x2, y2, x, y };
      }
      case 'Z':
        return { cmd: 'Z' };
    }
  });
}

/** Area scale of a matrix. Its square root is the stroke-width scale for uniform transforms. */
export function determinant(m: Matrix): number {
  return m[0] * m[3] - m[1] * m[2];
}

/** True when the matrix scales equally in every direction (rotation/translation allowed). */
export function isUniformScale(m: Matrix, epsilon = 1e-9): boolean {
  const [a, b, c, d] = m;
  // Columns must be orthogonal and the same length.
  return Math.abs(a * c + b * d) < epsilon && Math.abs(a * a + b * b - (c * c + d * d)) < epsilon;
}

export class TransformParseError extends Error {
  override name = 'TransformParseError';
}

const TRANSFORM_FN = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)\s*,?/gy;
const deg = (a: number) => (a * Math.PI) / 180;

/** Parses an SVG `transform` attribute into a single matrix. */
export function parseTransform(value: string): Matrix {
  let result = IDENTITY;
  const input = value.trim();
  TRANSFORM_FN.lastIndex = 0;
  let consumed = 0;
  let match: RegExpExecArray | null;
  while ((match = TRANSFORM_FN.exec(input)) !== null) {
    consumed = TRANSFORM_FN.lastIndex;
    const fn = match[1]!;
    const args = match[2]!
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (args.some((n) => !Number.isFinite(n))) {
      throw new TransformParseError(`Invalid number in ${fn}(${match[2]})`);
    }
    result = multiply(result, transformFunction(fn, args));
  }
  if (consumed !== input.length) {
    throw new TransformParseError(`Could not parse transform "${value}"`);
  }
  return result;
}

function transformFunction(fn: string, a: number[]): Matrix {
  const arity = (...allowed: number[]) => {
    if (!allowed.includes(a.length)) {
      throw new TransformParseError(`${fn}() takes ${allowed.join(' or ')} arguments`);
    }
  };
  switch (fn) {
    case 'matrix':
      arity(6);
      return a as unknown as Matrix;
    case 'translate':
      arity(1, 2);
      return [1, 0, 0, 1, a[0]!, a[1] ?? 0];
    case 'scale':
      arity(1, 2);
      return [a[0]!, 0, 0, a[1] ?? a[0]!, 0, 0];
    case 'rotate': {
      arity(1, 3);
      const r = deg(a[0]!);
      const rot: Matrix = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
      if (a.length === 1) return rot;
      const [cx, cy] = [a[1]!, a[2]!];
      return multiply(multiply([1, 0, 0, 1, cx, cy], rot), [1, 0, 0, 1, -cx, -cy]);
    }
    case 'skewX':
      arity(1);
      return [1, 0, Math.tan(deg(a[0]!)), 1, 0, 0];
    case 'skewY':
      arity(1);
      return [1, Math.tan(deg(a[0]!)), 0, 1, 0, 0];
    default:
      throw new TransformParseError(`Unknown transform ${fn}()`);
  }
}

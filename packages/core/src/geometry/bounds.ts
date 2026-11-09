/** Exact bounding boxes of canonical segments (cubic extrema solved analytically). */
import type { Segment } from '../schema';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Returns null for empty input. */
export function segmentsBounds(segments: readonly Segment[]): Bounds | null {
  let b: Bounds | null = null;
  const add = (x: number, y: number) => {
    if (!b) b = { minX: x, minY: y, maxX: x, maxY: y };
    else {
      b.minX = Math.min(b.minX, x);
      b.minY = Math.min(b.minY, y);
      b.maxX = Math.max(b.maxX, x);
      b.maxY = Math.max(b.maxY, y);
    }
  };

  let px = 0;
  let py = 0;
  let sx = 0;
  let sy = 0;
  for (const s of segments) {
    switch (s.cmd) {
      case 'M':
        [px, py, sx, sy] = [s.x, s.y, s.x, s.y];
        add(px, py);
        break;
      case 'L':
        add(s.x, s.y);
        [px, py] = [s.x, s.y];
        break;
      case 'C': {
        add(s.x, s.y);
        for (const t of cubicExtrema(px, s.x1, s.x2, s.x)) {
          add(cubicAt(px, s.x1, s.x2, s.x, t), cubicAt(py, s.y1, s.y2, s.y, t));
        }
        for (const t of cubicExtrema(py, s.y1, s.y2, s.y)) {
          add(cubicAt(px, s.x1, s.x2, s.x, t), cubicAt(py, s.y1, s.y2, s.y, t));
        }
        [px, py] = [s.x, s.y];
        break;
      }
      case 'Z':
        [px, py] = [sx, sy];
        break;
    }
  }
  return b;
}

export function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

/** Parameters t in (0, 1) where the derivative of a 1D cubic is zero. */
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  // Derivative / 3 = a·t² + b·t + c
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      roots.push((-b + sq) / (2 * a), (-b - sq) / (2 * a));
    }
  }
  return roots.filter((t) => t > 0 && t < 1);
}

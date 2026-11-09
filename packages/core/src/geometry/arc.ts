/**
 * Elliptical arc → cubic Béziers, following the SVG implementation notes
 * (endpoint to center parameterization, appendix B.2.4) and splitting the sweep
 * into pieces of at most 90°, where the cubic approximation error is tiny
 * (≈0.027% of the radius).
 */
import type { Segment } from '../schema';

type CubicSegment = Extract<Segment, { cmd: 'C' }>;
type LineSegment = Extract<Segment, { cmd: 'L' }>;

/**
 * Converts one arc command from (x0, y0) to (x, y). Returns [] when the endpoints
 * are equal (the spec says to omit the arc) and a single line when a radius is 0.
 */
export function arcToCubics(
  x0: number,
  y0: number,
  rxIn: number,
  ryIn: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x: number,
  y: number,
): (CubicSegment | LineSegment)[] {
  if (x0 === x && y0 === y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [{ cmd: 'L', x, y }];

  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: transformed midpoint.
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Correct out-of-range radii (B.2.5).
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // Step 2: center in the transformed frame.
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;

  // Step 3: center in user space.
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2;

  // Step 4: start angle and sweep.
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const theta1 = Math.atan2(uy, ux);
  let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  // Split into ≤90° pieces; each becomes one cubic on the unit circle, then mapped.
  const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / pieces;
  const k = (4 / 3) * Math.tan(step / 4);

  const map = (ex: number, ey: number): [number, number] => [
    cx + rx * ex * cosPhi - ry * ey * sinPhi,
    cy + rx * ex * sinPhi + ry * ey * cosPhi,
  ];

  const result: CubicSegment[] = [];
  let t = theta1;
  for (let i = 0; i < pieces; i++) {
    const t2 = t + step;
    const [c1, s1, c2, s2] = [Math.cos(t), Math.sin(t), Math.cos(t2), Math.sin(t2)];
    const [x1, y1] = map(c1 - k * s1, s1 + k * c1);
    const [x2, y2] = map(c2 + k * s2, s2 - k * c2);
    const [ex, ey] = map(c2, s2);
    result.push({ cmd: 'C', x1, y1, x2, y2, x: ex, y: ey });
    t = t2;
  }
  // Land exactly on the requested endpoint (avoid float drift).
  const last = result[result.length - 1]!;
  last.x = x;
  last.y = y;
  return result;
}

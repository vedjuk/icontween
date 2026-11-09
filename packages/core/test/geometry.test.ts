import { describe, expect, it } from 'vitest';
import {
  arcToCubics,
  cubicAt,
  KAPPA,
  multiply,
  normalizePath,
  parsePathData,
  parseTransform,
  PathParseError,
  rectToSegments,
  segmentsBounds,
  segmentsToD,
  transformSegments,
  TransformParseError,
  type Segment,
} from '../src';

type Cubic = Extract<Segment, { cmd: 'C' }>;

/** Samples points along cubic segments that start at (x0, y0). */
function sampleCubics(x0: number, y0: number, cubics: Cubic[], steps = 16): [number, number][] {
  const pts: [number, number][] = [];
  let [px, py] = [x0, y0];
  for (const c of cubics) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([cubicAt(px, c.x1, c.x2, c.x, t), cubicAt(py, c.y1, c.y2, c.y, t)]);
    }
    [px, py] = [c.x, c.y];
  }
  return pts;
}

function circumcenter(
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
  [cx, cy]: [number, number],
): [number, number] {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  return [
    (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d,
    (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d,
  ];
}

const expectClose = (actual: number, expected: number, tolerance = 1e-9) =>
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);

describe('parsePathData', () => {
  it('splits implicit repeats, including moveto → lineto', () => {
    expect(parsePathData('m1 1 2 2 3 3').map((c) => c.cmd)).toEqual(['m', 'l', 'l']);
    expect(parsePathData('M0 0L1 1 2 2').map((c) => c.cmd)).toEqual(['M', 'L', 'L']);
  });

  it('reads compact arc flags', () => {
    expect(parsePathData('M0 0a1 1 0 011 1')[1]).toEqual({ cmd: 'a', args: [1, 1, 0, 0, 1, 1, 1] });
  });

  it.each(['L0 0', 'M0 0 X1', 'M0 0 L1', 'M0 0 A1 1 0 2 0 1 1'])('rejects "%s"', (d) => {
    expect(() => parsePathData(d)).toThrow(PathParseError);
  });
});

describe('normalizePath', () => {
  it('makes relative commands absolute and expands H/V', () => {
    const { segments, stats } = normalizePath('M2 2 H12 V12 h-4 v4');
    expect(segmentsToD(segments)).toBe('M2 2 L12 2 L12 12 L8 12 L8 16');
    expect(stats).toMatchObject({ shorthands: 4, relative: 2 });
  });

  it('returns to the subpath start after Z', () => {
    const { segments } = normalizePath('M10 10 l5 0 z l0 5');
    expect(segmentsToD(segments)).toBe('M10 10 L15 10 Z L10 15');
  });

  it('reflects the previous control point for S', () => {
    const { segments } = normalizePath('M2 8 C4 4 8 4 10 8 S16 12 18 8');
    expect(segments[2]).toEqual({ cmd: 'C', x1: 12, y1: 12, x2: 16, y2: 12, x: 18, y: 8 });
  });

  it('uses the current point for S without a preceding cubic', () => {
    const { segments } = normalizePath('M0 0 S2 2 4 0');
    expect(segments[1]).toMatchObject({ x1: 0, y1: 0 });
  });

  it('converts Q and T to exact cubics', () => {
    const { segments, stats } = normalizePath('M2 20 Q6 14 10 20 T18 20');
    // Q control (6,14) → cubic controls at 2/3 of the way from each end.
    const q = segments[1] as Cubic;
    expectClose(q.x1, 14 / 3);
    expectClose(q.x2, 22 / 3);
    expect(q).toMatchObject({ y1: 16, y2: 16, x: 10, y: 20 });
    // T reflects (6,14) about (10,20) → (14,26).
    const t = segments[2] as Cubic;
    expectClose(t.x1, 10 + (2 / 3) * 4);
    expectClose(t.y1, 20 + (2 / 3) * 6);
    expect(stats).toMatchObject({ quadratics: 2, shorthands: 1 });
  });

  it('converts arcs to cubics and counts them', () => {
    const { segments, stats } = normalizePath('M2 12 A10 10 0 0 1 22 12');
    expect(stats.arcs).toBe(1);
    expect(segments.every((s) => s.cmd === 'M' || s.cmd === 'C')).toBe(true);
    expect(segments.at(-1)).toMatchObject({ x: 22, y: 12 });
  });
});

describe('arcToCubics', () => {
  it('approximates a half circle within 0.03% of the radius', () => {
    const cubics = arcToCubics(2, 12, 10, 10, 0, false, true, 22, 12) as Cubic[];
    expect(cubics).toHaveLength(2);
    for (const [x, y] of sampleCubics(2, 12, cubics)) {
      expect(Math.abs(Math.hypot(x - 12, y - 12) - 10)).toBeLessThan(10 * 0.0003);
      expect(y).toBeLessThanOrEqual(12 + 1e-9); // sweep=1 from left to right goes over the top
    }
  });

  it.each([
    ['radii large enough', 6, 3],
    ['radii too small (scaled up)', 2, 1],
  ])('keeps a rotated arc on one ellipse: %s', (_, rx, ry) => {
    const rot = 30;
    const cubics = arcToCubics(4, 20, rx, ry, rot, true, false, 12, 20) as Cubic[];
    expect(cubics.at(-1)).toMatchObject({ x: 12, y: 20 });
    // Undo rotation and the radii ratio: the points must then lie on one circle.
    const phi = (rot * Math.PI) / 180;
    const pts = sampleCubics(4, 20, cubics).map(([x, y]) => {
      const u = x * Math.cos(phi) + y * Math.sin(phi);
      const v = -x * Math.sin(phi) + y * Math.cos(phi);
      return [u / rx, v / ry] as [number, number];
    });
    const [a, b, c] = [pts[0]!, pts[Math.floor(pts.length / 2)]!, pts.at(-1)!];
    const center = circumcenter(a, b, c);
    const r = Math.hypot(a[0] - center[0], a[1] - center[1]);
    for (const [x, y] of pts) {
      expect(Math.abs(Math.hypot(x - center[0], y - center[1]) - r) / r).toBeLessThan(0.0005);
    }
  });

  it('splits a near-full circle into four pieces', () => {
    const cubics = arcToCubics(10, 0, 10, 10, 0, true, true, 9.99, -0.5);
    expect(cubics).toHaveLength(4);
  });

  it('omits arcs with equal endpoints and turns zero radii into lines', () => {
    expect(arcToCubics(1, 1, 5, 5, 0, false, true, 1, 1)).toEqual([]);
    expect(arcToCubics(0, 0, 0, 5, 0, false, true, 4, 4)).toEqual([{ cmd: 'L', x: 4, y: 4 }]);
  });
});

describe('transforms', () => {
  it('parses and composes transform lists left to right', () => {
    expect(parseTransform('translate(10) scale(2)')).toEqual([2, 0, 0, 2, 10, 0]);
    expect(parseTransform('translate(10, 5),scale(2 3)')).toEqual([2, 0, 0, 3, 10, 5]);
    expect(parseTransform('')).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('rotates around a center point', () => {
    const m = parseTransform('rotate(90 2 2)');
    const [seg] = transformSegments([{ cmd: 'M', x: 0, y: 0 }], m) as [
      Extract<Segment, { cmd: 'M' }>,
    ];
    expectClose(seg.x, 4);
    expectClose(seg.y, 0);
  });

  it('supports skew and matrix', () => {
    expect(parseTransform('matrix(1 2 3 4 5 6)')).toEqual([1, 2, 3, 4, 5, 6]);
    const [, , c] = parseTransform('skewX(45)');
    expectClose(c, 1);
  });

  it('multiplies in SVG order', () => {
    // translate then scale: points are scaled first, then translated.
    expect(multiply([1, 0, 0, 1, 10, 0], [2, 0, 0, 2, 0, 0])).toEqual([2, 0, 0, 2, 10, 0]);
  });

  it.each(['translate(1 2 3)', 'spin(4)', 'scale(a)', 'translate(1) garbage'])(
    'rejects "%s"',
    (t) => {
      expect(() => parseTransform(t)).toThrow(TransformParseError);
    },
  );
});

describe('rectToSegments', () => {
  it('keeps zero-length edges so every rounded rect has the same structure', () => {
    const pill = rectToSegments(0, 0, 20, 8, 100);
    const card = rectToSegments(0, 0, 20, 10, 3);
    expect(pill.map((s) => s.cmd)).toEqual(card.map((s) => s.cmd));
    // rx and ry are clamped independently (SVG 2): rx → w/2 = 10, ry → h/2 = 4.
    expect(pill[0]).toEqual({ cmd: 'M', x: 10, y: 0 });
    expect(pill[3]).toEqual({ cmd: 'L', x: 20, y: 4 });
  });

  it('takes ry from rx and vice versa', () => {
    const a = rectToSegments(0, 0, 10, 10, undefined, 2);
    expect(a[0]).toEqual({ cmd: 'M', x: 2, y: 0 });
    expect(a[2]).toMatchObject({ x: 10, y: 2, x1: 8 + 2 * KAPPA });
  });
});

describe('segmentsBounds', () => {
  it('uses curve extrema, not control points', () => {
    const b = segmentsBounds(normalizePath('M0 0 C0 10 10 10 10 0').segments)!;
    expect(b.minY).toBe(0);
    expectClose(b.maxY, 7.5);
    expect(b.maxX).toBe(10);
  });

  it('returns null for no segments', () => {
    expect(segmentsBounds([])).toBeNull();
  });
});

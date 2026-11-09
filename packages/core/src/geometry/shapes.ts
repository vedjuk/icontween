/**
 * Basic shapes → canonical segments, following the SVG 2 "equivalent path"
 * definitions so that start points and directions (which matter for stroke
 * drawing) match what browsers do.
 */
import type { Segment } from '../schema';

/** Cubic handle length for a quarter circle of radius 1. */
export const KAPPA = (4 / 3) * (Math.SQRT2 - 1);

/** Ellipse starting at (cx + rx, cy), going in positive angle direction (clockwise on screen). */
export function ellipseToSegments(cx: number, cy: number, rx: number, ry: number): Segment[] {
  if (rx <= 0 || ry <= 0) return [];
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return [
    { cmd: 'M', x: cx + rx, y: cy },
    { cmd: 'C', x1: cx + rx, y1: cy + ky, x2: cx + kx, y2: cy + ry, x: cx, y: cy + ry },
    { cmd: 'C', x1: cx - kx, y1: cy + ry, x2: cx - rx, y2: cy + ky, x: cx - rx, y: cy },
    { cmd: 'C', x1: cx - rx, y1: cy - ky, x2: cx - kx, y2: cy - ry, x: cx, y: cy - ry },
    { cmd: 'C', x1: cx + kx, y1: cy - ry, x2: cx + rx, y2: cy - ky, x: cx + rx, y: cy },
    { cmd: 'Z' },
  ];
}

export function circleToSegments(cx: number, cy: number, r: number): Segment[] {
  return ellipseToSegments(cx, cy, r, r);
}

/**
 * Rectangle, optionally rounded. rx/ry follow SVG 2 auto rules: if one is missing
 * it equals the other; both are clamped to half the width/height.
 */
export function rectToSegments(
  x: number,
  y: number,
  w: number,
  h: number,
  rxIn?: number,
  ryIn?: number,
): Segment[] {
  if (w <= 0 || h <= 0) return [];
  let rx = rxIn !== undefined && rxIn >= 0 ? rxIn : undefined;
  let ry = ryIn !== undefined && ryIn >= 0 ? ryIn : undefined;
  if (rx === undefined) rx = ry ?? 0;
  if (ry === undefined) ry = rx;
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);

  if (rx === 0 || ry === 0) {
    return [
      { cmd: 'M', x, y },
      { cmd: 'L', x: x + w, y },
      { cmd: 'L', x: x + w, y: y + h },
      { cmd: 'L', x, y: y + h },
      { cmd: 'Z' },
    ];
  }

  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const r = x + w;
  const b = y + h;
  // Straight edges are kept even when their length is 0 (e.g. a pill shape), so
  // every rounded rect has the same structure. That makes rects easier to morph.
  return [
    { cmd: 'M', x: x + rx, y },
    { cmd: 'L', x: r - rx, y },
    { cmd: 'C', x1: r - rx + kx, y1: y, x2: r, y2: y + ry - ky, x: r, y: y + ry },
    { cmd: 'L', x: r, y: b - ry },
    { cmd: 'C', x1: r, y1: b - ry + ky, x2: r - rx + kx, y2: b, x: r - rx, y: b },
    { cmd: 'L', x: x + rx, y: b },
    { cmd: 'C', x1: x + rx - kx, y1: b, x2: x, y2: b - ry + ky, x, y: b - ry },
    { cmd: 'L', x, y: y + ry },
    { cmd: 'C', x1: x, y1: y + ry - ky, x2: x + rx - kx, y2: y, x: x + rx, y },
    { cmd: 'Z' },
  ];
}

export function lineToSegments(x1: number, y1: number, x2: number, y2: number): Segment[] {
  return [
    { cmd: 'M', x: x1, y: y1 },
    { cmd: 'L', x: x2, y: y2 },
  ];
}

/** Parses a `points` attribute. An odd trailing number is ignored, as in SVG. */
export function parsePoints(points: string): [number, number][] {
  const nums = (points.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i]!, nums[i + 1]!]);
  return out;
}

export function polyToSegments(points: [number, number][], closed: boolean): Segment[] {
  if (points.length === 0) return [];
  const segs: Segment[] = points.map(([x, y], i) => ({ cmd: i === 0 ? 'M' : 'L', x, y }));
  if (closed) segs.push({ cmd: 'Z' });
  return segs;
}

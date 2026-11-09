/**
 * Arbitrary SVG path data → canonical segments (absolute M, L, C, Z).
 *
 * - Relative commands become absolute.
 * - H/V become L; S becomes C; Q/T become C (exact degree elevation).
 * - A becomes one or more C (see arc.ts).
 * - After Z the current point returns to the subpath start, as in SVG.
 */
import type { Segment } from '../schema';
import { arcToCubics } from './arc';
import { PathParseError } from '../path';

export interface NormalizeStats {
  /** Arc commands converted to cubics. */
  arcs: number;
  /** Quadratic commands (Q/T) converted to cubics. */
  quadratics: number;
  /** Shorthand commands (H/V/S/T) expanded. */
  shorthands: number;
  /** Relative commands made absolute. */
  relative: number;
}

export interface NormalizeResult {
  segments: Segment[];
  stats: NormalizeStats;
}

const ARITY: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

interface RawCommand {
  cmd: string; // as written, e.g. 'm' or 'C'
  args: number[];
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

/** Tokenizes path data into commands with their argument groups (implicit repeats split out). */
export function parsePathData(d: string): RawCommand[] {
  const out: RawCommand[] = [];
  let i = 0;
  const n = d.length;
  const skipSeparators = () => {
    while (i < n && /[\s,]/.test(d[i]!)) i++;
  };
  const readNumber = (): number => {
    skipSeparators();
    const m = NUMBER.exec(d.slice(i));
    if (!m) throw new PathParseError(`Expected a number at position ${i} in "${d}"`);
    i += m[0].length;
    return Number(m[0]);
  };
  const readFlag = (): number => {
    skipSeparators();
    const c = d[i];
    if (c !== '0' && c !== '1') throw new PathParseError(`Expected an arc flag at position ${i}`);
    i++;
    return Number(c);
  };

  skipSeparators();
  while (i < n) {
    const letter = d[i]!;
    const upper = letter.toUpperCase();
    const arity = ARITY[upper];
    if (arity === undefined) {
      throw new PathParseError(`Unexpected "${letter}" at position ${i}`);
    }
    if (out.length === 0 && upper !== 'M') {
      throw new PathParseError('Path data must start with M or m');
    }
    i++;
    if (arity === 0) {
      out.push({ cmd: letter, args: [] });
      skipSeparators();
      continue;
    }
    let first = true;
    for (;;) {
      skipSeparators();
      // Another argument group follows if the next character starts a number.
      if (!first && (i >= n || !/[\d.+-]/.test(d[i]!))) break;
      const args: number[] = [];
      for (let k = 0; k < arity; k++) {
        args.push(upper === 'A' && (k === 3 || k === 4) ? readFlag() : readNumber());
      }
      // Implicit repeats after a moveto are linetos (same case as the moveto).
      const cmd = !first && upper === 'M' ? (letter === 'm' ? 'l' : 'L') : letter;
      out.push({ cmd, args });
      first = false;
    }
  }
  return out;
}

/** Parses and normalizes arbitrary path data into canonical segments. */
export function normalizePath(d: string): NormalizeResult {
  const stats: NormalizeStats = { arcs: 0, quadratics: 0, shorthands: 0, relative: 0 };
  const segments: Segment[] = [];

  let cx = 0; // current point
  let cy = 0;
  let sx = 0; // subpath start
  let sy = 0;
  // Reflection points for S and T.
  let lastCubic: [number, number] | null = null;
  let lastQuad: [number, number] | null = null;

  const pushCubicFromQuad = (qx: number, qy: number, x: number, y: number) => {
    segments.push({
      cmd: 'C',
      x1: cx + (2 / 3) * (qx - cx),
      y1: cy + (2 / 3) * (qy - cy),
      x2: x + (2 / 3) * (qx - x),
      y2: y + (2 / 3) * (qy - y),
      x,
      y,
    });
  };

  for (const { cmd, args: a } of parsePathData(d)) {
    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    if (rel && upper !== 'Z') stats.relative++;
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    let nextCubic: [number, number] | null = null;
    let nextQuad: [number, number] | null = null;

    switch (upper) {
      case 'M': {
        cx = sx = a[0]! + ox;
        cy = sy = a[1]! + oy;
        segments.push({ cmd: 'M', x: cx, y: cy });
        break;
      }
      case 'L':
      case 'H':
      case 'V': {
        if (upper !== 'L') stats.shorthands++;
        const x = upper === 'V' ? cx : a[0]! + ox;
        const y = upper === 'H' ? cy : upper === 'V' ? a[0]! + oy : a[1]! + oy;
        segments.push({ cmd: 'L', x, y });
        [cx, cy] = [x, y];
        break;
      }
      case 'C': {
        const s: Segment = {
          cmd: 'C',
          x1: a[0]! + ox,
          y1: a[1]! + oy,
          x2: a[2]! + ox,
          y2: a[3]! + oy,
          x: a[4]! + ox,
          y: a[5]! + oy,
        };
        segments.push(s);
        nextCubic = [s.x2, s.y2];
        [cx, cy] = [s.x, s.y];
        break;
      }
      case 'S': {
        stats.shorthands++;
        const x1: number = lastCubic ? 2 * cx - lastCubic[0] : cx;
        const y1: number = lastCubic ? 2 * cy - lastCubic[1] : cy;
        const s: Segment = {
          cmd: 'C',
          x1,
          y1,
          x2: a[0]! + ox,
          y2: a[1]! + oy,
          x: a[2]! + ox,
          y: a[3]! + oy,
        };
        segments.push(s);
        nextCubic = [s.x2, s.y2];
        [cx, cy] = [s.x, s.y];
        break;
      }
      case 'Q':
      case 'T': {
        stats.quadratics++;
        let qx: number, qy: number, x: number, y: number;
        if (upper === 'Q') {
          [qx, qy, x, y] = [a[0]! + ox, a[1]! + oy, a[2]! + ox, a[3]! + oy];
        } else {
          stats.shorthands++;
          [qx, qy] = lastQuad ? [2 * cx - lastQuad[0], 2 * cy - lastQuad[1]] : [cx, cy];
          [x, y] = [a[0]! + ox, a[1]! + oy];
        }
        pushCubicFromQuad(qx, qy, x, y);
        nextQuad = [qx, qy];
        [cx, cy] = [x, y];
        break;
      }
      case 'A': {
        stats.arcs++;
        const x = a[5]! + ox;
        const y = a[6]! + oy;
        segments.push(...arcToCubics(cx, cy, a[0]!, a[1]!, a[2]!, a[3] === 1, a[4] === 1, x, y));
        [cx, cy] = [x, y];
        break;
      }
      case 'Z': {
        segments.push({ cmd: 'Z' });
        [cx, cy] = [sx, sy];
        break;
      }
    }
    lastCubic = nextCubic;
    lastQuad = nextQuad;
  }

  return { segments, stats };
}

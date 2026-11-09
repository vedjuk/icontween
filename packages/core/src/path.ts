/**
 * Conversion between canonical segments and SVG `d` strings.
 *
 * Only the canonical subset is handled here (absolute M/L/C/Z). Turning arbitrary
 * SVG path data into canonical form is the job of the prepare pipeline.
 */
import type { Segment } from './schema';

/** Decimal places kept in coordinates (prepare rounds to the same precision). */
export const COORDINATE_PRECISION = 3;

/** Formats a number compactly: rounded, no trailing zeros, no negative zero. */
export function formatNumber(value: number, precision = COORDINATE_PRECISION): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot format non-finite number: ${value}`);
  }
  const factor = 10 ** precision;
  const rounded = Math.round(value * factor) / factor;
  // `+ 0` turns -0 into 0.
  return String(rounded + 0);
}

/** Serializes canonical segments to a readable `d` string, e.g. "M4 12 L9 17 L20 6". */
export function segmentsToD(
  segments: readonly Segment[],
  precision = COORDINATE_PRECISION,
): string {
  const f = (n: number) => formatNumber(n, precision);
  return segments
    .map((s) => {
      switch (s.cmd) {
        case 'M':
        case 'L':
          return `${s.cmd}${f(s.x)} ${f(s.y)}`;
        case 'C':
          return `C${f(s.x1)} ${f(s.y1)} ${f(s.x2)} ${f(s.y2)} ${f(s.x)} ${f(s.y)}`;
        case 'Z':
          return 'Z';
      }
    })
    .join(' ');
}

const ARG_COUNT = { M: 2, L: 2, C: 6, Z: 0 } as const;
const TOKEN = /([MLCZ])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)|([\s,]+)|(.)/gi;

export class PathParseError extends Error {
  override name = 'PathParseError';
}

/**
 * Parses a canonical `d` string (absolute M, L, C, Z only) back into segments.
 * Implicit repeats ("M0 0 1 1" or "L1 1 2 2") are accepted, following SVG rules.
 * Anything else (relative commands, H/V/S/Q/T/A) throws a PathParseError.
 */
export function dToSegments(d: string): Segment[] {
  const segments: Segment[] = [];
  let cmd: keyof typeof ARG_COUNT | null = null;
  let args: number[] = [];

  const flush = () => {
    if (cmd === null) return;
    const n = ARG_COUNT[cmd];
    if (n === 0) {
      if (args.length > 0) throw new PathParseError('Z takes no arguments');
      segments.push({ cmd: 'Z' });
      return;
    }
    if (args.length === 0 || args.length % n !== 0) {
      throw new PathParseError(`${cmd} expects a multiple of ${n} numbers, got ${args.length}`);
    }
    for (let i = 0; i < args.length; i += n) {
      const a = args.slice(i, i + n) as [number, number, number, number, number, number];
      // After the first pair, a moveto's implicit repeats are linetos.
      const c = cmd === 'M' && i > 0 ? 'L' : cmd;
      if (c === 'C') {
        segments.push({ cmd: 'C', x1: a[0], y1: a[1], x2: a[2], y2: a[3], x: a[4], y: a[5] });
      } else {
        segments.push({ cmd: c, x: a[0], y: a[1] });
      }
    }
  };

  for (const match of d.matchAll(TOKEN)) {
    const [, command, number, , other] = match;
    if (other !== undefined) {
      throw new PathParseError(`Unexpected character "${other}" at ${match.index}`);
    }
    if (command !== undefined) {
      if (command !== command.toUpperCase()) {
        throw new PathParseError(`Relative command "${command}" is not canonical`);
      }
      flush();
      cmd = command as keyof typeof ARG_COUNT;
      args = [];
    } else if (number !== undefined) {
      if (cmd === null) throw new PathParseError('Path data must start with a command');
      args.push(Number(number));
    }
  }
  flush();

  if (segments.length > 0 && segments[0]!.cmd !== 'M') {
    throw new PathParseError('Path data must start with M');
  }
  return segments;
}

import { describe, expect, it } from 'vitest';
import { dToSegments, formatNumber, PathParseError, segmentsToD, type Segment } from '../src';

describe('formatNumber', () => {
  it('rounds to 3 decimals and drops trailing zeros', () => {
    expect(formatNumber(1.23456)).toBe('1.235');
    expect(formatNumber(2.5)).toBe('2.5');
    expect(formatNumber(12)).toBe('12');
  });

  it('never prints negative zero', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-0.0001)).toBe('0');
  });

  it('rejects non-finite numbers', () => {
    expect(() => formatNumber(NaN)).toThrow(RangeError);
    expect(() => formatNumber(Infinity)).toThrow(RangeError);
  });
});

describe('segmentsToD', () => {
  it('serializes every canonical command', () => {
    const segments: Segment[] = [
      { cmd: 'M', x: 4, y: 12 },
      { cmd: 'L', x: 9, y: 17 },
      { cmd: 'C', x1: 10, y1: 18, x2: 12.5, y2: 18, x: 14, y: 16.0004 },
      { cmd: 'Z' },
    ];
    expect(segmentsToD(segments)).toBe('M4 12 L9 17 C10 18 12.5 18 14 16 Z');
  });

  it('returns an empty string for no segments', () => {
    expect(segmentsToD([])).toBe('');
  });
});

describe('dToSegments', () => {
  it('round-trips segmentsToD output', () => {
    const segments: Segment[] = [
      { cmd: 'M', x: -1.5, y: 0.25 },
      { cmd: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 },
      { cmd: 'L', x: 7, y: 8 },
      { cmd: 'Z' },
      { cmd: 'M', x: 10, y: 10 },
      { cmd: 'L', x: 12, y: 12 },
    ];
    expect(dToSegments(segmentsToD(segments))).toEqual(segments);
  });

  it('accepts compact syntax, commas and exponents', () => {
    expect(dToSegments('M0,0L1e1-2.5.5.5Z')).toEqual([
      { cmd: 'M', x: 0, y: 0 },
      { cmd: 'L', x: 10, y: -2.5 },
      { cmd: 'L', x: 0.5, y: 0.5 },
      { cmd: 'Z' },
    ]);
  });

  it('treats extra moveto pairs as linetos', () => {
    expect(dToSegments('M0 0 1 1 2 2')).toEqual([
      { cmd: 'M', x: 0, y: 0 },
      { cmd: 'L', x: 1, y: 1 },
      { cmd: 'L', x: 2, y: 2 },
    ]);
  });

  it.each([
    ['relative commands', 'm0 0 l1 1'],
    ['shorthand commands', 'M0 0 H5'],
    ['arcs', 'M0 0 A5 5 0 0 1 10 10'],
    ['missing leading M', 'L1 1'],
    ['wrong argument count', 'M0 0 C1 2 3'],
    ['arguments after Z', 'M0 0 Z 1 1'],
    ['numbers before a command', '1 1 M0 0'],
  ])('rejects %s', (_, d) => {
    expect(() => dToSegments(d)).toThrow(PathParseError);
  });
});

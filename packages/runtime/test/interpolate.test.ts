import { describe, expect, it } from 'vitest';
import { mixElementState, mixValues } from '../src';
import { elementState, line } from './helpers';

describe('mixElementState', () => {
  const a = elementState([...line(0, 0, 10, 0), { cmd: 'Z' }], {
    opacity: 1,
    draw: { start: 0, end: 1 },
  });
  const b = elementState([{ cmd: 'M', x: 4, y: 8 }, { cmd: 'L', x: 20, y: -4 }, { cmd: 'Z' }], {
    opacity: 0,
    draw: { start: 0.5, end: 0.5 },
    transform: { translateX: 2, translateY: -2, rotate: 90, scale: 2, originX: 0, originY: 4 },
  });

  it('blends every number and keeps commands', () => {
    const mid = mixElementState(a, b, 0.5);
    expect(mid.segments).toEqual([
      { cmd: 'M', x: 2, y: 4 },
      { cmd: 'L', x: 15, y: -2 },
      { cmd: 'Z' },
    ]);
    expect(mid.opacity).toBe(0.5);
    expect(mid.draw).toEqual({ start: 0.25, end: 0.75 });
    expect(mid.transform).toEqual({
      translateX: 1,
      translateY: -1,
      rotate: 45,
      scale: 1.5,
      originX: 6,
      originY: 8,
    });
  });

  it('returns exact endpoints and leaves inputs alone', () => {
    const before = JSON.stringify([a, b]);
    expect(mixElementState(a, b, 0)).toEqual(a);
    expect(mixElementState(a, b, 1)).toEqual(b);
    expect(JSON.stringify([a, b])).toBe(before);
  });

  it('extrapolates for overshooting easings', () => {
    expect(mixElementState(a, b, 1.1).segments[1]).toEqual({ cmd: 'L', x: 21, y: -4.4 });
  });

  it('mixes whole states', () => {
    expect(mixValues({ x: a }, { x: b }, 1)).toEqual({ x: b });
  });
});

import type { Animation, ElementState, Segment, Transition } from '@icontween/core';
import type { Clock } from '../src';

export const LINEAR = { type: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 } as const;

export function line(x1: number, y1: number, x2: number, y2: number): Segment[] {
  return [
    { cmd: 'M', x: x1, y: y1 },
    { cmd: 'L', x: x2, y: y2 },
  ];
}

export function elementState(segments: Segment[], extra: Partial<ElementState> = {}): ElementState {
  return {
    segments,
    transform: { translateX: 0, translateY: 0, rotate: 0, scale: 1, originX: 12, originY: 12 },
    opacity: 1,
    draw: { start: 0, end: 1 },
    ...extra,
  };
}

const STYLE = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/**
 * Two lines that move down by 10 from A to B (y 0 → 10), linear over 100 ms.
 * Optional third state C at y 20 for multi-step sequences.
 */
export function testAnimation(overrides: Partial<Animation> = {}, step: Partial<Transition> = {}) {
  const at = (y: number) => ({
    'el-1': elementState(line(0, y, 10, y)),
    'el-2': elementState(line(0, y + 1, 10, y + 1)),
  });
  const animation: Animation = {
    id: 'test',
    name: 'Test',
    purpose: 'state-change',
    viewBox: [0, 0, 24, 24],
    elements: [
      { id: 'el-1', style: STYLE },
      { id: 'el-2', style: STYLE },
    ],
    states: [
      { id: 'A', elements: at(0) },
      { id: 'B', elements: at(10) },
      { id: 'C', elements: at(20) },
    ],
    sequence: {
      steps: [{ from: 'A', to: 'B', duration: 100, easing: LINEAR, ...step }],
      repeat: 'once',
    },
    trigger: { type: 'manual' },
    reducedMotion: { mode: 'instant' },
    ...overrides,
  };
  return animation;
}

/** y of the first point of an element in the current values. */
export function yOf(values: Record<string, ElementState>, id = 'el-1'): number {
  const s = values[id]!.segments[0]!;
  return s.cmd === 'Z' ? NaN : s.y;
}

export interface FakeClock extends Clock {
  /** Moves time forward in frame-sized steps, running frame callbacks. */
  advance(ms: number, frame?: number): void;
}

export function fakeClock(): FakeClock {
  let time = 0;
  let nextId = 0;
  const callbacks = new Map<number, () => void>();
  return {
    now: () => time,
    frame(cb) {
      callbacks.set(++nextId, cb);
      return nextId;
    },
    cancel(id) {
      callbacks.delete(id);
    },
    advance(ms, frame = 10) {
      let left = ms;
      while (left > 1e-9) {
        const dt = Math.min(frame, left);
        time += dt;
        left -= dt;
        const due = [...callbacks.values()];
        callbacks.clear();
        due.forEach((cb) => cb());
      }
    },
  };
}

export function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  return svg;
}

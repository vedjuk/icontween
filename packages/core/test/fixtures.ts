import type { Animation, ElementState, Segment } from '../src';

export function elementState(
  segments: Segment[],
  overrides: Partial<ElementState> = {},
): ElementState {
  return {
    segments,
    transform: { translateX: 0, translateY: 0, rotate: 0, scale: 1, originX: 12, originY: 12 },
    opacity: 1,
    draw: { start: 0, end: 1 },
    ...overrides,
  };
}

/** A minimal two-state animation: a check mark that flattens into a dash. */
export function checkToDash(): Animation {
  return {
    id: 'anim-1',
    name: 'Check → Dash',
    purpose: 'state-change',
    viewBox: [0, 0, 24, 24],
    elements: [
      {
        id: 'el-1',
        name: 'mark',
        style: {
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          fill: 'none',
        },
      },
    ],
    states: [
      {
        id: 'A',
        elements: {
          'el-1': elementState([
            { cmd: 'M', x: 20, y: 6 },
            { cmd: 'L', x: 9, y: 17 },
            { cmd: 'L', x: 4, y: 12 },
          ]),
        },
      },
      {
        id: 'B',
        label: 'Dash',
        elements: {
          'el-1': elementState([
            { cmd: 'M', x: 19, y: 12 },
            { cmd: 'L', x: 12, y: 12 },
            { cmd: 'L', x: 5, y: 12 },
          ]),
        },
      },
    ],
    sequence: {
      steps: [
        {
          from: 'A',
          to: 'B',
          duration: { token: 'base' },
          easing: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
        },
      ],
      repeat: 'once',
    },
    trigger: { type: 'toggle' },
    reducedMotion: { mode: 'instant' },
  };
}

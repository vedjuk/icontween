/**
 * Hand-built two-state animations for the runtime playground. Temporary: from M2 part 2
 * these are made in the editor (and later ship as .icontween.json starters).
 */
import {
  prepareSvg,
  type Animation,
  type ElementState,
  type ElementStyle,
  type Segment,
} from '@icontween/core';
import { STARTER_SOURCES } from '../starters';

export interface Demo {
  id: string;
  label: string;
  animation: Animation;
}

const STROKE: ElementStyle = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
};

const at = (segments: Segment[], extra: Partial<ElementState> = {}): ElementState => ({
  segments,
  transform: { translateX: 0, translateY: 0, rotate: 0, scale: 1, originX: 12, originY: 12 },
  opacity: 1,
  draw: { start: 0, end: 1 },
  ...extra,
});

const twoStates = (
  id: string,
  name: string,
  elements: Animation['elements'],
  a: Record<string, ElementState>,
  b: Record<string, ElementState>,
): Animation => ({
  id,
  name,
  purpose: 'state-change',
  viewBox: [0, 0, 24, 24],
  elements,
  states: [
    { id: 'A', elements: a },
    { id: 'B', elements: b },
  ],
  sequence: {
    steps: [
      {
        from: 'A',
        to: 'B',
        duration: { token: 'base' },
        easing: { type: 'token', name: 'standard' },
      },
    ],
    repeat: 'once',
  },
  trigger: { type: 'hover' },
  reducedMotion: { mode: 'instant' },
});

/** Menu → close, from the prepared Lucide menu. The middle bar shrinks to the centre and fades. */
function menuToClose(): Demo {
  const source = STARTER_SOURCES.find((s) => s.id === 'lucide-menu');
  const result = source && prepareSvg(source.svg);
  if (!result?.ok) throw new Error('lucide-menu did not prepare');
  const { elements, state } = result.icon;
  const [top, middle, bottom] = elements.map((e) => e.id) as [string, string, string];
  const line = (x1: number, y1: number, x2: number, y2: number): Segment[] => [
    { cmd: 'M', x: x1, y: y1 },
    { cmd: 'L', x: x2, y: y2 },
  ];
  const b = {
    [top]: { ...state.elements[top]!, segments: line(6, 6, 18, 18) },
    [middle]: { ...state.elements[middle]!, segments: line(12, 12, 12, 12), opacity: 0 },
    [bottom]: { ...state.elements[bottom]!, segments: line(6, 18, 18, 6) },
  };
  return {
    id: 'menu-close',
    label: 'Menu → close',
    animation: twoStates('menu-close', 'Menu → Close', elements, state.elements, b),
  };
}

/** A circle as four cubics, starting at the right and running clockwise (like prepare). */
function circle(cx: number, cy: number, r: number): Segment[] {
  const k = r * 0.5522847498;
  return [
    { cmd: 'M', x: cx + r, y: cy },
    { cmd: 'C', x1: cx + r, y1: cy + k, x2: cx + k, y2: cy + r, x: cx, y: cy + r },
    { cmd: 'C', x1: cx - k, y1: cy + r, x2: cx - r, y2: cy + k, x: cx - r, y: cy },
    { cmd: 'C', x1: cx - r, y1: cy - k, x2: cx - k, y2: cy - r, x: cx, y: cy - r },
    { cmd: 'C', x1: cx + k, y1: cy - r, x2: cx + r, y2: cy - k, x: cx + r, y: cy },
    { cmd: 'Z' },
  ];
}

/** A slider track with a gap for a knob at `knobX`: two subpaths in one element. */
function track(y: number, knobX: number, r: number): Segment[] {
  return [
    { cmd: 'M', x: 3, y },
    { cmd: 'L', x: knobX - r - 1, y },
    { cmd: 'M', x: knobX + r + 1, y },
    { cmd: 'L', x: 21, y },
  ];
}

/** The M2 "done when" morph: two sliders whose knobs swap sides. */
function filterSliders(): Demo {
  const r = 2.5;
  const elements = ['track-1', 'knob-1', 'track-2', 'knob-2'].map((id) => ({
    id,
    name: id,
    style: STROKE,
  }));
  const values = (k1: number, k2: number) => ({
    'track-1': at(track(7, k1, r)),
    'knob-1': at(circle(k1, 7, r)),
    'track-2': at(track(17, k2, r)),
    'knob-2': at(circle(k2, 17, r)),
  });
  return {
    id: 'filter',
    label: 'Filter sliders',
    animation: twoStates('filter', 'Filter', elements, values(8, 16), values(16, 8)),
  };
}

export const DEMOS: Demo[] = [filterSliders(), menuToClose()];

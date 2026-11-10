/**
 * The 12 starter examples (brief §12), built with only the operations the editor's controls
 * call (the same core functions the store uses). Shared by core's starter tests and the
 * runtime's SMIL comparison (decision 017).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import {
  addStateCopy,
  applyPattern,
  createAnimation,
  editablePoints,
  movePoint,
  prepareSvg,
  setElementDelay,
  setElementSegments,
  setElementValues,
  setPivot,
  setStepTiming,
  type Animation,
  type ElementValuesPatch,
  type MotionTokens,
  type PreparedIcon,
  type Purpose,
  type Segment,
  type Sequence,
  type TriggerType,
} from '../src';

const SOURCES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'examples',
  'source',
);

export function load(name: string): PreparedIcon {
  const result = prepareSvg(readFileSync(join(SOURCES, `${name}.svg`), 'utf8'));
  if (!result.ok) throw new Error(result.error);
  return result.icon;
}

// --- Editor actions, as the store performs them --------------------------------------

/** The "+ State" button: copies the last state. */
function addState(a: Animation): Animation {
  return addStateCopy(a, a.states[a.states.length - 1]!.id).animation;
}

/**
 * Moves every editable point of one element to where it is in `target`, one point at a
 * time, the way a designer types X/Y values: anchors first (they carry their handles),
 * then handles.
 */
function shapeTo(a: Animation, stateId: string, elementId: string, target: Segment[]): Animation {
  const current = () => a.states.find((s) => s.id === stateId)!.elements[elementId]!.segments;
  for (const role of ['anchor', 'handles'] as const) {
    for (const p of editablePoints(current())) {
      if ((role === 'anchor') !== (p.role === 'anchor')) continue;
      const t = target[p.segment]!;
      if (t.cmd === 'Z') throw new Error('No point on Z');
      const xy =
        p.role === 'c1' && t.cmd === 'C'
          ? { x: t.x1, y: t.y1 }
          : p.role === 'c2' && t.cmd === 'C'
            ? { x: t.x2, y: t.y2 }
            : { x: t.x, y: t.y };
      a = setElementSegments(a, stateId, elementId, movePoint(current(), p, xy.x, xy.y));
    }
  }
  expect(current()).toEqual(target);
  return a;
}

const values = (a: Animation, stateId: string, ids: string[], patch: ElementValuesPatch) =>
  ids.reduce((acc, id) => setElementValues(acc, stateId, id, patch), a);

const pivot = (a: Animation, ids: string[], x: number, y: number) =>
  ids.reduce((acc, id) => setPivot(acc, id, x, y), a);

const trigger = (a: Animation, type: TriggerType): Animation => ({ ...a, trigger: { type } });

const repeat = (a: Animation, mode: Sequence['repeat'], rest?: number): Animation => ({
  ...a,
  sequence: { ...a.sequence, repeat: mode, restBetweenLoops: rest },
});

function start(icon: string, purpose: Purpose): Animation {
  return createAnimation(load(icon), { id: icon, name: icon, purpose });
}

// --- Geometry helpers ------------------------------------------------------------------

export type Pt = { x: number; y: number };
export type C = Extract<Segment, { cmd: 'C' }>;

const L = (x: number, y: number): Segment => ({ cmd: 'L', x, y });
const M = (x: number, y: number): Segment => ({ cmd: 'M', x, y });
const Cu = (x1: number, y1: number, x2: number, y2: number, x: number, y: number): C => ({
  cmd: 'C',
  x1,
  y1,
  x2,
  y2,
  x,
  y,
});
/** A straight cubic, handles on the line at thirds. */
const straight = (from: Pt, to: Pt): C => {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const at = (t: number) => ({
    x: r(from.x + (to.x - from.x) * t),
    y: r(from.y + (to.y - from.y) * t),
  });
  const [a, b] = [at(1 / 3), at(2 / 3)];
  return Cu(a.x, a.y, b.x, b.y, to.x, to.y);
};

/** Splits a cubic at t = 0.5 (de Casteljau), rounded like prepared geometry. */
export function halve(p0: Pt, c: C): [C, C] {
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const c1 = { x: c.x1, y: c.y1 };
  const c2 = { x: c.x2, y: c.y2 };
  const p3 = { x: c.x, y: c.y };
  const a = mid(p0, c1);
  const b = mid(c1, c2);
  const d = mid(c2, p3);
  const e = mid(a, b);
  const f = mid(b, d);
  const m = mid(e, f);
  return [
    Cu(r(a.x), r(a.y), r(e.x), r(e.y), r(m.x), r(m.y)),
    Cu(r(f.x), r(f.y), r(d.x), r(d.y), c.x, c.y),
  ];
}

// --- The 12 starters (brief §12) ------------------------------------------------------

export const builds: Record<string, () => Animation> = {
  /** State change: prepare pause; A is reshaped into play, B stays pause. */
  'play-pause': () => {
    let a = addState(start('pause', 'state-change'));
    // Play's rounded triangle in a rounded rect's structure (M L C L C L C L C Z): the
    // top-right and bottom-right corners share the tip, the right edge has no length.
    const triangle: Segment[] = [
      M(8.008, 3.272),
      L(20.005, 10.27),
      Cu(20.621, 10.628, 21.001, 11.286, 21.001, 11.998),
      L(21.001, 11.998),
      Cu(21.002, 12.71, 20.624, 13.369, 20.008, 13.728),
      L(8.008, 20.728),
      Cu(6.678, 21.504, 5, 20.54, 5, 19),
      L(5, 5),
      Cu(5, 3.46, 6.678, 2.496, 8.008, 3.272),
      { cmd: 'Z' },
    ];
    // Both bars become the same triangle, so they merge.
    a = shapeTo(a, 'A', 'el-1', triangle);
    return shapeTo(a, 'A', 'el-2', triangle);
  },

  /** State change: the top and bottom lines turn into the cross, the middle one fades. */
  'menu-x': () => {
    let a = addState(start('menu', 'state-change'));
    a = values(a, 'B', ['el-1'], { transform: { rotate: 45, translateY: 7 } });
    a = values(a, 'B', ['el-3'], { transform: { rotate: -45, translateY: -7 } });
    return values(a, 'B', ['el-2'], { opacity: 0 });
  },

  /** State change: the shackle's right leg shortens into lock-open's open end. */
  'lock-unlock': () => {
    const a = addState(start('lock', 'state-change'));
    return shapeTo(a, 'B', 'el-2', [
      M(7, 11),
      L(7, 7),
      Cu(6.997, 4.431, 8.942, 2.278, 11.498, 2.02),
      Cu(14.053, 1.762, 16.389, 3.483, 16.9, 6),
      L(16.9, 6),
    ]);
  },

  /**
   * State change: prepare eye-off (it has the slash); A is reshaped into the open eye:
   * the two lid pieces close up, the half pupil becomes a full circle, the slash is undrawn.
   */
  'eye-eye-off': () => {
    let a = addState(start('eye-off', 'state-change'));
    const lowerLeft = Cu(7.646, 18.999, 3.722, 16.373, 2.062, 12.348);
    const [ll1, ll2] = halve({ x: 12, y: 18.999 }, lowerLeft);
    a = shapeTo(a, 'A', 'el-1', [
      M(12, 5.001),
      Cu(16.354, 5.001, 20.278, 7.627, 21.938, 11.652),
      Cu(22.021, 11.877, 22.021, 12.123, 21.938, 12.348),
      Cu(20.278, 16.373, 16.354, 18.999, 12, 18.999),
    ]);
    a = shapeTo(a, 'A', 'el-3', [
      M(12, 18.999),
      ll1,
      ll2,
      Cu(1.979, 12.123, 1.979, 11.877, 2.062, 11.652),
      Cu(3.722, 7.627, 7.646, 5.001, 12, 5.001),
    ]);
    // A circle of radius 3 from two half-circle cubics (handles 4/3 r), starting where
    // eye-off's half pupil starts, so it unrolls in place.
    a = shapeTo(a, 'A', 'el-2', [
      M(14.121, 14.121),
      Cu(11.293, 16.949, 7.051, 12.707, 9.879, 9.879),
      Cu(12.707, 7.051, 16.949, 11.293, 14.121, 14.121),
    ]);
    return values(a, 'A', ['el-4'], { draw: { end: 0 } });
  },

  /** State change: the two sound waves straighten into the x. */
  'volume-mute': () => {
    let a = addState(start('volume-2', 'state-change'));
    a = shapeTo(a, 'B', 'el-2', [
      M(16.5, 9.5),
      straight({ x: 16.5, y: 9.5 }, { x: 21.5, y: 14.5 }),
    ]);
    return shapeTo(a, 'B', 'el-3', [
      M(16.5, 14.5),
      straight({ x: 16.5, y: 14.5 }, { x: 19, y: 12 }),
      straight({ x: 19, y: 12 }, { x: 21.5, y: 9.5 }),
    ]);
  },

  /**
   * Feedback: the front sheet folds into a check (traced there and back, so the closed
   * rect fits), the back sheet fades. The return waits ~1 s on the check.
   */
  'copy-check': () => {
    let a = addState(start('copy', 'feedback'));
    const tip = Cu(9, 17, 9, 17, 9, 17);
    const end = Cu(20, 6, 20, 6, 20, 6);
    a = shapeTo(a, 'B', 'el-1', [
      M(4, 12),
      L(9, 17),
      tip,
      L(20, 6),
      end,
      L(9, 17),
      tip,
      L(4, 12),
      Cu(4, 12, 4, 12, 4, 12),
      { cmd: 'Z' },
    ]);
    a = values(a, 'B', ['el-2'], { opacity: 0 });
    a = setElementDelay(a, 1, 'el-1', 1000);
    return setElementDelay(a, 1, 'el-2', 1000);
  },

  /** Feedback: the plane flies off to the top right and comes back in from the bottom left. */
  send: () => {
    let a = addState(addState(start('send', 'feedback')));
    expect(a.sequence.steps.map((s) => s.to)).toEqual(['B', 'C', 'A']);
    a = values(a, 'B', ['el-1', 'el-2'], {
      transform: { translateX: 8, translateY: -8 },
      opacity: 0,
    });
    a = values(a, 'C', ['el-1', 'el-2'], {
      transform: { translateX: -8, translateY: 8 },
      opacity: 0,
    });
    return setStepTiming(a, 1, { duration: 0 }); // the jump while invisible
  },

  /** Feedback: the arrow dips into the tray and back. */
  download: () => {
    const a = addState(start('download', 'feedback'));
    return values(a, 'B', ['el-1', 'el-3'], { transform: { translateY: 3 } });
  },

  /** Attention: swings from the top, twice, the clapper a beat behind. */
  bell: () => {
    let a = addState(addState(start('bell', 'attention')));
    a = pivot(a, ['el-1', 'el-2'], 12, 2);
    a = values(a, 'B', ['el-1', 'el-2'], { transform: { rotate: 14 } });
    a = values(a, 'C', ['el-1', 'el-2'], { transform: { rotate: -14 } });
    expect(a.sequence.steps.map((s) => s.to)).toEqual(['B', 'C', 'A', 'B', 'C', 'A']);
    for (let i = 0; i < a.sequence.steps.length; i++) a = setElementDelay(a, i, 'el-1', 60);
    return a;
  },

  /** Delight: squash, then pop past full size, on a bouncy spring. */
  heart: () => {
    let a = addState(addState(start('heart', 'delight')));
    a = values(a, 'B', ['el-1'], { transform: { scale: 0.8 } });
    return values(a, 'C', ['el-1'], { transform: { scale: 1.15 } });
  },

  /** Discoverability: on hover the magnifier tilts around its lens. */
  search: () => {
    let a = addState(start('search', 'discoverability'));
    a = pivot(a, ['el-1', 'el-2'], 11, 11);
    return values(a, 'B', ['el-1', 'el-2'], { transform: { rotate: -15, scale: 1.05 } });
  },

  /** Loading: one full turn, linear, looping while visible. */
  'refresh-cw': () => {
    let a = addState(start('refresh-cw', 'feedback'));
    const all = ['el-1', 'el-2', 'el-3', 'el-4'];
    a = pivot(a, all, 12, 12);
    a = values(a, 'B', all, { transform: { rotate: 360 } });
    a = applyPattern(a, 'hold');
    a = setStepTiming(a, 0, {
      duration: 1000,
      easing: { type: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 },
    });
    a = trigger(a, 'loop');
    return repeat(a, 'loop', 0);
  },
};

/** The runtime's default tokens (core doesn't depend on the runtime, so they're copied). */
export const TOKENS: MotionTokens = {
  durations: { fast: 150, base: 250, slow: 400 },
  easings: {
    standard: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
    snappy: { type: 'cubic-bezier', x1: 0.3, y1: 0, x2: 0, y2: 1 },
    'spring-gentle': { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
    'spring-snappy': { type: 'spring', stiffness: 400, damping: 28, mass: 1 },
    'spring-bouncy': { type: 'spring', stiffness: 300, damping: 14, mass: 1 },
  },
};

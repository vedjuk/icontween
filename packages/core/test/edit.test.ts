// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  addStateCopy,
  circleToSegments,
  createAnimation,
  editablePoints,
  movePoint,
  iconToSvg,
  nextStateId,
  paintAttributes,
  pivotPresets,
  prepareSvg,
  resetElementValues,
  setElementSegments,
  setElementValues,
  setPivot,
  validateAnimation,
  type Segment,
} from '../src';

const SLIDER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 7h4M11 7h10" /><circle cx="9" cy="7" r="2" />
</svg>`;

function prepared() {
  const result = prepareSvg(SLIDER);
  if (!result.ok) throw new Error(result.error);
  return result.icon;
}

describe('createAnimation / addStateCopy', () => {
  it('starts with state A and no steps, without touching the icon', () => {
    const icon = prepared();
    const before = JSON.stringify(icon);
    const anim = createAnimation(icon, { id: 'a1', name: 'Slider' });
    expect(anim.states.map((s) => s.id)).toEqual(['A']);
    expect(anim.sequence.steps).toEqual([]);
    expect(validateAnimation(anim)).toEqual({ ok: true });
    anim.states[0]!.elements['el-1']!.segments[0] = { cmd: 'M', x: 99, y: 99 };
    expect(JSON.stringify(icon)).toBe(before);
  });

  it('adds B as a deep copy with a step A → B, then C with B → C', () => {
    const anim = createAnimation(prepared(), { id: 'a1', name: 'Slider' });
    const b = addStateCopy(anim, 'A');
    expect(b.stateId).toBe('B');
    expect(b.animation.sequence.steps).toEqual([
      expect.objectContaining({ from: 'A', to: 'B', duration: { token: 'base' } }),
    ]);
    expect(b.animation.states[1]!.elements).toEqual(anim.states[0]!.elements);
    expect(b.animation.states[1]!.elements['el-1']).not.toBe(anim.states[0]!.elements['el-1']);
    expect(anim.states).toHaveLength(1);

    const c = addStateCopy(b.animation, 'B');
    expect(c.stateId).toBe('C');
    expect(c.animation.sequence.steps[1]).toMatchObject({ from: 'B', to: 'C' });
    expect(validateAnimation(c.animation)).toEqual({ ok: true });
  });

  it('picks the next free id', () => {
    const s = (id: string) => ({ id, elements: {} });
    expect(nextStateId([s('A'), s('C')])).toBe('B');
  });
});

describe('editablePoints', () => {
  it('lists anchors and handles, showing a closed shape’s start once', () => {
    const circle = circleToSegments(9, 7, 2);
    const points = editablePoints(circle);
    const anchors = points.filter((p) => p.role === 'anchor');
    expect(anchors).toHaveLength(4);
    expect(anchors[0]).toMatchObject({ segment: 0, x: 11, y: 7 });
    expect(points.filter((p) => p.role !== 'anchor')).toHaveLength(8);
    // The last handle hangs from the (hidden) closing point, which is at the start.
    expect(points.find((p) => p.segment === 4 && p.role === 'c2')).toMatchObject({
      anchorX: 11,
      anchorY: 7,
    });
  });

  it('keeps every anchor of an open path and of a polygon closed by Z', () => {
    const open: Segment[] = [
      { cmd: 'M', x: 0, y: 0 },
      { cmd: 'L', x: 4, y: 0 },
      { cmd: 'M', x: 6, y: 0 },
      { cmd: 'L', x: 10, y: 0 },
    ];
    expect(editablePoints(open)).toHaveLength(4);
    const triangle: Segment[] = [
      { cmd: 'M', x: 0, y: 0 },
      { cmd: 'L', x: 4, y: 0 },
      { cmd: 'L', x: 2, y: 3 },
      { cmd: 'Z' },
    ];
    expect(editablePoints(triangle)).toHaveLength(3);
  });
});

describe('movePoint', () => {
  const curve: Segment[] = [
    { cmd: 'M', x: 0, y: 0 },
    { cmd: 'C', x1: 1, y1: 0, x2: 3, y2: 0, x: 4, y: 0 },
    { cmd: 'C', x1: 5, y1: 0, x2: 7, y2: 0, x: 8, y: 0 },
  ];

  it('moves an anchor with both of its handles', () => {
    const out = movePoint(curve, { segment: 1, role: 'anchor' }, 4, 2);
    expect(out[1]).toEqual({ cmd: 'C', x1: 1, y1: 0, x2: 3, y2: 2, x: 4, y: 2 });
    expect(out[2]).toEqual({ cmd: 'C', x1: 5, y1: 2, x2: 7, y2: 0, x: 8, y: 0 });
    expect(curve[1]).toMatchObject({ y: 0 }); // input untouched
  });

  it('moves a handle alone', () => {
    const out = movePoint(curve, { segment: 2, role: 'c1' }, 5, -1);
    expect(out[2]).toMatchObject({ x1: 5, y1: -1, x2: 7, y2: 0 });
    expect(out[1]).toEqual(curve[1]);
  });

  it('moves the start of a closed shape together with its closing point', () => {
    const circle = circleToSegments(9, 7, 2);
    const out = movePoint(circle, { segment: 0, role: 'anchor' }, 13, 7);
    expect(out[0]).toEqual({ cmd: 'M', x: 13, y: 7 });
    expect(out[4]).toMatchObject({ x: 13, y: 7 });
    expect(out[1]).toMatchObject({ x1: 13 }); // first handle follows
    expect((out[4] as { x2: number }).x2).toBe(13); // last handle follows
  });

  it('moves line ends and rounds to 3 decimals', () => {
    const out = movePoint(curve.slice(0, 1), { segment: 0, role: 'anchor' }, 1.23456, 2.0004);
    expect(out[0]).toEqual({ cmd: 'M', x: 1.235, y: 2 });
  });
});

describe('setElementSegments', () => {
  it('replaces one state’s segments and refuses structure changes', () => {
    const { animation } = addStateCopy(createAnimation(prepared(), { id: 'a', name: 'a' }), 'A');
    const segs = animation.states[1]!.elements['el-1']!.segments;
    const moved = movePoint(segs, { segment: 0, role: 'anchor' }, 5, 5);
    const next = setElementSegments(animation, 'B', 'el-1', moved);
    expect(next.states[1]!.elements['el-1']!.segments[0]).toEqual({ cmd: 'M', x: 5, y: 5 });
    expect(next.states[0]).toBe(animation.states[0]);
    expect(() => setElementSegments(animation, 'B', 'el-1', moved.slice(1))).toThrow(/structure/);
  });
});

describe('setElementValues', () => {
  const withB = () =>
    addStateCopy(createAnimation(prepared(), { id: 'a', name: 'a' }), 'A').animation;

  it('changes transform, opacity and draw in one state only, rounded', () => {
    const animation = withB();
    const next = setElementValues(animation, 'B', 'el-1', {
      transform: { rotate: 45.12345, translateY: -2 },
      opacity: 0.5,
      draw: { end: 0.25 },
    });
    const es = next.states[1]!.elements['el-1']!;
    expect(es.transform).toMatchObject({ rotate: 45.123, translateY: -2, translateX: 0, scale: 1 });
    expect(es.opacity).toBe(0.5);
    expect(es.draw).toEqual({ start: 0, end: 0.25 });
    expect(next.states[0]).toBe(animation.states[0]);
    expect(animation.states[1]!.elements['el-1']!.opacity).toBe(1);
    expect(validateAnimation(next).ok).toBe(true);
  });

  it('clamps opacity and draw, and stops draw start and end at each other', () => {
    let a = setElementValues(withB(), 'B', 'el-1', { opacity: 1.5, draw: { end: 0.4 } });
    a = setElementValues(a, 'B', 'el-1', { draw: { start: 0.9 } });
    expect(a.states[1]!.elements['el-1']!.opacity).toBe(1);
    expect(a.states[1]!.elements['el-1']!.draw).toEqual({ start: 0.4, end: 0.4 });
    a = setElementValues(a, 'B', 'el-1', { draw: { end: 0.1 } });
    expect(a.states[1]!.elements['el-1']!.draw).toEqual({ start: 0.4, end: 0.4 });
    a = setElementValues(a, 'B', 'el-1', { draw: { start: -1, end: 2 }, opacity: -3 });
    expect(a.states[1]!.elements['el-1']!.draw).toEqual({ start: 0, end: 1 });
    expect(a.states[1]!.elements['el-1']!.opacity).toBe(0);
    expect(validateAnimation(a).ok).toBe(true);
  });

  it('ignores non-finite numbers and pivot keys, and rejects unknown ids', () => {
    const a = withB();
    const next = setElementValues(a, 'B', 'el-1', {
      transform: { rotate: NaN, originX: 99 } as never,
      opacity: Infinity,
    });
    expect(next.states[1]!.elements['el-1']).toEqual(a.states[1]!.elements['el-1']);
    expect(() => setElementValues(a, 'Q', 'el-1', {})).toThrow(/Unknown state/);
    expect(() => setElementValues(a, 'B', 'nope', {})).toThrow(/no element/);
  });

  it('resets values but keeps the pivot', () => {
    let a = setPivot(withB(), 'el-1', 3, 4);
    a = setElementValues(a, 'B', 'el-1', {
      transform: { rotate: 10, scale: 2, translateX: 1 },
      opacity: 0.2,
      draw: { start: 0.5 },
    });
    const es = resetElementValues(a, 'B', 'el-1').states[1]!.elements['el-1']!;
    expect(es.transform).toEqual({
      translateX: 0,
      translateY: 0,
      rotate: 0,
      scale: 1,
      originX: 3,
      originY: 4,
    });
    expect(es.opacity).toBe(1);
    expect(es.draw).toEqual({ start: 0, end: 1 });
  });
});

describe('setPivot / pivotPresets', () => {
  it('sets one pivot for the element in every state', () => {
    const a = setPivot(
      addStateCopy(createAnimation(prepared(), { id: 'a', name: 'a' }), 'A').animation,
      'el-2',
      9.12345,
      5,
    );
    for (const state of a.states) {
      expect(state.elements['el-2']!.transform).toMatchObject({ originX: 9.123, originY: 5 });
    }
    expect(a.states[0]!.elements['el-1']!.transform.originX).not.toBe(9.123);
  });

  it('offers the 3 × 3 grid of the element’s box in state A', () => {
    // el-2 is the circle at (9, 7) with r 2.
    const presets = pivotPresets(createAnimation(prepared(), { id: 'a', name: 'a' }), 'el-2');
    expect(presets).toHaveLength(9);
    expect(presets[0]).toEqual({ col: 0, row: 0, x: 7, y: 5 });
    expect(presets[4]).toEqual({ col: 1, row: 1, x: 9, y: 7 });
    expect(presets[8]).toEqual({ col: 2, row: 2, x: 11, y: 9 });
  });
});

describe('paintAttributes', () => {
  it('is empty at the defaults and describes partial draws', () => {
    const es = createAnimation(prepared(), { id: 'a', name: 'a' }).states[0]!.elements['el-1']!;
    expect(paintAttributes(es)).toEqual({});
    expect(paintAttributes({ ...es, opacity: 0.5, draw: { start: 0.25, end: 0.75 } })).toEqual({
      opacity: '0.5',
      pathLength: '1',
      strokeDasharray: '0.5 2',
      strokeDashoffset: '-0.25',
    });
    expect(paintAttributes({ ...es, draw: { start: 0.5, end: 0.5 } }).opacity).toBe('0');
  });

  it('is written by iconToSvg', () => {
    const a = setElementValues(createAnimation(prepared(), { id: 'a', name: 'a' }), 'A', 'el-1', {
      draw: { end: 0.5 },
    });
    const svg = iconToSvg(a.viewBox, a.elements, a.states[0]!.elements);
    expect(svg).toContain('pathLength="1" stroke-dasharray="0.5 2" stroke-dashoffset="0"');
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  addStateCopy,
  circleToSegments,
  createAnimation,
  editablePoints,
  movePoint,
  nextStateId,
  prepareSvg,
  setElementSegments,
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

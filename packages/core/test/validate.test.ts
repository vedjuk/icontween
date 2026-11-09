import { describe, expect, it } from 'vitest';
import { assertValidAnimation, AnimationValidationError, validateAnimation } from '../src';
import { checkToDash, elementState } from './fixtures';

function issuesOf(animation: ReturnType<typeof checkToDash>) {
  const result = validateAnimation(animation);
  return result.ok ? [] : result.issues;
}

describe('validateAnimation', () => {
  it('accepts a well-formed animation', () => {
    expect(validateAnimation(checkToDash())).toEqual({ ok: true });
  });

  it('rejects a state with a different segment count', () => {
    const a = checkToDash();
    a.states[1]!.elements['el-1']!.segments.push({ cmd: 'L', x: 1, y: 1 });
    expect(issuesOf(a)).toEqual([
      expect.objectContaining({
        path: 'states[1].elements.el-1.segments',
        message: 'Has 4 segments, state A has 3',
      }),
    ]);
  });

  it('rejects a state with a different command sequence', () => {
    const a = checkToDash();
    a.states[1]!.elements['el-1']!.segments[1] = {
      cmd: 'C',
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      x: 12,
      y: 12,
    };
    expect(issuesOf(a)).toEqual([
      expect.objectContaining({ path: 'states[1].elements.el-1.segments[1]' }),
    ]);
  });

  it('rejects a state missing an element, or with an unknown one', () => {
    const a = checkToDash();
    const b = a.states[1]!;
    b.elements['el-9'] = b.elements['el-1']!;
    delete b.elements['el-1'];
    const paths = issuesOf(a).map((i) => i.path);
    expect(paths).toContain('states[1].elements.el-1');
    expect(paths).toContain('states[1].elements.el-9');
  });

  it('requires state A first and unique state ids', () => {
    const a = checkToDash();
    a.states[0]!.id = 'B';
    const paths = issuesOf(a).map((i) => i.path);
    expect(paths).toContain('states[0].id');
    expect(paths).toContain('states[1].id');
  });

  it('requires at least one state', () => {
    const a = checkToDash();
    a.states = [];
    expect(issuesOf(a)).toEqual([expect.objectContaining({ path: 'states' })]);
  });

  it('rejects duplicate element ids', () => {
    const a = checkToDash();
    a.elements.push({ ...a.elements[0]! });
    expect(issuesOf(a).map((i) => i.path)).toContain('elements[1].id');
  });

  it('rejects paths that do not start with M', () => {
    const a = checkToDash();
    for (const s of a.states) {
      s.elements['el-1'] = elementState([{ cmd: 'L', x: 1, y: 1 }]);
    }
    expect(issuesOf(a).map((i) => i.path)).toContain('states[0].elements.el-1.segments[0]');
  });

  it('rejects non-canonical commands smuggled in from untyped data', () => {
    const a = checkToDash();
    const segs = a.states[0]!.elements['el-1']!.segments as unknown as { cmd: string }[];
    segs[1] = { cmd: 'Q' };
    expect(issuesOf(a).map((i) => i.message)).toContain('Non-canonical command "Q"');
  });

  it('rejects non-finite numbers and out-of-range values', () => {
    const a = checkToDash();
    const el = a.states[1]!.elements['el-1']!;
    el.segments[0] = { cmd: 'M', x: NaN, y: 0 };
    el.transform.rotate = Infinity;
    el.opacity = 1.5;
    el.draw = { start: 0.8, end: 0.2 };
    expect(issuesOf(a).map((i) => i.path)).toEqual([
      'states[1].elements.el-1.segments[0].x',
      'states[1].elements.el-1.transform.rotate',
      'states[1].elements.el-1.opacity',
      'states[1].elements.el-1.draw',
    ]);
  });

  it('checks sequence references, durations and easings', () => {
    const a = checkToDash();
    a.sequence.steps.push({
      from: 'B',
      to: 'Z',
      duration: -10,
      easing: { type: 'cubic-bezier', x1: 2, y1: 0, x2: 0, y2: 1 },
      delays: { 'el-7': 10 },
      stagger: -1,
    });
    a.sequence.restBetweenLoops = -5;
    expect(issuesOf(a).map((i) => i.path)).toEqual([
      'sequence.steps[1].to',
      'sequence.steps[1].duration',
      'sequence.steps[1].easing',
      'sequence.steps[1].delays.el-7',
      'sequence.steps[1].stagger',
      'sequence.restBetweenLoops',
    ]);
  });

  it('checks springs', () => {
    const a = checkToDash();
    a.sequence.steps[0]!.easing = { type: 'spring', stiffness: 0, damping: 10, mass: 1 };
    expect(issuesOf(a).map((i) => i.path)).toEqual(['sequence.steps[0].easing']);
  });

  it('checks metadata enums and viewBox', () => {
    const a = checkToDash();
    (a as { purpose: string }).purpose = 'decoration';
    (a.trigger as { type: string }).type = 'scroll';
    (a.reducedMotion as { mode: string }).mode = 'slow';
    a.viewBox = [0, 0, 0, 24];
    expect(issuesOf(a).map((i) => i.path)).toEqual([
      'purpose',
      'trigger.type',
      'reducedMotion.mode',
      'viewBox',
    ]);
  });
});

describe('assertValidAnimation', () => {
  it('returns valid animations unchanged', () => {
    const a = checkToDash();
    expect(assertValidAnimation(a)).toBe(a);
  });

  it('throws with all issues listed', () => {
    const a = checkToDash();
    a.states[1]!.elements['el-1']!.opacity = -1;
    expect(() => assertValidAnimation(a)).toThrow(AnimationValidationError);
    expect(() => assertValidAnimation(a)).toThrow(/states\[1\]\.elements\.el-1\.opacity/);
  });
});

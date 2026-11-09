// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  addStateCopy,
  applyPattern,
  createAnimation,
  elementOffsets,
  matchPattern,
  patternTemplates,
  prepareSvg,
  sequencePath,
  setElementDelay,
  setSequencePath,
  setStepTiming,
  validateAnimation,
  type Animation,
} from '../src';

const SLIDER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 7h4M11 7h10" /><circle cx="9" cy="7" r="2" />
</svg>`;

function withStates(count: number): Animation {
  const result = prepareSvg(SLIDER);
  if (!result.ok) throw new Error(result.error);
  let anim = createAnimation(result.icon, { id: 'a', name: 'Slider' });
  for (let i = 1; i < count; i++) {
    anim = addStateCopy(anim, anim.states[anim.states.length - 1]!.id).animation;
  }
  return anim;
}

const valid = (a: Animation) => expect(validateAnimation(a)).toEqual({ ok: true });

describe('sequence paths', () => {
  it('reads the path along the steps', () => {
    expect(sequencePath(withStates(1))).toEqual(['A']);
    expect(sequencePath(withStates(3))).toEqual(['A', 'B', 'C']);
  });

  it('rebuilds steps, keeping the timing of steps that stay', () => {
    let a = withStates(2);
    a = setStepTiming(a, 0, { duration: 400, stagger: 30 });
    a = setElementDelay(a, 0, 'el-2', 50);
    const b = setSequencePath(a, ['A', 'B', 'A']);
    expect(b.sequence.steps).toEqual([
      expect.objectContaining({
        from: 'A',
        to: 'B',
        duration: 400,
        stagger: 30,
        delays: { 'el-2': 50 },
      }),
      expect.objectContaining({ from: 'B', to: 'A', duration: { token: 'base' } }),
    ]);
    valid(b);
    // Never touches its input.
    expect(a.sequence.steps).toHaveLength(1);
  });

  it('gives a replaced step the timing of the step at its place, without delays', () => {
    let a = setSequencePath(withStates(3), ['A', 'B', 'A']);
    a = setStepTiming(a, 1, { duration: 120, stagger: 20 });
    a = setElementDelay(a, 1, 'el-1', 80);
    const b = setSequencePath(a, ['A', 'B', 'C']);
    expect(b.sequence.steps[1]).toEqual({
      from: 'B',
      to: 'C',
      duration: 120,
      easing: { type: 'token', name: 'standard' },
      stagger: 20,
    });
  });

  it('allows a hold (a step to the same state) and an empty sequence', () => {
    valid(setSequencePath(withStates(2), ['A', 'B', 'B', 'A']));
    expect(setSequencePath(withStates(2), ['A']).sequence.steps).toEqual([]);
  });

  it('rejects paths that do not start at A or name unknown states', () => {
    expect(() => setSequencePath(withStates(2), ['B', 'A'])).toThrow(/starts at state A/);
    expect(() => setSequencePath(withStates(2), ['A', 'Q'])).toThrow(/Unknown state/);
  });
});

describe('pattern templates', () => {
  it('offers hold, return and return ×2 for two states', () => {
    expect(patternTemplates(['A']).length).toBe(0);
    expect(patternTemplates(['A', 'B']).map((t) => [t.id, t.path.join('')])).toEqual([
      ['hold', 'AB'],
      ['return', 'ABA'],
      ['return-twice', 'ABABA'],
    ]);
  });

  it('adds back and forth from three states', () => {
    expect(patternTemplates(['A', 'B', 'C']).map((t) => t.path.join(''))).toEqual([
      'ABC',
      'ABCA',
      'ABCABCA',
      'ABCBA',
    ]);
  });

  it('applies and recognises templates', () => {
    const a = applyPattern(withStates(3), 'back-and-forth');
    valid(a);
    expect(matchPattern(a)?.id).toBe('back-and-forth');
    expect(matchPattern(setSequencePath(a, ['A', 'C', 'B']))).toBeUndefined();
    expect(() => applyPattern(withStates(2), 'back-and-forth')).toThrow(/more states/);
  });
});

describe('adding a state to a sequence', () => {
  it('keeps following the template', () => {
    const a = applyPattern(withStates(2), 'return');
    const c = addStateCopy(a, 'B');
    expect(sequencePath(c.animation)).toEqual(['A', 'B', 'C', 'A']);
    valid(c.animation);
  });

  it('inserts before the return of a custom closed sequence, else appends', () => {
    const closed = setSequencePath(withStates(3), ['A', 'C', 'B', 'A']);
    expect(sequencePath(addStateCopy(closed, 'C').animation)).toEqual(['A', 'C', 'B', 'D', 'A']);
    const open = setSequencePath(withStates(3), ['A', 'C', 'B']);
    expect(sequencePath(addStateCopy(open, 'C').animation)).toEqual(['A', 'C', 'B', 'D']);
  });
});

describe('step timing and delays', () => {
  it('rounds to whole ms, clamps at 0 and drops empty values', () => {
    let a = withStates(2);
    a = setStepTiming(a, 0, { duration: 123.6, stagger: -5 });
    expect(a.sequence.steps[0]!.duration).toBe(124);
    expect(a.sequence.steps[0]).not.toHaveProperty('stagger');
    a = setElementDelay(a, 0, 'el-1', 40.4);
    expect(a.sequence.steps[0]!.delays).toEqual({ 'el-1': 40 });
    a = setElementDelay(a, 0, 'el-1', 0);
    expect(a.sequence.steps[0]).not.toHaveProperty('delays');
    valid(a);
  });

  it('rejects unknown steps and elements', () => {
    expect(() => setStepTiming(withStates(2), 3, { duration: 1 })).toThrow(/No step/);
    expect(() => setElementDelay(withStates(2), 0, 'el-9', 1)).toThrow(/Unknown element/);
  });

  it('computes when each element starts: delay plus stagger in element order', () => {
    let a = setStepTiming(withStates(2), 0, { stagger: 40 });
    a = setElementDelay(a, 0, 'el-1', 100);
    expect(elementOffsets(a, 0)).toEqual({ 'el-1': 100, 'el-2': 40 });
  });
});

describe('validation of the chain', () => {
  it('requires steps to start at A and continue from the previous state', () => {
    const a = setSequencePath(withStates(3), ['A', 'B', 'C']);
    a.sequence.steps[1]!.from = 'A';
    const b = withStates(2);
    b.sequence.steps[0]!.from = 'B';
    const paths = (x: Animation) => {
      const r = validateAnimation(x);
      return r.ok ? [] : r.issues.map((i) => i.message);
    };
    expect(paths(a)).toEqual(['Must continue from "B"']);
    expect(paths(b)).toEqual(['The sequence must start at state A']);
  });
});

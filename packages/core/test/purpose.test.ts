// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  PURPOSES,
  PURPOSE_DEFAULTS,
  addStateCopy,
  applyPurposeDefaults,
  createAnimation,
  matchPattern,
  patternTemplates,
  prepareSvg,
  purposeOverrides,
  sequencePath,
  setDurationToken,
  setEasingToken,
  setElementDelay,
  setPurpose,
  setSequencePath,
  setStepTiming,
  validateAnimation,
  type Animation,
  type MotionTokens,
  type Purpose,
} from '../src';

const SLIDER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 7h4M11 7h10" /><circle cx="9" cy="7" r="2" />
</svg>`;

function withStates(count: number, purpose?: Purpose): Animation {
  const result = prepareSvg(SLIDER);
  if (!result.ok) throw new Error(result.error);
  let anim = createAnimation(result.icon, { id: 'a', name: 'Slider', purpose });
  for (let i = 1; i < count; i++) {
    anim = addStateCopy(anim, anim.states[anim.states.length - 1]!.id).animation;
  }
  return anim;
}

const valid = (a: Animation) => expect(validateAnimation(a)).toEqual({ ok: true });

describe('purpose defaults', () => {
  it('has defaults for every purpose, with patterns that exist', () => {
    const ids = patternTemplates(['A', 'B']).map((t) => t.id);
    for (const p of PURPOSES) {
      expect(PURPOSE_DEFAULTS[p].name).toBeTruthy();
      expect(ids).toContain(PURPOSE_DEFAULTS[p].pattern);
    }
  });

  it('creates an animation with the purpose’s trigger and reduced motion', () => {
    const a = withStates(1, 'attention');
    expect(a.trigger.type).toBe('appear');
    expect(a.reducedMotion.mode).toBe('none');
    expect(withStates(1).purpose).toBe('state-change');
    expect(withStates(1).trigger.type).toBe('toggle');
  });

  it('builds the first steps with the purpose’s pattern and timing', () => {
    const feedback = withStates(2, 'feedback');
    expect(sequencePath(feedback)).toEqual(['A', 'B', 'A']);
    expect(feedback.sequence.steps[0]).toMatchObject({
      duration: { token: 'base' },
      easing: { type: 'token', name: 'snappy' },
    });
    expect(purposeOverrides(feedback)).toEqual([]);
    valid(feedback);

    // Then a new state follows the pattern: A→B→C→A.
    expect(sequencePath(withStates(3, 'delight'))).toEqual(['A', 'B', 'C', 'A']);
    expect(sequencePath(withStates(2, 'attention'))).toEqual(['A', 'B', 'A', 'B', 'A']);
    expect(sequencePath(withStates(2, 'state-change'))).toEqual(['A', 'B']);
  });

  it('gives new steps the purpose’s timing when no step was at their place', () => {
    const a = setSequencePath(withStates(2, 'discoverability'), ['A', 'B', 'A']);
    expect(a.sequence.steps[1]).toMatchObject({ duration: { token: 'fast' } });
  });
});

describe('purposeOverrides', () => {
  it('lists what differs from the defaults', () => {
    let a = withStates(2);
    expect(purposeOverrides(a)).toEqual([]);
    a = { ...a, trigger: { type: 'hover' }, reducedMotion: { mode: 'fade' } };
    a = setStepTiming(a, 0, { duration: 300 });
    a = setSequencePath(a, ['A', 'B', 'A']);
    expect(purposeOverrides(a)).toEqual(['trigger', 'pattern', 'timing', 'reduced-motion']);
  });

  it('does not count a pattern the states cannot make, or stagger and delays', () => {
    let a = withStates(1);
    expect(purposeOverrides(a)).toEqual([]);
    a = setStepTiming(withStates(2), 0, { stagger: 40 });
    a = setElementDelay(a, 0, 'el-1', 100);
    expect(purposeOverrides(a)).toEqual([]);
  });

  it('treats equal easings written differently as the same', () => {
    const a = setStepTiming(withStates(2), 0, {
      duration: { token: 'base' },
      easing: { name: 'standard', type: 'token' } as never,
    });
    expect(purposeOverrides(a)).toEqual([]);
  });
});

describe('setPurpose', () => {
  it('moves every default part to the new purpose’s defaults', () => {
    const a = setPurpose(withStates(2), 'feedback');
    expect(a.purpose).toBe('feedback');
    expect(a.trigger.type).toBe('click');
    expect(matchPattern(a)?.id).toBe('return');
    expect(
      a.sequence.steps.every((s) => s.easing.type === 'token' && s.easing.name === 'snappy'),
    ).toBe(true);
    expect(purposeOverrides(a)).toEqual([]);
    valid(a);
  });

  it('keeps overrides', () => {
    let a = withStates(2);
    a = { ...a, trigger: { type: 'hover' } };
    a = setStepTiming(a, 0, { duration: 320 });
    a = setPurpose(a, 'attention');
    expect(a.trigger.type).toBe('hover');
    expect(a.reducedMotion.mode).toBe('none');
    // The step still has 320 ms, but takes the spring (its easing was the default).
    expect(a.sequence.steps[0]).toMatchObject({
      duration: 320,
      easing: { type: 'token', name: 'spring-gentle' },
    });
    // Pattern followed the purpose (Hold → Return ×2); the new steps took the old timing.
    expect(sequencePath(a)).toEqual(['A', 'B', 'A', 'B', 'A']);
    expect(purposeOverrides(a)).toEqual(['trigger', 'timing']);
    valid(a);
  });

  it('keeps a custom pattern and delays', () => {
    let a = setSequencePath(withStates(3), ['A', 'C', 'B']);
    a = setElementDelay(a, 0, 'el-2', 80);
    a = setPurpose(a, 'delight');
    expect(sequencePath(a)).toEqual(['A', 'C', 'B']);
    expect(a.sequence.steps[0]!.delays).toEqual({ 'el-2': 80 });
  });

  it('returns the same animation for the same purpose', () => {
    const a = withStates(2);
    expect(setPurpose(a, 'state-change')).toBe(a);
  });
});

describe('applyPurposeDefaults', () => {
  it('resets trigger, pattern, timing and reduced motion, keeping delays and stagger', () => {
    let a = withStates(2, 'feedback');
    a = { ...a, trigger: { type: 'loop' }, reducedMotion: { mode: 'none' } };
    a = setSequencePath(a, ['A', 'B']);
    a = setStepTiming(a, 0, { duration: 900, stagger: 30 });
    a = applyPurposeDefaults(a);
    expect(purposeOverrides(a)).toEqual([]);
    expect(sequencePath(a)).toEqual(['A', 'B', 'A']);
    expect(a.sequence.steps[0]!.stagger).toBe(30);
    valid(a);
  });
});

describe('motion tokens', () => {
  const tokens: MotionTokens = {
    durations: { fast: 150, base: 250 },
    easings: {
      standard: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
      gentle: { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
    },
  };

  it('sets durations in whole, bounded milliseconds without touching the input', () => {
    const next = setDurationToken(tokens, 'fast', 120.6);
    expect(next.durations).toEqual({ fast: 121, base: 250 });
    expect(tokens.durations.fast).toBe(150);
    expect(setDurationToken(tokens, 'base', -5).durations.base).toBe(0);
    expect(setDurationToken(tokens, 'base', NaN)).toBe(tokens);
    expect(() => setDurationToken(tokens, 'nope', 100)).toThrow();
  });

  it('keeps curves moving forwards in time and springs positive', () => {
    const curve = setEasingToken(tokens, 'standard', {
      type: 'cubic-bezier',
      x1: -0.5,
      y1: 3,
      x2: 1.2,
      y2: 0.12345,
    });
    expect(curve.easings.standard).toEqual({
      type: 'cubic-bezier',
      x1: 0,
      y1: 2,
      x2: 1,
      y2: 0.123,
    });
    const spring = setEasingToken(tokens, 'gentle', {
      type: 'spring',
      stiffness: 0,
      damping: 12,
      mass: 0,
    });
    expect(spring.easings.gentle).toEqual({ type: 'spring', stiffness: 1, damping: 12, mass: 0.1 });
  });

  it('refuses to change a token’s kind', () => {
    expect(() =>
      setEasingToken(tokens, 'standard', { type: 'spring', stiffness: 1, damping: 1, mass: 1 }),
    ).toThrow();
    expect(() => setEasingToken(tokens, 'gentle', { type: 'token', name: 'standard' })).toThrow();
  });
});

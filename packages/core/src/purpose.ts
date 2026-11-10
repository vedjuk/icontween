/**
 * Purpose: why the motion exists. It sets the trigger, step timing, sequence pattern and
 * reduced-motion mode (see defaults.ts). What differs from those defaults is an override,
 * and overrides survive a change of purpose. Pure functions, like edit.ts.
 */
import { PURPOSE_DEFAULTS, type PurposeDefaults } from './defaults';
import type { Animation, Easing, Purpose, Transition } from './schema';
import { applyPattern, matchPattern, patternTemplates } from './sequence';

/** The parts of an animation a purpose sets. */
export type PurposeField = 'trigger' | 'pattern' | 'timing' | 'reduced-motion';

export function sameEasing(a: Easing, b: Easing): boolean {
  if (a.type === 'token' || b.type === 'token') {
    return a.type === b.type && (a as { name: string }).name === (b as { name: string }).name;
  }
  if (a.type === 'cubic-bezier' && b.type === 'cubic-bezier') {
    return a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
  }
  if (a.type === 'spring' && b.type === 'spring') {
    return a.stiffness === b.stiffness && a.damping === b.damping && a.mass === b.mass;
  }
  return false;
}

export function sameDuration(a: Transition['duration'], b: Transition['duration']): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b;
  return a.token === b.token;
}

const stepIsDefault = (step: Transition, d: PurposeDefaults) =>
  sameDuration(step.duration, d.duration) && sameEasing(step.easing, d.easing);

/** True when the purpose's pattern can be built from the animation's states. */
const patternFits = (animation: Animation, d: PurposeDefaults) =>
  patternTemplates(animation.states.map((s) => s.id)).some((t) => t.id === d.pattern);

/** Which purpose-set parts differ from the purpose's defaults, in a fixed order. */
export function purposeOverrides(animation: Animation): PurposeField[] {
  const d = PURPOSE_DEFAULTS[animation.purpose];
  const steps = animation.sequence.steps;
  const out: PurposeField[] = [];
  if (animation.trigger.type !== d.trigger) out.push('trigger');
  if (steps.length && patternFits(animation, d) && matchPattern(animation)?.id !== d.pattern) {
    out.push('pattern');
  }
  if (steps.some((s) => !stepIsDefault(s, d))) out.push('timing');
  if (animation.reducedMotion.mode !== d.reducedMotion) out.push('reduced-motion');
  return out;
}

/**
 * Changes the purpose. Each part that still had the old purpose's default takes the new
 * one; overrides stay. Step timing is judged per step and per value (duration, easing).
 * Delays and stagger are never touched.
 */
export function setPurpose(animation: Animation, purpose: Purpose): Animation {
  if (purpose === animation.purpose) return animation;
  const before = PURPOSE_DEFAULTS[animation.purpose];
  const after = PURPOSE_DEFAULTS[purpose];
  let out: Animation = { ...animation, purpose };
  if (animation.trigger.type === before.trigger) out.trigger = { type: after.trigger };
  if (animation.reducedMotion.mode === before.reducedMotion) {
    out.reducedMotion = { mode: after.reducedMotion };
  }
  if (
    animation.sequence.steps.length &&
    matchPattern(animation)?.id === before.pattern &&
    patternFits(animation, after)
  ) {
    out = applyPattern(out, after.pattern);
  }
  const steps = out.sequence.steps.map((step): Transition => {
    const next = { ...step };
    if (sameDuration(step.duration, before.duration)) next.duration = { ...after.duration };
    if (sameEasing(step.easing, before.easing)) next.easing = { ...after.easing };
    return next;
  });
  return { ...out, sequence: { ...out.sequence, steps } };
}

/** Sets every purpose-set part to the current purpose's defaults. Keeps delays and stagger. */
export function applyPurposeDefaults(animation: Animation): Animation {
  const d = PURPOSE_DEFAULTS[animation.purpose];
  let out: Animation = {
    ...animation,
    trigger: { type: d.trigger },
    reducedMotion: { mode: d.reducedMotion },
  };
  if (out.sequence.steps.length && patternFits(out, d)) out = applyPattern(out, d.pattern);
  const steps = out.sequence.steps.map((step): Transition => ({
    ...step,
    duration: { ...d.duration },
    easing: { ...d.easing },
  }));
  return { ...out, sequence: { ...out.sequence, steps } };
}

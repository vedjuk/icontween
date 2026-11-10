/**
 * Sequence editing. A sequence is a chain of steps (A→B, B→A, …), so it is edited as its
 * path of state ids and rebuilt into steps, keeping each step's timing where it can. All
 * functions are pure, like those in edit.ts. See docs/decisions/009-sequences-and-stagger.md.
 */
import { PURPOSE_DEFAULTS, purposeTransition } from './defaults';
import type { Animation, Purpose, Transition } from './schema';

/** State ids along the sequence: the first state, then where each step goes. */
export function sequencePath(animation: Animation): string[] {
  const steps = animation.sequence.steps;
  const first = steps[0]?.from ?? animation.states[0]?.id;
  return first === undefined ? [] : [first, ...steps.map((s) => s.to)];
}

/** The transition into a newly added step: the purpose's default timing. */
export function defaultTransition(
  from: string,
  to: string,
  purpose: Purpose = 'state-change',
): Transition {
  return purposeTransition(purpose, from, to);
}

/**
 * Rebuilds the sequence along a path of state ids. The path starts at state A, and one
 * state means no steps. A step that existed before (same from and to) keeps its timing and
 * delays; a new step takes the timing of the step that was at its place, or the default.
 */
export function setSequencePath(animation: Animation, path: readonly string[]): Animation {
  const ids = new Set(animation.states.map((s) => s.id));
  if (path[0] !== animation.states[0]?.id) throw new Error('A sequence starts at state A');
  for (const id of path) if (!ids.has(id)) throw new Error(`Unknown state "${id}"`);

  const old = animation.sequence.steps;
  const used = new Set<number>();
  const steps = path.slice(1).map((to, i): Transition => {
    const from = path[i]!;
    const same = old.findIndex((s, j) => !used.has(j) && s.from === from && s.to === to);
    if (same !== -1) {
      used.add(same);
      return cloneTransition(old[same]!);
    }
    const near = old[i];
    if (!near) return defaultTransition(from, to, animation.purpose);
    const step: Transition = {
      from,
      to,
      duration: cloneDuration(near.duration),
      easing: { ...near.easing },
    };
    if (near.stagger) step.stagger = near.stagger;
    return step;
  });
  return { ...animation, sequence: { ...animation.sequence, steps } };
}

function cloneDuration(d: Transition['duration']): Transition['duration'] {
  return typeof d === 'number' ? d : { ...d };
}

function cloneTransition(t: Transition): Transition {
  const out: Transition = { ...t, duration: cloneDuration(t.duration), easing: { ...t.easing } };
  if (t.delays) out.delays = { ...t.delays };
  return out;
}

export type PatternId = 'hold' | 'return' | 'return-twice' | 'back-and-forth';

export interface PatternTemplate {
  id: PatternId;
  /** Short name, e.g. 'Return'. */
  name: string;
  /** What it is for, in a few words. */
  hint: string;
  path: string[];
}

/**
 * Sequence templates for a list of state ids (brief §9: A→B, A→B→A, A→B→C→A, …). Needs
 * two states or more. Hover and toggle play forwards and back, so 'hold' is their pattern.
 */
export function patternTemplates(stateIds: readonly string[]): PatternTemplate[] {
  if (stateIds.length < 2) return [];
  const all = [...stateIds];
  const first = all[0]!;
  const returned = [...all, first];
  const templates: PatternTemplate[] = [
    { id: 'hold', name: 'Hold', hint: 'Stays on the last state', path: all },
    { id: 'return', name: 'Return', hint: 'Goes back to the start', path: returned },
    {
      id: 'return-twice',
      name: 'Return ×2',
      hint: 'Twice, for attention',
      path: [...returned, ...all.slice(1), first],
    },
  ];
  if (all.length >= 3) {
    templates.push({
      id: 'back-and-forth',
      name: 'Back and forth',
      hint: 'Retraces its steps',
      path: [...all, ...all.slice(0, -1).reverse()],
    });
  }
  return templates;
}

/** The template whose path equals the sequence's, if any. */
export function matchPattern(animation: Animation): PatternTemplate | undefined {
  const path = sequencePath(animation).join(' ');
  return patternTemplates(animation.states.map((s) => s.id)).find((t) => t.path.join(' ') === path);
}

/** Applies a template to the animation's current states. */
export function applyPattern(animation: Animation, id: PatternId): Animation {
  const template = patternTemplates(animation.states.map((s) => s.id)).find((t) => t.id === id);
  if (!template) throw new Error(`Pattern "${id}" needs more states`);
  return setSequencePath(animation, template.path);
}

/**
 * Where a new state goes in the sequence: a sequence that follows a template keeps
 * following it with the new state; one that returns to the start gets it before the
 * return (A→B→A becomes A→B→C→A); anything else gets it at the end.
 */
export function pathWithNewState(animation: Animation, newId: string): string[] {
  const pattern = matchPattern(animation);
  const ids = [...animation.states.map((s) => s.id), newId];
  if (!animation.sequence.steps.length) {
    // The first steps follow the purpose's pattern (A→B→A for feedback).
    const wanted = PURPOSE_DEFAULTS[animation.purpose].pattern;
    const template = patternTemplates(ids).find((t) => t.id === wanted);
    return template ? template.path : [...sequencePath(animation), newId];
  }
  if (pattern) return patternTemplates(ids).find((t) => t.id === pattern.id)!.path;
  const path = sequencePath(animation);
  if (path.length >= 3 && path[path.length - 1] === path[0]) {
    return [...path.slice(0, -1), newId, path[0]!];
  }
  return [...path, newId];
}

export type StepTimingPatch = Partial<Pick<Transition, 'duration' | 'easing' | 'stagger'>>;

const roundMs = (n: number) => Math.round(Math.max(0, n));

/** Changes one step's duration, easing and/or stagger. Milliseconds are whole and ≥ 0. */
export function setStepTiming(
  animation: Animation,
  index: number,
  patch: StepTimingPatch,
): Animation {
  return updateStep(animation, index, (step) => {
    const out = { ...step };
    if (patch.duration !== undefined) {
      if (typeof patch.duration !== 'number') out.duration = { ...patch.duration };
      else if (Number.isFinite(patch.duration)) out.duration = roundMs(patch.duration);
    }
    if (patch.easing) out.easing = { ...patch.easing };
    if (patch.stagger !== undefined && Number.isFinite(patch.stagger)) {
      const stagger = roundMs(patch.stagger);
      if (stagger) out.stagger = stagger;
      else delete out.stagger;
    }
    return out;
  });
}

/** Sets one element's delay in one step, in whole milliseconds. 0 removes it. */
export function setElementDelay(
  animation: Animation,
  index: number,
  elementId: string,
  ms: number,
): Animation {
  if (!Number.isFinite(ms)) return animation;
  if (!animation.elements.some((e) => e.id === elementId)) {
    throw new Error(`Unknown element "${elementId}"`);
  }
  return updateStep(animation, index, (step) => {
    const delays = { ...step.delays };
    const delay = roundMs(ms);
    if (delay) delays[elementId] = delay;
    else delete delays[elementId];
    const out: Transition = { ...step, delays };
    if (!Object.keys(delays).length) delete out.delays;
    return out;
  });
}

/**
 * When each element starts moving in a step, in ms from the step's start: its delay plus
 * the stagger times its place in element order. Matches the runtime's forward playback.
 */
export function elementOffsets(animation: Animation, index: number): Record<string, number> {
  const step = animation.sequence.steps[index];
  const out: Record<string, number> = {};
  animation.elements.forEach(({ id }, i) => {
    out[id] = (step?.delays?.[id] ?? 0) + (step?.stagger ?? 0) * i;
  });
  return out;
}

function updateStep(
  animation: Animation,
  index: number,
  update: (step: Transition) => Transition,
): Animation {
  const step = animation.sequence.steps[index];
  if (!step) throw new Error(`No step ${index}`);
  const steps = animation.sequence.steps.map((s, i) => (i === index ? update(s) : s));
  return { ...animation, sequence: { ...animation.sequence, steps } };
}

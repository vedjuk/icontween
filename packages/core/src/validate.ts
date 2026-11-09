/**
 * validateAnimation() enforces rule 1: every state has the same elements, and every
 * element has the same segment command sequence in every state. States may only
 * differ in numbers. It also catches out-of-range values and dangling references.
 *
 * Run it on load, after every edit in development, and in tests.
 */
import {
  PURPOSES,
  REDUCED_MOTION_MODES,
  TRIGGER_TYPES,
  type Animation,
  type Easing,
  type ElementState,
  type Segment,
} from './schema';

export interface ValidationIssue {
  /** Where the problem is, e.g. "states[1].elements.el-2.segments[3]". */
  path: string;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; issues: ValidationIssue[] };

export class AnimationValidationError extends Error {
  override name = 'AnimationValidationError';
  constructor(readonly issues: ValidationIssue[]) {
    super(`Invalid animation:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`);
  }
}

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const SEGMENT_NUMBER_KEYS: Record<Segment['cmd'], readonly string[]> = {
  M: ['x', 'y'],
  L: ['x', 'y'],
  C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'],
  Z: [],
};

export function validateAnimation(animation: Animation): ValidationResult {
  const issues: ValidationIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });

  // Metadata
  if (!PURPOSES.includes(animation.purpose)) {
    issue('purpose', `Unknown purpose "${animation.purpose}"`);
  }
  if (!TRIGGER_TYPES.includes(animation.trigger?.type)) {
    issue('trigger.type', `Unknown trigger "${animation.trigger?.type}"`);
  }
  if (!REDUCED_MOTION_MODES.includes(animation.reducedMotion?.mode)) {
    issue('reducedMotion.mode', `Unknown reduced-motion mode "${animation.reducedMotion?.mode}"`);
  }

  const vb = animation.viewBox;
  if (!Array.isArray(vb) || vb.length !== 4 || !vb.every(isFiniteNumber)) {
    issue('viewBox', 'Must be four finite numbers');
  } else if (vb[2] <= 0 || vb[3] <= 0) {
    issue('viewBox', 'Width and height must be positive');
  }

  // Elements
  const elementIds = animation.elements.map((e) => e.id);
  const seenElementIds = new Set<string>();
  animation.elements.forEach((el, i) => {
    if (!el.id) issue(`elements[${i}].id`, 'Missing id');
    if (seenElementIds.has(el.id)) issue(`elements[${i}].id`, `Duplicate element id "${el.id}"`);
    seenElementIds.add(el.id);
    if (!isFiniteNumber(el.style.strokeWidth) || el.style.strokeWidth < 0) {
      issue(`elements[${i}].style.strokeWidth`, 'Must be a non-negative number');
    }
  });

  // States
  if (animation.states.length === 0) {
    issue('states', 'An animation needs at least state A');
    return { ok: false, issues };
  }
  if (animation.states[0]!.id !== 'A') {
    issue('states[0].id', `The first state must be "A", got "${animation.states[0]!.id}"`);
  }

  const stateIds = new Set<string>();
  const reference = animation.states[0]!;

  animation.states.forEach((state, si) => {
    const sp = `states[${si}]`;
    if (stateIds.has(state.id)) issue(`${sp}.id`, `Duplicate state id "${state.id}"`);
    stateIds.add(state.id);

    for (const key of Object.keys(state.elements)) {
      if (!seenElementIds.has(key)) issue(`${sp}.elements.${key}`, 'Unknown element id');
    }

    for (const id of elementIds) {
      const es = state.elements[id];
      const ep = `${sp}.elements.${id}`;
      if (!es) {
        issue(ep, 'Missing element in this state');
        continue;
      }
      validateElementState(es, ep, issue);
      if (si > 0) {
        const ref = reference.elements[id];
        if (ref) compareStructure(ref, es, ep, issue);
      }
    }
  });

  // Sequence
  animation.sequence.steps.forEach((step, i) => {
    const p = `sequence.steps[${i}]`;
    if (!stateIds.has(step.from)) issue(`${p}.from`, `Unknown state "${step.from}"`);
    if (!stateIds.has(step.to)) issue(`${p}.to`, `Unknown state "${step.to}"`);
    // Steps form one chain from state A, so the runtime can play it forwards and back.
    const expected = i === 0 ? animation.states[0]?.id : animation.sequence.steps[i - 1]!.to;
    if (stateIds.has(step.from) && step.from !== expected) {
      issue(
        `${p}.from`,
        i === 0 ? 'The sequence must start at state A' : `Must continue from "${expected}"`,
      );
    }
    if (typeof step.duration === 'number') {
      if (!isFiniteNumber(step.duration) || step.duration < 0) {
        issue(`${p}.duration`, 'Must be a non-negative number of milliseconds');
      }
    } else if (!step.duration?.token) {
      issue(`${p}.duration`, 'Must be milliseconds or { token }');
    }
    validateEasing(step.easing, `${p}.easing`, issue);
    for (const [id, delay] of Object.entries(step.delays ?? {})) {
      if (!seenElementIds.has(id)) issue(`${p}.delays.${id}`, 'Unknown element id');
      if (!isFiniteNumber(delay) || delay < 0) {
        issue(`${p}.delays.${id}`, 'Must be a non-negative number');
      }
    }
    if (step.stagger !== undefined && (!isFiniteNumber(step.stagger) || step.stagger < 0)) {
      issue(`${p}.stagger`, 'Must be a non-negative number');
    }
  });
  const rest = animation.sequence.restBetweenLoops;
  if (rest !== undefined && (!isFiniteNumber(rest) || rest < 0)) {
    issue('sequence.restBetweenLoops', 'Must be a non-negative number');
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/** Throws AnimationValidationError listing every issue, or returns the animation unchanged. */
export function assertValidAnimation(animation: Animation): Animation {
  const result = validateAnimation(animation);
  if (!result.ok) throw new AnimationValidationError(result.issues);
  return animation;
}

type Report = (path: string, message: string) => void;

function validateElementState(es: ElementState, ep: string, issue: Report) {
  if (es.segments.length === 0) {
    issue(`${ep}.segments`, 'A path needs at least one segment');
  } else if (es.segments[0]!.cmd !== 'M') {
    issue(`${ep}.segments[0]`, 'A path must start with M');
  }
  es.segments.forEach((seg, i) => {
    const keys = SEGMENT_NUMBER_KEYS[seg.cmd];
    if (!keys) {
      issue(`${ep}.segments[${i}]`, `Non-canonical command "${(seg as { cmd: string }).cmd}"`);
      return;
    }
    for (const key of keys) {
      if (!isFiniteNumber((seg as unknown as Record<string, unknown>)[key])) {
        issue(`${ep}.segments[${i}].${key}`, 'Must be a finite number');
      }
    }
  });

  for (const [key, value] of Object.entries(es.transform)) {
    if (!isFiniteNumber(value)) issue(`${ep}.transform.${key}`, 'Must be a finite number');
  }
  if (!isFiniteNumber(es.opacity) || es.opacity < 0 || es.opacity > 1) {
    issue(`${ep}.opacity`, 'Must be between 0 and 1');
  }
  const { start, end } = es.draw;
  if (!isFiniteNumber(start) || !isFiniteNumber(end) || start < 0 || end > 1 || start > end) {
    issue(`${ep}.draw`, 'Must satisfy 0 ≤ start ≤ end ≤ 1');
  }
}

function compareStructure(ref: ElementState, es: ElementState, ep: string, issue: Report) {
  if (ref.segments.length !== es.segments.length) {
    issue(
      `${ep}.segments`,
      `Has ${es.segments.length} segments, state A has ${ref.segments.length}`,
    );
    return;
  }
  ref.segments.forEach((refSeg, i) => {
    const cmd = es.segments[i]!.cmd;
    if (cmd !== refSeg.cmd) {
      issue(`${ep}.segments[${i}]`, `Command ${cmd} differs from state A (${refSeg.cmd})`);
    }
  });
}

function validateEasing(easing: Easing, p: string, issue: Report) {
  switch (easing?.type) {
    case 'token':
      if (!easing.name) issue(`${p}.name`, 'Missing token name');
      return;
    case 'cubic-bezier': {
      const { x1, y1, x2, y2 } = easing;
      if (![x1, y1, x2, y2].every(isFiniteNumber)) {
        issue(p, 'Control points must be finite numbers');
      } else if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
        issue(p, 'x1 and x2 must be between 0 and 1');
      }
      return;
    }
    case 'spring': {
      const { stiffness, damping, mass } = easing;
      if (
        ![stiffness, damping, mass].every(isFiniteNumber) ||
        stiffness <= 0 ||
        mass <= 0 ||
        damping < 0
      ) {
        issue(p, 'Spring needs stiffness > 0, mass > 0, damping ≥ 0');
      }
      return;
    }
    default:
      issue(`${p}.type`, `Unknown easing type "${(easing as { type?: string })?.type}"`);
  }
}

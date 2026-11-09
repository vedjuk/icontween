/**
 * Editing operations on animations. All are pure: they return a new animation (or new
 * segments) and never touch their input, which keeps the editor store and a later undo
 * history simple.
 *
 * None of these change structure (rule 1): states are cloned whole, and point edits only
 * change numbers.
 */
import type { PreparedIcon } from './prepare';
import type { Animation, ElementState, Segment, State, Transition } from './schema';

/** A fresh one-state animation from a prepared icon. The icon itself is not modified. */
export function createAnimation(
  icon: PreparedIcon,
  options: { id: string; name: string },
): Animation {
  return {
    id: options.id,
    name: options.name,
    purpose: 'state-change',
    viewBox: [...icon.viewBox],
    elements: icon.elements.map((e) => ({ ...e, style: { ...e.style } })),
    states: [cloneState(icon.state, 'A')],
    sequence: { steps: [], repeat: 'once' },
    trigger: { type: 'hover' },
    reducedMotion: { mode: 'instant' },
  };
}

/** Next free state id: A, B, … Z, then S27, S28, … */
export function nextStateId(states: readonly State[]): string {
  const taken = new Set(states.map((s) => s.id));
  for (let i = 0; ; i++) {
    const id = i < 26 ? String.fromCharCode(65 + i) : `S${i + 1}`;
    if (!taken.has(id)) return id;
  }
}

/** The default transition into a newly added state. Tuned per purpose in M3. */
export function defaultTransition(from: string, to: string): Transition {
  return { from, to, duration: { token: 'base' }, easing: { type: 'token', name: 'standard' } };
}

/**
 * Adds a copy of state `fromId` as a new last state, and a step into it from the current
 * last state of the sequence. Returns the new animation and the new state's id.
 */
export function addStateCopy(
  animation: Animation,
  fromId: string,
): { animation: Animation; stateId: string } {
  const source = animation.states.find((s) => s.id === fromId);
  if (!source) throw new Error(`Unknown state "${fromId}"`);
  const stateId = nextStateId(animation.states);
  const steps = animation.sequence.steps;
  const lastId = steps.length ? steps[steps.length - 1]!.to : animation.states[0]!.id;
  return {
    stateId,
    animation: {
      ...animation,
      states: [...animation.states, cloneState(source, stateId)],
      sequence: { ...animation.sequence, steps: [...steps, defaultTransition(lastId, stateId)] },
    },
  };
}

function cloneState(state: State, id: string): State {
  const elements: Record<string, ElementState> = {};
  for (const [elId, es] of Object.entries(state.elements)) {
    elements[elId] = {
      segments: es.segments.map((s) => ({ ...s })),
      transform: { ...es.transform },
      opacity: es.opacity,
      draw: { ...es.draw },
    };
  }
  return { id, elements };
}

/** Replaces one element's segments in one state. Throws if the command sequence changes. */
export function setElementSegments(
  animation: Animation,
  stateId: string,
  elementId: string,
  segments: Segment[],
): Animation {
  return {
    ...animation,
    states: animation.states.map((state) => {
      if (state.id !== stateId) return state;
      const es = state.elements[elementId];
      if (!es) throw new Error(`State ${stateId} has no element "${elementId}"`);
      const same =
        es.segments.length === segments.length &&
        es.segments.every((s, i) => s.cmd === segments[i]!.cmd);
      if (!same) throw new Error('Point edits must keep the path structure');
      return { ...state, elements: { ...state.elements, [elementId]: { ...es, segments } } };
    }),
  };
}

/** Which number pair of a segment: its end point (anchor) or one of its control points. */
export type PointRole = 'anchor' | 'c1' | 'c2';

export interface PointRef {
  segment: number;
  role: PointRole;
}

export interface EditablePoint extends PointRef {
  x: number;
  y: number;
  /** For handles: the anchor the handle belongs to (for drawing the handle line). */
  anchorX?: number;
  anchorY?: number;
}

const EPSILON = 1e-6;

/**
 * Index of the segment whose end point closes the subpath containing `index` back onto its
 * starting M, or -1. Closed shapes (circles, rounded rects) end exactly on their start, so
 * that point is one node on screen and must move as one.
 */
function closingPair(segments: readonly Segment[], index: number): { m: number; end: number } {
  let m = index;
  while (m > 0 && segments[m]!.cmd !== 'M') m--;
  let z = m + 1;
  while (z < segments.length && segments[z]!.cmd !== 'M' && segments[z]!.cmd !== 'Z') z++;
  const start = segments[m];
  const last = segments[z - 1];
  if (segments[z]?.cmd !== 'Z' || !start || start.cmd !== 'M' || !last || z - 1 === m) {
    return { m, end: -1 };
  }
  if (last.cmd === 'Z' || last.cmd === 'M') return { m, end: -1 };
  const coincident = Math.abs(last.x - start.x) < EPSILON && Math.abs(last.y - start.y) < EPSILON;
  return { m, end: coincident ? z - 1 : -1 };
}

const endPoint = (s: Segment | undefined) => (s && s.cmd !== 'Z' ? { x: s.x, y: s.y } : undefined);

/**
 * The points a designer can drag: every anchor (closing duplicates shown once, at the M)
 * and every control point, with the anchor it hangs from.
 */
export function editablePoints(segments: readonly Segment[]): EditablePoint[] {
  const points: EditablePoint[] = [];
  segments.forEach((s, i) => {
    if (s.cmd === 'Z') return;
    if (s.cmd === 'C') {
      const before = endPoint(segments[i - 1]);
      points.push({
        segment: i,
        role: 'c1',
        x: s.x1,
        y: s.y1,
        anchorX: before?.x,
        anchorY: before?.y,
      });
      points.push({ segment: i, role: 'c2', x: s.x2, y: s.y2, anchorX: s.x, anchorY: s.y });
    }
    if (closingPair(segments, i).end !== i)
      points.push({ segment: i, role: 'anchor', x: s.x, y: s.y });
  });
  return points;
}

/** Current position of a point. */
export function getPoint(segments: readonly Segment[], ref: PointRef): { x: number; y: number } {
  const s = segments[ref.segment];
  if (!s || s.cmd === 'Z') throw new Error(`No point at segment ${ref.segment}`);
  if (ref.role === 'c1' || ref.role === 'c2') {
    if (s.cmd !== 'C') throw new Error(`Segment ${ref.segment} has no control points`);
    return ref.role === 'c1' ? { x: s.x1, y: s.y1 } : { x: s.x2, y: s.y2 };
  }
  return { x: s.x, y: s.y };
}

const round = (n: number) => Math.round(n * 1000) / 1000 + 0;

/**
 * Moves one point to (x, y), rounded to 3 decimals like prepared geometry. Moving an
 * anchor carries its handles along (as in design tools) and, for closed shapes, the
 * coincident closing point too. Returns new segments.
 */
export function movePoint(
  segments: readonly Segment[],
  ref: PointRef,
  x: number,
  y: number,
): Segment[] {
  const out = segments.map((s) => ({ ...s }));
  const old = getPoint(segments, ref);
  x = round(x);
  y = round(y);
  if (ref.role !== 'anchor') {
    const s = out[ref.segment] as Extract<Segment, { cmd: 'C' }>;
    if (ref.role === 'c1') Object.assign(s, { x1: x, y1: y });
    else Object.assign(s, { x2: x, y2: y });
    return out;
  }
  const dx = x - old.x;
  const dy = y - old.y;
  const shiftAnchor = (i: number) => {
    const s = out[i];
    if (!s || s.cmd === 'Z') return;
    s.x = round(s.x + dx);
    s.y = round(s.y + dy);
    if (s.cmd === 'C') {
      s.x2 = round(s.x2 + dx);
      s.y2 = round(s.y2 + dy);
    }
    const next = out[i + 1];
    if (next?.cmd === 'C') {
      next.x1 = round(next.x1 + dx);
      next.y1 = round(next.y1 + dy);
    }
  };
  const { m, end } = closingPair(segments, ref.segment);
  shiftAnchor(ref.segment);
  if (end !== -1 && (ref.segment === m || ref.segment === end)) {
    shiftAnchor(ref.segment === m ? end : m);
  }
  // Land exactly on the requested spot (shifting by a rounded delta can drift by 0.001).
  const moved = out[ref.segment] as { x: number; y: number };
  moved.x = x;
  moved.y = y;
  return out;
}

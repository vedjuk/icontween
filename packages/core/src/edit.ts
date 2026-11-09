/**
 * Editing operations on animations. All are pure: they return a new animation (or new
 * segments) and never touch their input, which keeps the editor store and a later undo
 * history simple.
 *
 * None of these change structure (rule 1): states are cloned whole, and point edits only
 * change numbers.
 */
import { segmentsBounds } from './geometry';
import type { PreparedIcon } from './prepare';
import { pathWithNewState, setSequencePath } from './sequence';
import type { Animation, ElementState, ElementTransform, Segment, State } from './schema';

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

/**
 * Adds a copy of state `fromId` as a new last state and puts it in the sequence: a
 * sequence that follows a pattern template keeps following it, one that returns to the
 * start gets the new state before the return, anything else gets it at the end (see
 * `pathWithNewState()`). Returns the new animation and the new state's id.
 */
export function addStateCopy(
  animation: Animation,
  fromId: string,
): { animation: Animation; stateId: string } {
  const source = animation.states.find((s) => s.id === fromId);
  if (!source) throw new Error(`Unknown state "${fromId}"`);
  const stateId = nextStateId(animation.states);
  const path = pathWithNewState(animation, stateId);
  const withState = { ...animation, states: [...animation.states, cloneState(source, stateId)] };
  return { stateId, animation: setSequencePath(withState, path) };
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

export interface ElementValuesPatch {
  /** Translate, rotate and scale. The pivot is shared by all states: use `setPivot()`. */
  transform?: Partial<Omit<ElementTransform, 'originX' | 'originY'>>;
  opacity?: number;
  draw?: Partial<ElementState['draw']>;
}

const clampTo = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Changes one element's transform, opacity and/or draw in one state. Values are rounded to
 * 3 decimals; opacity and draw are clamped to 0..1, and a draw start or end that would
 * cross the other stops at it. Non-finite numbers are ignored.
 */
export function setElementValues(
  animation: Animation,
  stateId: string,
  elementId: string,
  patch: ElementValuesPatch,
): Animation {
  return updateElement(animation, stateId, elementId, (es) => {
    const transform = { ...es.transform };
    for (const [key, value] of Object.entries(patch.transform ?? {})) {
      if (key === 'originX' || key === 'originY') continue;
      if (Number.isFinite(value)) transform[key as keyof ElementTransform] = round(value);
    }
    let opacity = es.opacity;
    if (patch.opacity !== undefined && Number.isFinite(patch.opacity)) {
      opacity = round(clampTo(patch.opacity, 0, 1));
    }
    let { start, end } = es.draw;
    const s = patch.draw?.start;
    const e = patch.draw?.end;
    if (e !== undefined && Number.isFinite(e)) end = round(clampTo(e, 0, 1));
    if (s !== undefined && Number.isFinite(s)) start = round(clampTo(s, 0, 1));
    if (start > end) {
      // The value being edited stops at the other one.
      if (s !== undefined && Number.isFinite(s)) start = end;
      else end = start;
    }
    return { ...es, transform, opacity, draw: { start, end } };
  });
}

/**
 * Sets an element's pivot (rotate/scale origin, in viewBox coordinates) in every state.
 * One pivot per element: interpolating the pivot between states would make rotations
 * wobble. States that already rotate or scale will turn around the new pivot.
 */
export function setPivot(animation: Animation, elementId: string, x: number, y: number): Animation {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return animation;
  let result = animation;
  for (const state of animation.states) {
    result = updateElement(result, state.id, elementId, (es) => ({
      ...es,
      transform: { ...es.transform, originX: round(x), originY: round(y) },
    }));
  }
  return result;
}

/** Resets an element's transform (keeping the pivot), opacity and draw in one state. */
export function resetElementValues(
  animation: Animation,
  stateId: string,
  elementId: string,
): Animation {
  return updateElement(animation, stateId, elementId, (es) => ({
    ...es,
    transform: { ...es.transform, translateX: 0, translateY: 0, rotate: 0, scale: 1 },
    opacity: 1,
    draw: { start: 0, end: 1 },
  }));
}

/** Where a pivot can snap to: the 3 × 3 grid of an element's bounding box in state A. */
export function pivotPresets(
  animation: Animation,
  elementId: string,
): { col: number; row: number; x: number; y: number }[] {
  const segments = animation.states[0]?.elements[elementId]?.segments;
  const b = segments && segmentsBounds(segments);
  if (!b) return [];
  const out = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out.push({
        col,
        row,
        x: round(b.minX + ((b.maxX - b.minX) * col) / 2),
        y: round(b.minY + ((b.maxY - b.minY) * row) / 2),
      });
    }
  }
  return out;
}

function updateElement(
  animation: Animation,
  stateId: string,
  elementId: string,
  update: (es: ElementState) => ElementState,
): Animation {
  let found = false;
  const states = animation.states.map((state) => {
    if (state.id !== stateId) return state;
    const es = state.elements[elementId];
    if (!es) throw new Error(`State ${stateId} has no element "${elementId}"`);
    found = true;
    return { ...state, elements: { ...state.elements, [elementId]: update(es) } };
  });
  if (!found) throw new Error(`Unknown state "${stateId}"`);
  return { ...animation, states };
}

/**
 * Stepping through elements and points without a mouse: the canvas's `[` / `]` keys and
 * the inspector's ‹ › buttons both use these (decision 021).
 */
import { editablePoints, type PointRef } from '@icontween/core';
import { cycleIndex } from './canvasKeys';
import { useEditor } from './store';

export const POINT_ROLE_LABEL = { anchor: 'Point', c1: 'Handle (out)', c2: 'Handle (in)' } as const;

const same = (a: PointRef | null, b: PointRef) =>
  a !== null && a.segment === b.segment && a.role === b.role;

/** The edited state's points of an element, in path order. */
export function pointsOf(elementId: string | null) {
  const { animation, stateId } = useEditor.getState();
  const es = animation?.states.find((s) => s.id === stateId)?.elements[elementId ?? ''];
  return es ? editablePoints(es.segments) : [];
}

/** Index of the selected point among the selected element's points, or -1. */
export function selectedPointIndex(): number {
  const { elementId, point } = useEditor.getState();
  return pointsOf(elementId).findIndex((p) => same(point, p));
}

/** Selects the next or previous element, wrapping around. */
export function stepElement(step: 1 | -1) {
  const { animation, elementId, selectElement } = useEditor.getState();
  if (!animation) return;
  const ids = animation.elements.map((el) => el.id);
  const id = ids[cycleIndex(ids.indexOf(elementId ?? ''), ids.length, step)];
  if (id) selectElement(id);
}

/**
 * Selects the next or previous point of the selected element, wrapping around. With no
 * element selected, starts with the first element.
 */
export function stepPoint(step: 1 | -1) {
  const { animation, elementId, selectElement, selectPoint } = useEditor.getState();
  if (!animation) return;
  const id = elementId ?? animation.elements[0]?.id;
  if (!id) return;
  if (id !== elementId) selectElement(id);
  const points = pointsOf(id);
  const p = points[cycleIndex(id === elementId ? selectedPointIndex() : -1, points.length, step)];
  if (p) selectPoint({ segment: p.segment, role: p.role });
}

/** A short spoken description of what's selected on the canvas, for screen readers. */
export function describeSelection(): string {
  const { animation, elementId, point } = useEditor.getState();
  if (!animation || !elementId) return '';
  const name = animation.elements.find((el) => el.id === elementId)?.name ?? elementId;
  if (!point) return `${name} selected.`;
  const points = pointsOf(elementId);
  const i = selectedPointIndex();
  const p = points[i];
  if (!p) return `${name} selected.`;
  const at = `${round(p.x)}, ${round(p.y)}`;
  const kind = SPOKEN_ROLE[p.role];
  return `${name}: point ${i + 1} of ${points.length} (${kind}), at ${at}.`;
}

const SPOKEN_ROLE = { anchor: 'anchor', c1: 'handle out', c2: 'handle in' } as const;

const round = (n: number) => Math.round(n * 100) / 100;

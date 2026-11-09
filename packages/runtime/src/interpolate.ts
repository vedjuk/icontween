/**
 * Blending element states. Because all states share one structure (rule 1), a morph is
 * nothing more than mixing each number with its counterpart.
 */
import type { ElementState, Segment } from '@icontween/core';

export type StateValues = Record<string, ElementState>;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deep copy of an element state, so it can be mutated in place while playing. */
export function cloneElementState(es: ElementState): ElementState {
  return {
    segments: es.segments.map((s) => ({ ...s })),
    transform: { ...es.transform },
    opacity: es.opacity,
    draw: { ...es.draw },
  };
}

export function cloneValues(values: StateValues): StateValues {
  const out: StateValues = {};
  for (const id in values) out[id] = cloneElementState(values[id]!);
  return out;
}

/** Writes the blend of `a` and `b` at `t` into `out`. All three must share one structure. */
export function mixElementStateInto(
  out: ElementState,
  a: ElementState,
  b: ElementState,
  t: number,
): void {
  for (let i = 0; i < out.segments.length; i++) {
    const o = out.segments[i] as Record<string, number | string>;
    const sa = a.segments[i] as Record<string, number | string>;
    const sb = b.segments[i] as Record<string, number | string>;
    for (const key in o) {
      if (key !== 'cmd') o[key] = mix(sa[key] as number, sb[key] as number, t);
    }
  }
  const ot = out.transform;
  for (const key in ot) {
    const k = key as keyof typeof ot;
    ot[k] = mix(a.transform[k], b.transform[k], t);
  }
  out.opacity = mix(a.opacity, b.opacity, t);
  out.draw.start = mix(a.draw.start, b.draw.start, t);
  out.draw.end = mix(a.draw.end, b.draw.end, t);
}

/** Returns a new element state blended between `a` (t = 0) and `b` (t = 1). */
export function mixElementState(a: ElementState, b: ElementState, t: number): ElementState {
  const out = cloneElementState(a);
  mixElementStateInto(out, a, b, t);
  return out;
}

/** Returns new state values blended between `a` and `b`, for every element in `a`. */
export function mixValues(a: StateValues, b: StateValues, t: number): StateValues {
  const out: StateValues = {};
  for (const id in a) {
    const eb = b[id];
    out[id] = eb ? mixElementState(a[id]!, eb, t) : cloneElementState(a[id]!);
  }
  return out;
}

/**
 * Throws if two element states can't be blended (different segment count or commands).
 * A cheap guard; `validateAnimation()` in core is the full check.
 */
export function assertSameStructure(a: Segment[], b: Segment[], where: string): void {
  const same = a.length === b.length && a.every((s, i) => s.cmd === b[i]!.cmd);
  if (!same) {
    throw new Error(`IconTween: ${where} has a different path structure than state A`);
  }
}

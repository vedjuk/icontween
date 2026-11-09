/**
 * Writing element values to SVG attributes. Produces exactly the same strings as
 * `segmentsToD()` and `transformAttribute()` in core (tested), without depending on core.
 */
import type { ElementState, PreparedElement, ViewBox } from '@icontween/core';
import { clamp01 } from './easing';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The attribute that links a <path> to its element id. */
export const ELEMENT_ATTRIBUTE = 'data-icontween-element';

/** Rounds to 3 decimals, drops trailing zeros and negative zero. */
export const num = (n: number): string => String(Math.round(n * 1000) / 1000 + 0);

export function toD(es: ElementState): string {
  return es.segments
    .map((s) =>
      s.cmd === 'Z'
        ? 'Z'
        : s.cmd === 'C'
          ? `C${num(s.x1)} ${num(s.y1)} ${num(s.x2)} ${num(s.y2)} ${num(s.x)} ${num(s.y)}`
          : `${s.cmd}${num(s.x)} ${num(s.y)}`,
    )
    .join(' ');
}

export function toTransform(es: ElementState): string {
  const { translateX: tx, translateY: ty, rotate, scale, originX: ox, originY: oy } = es.transform;
  let out = tx !== 0 || ty !== 0 ? `translate(${num(tx)} ${num(ty)})` : '';
  if (rotate !== 0 || scale !== 1) {
    // Rotate and scale around the pivot.
    out += `${out && ' '}translate(${num(ox)} ${num(oy)})`;
    if (rotate !== 0) out += ` rotate(${num(rotate)})`;
    if (scale !== 1) out += ` scale(${num(scale)})`;
    out += ` translate(${num(-ox)} ${num(-oy)})`;
  }
  return out;
}

/** A bound <path> plus the last attribute values written, so unchanged ones are skipped. */
export interface PathTarget {
  el: SVGPathElement;
  last: Record<string, string | null>;
}

/**
 * Finds each element's <path> in the svg (by ELEMENT_ATTRIBUTE) or creates it, in element
 * order. Sets the viewBox when the svg has none.
 */
export function bindPaths(
  svg: SVGSVGElement,
  viewBox: ViewBox,
  elements: readonly PreparedElement[],
): PathTarget[] {
  if (!svg.hasAttribute('viewBox')) svg.setAttribute('viewBox', viewBox.join(' '));
  const existing = new Map<string, SVGPathElement>();
  svg.querySelectorAll<SVGPathElement>(`path[${ELEMENT_ATTRIBUTE}]`).forEach((p) => {
    existing.set(p.getAttribute(ELEMENT_ATTRIBUTE)!, p);
  });
  return elements.map(({ id, style }) => {
    let el = existing.get(id);
    if (!el) {
      el = svg.ownerDocument.createElementNS(SVG_NS, 'path');
      el.setAttribute(ELEMENT_ATTRIBUTE, id);
      el.setAttribute('fill', style.fill);
      el.setAttribute('stroke', style.stroke);
      el.setAttribute('stroke-width', String(style.strokeWidth));
      el.setAttribute('stroke-linecap', style.strokeLinecap);
      el.setAttribute('stroke-linejoin', style.strokeLinejoin);
      svg.appendChild(el);
    }
    return { el, last: {} };
  });
}

/**
 * Writes one element's values. `fade` multiplies opacity (used by reduced-motion fades).
 * Drawing uses pathLength="1" so dash lengths are fractions of the path.
 */
export function renderPath(target: PathTarget, es: ElementState, fade = 1): void {
  // Springs and overshooting curves can carry values past their range; clamp the ones
  // that have one.
  const start = clamp01(es.draw.start);
  const end = clamp01(es.draw.end);
  const drawn = end - start;
  const partial = start > 0 || end < 1;
  // A zero-length dash still paints round caps, so a fully undrawn path is hidden instead.
  const opacity = clamp01(es.opacity) * fade * (partial && drawn <= 0.0005 ? 0 : 1);
  set(target, 'd', toD(es));
  set(target, 'transform', toTransform(es) || null);
  set(target, 'opacity', opacity === 1 ? null : num(opacity));
  set(target, 'pathLength', partial ? '1' : null);
  set(target, 'stroke-dasharray', partial ? `${num(Math.max(drawn, 0))} 2` : null);
  set(target, 'stroke-dashoffset', partial ? num(-start) : null);
}

function set(target: PathTarget, name: string, value: string | null): void {
  if (target.last[name] === value) return;
  target.last[name] = value;
  if (value === null) target.el.removeAttribute(name);
  else target.el.setAttribute(name, value);
}

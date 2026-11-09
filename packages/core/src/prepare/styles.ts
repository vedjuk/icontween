/**
 * Resolves the presentation properties that affect a drawn element: inherited
 * values from ancestors (Lucide sets stroke, width, caps and joins on the root
 * <svg>), element attributes, and inline style="" (which wins over attributes).
 */
import type { ElementStyle } from '../schema';
import { parseStyle } from './sanitize';

/** Inherited properties we track. `opacity` is not inherited; it multiplies down instead. */
const INHERITED = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'color',
  'visibility',
  'fill-opacity',
  'stroke-opacity',
  'stroke-dasharray',
] as const;

export type InheritedProps = Partial<Record<(typeof INHERITED)[number], string>>;

/** SVG initial values. */
const INITIAL: Required<
  Pick<InheritedProps, 'fill' | 'stroke' | 'stroke-width' | 'stroke-linecap' | 'stroke-linejoin'>
> = {
  fill: 'black',
  stroke: 'none',
  'stroke-width': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
};

/** Reads one property from an element: style="" first, then the attribute. */
export function ownProperty(el: Element, prop: string): string | undefined {
  const style = el.getAttribute('style');
  if (style) {
    // Last declaration wins, as in CSS.
    const decls = parseStyle(style).filter(([p]) => p === prop);
    if (decls.length > 0) return decls[decls.length - 1]![1];
  }
  const attr = el.getAttribute(prop);
  return attr === null ? undefined : attr.trim();
}

/** Computes the inherited props for `el` given its parent's. `inherit` keeps the parent value. */
export function inheritProps(el: Element, parent: InheritedProps): InheritedProps {
  const out: InheritedProps = { ...parent };
  for (const prop of INHERITED) {
    const v = ownProperty(el, prop);
    if (v !== undefined && v !== 'inherit') out[prop] = v;
  }
  return out;
}

const LINECAPS = ['butt', 'round', 'square'] as const;
const LINEJOINS = ['miter', 'round', 'bevel'] as const;

export interface ResolvedStyle {
  style: ElementStyle;
  /** Values we couldn't represent and fell back from, for the report. */
  notes: string[];
}

/** Turns inherited props into a concrete ElementStyle. strokeScale accounts for flattened transforms. */
export function resolveElementStyle(props: InheritedProps, strokeScale = 1): ResolvedStyle {
  const notes: string[] = [];
  const get = <K extends keyof typeof INITIAL>(k: K) => props[k] ?? INITIAL[k];

  let strokeWidth = parseLength(get('stroke-width'));
  if (strokeWidth === null) {
    notes.push(`stroke-width "${get('stroke-width')}" isn't a plain number; used 1`);
    strokeWidth = 1;
  }

  const cap = get('stroke-linecap');
  const join = get('stroke-linejoin');
  const strokeLinecap = (LINECAPS as readonly string[]).includes(cap)
    ? (cap as ElementStyle['strokeLinecap'])
    : 'butt';
  // SVG 2 adds miter-clip and arcs; browsers render them like miter.
  const strokeLinejoin = (LINEJOINS as readonly string[]).includes(join)
    ? (join as ElementStyle['strokeLinejoin'])
    : 'miter';

  return {
    style: {
      stroke: normalizeColor(get('stroke')),
      strokeWidth: round(strokeWidth * strokeScale),
      strokeLinecap,
      strokeLinejoin,
      fill: normalizeColor(get('fill')),
    },
    notes,
  };
}

function normalizeColor(value: string): string {
  const v = value.trim();
  return v.toLowerCase() === 'currentcolor' ? 'currentColor' : v;
}

/** Parses a unitless or px length. Returns null for other units or percentages. */
export function parseLength(value: string | null | undefined): number | null {
  if (value == null) return null;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(px)?\s*$/i.exec(value);
  return m ? Number(m[1]) : null;
}

export function round(n: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f + 0;
}

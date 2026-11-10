/**
 * SVG sanitizer (rule 6). Works on a parsed document in place and reports what it
 * removed. Allowlist-based: anything not listed here is dropped.
 *
 * Every imported SVG goes through this, including library icons shown "as-is".
 */

/** Elements kept. Everything else is removed together with its children. */
export const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'title',
  'desc',
]);

/** Presentation properties understood by the pipeline (as attributes or in style=""). */
export const PRESENTATION_PROPERTIES = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'display',
  'visibility',
  'color',
  'vector-effect',
]);

/** Geometry and structural attributes kept. */
const GEOMETRY_ATTRIBUTES = new Set([
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'width',
  'height',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'transform',
  'viewBox',
  'preserveAspectRatio',
  'id',
  'class',
  'style',
  'xmlns',
  'version',
]);

export interface RemovedItem {
  kind: 'element' | 'attribute' | 'style';
  /** Element name, attribute name, or CSS property. */
  name: string;
  count: number;
}

export interface SanitizeReport {
  removed: RemovedItem[];
}

/** Values that could reach the network or run code, even in an allowed property. */
export const DANGEROUS_VALUE = /url\s*\(|expression\s*\(|javascript:|@import|\\/i;

class Tally {
  private map = new Map<string, RemovedItem>();
  add(kind: RemovedItem['kind'], name: string) {
    const key = `${kind}:${name}`;
    const item = this.map.get(key);
    if (item) item.count++;
    else this.map.set(key, { kind, name, count: 1 });
  }
  list(): RemovedItem[] {
    return [...this.map.values()];
  }
}

/** Sanitizes the subtree rooted at `root` (normally the <svg> element) in place. */
export function sanitizeElement(root: Element): SanitizeReport {
  const tally = new Tally();
  walk(root, tally);
  return { removed: tally.list() };
}

function walk(el: Element, tally: Tally) {
  for (const child of [...el.children]) {
    const name = child.localName;
    // A nested <svg> creates a new viewport; not supported, so it's dropped.
    if (!ALLOWED_ELEMENTS.has(name) || name === 'svg') {
      tally.add('element', name);
      child.remove();
      continue;
    }
    walk(child, tally);
  }
  // Comments and processing instructions carry nothing we need.
  for (const node of [...el.childNodes]) {
    if (node.nodeType === 7 /* PROCESSING_INSTRUCTION */ || node.nodeType === 8 /* COMMENT */) {
      node.remove();
    }
  }
  cleanAttributes(el, tally);
}

function cleanAttributes(el: Element, tally: Tally) {
  for (const attr of [...el.attributes]) {
    const name = attr.name;
    // Extra namespace declarations (xmlns:xlink…) aren't needed and aren't worth reporting.
    if (name.startsWith('xmlns:')) {
      el.removeAttribute(name);
      continue;
    }
    const keep =
      !name.includes(':') &&
      (GEOMETRY_ATTRIBUTES.has(name) || PRESENTATION_PROPERTIES.has(name)) &&
      // style="" is checked declaration by declaration below.
      (name === 'style' || !DANGEROUS_VALUE.test(attr.value));
    if (!keep) {
      tally.add('attribute', name);
      el.removeAttribute(name);
    }
  }

  const style = el.getAttribute('style');
  if (style !== null) {
    const kept: string[] = [];
    for (const [prop, value] of parseStyle(style)) {
      if (PRESENTATION_PROPERTIES.has(prop) && !DANGEROUS_VALUE.test(value)) {
        kept.push(`${prop}: ${value}`);
      } else {
        tally.add('style', prop);
      }
    }
    if (kept.length > 0) el.setAttribute('style', kept.join('; '));
    else el.removeAttribute('style');
  }
}

/** Parses a style attribute into [property, value] pairs (lowercased property names). */
export function parseStyle(style: string): [string, string][] {
  const out: [string, string][] = [];
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl
      .slice(i + 1)
      .replace(/!important/i, '')
      .trim();
    if (prop && value) out.push([prop, value]);
  }
  return out;
}

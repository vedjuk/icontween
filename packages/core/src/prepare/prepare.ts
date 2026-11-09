/**
 * The prepare pipeline: raw SVG string → prepared icon (rules 1–3, 6).
 *
 *   parse → sanitize → viewBox → walk the tree (styles, transforms, opacity)
 *   → shapes to paths → normalize to M/L/C/Z → flatten transforms → round
 *   → state A → report
 *
 * The input string is never modified; the pipeline works on its own parsed copy.
 */
import {
  circleToSegments,
  determinant,
  ellipseToSegments,
  IDENTITY,
  isIdentity,
  isUniformScale,
  lineToSegments,
  multiply,
  normalizePath,
  parsePoints,
  parseTransform,
  polyToSegments,
  rectToSegments,
  segmentsBounds,
  transformSegments,
  type Matrix,
  type NormalizeStats,
} from '../geometry';
import type { ElementState, PreparedElement, Segment, State, ViewBox } from '../schema';
import { sanitizeElement, type RemovedItem } from './sanitize';
import {
  inheritProps,
  ownProperty,
  parseLength,
  resolveElementStyle,
  round,
  type InheritedProps,
} from './styles';

/** Inputs larger than this are rejected before parsing. Icons are a few KB. */
export const MAX_SVG_BYTES = 1_000_000;

export interface PreparedIcon {
  viewBox: ViewBox;
  elements: PreparedElement[];
  /** State A: the prepared geometry with identity transforms. */
  state: State;
}

export interface PrepareReport {
  /** Shapes converted to paths, by source element name. */
  shapesConverted: Record<string, number>;
  /** Path commands rewritten during normalization. */
  path: NormalizeStats;
  /** Elements whose coordinates absorbed a transform (own or inherited). */
  transformsFlattened: number;
  /** Groups removed after their styles and transforms were pushed down. */
  groupsFlattened: number;
  /** Removed by the sanitizer. */
  removed: RemovedItem[];
  /** Elements left out of the result, with the reason. */
  skipped: { reason: string; count: number }[];
  /** Things the designer should know: unsupported features, approximations. */
  warnings: string[];
}

export type PrepareResult =
  { ok: true; icon: PreparedIcon; report: PrepareReport } | { ok: false; error: string };

export interface PrepareOptions {
  /** Defaults to the global DOMParser (browsers). Tests pass jsdom's. */
  domParser?: DOMParser;
}

/** Elements dropped because the feature isn't supported yet (vs. dropped for safety). */
const UNSUPPORTED_FEATURES = new Set([
  'text',
  'tspan',
  'mask',
  'clipPath',
  'linearGradient',
  'radialGradient',
  'pattern',
  'filter',
  'use',
  'image',
  'symbol',
  'marker',
  'style',
  'defs',
  'svg',
  'a',
  'switch',
]);

const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);

export function prepareSvg(source: string, options: PrepareOptions = {}): PrepareResult {
  if (source.length > MAX_SVG_BYTES) {
    return { ok: false, error: 'This file is too large to be an icon (over 1 MB).' };
  }
  if (/<!ENTITY/i.test(source)) {
    return { ok: false, error: "SVGs with entity declarations (<!ENTITY>) aren't supported." };
  }

  const Parser = options.domParser ?? (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!Parser)
    throw new Error('prepareSvg needs a DOMParser (pass options.domParser outside browsers)');

  const doc = Parser.parseFromString(source, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, error: "This isn't valid SVG. Check that the code is complete." };
  }
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg') {
    return { ok: false, error: 'The file needs an <svg> root element.' };
  }

  const report: PrepareReport = {
    shapesConverted: {},
    path: { arcs: 0, quadratics: 0, shorthands: 0, relative: 0 },
    transformsFlattened: 0,
    groupsFlattened: 0,
    removed: [],
    skipped: [],
    warnings: [],
  };

  report.removed = sanitizeElement(root).removed;
  const unsupported = report.removed
    .filter((r) => r.kind === 'element' && UNSUPPORTED_FEATURES.has(r.name))
    .map((r) => `<${r.name}>`);
  if (unsupported.length > 0) {
    report.warnings.push(
      `Not supported yet and left out: ${unsupported.join(', ')}. The result may look different.`,
    );
  }

  const viewBox = readViewBox(root);
  if (!viewBox) {
    return { ok: false, error: 'The SVG needs a viewBox (or a width and height) to place it.' };
  }

  const walker = new Walker(report);
  walker.visit(root, IDENTITY, {}, 1, true);

  if (walker.elements.length === 0) {
    return { ok: false, error: 'No drawable shapes were found in this SVG.' };
  }

  walker.finishWarnings();

  const state: State = { id: 'A', elements: {} };
  const elements: PreparedElement[] = walker.elements.map((e, i) => {
    const id = `el-${i + 1}`;
    state.elements[id] = e.state;
    return { id, ...(e.name ? { name: e.name } : {}), style: e.style };
  });

  return { ok: true, icon: { viewBox, elements, state }, report };
}

function readViewBox(root: Element): ViewBox | null {
  const vb = root.getAttribute('viewBox');
  if (vb) {
    const nums = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (nums.length === 4 && nums.every(Number.isFinite) && nums[2]! > 0 && nums[3]! > 0) {
      return nums as unknown as ViewBox;
    }
  }
  const w = parseLength(root.getAttribute('width'));
  const h = parseLength(root.getAttribute('height'));
  return w && h && w > 0 && h > 0 ? [0, 0, w, h] : null;
}

interface CollectedElement {
  name?: string;
  style: PreparedElement['style'];
  state: ElementState;
}

class Walker {
  readonly elements: CollectedElement[] = [];
  private skipped = new Map<string, number>();
  private filled = 0;
  private nonUniformStroke = 0;
  private ignoredProps = new Set<string>();

  constructor(private report: PrepareReport) {}

  visit(
    el: Element,
    parentCtm: Matrix,
    parentProps: InheritedProps,
    parentOpacity: number,
    isRoot = false,
  ) {
    const name = el.localName;
    if (name === 'title' || name === 'desc') return;

    if (ownProperty(el, 'display') === 'none') {
      this.skip('hidden (display: none)');
      return;
    }

    let ctm = parentCtm;
    const transform = el.getAttribute('transform');
    if (transform) {
      try {
        ctm = multiply(parentCtm, parseTransform(transform));
      } catch {
        this.report.warnings.push(`Couldn't read transform "${transform}"; left that part out.`);
        this.skip('unreadable transform');
        return;
      }
    }
    const props = inheritProps(el, parentProps);
    const ownOpacity = Number(ownProperty(el, 'opacity') ?? 1);
    const opacity = parentOpacity * (Number.isFinite(ownOpacity) ? clamp01(ownOpacity) : 1);

    if (name === 'svg' || name === 'g') {
      if (!isRoot) this.report.groupsFlattened++;
      for (const child of el.children) this.visit(child, ctm, props, opacity);
      return;
    }
    if (!SHAPES.has(name)) return; // sanitizer already removed anything else

    if (props.visibility === 'hidden' || props.visibility === 'collapse') {
      this.skip('hidden (visibility)');
      return;
    }

    let segments: Segment[];
    try {
      segments = this.shapeSegments(el);
    } catch (err) {
      this.report.warnings.push(`Couldn't read a <${name}>: ${(err as Error).message}`);
      this.skip('unreadable path data');
      return;
    }
    if (segments.length === 0) {
      this.skip('empty (zero size or no path data)');
      return;
    }

    if (!isIdentity(ctm)) {
      segments = transformSegments(segments, ctm);
      this.report.transformsFlattened++;
    }
    segments = segments.map(roundSegment);

    const uniform = isUniformScale(ctm);
    const strokeScale = Math.sqrt(Math.abs(determinant(ctm)));
    const { style, notes } = resolveElementStyle(props, strokeScale);
    for (const n of notes) this.report.warnings.push(n);

    const hasStroke = style.stroke !== 'none' && style.strokeWidth > 0;
    const hasFill = style.fill !== 'none' && style.fill !== 'transparent';
    if (!hasStroke && !hasFill) {
      this.skip('invisible (no stroke and no fill)');
      return;
    }
    if (hasFill) this.filled++;
    if (hasStroke && !uniform) this.nonUniformStroke++;
    for (const p of ['fill-opacity', 'stroke-opacity', 'stroke-dasharray'] as const) {
      if (props[p] !== undefined) this.ignoredProps.add(p);
    }

    const b = segmentsBounds(segments)!;
    const id = el.getAttribute('id');
    this.elements.push({
      ...(id && /^[\w-]{1,40}$/.test(id) ? { name: id } : {}),
      style,
      state: {
        segments,
        transform: {
          translateX: 0,
          translateY: 0,
          rotate: 0,
          scale: 1,
          originX: round((b.minX + b.maxX) / 2),
          originY: round((b.minY + b.maxY) / 2),
        },
        opacity: round(opacity),
        draw: { start: 0, end: 1 },
      },
    });
  }

  private shapeSegments(el: Element): Segment[] {
    const name = el.localName;
    const num = (attr: string) => parseLength(el.getAttribute(attr)) ?? 0;
    const optional = (attr: string) => {
      const v = el.getAttribute(attr);
      return v === null || v.trim() === 'auto' ? undefined : (parseLength(v) ?? undefined);
    };
    const count = () => {
      this.report.shapesConverted[name] = (this.report.shapesConverted[name] ?? 0) + 1;
    };

    switch (name) {
      case 'path': {
        const { segments, stats } = normalizePath(el.getAttribute('d') ?? '');
        for (const k of Object.keys(stats) as (keyof NormalizeStats)[]) {
          this.report.path[k] += stats[k];
        }
        return segments;
      }
      case 'circle':
        count();
        return circleToSegments(num('cx'), num('cy'), num('r'));
      case 'ellipse': {
        count();
        // SVG 2: a missing rx/ry ("auto") takes the other's value.
        const rx = optional('rx');
        const ry = optional('ry');
        return ellipseToSegments(num('cx'), num('cy'), rx ?? ry ?? 0, ry ?? rx ?? 0);
      }
      case 'rect':
        count();
        return rectToSegments(
          num('x'),
          num('y'),
          num('width'),
          num('height'),
          optional('rx'),
          optional('ry'),
        );
      case 'line':
        count();
        return lineToSegments(num('x1'), num('y1'), num('x2'), num('y2'));
      case 'polyline':
      case 'polygon':
        count();
        return polyToSegments(parsePoints(el.getAttribute('points') ?? ''), name === 'polygon');
      default:
        return [];
    }
  }

  private skip(reason: string) {
    this.skipped.set(reason, (this.skipped.get(reason) ?? 0) + 1);
  }

  finishWarnings() {
    const w = this.report.warnings;
    if (this.filled > 0) {
      w.push(
        `${plural(this.filled, 'element is', 'elements are')} filled. Filled icons aren't fully supported yet; the fill is kept but may not animate well.`,
      );
    }
    if (this.nonUniformStroke > 0) {
      w.push(
        `${plural(this.nonUniformStroke, 'stroke was', 'strokes were')} stretched or skewed by a transform. Stroke width is approximated.`,
      );
    }
    if (this.ignoredProps.size > 0) {
      w.push(`Ignored (not supported yet): ${[...this.ignoredProps].join(', ')}.`);
    }
    this.report.skipped = [...this.skipped].map(([reason, count]) => ({ reason, count }));
  }
}

function roundSegment(s: Segment): Segment {
  switch (s.cmd) {
    case 'M':
    case 'L':
      return { cmd: s.cmd, x: round(s.x), y: round(s.y) };
    case 'C':
      return {
        cmd: 'C',
        x1: round(s.x1),
        y1: round(s.y1),
        x2: round(s.x2),
        y2: round(s.y2),
        x: round(s.x),
        y: round(s.y),
      };
    case 'Z':
      return s;
  }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Human-readable lines for the cleanup report, e.g.
 * "2 circles → paths", "3 arcs → curves", "Removed for safety: 1 <script>".
 */
export function describeReport(report: PrepareReport): string[] {
  const lines: string[] = [];
  for (const [shape, n] of Object.entries(report.shapesConverted)) {
    lines.push(plural(n, `${shape} → path`, `${shape}s → paths`));
  }
  const p = report.path;
  if (p.arcs) lines.push(`${plural(p.arcs, 'arc', 'arcs')} → curves`);
  if (p.quadratics)
    lines.push(`${plural(p.quadratics, 'quadratic curve', 'quadratic curves')} → cubic curves`);
  if (p.shorthands)
    lines.push(`${plural(p.shorthands, 'shorthand command', 'shorthand commands')} expanded`);
  if (p.relative)
    lines.push(`${plural(p.relative, 'relative command', 'relative commands')} made absolute`);
  if (report.transformsFlattened) {
    lines.push(
      `${plural(report.transformsFlattened, 'transform', 'transforms')} flattened into coordinates`,
    );
  }
  if (report.groupsFlattened) {
    lines.push(`${plural(report.groupsFlattened, 'group', 'groups')} removed (styles pushed down)`);
  }
  const removed = report.removed.filter(
    (r) => !(r.kind === 'element' && UNSUPPORTED_FEATURES.has(r.name)),
  );
  if (removed.length > 0) {
    const label = { element: '', attribute: ' attribute', style: ' style' } as const;
    const items = removed.map((r) =>
      r.kind === 'element' ? `${r.count}× <${r.name}>` : `${r.count}× ${r.name}${label[r.kind]}`,
    );
    lines.push(`Removed for safety: ${items.join(', ')}`);
  }
  for (const s of report.skipped)
    lines.push(`Left out ${plural(s.count, 'element', 'elements')}: ${s.reason}`);
  return [...lines, ...report.warnings];
}

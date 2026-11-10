// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cubicAt,
  describeReport,
  prepareSvg,
  segmentsToD,
  validateAnimation,
  type Animation,
  type PrepareResult,
  type Segment,
} from '../src';

// Plain paths: the jsdom environment replaces the global URL class.
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'svg');
const fixture = (name: string) => readFileSync(join(FIXTURES, `${name}.svg`), 'utf8');

function prepared(name: string) {
  const result = prepareSvg(fixture(name));
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result;
}

function d(result: Extract<PrepareResult, { ok: true }>, index: number) {
  return segmentsToD(result.icon.state.elements[`el-${index + 1}`]!.segments);
}

const CANONICAL = new Set(['M', 'L', 'C', 'Z']);

describe('prepareSvg: Lucide icons', () => {
  it.each(['lucide-search', 'lucide-copy', 'lucide-bell'])(
    '%s prepares into canonical, valid geometry',
    (name) => {
      const result = prepared(name);
      const { icon } = result;
      expect(icon.viewBox).toEqual([0, 0, 24, 24]);
      for (const el of icon.elements) {
        expect(el.style).toEqual({
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          fill: 'none',
        });
        const segs = icon.state.elements[el.id]!.segments;
        expect(segs[0]!.cmd).toBe('M');
        expect(segs.every((s) => CANONICAL.has(s.cmd))).toBe(true);
      }
      // Wrapped as a one-state animation, it passes validation.
      expect(validateAnimation(wrap(result))).toEqual({ ok: true });
      expect(result.report.warnings).toEqual([]);
    },
  );

  it('search: circle → 4 cubics starting at the right, path made absolute', () => {
    const result = prepared('lucide-search');
    expect(d(result, 0)).toBe(
      'M19 11 C19 15.418 15.418 19 11 19 C6.582 19 3 15.418 3 11 C3 6.582 6.582 3 11 3 C15.418 3 19 6.582 19 11 Z',
    );
    expect(d(result, 1)).toBe('M21 21 L16.7 16.7');
    expect(result.report.shapesConverted).toEqual({ circle: 1 });
    expect(result.report.path.relative).toBe(2);
  });

  it('copy: rounded rect and arc-free relative path', () => {
    const result = prepared('lucide-copy');
    expect(d(result, 0).startsWith('M10 8 L20 8 C21.105 8 22 8.895 22 10 L22 20')).toBe(true);
    expect(d(result, 1)).toBe(
      'M4 16 C2.9 16 2 15.1 2 14 L2 4 C2 2.9 2.9 2 4 2 L14 2 C15.1 2 16 2.9 16 4',
    );
  });

  it('bell: arcs become curves; state A has bounding-box origins', () => {
    const result = prepared('lucide-bell');
    expect(result.report.path.arcs).toBeGreaterThan(0);
    const clapper = result.icon.state.elements['el-1']!;
    expect(clapper.segments[0]).toEqual({ cmd: 'M', x: 10.268, y: 21 });
    expect(clapper.segments.at(-1)).toMatchObject({ x: 13.732, y: 21 });
    expect(clapper.transform).toMatchObject({ rotate: 0, scale: 1, originX: 12 });
    expect(clapper.opacity).toBe(1);
    expect(clapper.draw).toEqual({ start: 0, end: 1 });
  });
});

describe('prepareSvg: shapes', () => {
  it('converts every basic shape and reports counts', () => {
    const result = prepared('shapes');
    expect(result.report.shapesConverted).toEqual({
      circle: 1,
      ellipse: 1,
      rect: 1,
      line: 1,
      polyline: 1,
      polygon: 1,
    });
    expect(d(result, 2)).toBe('M2 2 L10 2 L10 8 L2 8 Z');
    expect(d(result, 3)).toBe('M2 22 L22 22');
    expect(d(result, 4)).toBe('M2 18 L6 14 L10 18');
    expect(d(result, 5)).toBe('M14 18 L18 14 L22 18 Z');
  });

  it('keeps circle samples on the circle after rounding', () => {
    const segs = prepared('shapes').icon.state.elements['el-1']!.segments;
    let [px, py] = [0, 0];
    for (const s of segs) {
      if (s.cmd === 'M') [px, py] = [s.x, s.y];
      if (s.cmd !== 'C') continue;
      for (let t = 0; t <= 1; t += 0.125) {
        const x = cubicAt(px, s.x1, s.x2, s.x, t);
        const y = cubicAt(py, s.y1, s.y2, s.y, t);
        expect(Math.abs(Math.hypot(x - 12, y - 12) - 10)).toBeLessThan(0.01);
      }
      [px, py] = [s.x, s.y];
    }
  });

  it('gives all rounded rects the same structure, clamping radii', () => {
    const result = prepared('rounded-rects');
    const cmds = (i: number) =>
      result.icon.state.elements[`el-${i}`]!.segments.map((s: Segment) => s.cmd).join('');
    expect(cmds(1)).toBe('MLCLCLCLCZ');
    expect(cmds(2)).toBe(cmds(1));
    expect(cmds(3)).toBe(cmds(1));
    expect(d(result, 0).startsWith('M5 2 L19 2')).toBe(true);
  });
});

describe('prepareSvg: paths', () => {
  it('expands shorthand and quadratic commands', () => {
    const result = prepared('shorthand');
    expect(d(result, 0)).toBe('M2 2 L12 2 L12 12 L8 12 L8 16');
    expect(d(result, 1)).toBe('M2 20 C4.667 16 7.333 16 10 20 C12.667 24 15.333 24 18 20');
    expect(d(result, 2)).toBe('M2 8 C4 4 8 4 10 8 C12 12 16 12 18 8');
    expect(result.report.path).toMatchObject({ quadratics: 2 });
  });

  it('converts every arc form, including compact flags', () => {
    const result = prepared('arcs');
    expect(result.report.path.arcs).toBe(3);
    for (const id of ['el-1', 'el-2', 'el-3']) {
      const segs = result.icon.state.elements[id]!.segments;
      expect(segs.slice(1).every((s) => s.cmd === 'C')).toBe(true);
    }
    expect(d(result, 0)).toBe('M2 12 C2 6.477 6.477 2 12 2 C17.523 2 22 6.477 22 12');
    expect(d(result, 2)).toBe('M12 2 C12.552 2 13 2.448 13 3');
  });
});

describe('prepareSvg: transforms', () => {
  it('flattens nested group, element, rotate and matrix transforms', () => {
    const result = prepared('transforms');
    expect(d(result, 0)).toBe('M10 2 L14 2');
    expect(d(result, 1)).toBe('M4 0 L4 4 L0 4 L0 0 Z');
    expect(d(result, 2).startsWith('M21 20 C21 20.552')).toBe(true);
    expect(result.report.transformsFlattened).toBe(4);
    expect(result.report.groupsFlattened).toBe(2);
  });

  it('scales stroke width with uniform transforms', () => {
    const { icon } = prepared('transforms');
    expect(icon.elements[0]!.style.strokeWidth).toBe(4); // scale(2) inside translate
    expect(icon.elements[1]!.style.strokeWidth).toBe(2); // rotation only
  });

  it('warns when a non-uniform transform stretches a stroke', () => {
    const { icon, report } = prepared('transforms');
    expect(d({ ok: true, icon, report }, 3)).toBe('M0 0 L8 0');
    expect(report.warnings).toContainEqual(expect.stringContaining('Stroke width is approximated'));
  });
});

describe('prepareSvg: styles', () => {
  it('resolves inherited attributes, inline styles and inherit', () => {
    const { icon } = prepared('inline-styles');
    // style="" beats the attribute; inline beats inherited.
    expect(icon.elements[0]!.style).toMatchObject({
      stroke: 'green',
      strokeWidth: 3,
      strokeLinecap: 'round',
      fill: 'none',
    });
    // "inherit" keeps the parent value; own attribute applies.
    expect(icon.elements[1]!.style).toMatchObject({
      stroke: 'red',
      strokeWidth: 3,
      strokeLinejoin: 'bevel',
    });
  });

  it('carries element opacity into state A', () => {
    const { icon } = prepared('inline-styles');
    expect(icon.state.elements['el-2']!.opacity).toBe(0.5);
  });

  it('warns about filled icons but keeps them', () => {
    const { icon, report } = prepared('filled');
    expect(icon.elements[0]!.style).toMatchObject({ fill: 'black', stroke: 'none' });
    expect(report.warnings).toContainEqual(
      expect.stringContaining("Filled icons aren't fully supported"),
    );
  });
});

describe('prepareSvg: sanitizing', () => {
  it('removes scripts, foreign content, handlers and remote references', () => {
    const result = prepared('malicious');
    expect(result.icon.elements).toHaveLength(1);
    const el = result.icon.elements[0]!;
    expect(el.name).toBe('p');
    // url() stroke and fill are dropped, so inherited values apply.
    expect(el.style).toMatchObject({ stroke: 'black', strokeWidth: 2, fill: 'none' });

    const removed = Object.fromEntries(
      result.report.removed.map((r) => [`${r.kind}:${r.name}`, r.count]),
    );
    expect(removed).toMatchObject({
      'element:script': 1,
      'element:foreignObject': 1,
      'element:a': 1,
      'element:image': 1,
      'element:use': 1,
      'element:style': 1,
      'attribute:onload': 1,
      'attribute:onclick': 1,
      'attribute:fill': 1,
      'style:stroke': 1,
    });
    const lines = describeReport(result.report).join('\n');
    expect(lines).toContain('Removed for safety: 1× <script>');
    expect(lines).toContain('1× onclick attribute');
    expect(lines).toContain('1× stroke style');
    expect(lines).toContain('Embedded images were left out.');
    expect(lines).not.toMatch(/Removed for safety:.*<(a|image|use|style)>/);
  });

  it('never touches the source string', () => {
    const source = fixture('malicious');
    const copy = String(source);
    prepareSvg(source);
    expect(source).toBe(copy);
  });

  it('rejects entity declarations', () => {
    const svg = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1"/>`;
    expect(prepareSvg(svg)).toEqual({ ok: false, error: expect.stringContaining('ENTITY') });
  });
});

describe('prepareSvg: unsupported features', () => {
  it('finds features nested in <defs> and explains each in plain words', () => {
    const result = prepared('unsupported');
    const counts = Object.fromEntries(result.report.unsupported.map((u) => [u.feature, u.count]));
    expect(counts).toEqual({
      gradient: 1,
      clipping: 1,
      symbol: 3, // one <symbol>, two <use>
      stylesheet: 1,
      text: 2, // <text> and its <tspan>
    });
    const w = result.report.warnings.join('\n');
    expect(w).toContain('Gradients aren’t supported');
    expect(w).toContain('Masks and clipping paths aren’t supported');
    expect(w).toContain('Symbols placed with <use>');
    expect(w).toContain('CSS in a <style> block is ignored');
    expect(w).toContain('Convert text to outlines');
    expect(w).toContain('Dashed strokes');
    expect(w).toContain('See-through fills and strokes');
    // One line per feature, not one per element.
    expect(result.report.warnings.filter((l) => l.includes('Text isn’t'))).toHaveLength(1);
  });

  it('lists features as plain words, not element names, in the report', () => {
    const lines = describeReport(prepared('unsupported').report).join('\n');
    expect(lines).not.toContain('<defs>');
    expect(lines).not.toContain('<linearGradient>');
    // fill="url(#g)" and clip-path="url(#c)" pointed at the gradient and the clip: not a safety issue.
    expect(lines).not.toContain('Removed for safety');
  });

  it('still lists a url() fill as a safety removal when there is no gradient', () => {
    const result = prepareSvg(
      '<svg viewBox="0 0 24 24"><path d="M0 0 L9 9" stroke="black" fill="url(https://x.test/a)"/></svg>',
    );
    expect(result.ok && describeReport(result.report).join('\n')).toContain(
      'Removed for safety: 1× fill attribute',
    );
  });

  it('still prepares the shapes it can use', () => {
    expect(prepared('unsupported').icon.elements).toHaveLength(2);
  });

  it('says why nothing is left when everything was unsupported', () => {
    const result = prepareSvg('<svg viewBox="0 0 24 24"><text x="2" y="20">Logo</text></svg>');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('No drawable shapes');
      expect(result.error).toContain('Convert text to outlines');
    }
  });

  it('reports nothing for clean icons', () => {
    expect(prepared('lucide-bell').report.unsupported).toEqual([]);
  });
});

describe('prepareSvg: edge cases', () => {
  it('skips hidden, empty and invisible elements, and says why', () => {
    const result = prepared('hidden-and-empty');
    expect(result.icon.elements).toHaveLength(1);
    expect(d(result, 0)).toBe('M12 12 L20 20');
    expect(result.report.skipped).toEqual(
      expect.arrayContaining([
        { reason: 'hidden (display: none)', count: 2 },
        { reason: 'empty (zero size or no path data)', count: 1 },
        { reason: 'hidden (visibility)', count: 1 },
        { reason: 'invisible (no stroke and no fill)', count: 1 },
      ]),
    );
  });

  it('falls back to width/height without a viewBox', () => {
    expect(prepared('no-viewbox').icon.viewBox).toEqual([0, 0, 32, 16]);
  });

  it('accepts SVG without an xmlns', () => {
    expect(prepared('no-namespace').icon.elements).toHaveLength(1);
  });

  it.each([
    ['broken XML', '<svg viewBox="0 0 24 24"><path d="M0 0"', "isn't valid SVG"],
    ['non-SVG root', '<html><body/></html>', '<svg> root'],
    ['no size', '<svg><path d="M0 0 L1 1" stroke="black"/></svg>', 'viewBox'],
    ['nothing drawable', '<svg viewBox="0 0 24 24"><title>x</title></svg>', 'No drawable'],
    ['too large', `<svg viewBox="0 0 1 1">${' '.repeat(1_000_001)}</svg>`, 'too large'],
  ])('rejects %s with a clear message', (_, svg, message) => {
    const result = prepareSvg(svg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it('skips an element with unreadable path data and warns', () => {
    const result = prepareSvg(
      '<svg viewBox="0 0 24 24" stroke="black"><path d="M0 0 X"/><path d="M1 1 L2 2"/></svg>',
    );
    expect(result.ok && result.icon.elements.length).toBe(1);
    expect(result.ok && result.report.warnings[0]).toContain("Couldn't read a <path>");
  });
});

function wrap(result: Extract<PrepareResult, { ok: true }>): Animation {
  return {
    id: 'test',
    name: 'test',
    purpose: 'feedback',
    viewBox: result.icon.viewBox,
    elements: result.icon.elements,
    states: [result.icon.state],
    sequence: { steps: [], repeat: 'once' },
    trigger: { type: 'manual' },
    reducedMotion: { mode: 'instant' },
  };
}

// @vitest-environment jsdom
/**
 * M3 "done when": all 12 starter examples can be built in the editor (brief §12, §14).
 *
 * Each starter is built here with only the operations the editor's controls call (the same
 * core functions the store uses): add a state, move points one at a time (drag or X/Y
 * fields), set transform/opacity/draw, set the pivot, edit the sequence path, set step
 * timing and delays, trigger, repeat and reduced motion. No structure changes (rule 4).
 *
 * Icon-to-icon pairs are then compared with the Lucide icon they turn into: every visible
 * stroke must lie within half a unit (half a pixel at 24 px) of the target's, and back.
 */
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  encodeShare,
  exportHtml,
  exportJson,
  exportReact,
  exportSvg,
  readAnimation,
  resolveTokens,
  setSequencePath,
  shareAnimation,
  SHARE_LINK_WARN_LENGTH,
  segmentsToD,
  validateAnimation,
  type Animation,
  type ElementState,
} from '../src';
import { builds, load, TOKENS, type Pt } from './starters';

/** Points along the visible part of an element state, with its transform applied. */
function sample(es: ElementState): Pt[] {
  if (es.opacity === 0 || es.draw.end - es.draw.start <= 0) return [];
  expect(es.draw).toEqual({ start: 0, end: 1 }); // partial draws aren't compared
  const { translateX, translateY, rotate, scale, originX, originY } = es.transform;
  const cos = Math.cos((rotate * Math.PI) / 180);
  const sin = Math.sin((rotate * Math.PI) / 180);
  const place = ({ x, y }: Pt): Pt => {
    const dx = (x - originX) * scale;
    const dy = (y - originY) * scale;
    return {
      x: translateX + originX + dx * cos - dy * sin,
      y: translateY + originY + dx * sin + dy * cos,
    };
  };
  const out: Pt[] = [];
  let pen: Pt = { x: 0, y: 0 };
  let startPt: Pt = pen;
  const line = (a: Pt, b: Pt) => {
    for (let i = 0; i <= 40; i++)
      out.push(place({ x: a.x + ((b.x - a.x) * i) / 40, y: a.y + ((b.y - a.y) * i) / 40 }));
  };
  for (const s of es.segments) {
    if (s.cmd === 'M') {
      pen = startPt = { x: s.x, y: s.y };
      out.push(place(pen));
    } else if (s.cmd === 'L') {
      line(pen, s);
      pen = { x: s.x, y: s.y };
    } else if (s.cmd === 'C') {
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const u = 1 - t;
        out.push(
          place({
            x: u * u * u * pen.x + 3 * u * u * t * s.x1 + 3 * u * t * t * s.x2 + t * t * t * s.x,
            y: u * u * u * pen.y + 3 * u * u * t * s.y1 + 3 * u * t * t * s.y2 + t * t * t * s.y,
          }),
        );
      }
      pen = { x: s.x, y: s.y };
    } else {
      line(pen, startPt);
      pen = startPt;
    }
  }
  return out;
}

/** Hausdorff distance between what a state shows and what an icon shows. */
function distance(a: Animation, stateId: string, icon: string): number {
  const state = a.states.find((s) => s.id === stateId)!;
  const target = load(icon);
  const built = Object.values(state.elements).flatMap(sample);
  const wanted = Object.values(target.state.elements).flatMap(sample);
  const oneWay = (from: Pt[], to: Pt[]) =>
    Math.max(...from.map((p) => Math.min(...to.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))));
  return Math.max(oneWay(built, wanted), oneWay(wanted, built));
}

/** Which state of each pair should look like which Lucide icon. */
const looksLike: [build: string, state: string, icon: string][] = [
  ['play-pause', 'A', 'play'],
  ['play-pause', 'B', 'pause'],
  ['menu-x', 'A', 'menu'],
  ['menu-x', 'B', 'x'],
  ['lock-unlock', 'A', 'lock'],
  ['lock-unlock', 'B', 'lock-open'],
  ['eye-eye-off', 'A', 'eye'],
  ['eye-eye-off', 'B', 'eye-off'],
  ['volume-mute', 'A', 'volume-2'],
  ['volume-mute', 'B', 'volume-x'],
  ['copy-check', 'A', 'copy'],
  ['copy-check', 'B', 'check'],
];

describe('starter set can be built with editor operations', () => {
  it('has 12 starters', () => {
    expect(Object.keys(builds)).toHaveLength(12);
  });

  it.each(Object.keys(builds))('%s builds into a valid animation', (name) => {
    const a = builds[name]!();
    expect(validateAnimation(a)).toEqual({ ok: true });
    expect(a.states.length).toBeGreaterThanOrEqual(2);
    expect(a.sequence.steps.length).toBeGreaterThanOrEqual(1);
  });

  it.each(Object.keys(builds))('%s fits in a share link', async (name) => {
    const code = await encodeShare(shareAnimation(builds[name]!(), { durations: {}, easings: {} }));
    expect(code.length).toBeLessThan(SHARE_LINK_WARN_LENGTH);
  });

  it.each(looksLike)('%s state %s looks like %s', (name, state, icon) => {
    expect(distance(builds[name]!(), state, icon)).toBeLessThan(0.5);
  });

  it('send passes through invisible states only during the jump', () => {
    const a = builds.send!();
    expect(a.sequence.steps[1]).toMatchObject({ from: 'B', to: 'C', duration: 0 });
  });

  it('refresh-cw ends a turn where it started', () => {
    const a = builds['refresh-cw']!();
    expect(a.trigger.type).toBe('loop');
    expect(a.sequence.steps).toHaveLength(1);
    expect(a.states[1]!.elements['el-1']!.transform.rotate % 360).toBe(0);
  });

  it('a starter path can be rebuilt by hand in the state strip', () => {
    // The strip's "+ step" and target selects call setSequencePath.
    const a = setSequencePath(builds.heart!(), ['A', 'C', 'B', 'A']);
    expect(validateAnimation(a)).toEqual({ ok: true });
  });
});

/** Stands in for the runtime in HTML exports; the runtime's own tests run the real one. */
const RUNTIME = 'var IconTween = { createPlayer: function () {} };';

describe('starter set exports (decision 016)', () => {
  it.each(Object.keys(builds))('%s exports as JSON that reads back', (name) => {
    const a = builds[name]!();
    const data = JSON.parse(exportJson(a, TOKENS).text);
    const read = readAnimation(data.animation);
    expect(read).toEqual({ ok: true, value: resolveTokens(a, TOKENS) });
    expect(JSON.stringify(data)).not.toContain('"token"');
  });

  it.each(Object.keys(builds))('%s exports as HTML with state A and its data', (name) => {
    const a = builds[name]!();
    const doc = new DOMParser().parseFromString(
      exportHtml(a, TOKENS, { runtime: RUNTIME }).text,
      'text/html',
    );
    const paths = [...doc.querySelectorAll('svg path')];
    expect(paths.map((p) => p.getAttribute('data-icontween-element'))).toEqual(
      a.elements.map((el) => el.id),
    );
    const scripts = [...doc.querySelectorAll('script')].map((el) => el.textContent!);
    expect(scripts).toHaveLength(2);
    // The start script runs against the stand-in runtime without throwing.
    const run = new Function('IconTween', 'document', scripts[1]!);
    const calls: unknown[][] = [];
    run({ createPlayer: (...args: unknown[]) => calls.push(args) && { play() {} } }, doc);
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe(doc.querySelector('svg'));
    expect(calls[0]![1]).toEqual(resolveTokens(a, TOKENS));
  });

  it.each(Object.keys(builds))('%s exports as a React component that compiles', (name) => {
    const a = builds[name]!();
    const file = exportReact(a, TOKENS);
    const out = ts.transpileModule(file.text, {
      fileName: file.fileName,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    });
    expect(out.diagnostics ?? []).toEqual([]);
    expect(file.text.match(/<path\b/g)).toHaveLength(a.elements.length);
  });

  it('copy-check exports stay the same (review the snapshot when they change)', () => {
    const a = builds['copy-check']!();
    expect(exportJson(a, TOKENS).text).toMatchSnapshot('json');
    expect(exportHtml(a, TOKENS, { runtime: RUNTIME }).text).toMatchSnapshot('html');
    expect(exportReact(a, TOKENS).text).toMatchSnapshot('react');
  });
});

/** Command letters of a `d` string: "M L C Z". */
const commands = (d: string) => (d.match(/[MLCZ]/g) ?? []).join(' ');

describe('starter set exports as SVG + SMIL (decision 017)', () => {
  it.each(Object.keys(builds))('%s exports as SVG that parses and matches state A', (name) => {
    const a = builds[name]!();
    const file = exportSvg(a, TOKENS);
    expect(file.fileName).toMatch(/\.svg$/);
    const doc = new DOMParser().parseFromString(file.text, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.tagName).toBe('svg');
    expect(file.text).not.toMatch(/<script|on\w+=/i);
    // Chrome reads "-" in begin="id.event" as an offset, so timer and hit ids have none.
    for (const el of doc.querySelectorAll('[begin]')) {
      expect(el.getAttribute('begin')).not.toMatch(/^[^.]*-/);
    }

    const groups = [...doc.querySelectorAll('svg > g')];
    expect(groups.length).toBe(2);
    const stateA = a.states[0]!.elements;
    for (const group of groups) {
      const paths = [...group.querySelectorAll('path')];
      expect(paths).toHaveLength(a.elements.length);
      paths.forEach((path, i) => {
        const shape = commands(segmentsToD(stateA[a.elements[i]!.id]!.segments));
        expect(commands(path.getAttribute('d')!)).toBe(shape);
        for (const anim of path.querySelectorAll('animate')) {
          const values = anim.getAttribute('values')!.split(';');
          const times = anim.getAttribute('keyTimes')?.split(';') ?? [];
          if (values.length > 1) expect(times).toHaveLength(values.length);
          const splines = anim.getAttribute('keySplines')?.split(';');
          if (splines) expect(splines).toHaveLength(values.length - 1);
          if (anim.getAttribute('attributeName') === 'd') {
            for (const v of values) expect(commands(v)).toBe(shape);
          }
        }
      });
    }

    // Every timer an animation begins with exists.
    const ids = new Set([...doc.querySelectorAll('[id]')].map((el) => el.id));
    for (const el of doc.querySelectorAll('[begin]')) {
      const ref = /^([\w-]+)\.\w+$/.exec(el.getAttribute('begin')!)?.[1];
      if (ref) expect(ids).toContain(ref);
    }
  });

  it('copy-check SVG stays the same (review the snapshot when it changes)', () => {
    expect(exportSvg(builds['copy-check']!(), TOKENS).text).toMatchSnapshot('svg');
  });
});

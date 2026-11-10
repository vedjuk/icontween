// @vitest-environment jsdom
/**
 * Preview = export for the SVG + SMIL export (rule 9, decision 017). SMIL can't use the
 * runtime, so this test evaluates the exported keyframes the way a browser does (keyTimes,
 * keySplines, values, repeat and freeze) and compares them with the runtime playing the
 * same animation, at sample times, for every starter: full motion, reduced motion, and the
 * way back for triggers that have one.
 */
import {
  cubicBezier as coreBezier,
  exportSvg,
  spring as coreSpring,
  type Animation,
} from '@icontween/core';
import { describe, expect, it } from 'vitest';
import { createPlayer, cubicBezier, spring, type ReducedMotionPreference } from '../src';
import { builds, TOKENS } from '../../core/test/starters';
import { fakeClock, makeSvg } from './helpers';

// --- A tiny SMIL evaluator -------------------------------------------------------------

const numbers = (s: string) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
const list = (s: string | null) => (s ?? '').split(';').map((x) => x.trim());

/** Numbers of an <animate>'s value at `t` ms after it began. */
function evaluate(anim: Element, t: number): number[] {
  const values = list(anim.getAttribute('values'));
  if (values.length === 1) return numbers(values[0]!);
  const dur = parseFloat(anim.getAttribute('dur')!);
  const repeat = anim.getAttribute('repeatCount') === 'indefinite';
  const local = repeat ? t % dur : Math.min(t, dur);
  const p = local / dur;
  const times = list(anim.getAttribute('keyTimes')).map(Number);
  const splines = anim.getAttribute('keySplines') ? list(anim.getAttribute('keySplines')) : null;
  // The last interval that starts at or before p (so a jump has happened at its time).
  let i = 0;
  while (i < times.length - 2 && times[i + 1]! <= p) i++;
  const span = times[i + 1]! - times[i]!;
  let u = span > 0 ? Math.min(1, Math.max(0, (p - times[i]!) / span)) : 1;
  if (splines) {
    const [x1, y1, x2, y2] = numbers(splines[i]!);
    u = cubicBezier(x1!, y1!, x2!, y2!)(u);
  }
  const a = numbers(values[i]!);
  const b = numbers(values[i + 1]!);
  return a.map((n, k) => n + (b[k]! - n) * u);
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

function part(type: string, v: number[]): Matrix {
  if (type === 'translate') return [1, 0, 0, 1, v[0]!, v[1] ?? 0];
  if (type === 'scale') return [v[0]!, 0, 0, v[1] ?? v[0]!, 0, 0];
  const r = (v[0]! * Math.PI) / 180;
  const rot: Matrix = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
  if (v.length < 3) return rot;
  const [cx, cy] = [v[1]!, v[2]!];
  return multiply(multiply([1, 0, 0, 1, cx, cy], rot), [1, 0, 0, 1, -cx, -cy]);
}

/** A transform attribute ("translate(1 2) rotate(45) …") as a matrix. */
function parseTransform(value: string | null): Matrix {
  let m = IDENTITY;
  for (const [, type, args] of (value ?? '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    m = multiply(m, part(type!, numbers(args!)));
  }
  return m;
}

/** What a path shows: its points with the transform applied, opacity and draw. */
interface Look {
  points: [number, number][];
  opacity: number;
  drawn: number;
  start: number;
}

function look(
  d: string,
  m: Matrix,
  opacity: string | null,
  dash: string | null,
  offset: string | null,
): Look {
  const n = numbers(d);
  const points: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) {
    const [x, y] = [n[i]!, n[i + 1]!];
    points.push([m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  }
  return {
    points,
    opacity: opacity === null ? 1 : Number(opacity),
    drawn: dash === null ? 1 : numbers(dash)[0]!,
    start: offset === null ? 0 : -Number(offset),
  };
}

/** What an exported path shows `t` ms after the timer `timer` began. */
function smilLook(path: Element, timer: string, t: number): Look {
  const anims = [...path.children].filter((el) => el.getAttribute('begin') === `${timer}.begin`);
  const value = (name: string) => {
    const anim = anims.find(
      (a) => a.tagName === 'animate' && a.getAttribute('attributeName') === name,
    );
    if (!anim) return path.getAttribute(name);
    const v = evaluate(anim, t);
    return name === 'd'
      ? fillNumbers(path.getAttribute('d')!, v)
      : name === 'stroke-dasharray'
        ? `${v[0]} 2`
        : String(v[0]);
  };
  const transforms = anims.filter((a) => a.tagName === 'animateTransform');
  let m = transforms.length ? IDENTITY : parseTransform(path.getAttribute('transform'));
  for (const a of transforms) {
    const p = part(a.getAttribute('type')!, evaluate(a, t));
    m = a.getAttribute('additive') === 'sum' ? multiply(m, p) : p;
  }
  return look(
    value('d')!,
    m,
    value('opacity'),
    value('stroke-dasharray'),
    value('stroke-dashoffset'),
  );
}

/** Puts numbers back into a `d` string with the same commands. */
function fillNumbers(d: string, values: number[]): string {
  let i = 0;
  return d.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, () => String(values[i++]));
}

function runtimeLook(path: Element): Look {
  return look(
    path.getAttribute('d')!,
    parseTransform(path.getAttribute('transform')),
    path.getAttribute('opacity'),
    path.getAttribute('stroke-dasharray'),
    path.getAttribute('stroke-dashoffset'),
  );
}

/** Largest difference between two looks: point distance in viewBox units, or value. */
function difference(a: Look, b: Look): number {
  let worst = 0;
  a.points.forEach(([x, y], i) => {
    const [x2, y2] = b.points[i]!;
    worst = Math.max(worst, Math.hypot(x - x2, y - y2));
  });
  // A hidden path shows nothing, whatever its shape or draw.
  if (a.opacity < 0.01 && b.opacity < 0.01) return Math.abs(a.opacity - b.opacity);
  return Math.max(
    worst,
    Math.abs(a.opacity - b.opacity),
    a.drawn < 1 || b.drawn < 1 ? Math.abs(a.drawn - b.drawn) + Math.abs(a.start - b.start) : 0,
  );
}

// --- The comparison -------------------------------------------------------------------

/** Half a twentieth of a pixel at 24 px, plus rounding to 3 decimals. */
const TOLERANCE = 0.06;

interface Case {
  name: string;
  reduced: ReducedMotionPreference;
  direction: 'play' | 'reverse';
}

function compare(animation: Animation, { reduced, direction }: Case): number {
  const doc = new DOMParser().parseFromString(exportSvg(animation, TOKENS).text, 'image/svg+xml');
  const groups = [...doc.querySelectorAll('svg > g')];
  const group = reduced === 'reduce' ? groups[1]! : groups[0]!;
  const paths = [...group.querySelectorAll('path')];
  const timerId = (suffix: string) => doc.querySelector(`animate[id$="${suffix}"]`)!.id;
  const timer = doc.querySelector(`animate[id$="${direction === 'play' ? 'Play' : 'Reverse'}"]`)!;
  const duration = parseFloat(timer.getAttribute('dur')!);
  const repeat = timer.getAttribute('repeatCount') === 'indefinite';

  const clock = fakeClock();
  const svg = makeSvg();
  const player = createPlayer(svg, animation, {
    tokens: TOKENS,
    trigger: 'none',
    reducedMotion: reduced,
    clock,
  });
  if (direction === 'reverse') {
    // The way back starts from the end of a finished forward run.
    player.play();
    clock.advance(parseFloat(doc.getElementById(timerId('Play'))!.getAttribute('dur')!) + 100);
  }
  const began = clock.now();
  if (direction === 'play') player.play();
  else player.reverse();

  const runtimePaths = [...svg.querySelectorAll('path')];
  const span = repeat ? duration * 2.5 : duration + 100;
  let worst = 0;
  for (let k = 0; k <= 60; k++) {
    // A quarter millisecond off whole and half milliseconds, so no sample sits on a jump.
    const t = Math.round((span * k) / 60) + 0.25;
    clock.advance(began + t - clock.now(), 5);
    paths.forEach((path, i) => {
      // A still group (reduced motion "none") has no timer: it shows state A.
      const smil = smilLook(path, timer.id, t);
      worst = Math.max(worst, difference(smil, runtimeLook(runtimePaths[i]!)));
    });
  }
  player.destroy();
  svg.remove();
  return worst;
}

const cases: Case[] = Object.keys(builds).flatMap((name) => {
  const trigger = builds[name]!().trigger.type;
  const back = trigger === 'hover' || trigger === 'toggle' || trigger === 'manual';
  return (['no-preference', 'reduce'] as const).flatMap((reduced) => [
    { name, reduced, direction: 'play' as const },
    ...(back ? [{ name, reduced, direction: 'reverse' as const }] : []),
  ]);
});

describe('SVG + SMIL plays like the runtime', () => {
  it.each(cases)('$name, $direction, reduced motion $reduced', (c) => {
    expect(compare(builds[c.name]!(), c)).toBeLessThan(TOLERANCE);
  });

  it('every reduced-motion mode matches', () => {
    for (const mode of ['instant', 'fade', 'none'] as const) {
      const a = { ...builds['menu-x']!(), reducedMotion: { mode } };
      expect(compare(a, { name: 'menu-x', reduced: 'reduce', direction: 'play' })).toBeLessThan(
        TOLERANCE,
      );
      expect(compare(a, { name: 'menu-x', reduced: 'reduce', direction: 'reverse' })).toBeLessThan(
        TOLERANCE,
      );
    }
  });

  it('springs, overshooting curves, ping-pong and rest match', () => {
    const base = builds.download!();
    const variants: Animation[] = [
      // A bouncy spring, sampled.
      {
        ...base,
        sequence: {
          ...base.sequence,
          steps: base.sequence.steps.map((s) => ({
            ...s,
            easing: { type: 'token', name: 'spring-bouncy' },
          })),
        },
      },
      // A curve that overshoots (y outside 0..1, so not a keySpline).
      {
        ...base,
        sequence: {
          ...base.sequence,
          steps: base.sequence.steps.map((s) => ({
            ...s,
            easing: { type: 'cubic-bezier', x1: 0.3, y1: -0.4, x2: 0.4, y2: 1.6 },
          })),
        },
      },
      // Ping-pong with a rest at both ends, staggered.
      {
        ...base,
        trigger: { type: 'loop' },
        sequence: {
          steps: [{ ...base.sequence.steps[0]!, stagger: 40 }],
          repeat: 'ping-pong',
          restBetweenLoops: 300,
        },
      },
      // A loop with a rest, drawing a stroke.
      {
        ...base,
        trigger: { type: 'loop' },
        states: base.states.map((s, i) =>
          i === 0
            ? s
            : {
                ...s,
                elements: Object.fromEntries(
                  Object.entries(s.elements).map(([id, es]) => [
                    id,
                    { ...es, draw: { start: 0.2, end: 0 } },
                  ]),
                ),
              },
        ),
        sequence: { ...base.sequence, repeat: 'loop', restBetweenLoops: 200 },
      },
    ];
    for (const a of variants) {
      expect(
        compare(a, { name: 'variant', reduced: 'no-preference', direction: 'play' }),
      ).toBeLessThan(TOLERANCE);
    }
  });
});

describe("core's copy of the easing math", () => {
  it('matches the runtime', () => {
    const curves: [number, number, number, number][] = [
      [0.2, 0, 0, 1],
      [0.3, -0.4, 0.4, 1.6],
      [0, 0, 1, 1],
    ];
    for (const c of curves) {
      const a = cubicBezier(...c);
      const b = coreBezier(...c);
      for (let t = 0; t <= 1; t += 0.01) expect(b(t)).toBe(a(t));
    }
    for (const [k, d, m] of [
      [170, 26, 1],
      [400, 28, 1],
      [300, 14, 1],
      [100, 40, 2],
    ] as const) {
      const a = spring(k, d, m);
      const b = coreSpring(k, d, m);
      expect(b.duration).toBe(a.duration);
      for (let t = 0; t <= 1; t += 0.01) expect(b.ease(t)).toBe(a.ease(t));
    }
  });
});

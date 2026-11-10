/**
 * SVG export with SMIL: one .svg file that plays without JavaScript, inline or as
 * <img src> (brief §11, decision 017).
 *
 * SMIL is the one format that can't use the runtime, so this file rebuilds the runtime's
 * timeline as keyframes (rule 9; a runtime test compares the two at sample times):
 *
 * - A pass is the whole sequence in one direction. Every animated value of every path gets
 *   one <animate> over the whole pass: holds for delays and stagger, a move per step.
 * - Cubic-bezier curves become keySplines (exact). Springs and curves that overshoot are
 *   sampled into keyframes, with more where they bend.
 * - Loops repeat one cycle (forwards, then the rest; ping-pong adds the way back).
 * - One timer animation per direction starts each pass; everything else begins with it.
 * - Reduced motion (rule 8): a second copy of the paths, shown by a prefers-reduced-motion
 *   media query, jumps or fades between states (or stays on state A) and never loops.
 */
import { formatNumber, segmentsToD } from '../path';
import { pathAttributes } from '../render';
import type { Animation, ElementState, PreparedElement, TriggerType } from '../schema';
import type { MotionTokens } from '../tokens';
import { exportMotion, sampleCurve, type ExportMotion } from './easing';
import { reducedMotionSummary, resolveTokens, type ExportFile } from './export';
import { commentText, dataVariableName, exportFileBase } from './names';

type StateValues = Record<string, ElementState>;
type Spline = [number, number, number, number];
type Mode = 'motion' | 'instant' | 'fade';

// --- Which triggers work --------------------------------------------------------------

export interface SvgTriggerSupport {
  trigger: TriggerType;
  /** Works when the SVG is inline in a page (or opened on its own). */
  inline: boolean;
  /** Works in <img src>, CSS backgrounds and other places that show SVG as an image. */
  image: boolean;
  note: string;
}

/** Which triggers the SVG export can play, and where (for the Export dialog). */
export const SVG_TRIGGER_SUPPORT: readonly SvgTriggerSupport[] = [
  { trigger: 'loop', inline: true, image: true, note: 'Starts when the file loads.' },
  {
    trigger: 'appear',
    inline: true,
    image: true,
    note: 'Plays once when the file loads, not when it scrolls into view.',
  },
  {
    trigger: 'click',
    inline: true,
    image: false,
    note: 'Clicks while it plays are ignored, like the runtime.',
  },
  {
    trigger: 'hover',
    inline: true,
    image: false,
    note: 'Leaving halfway jumps to the end before playing back. No keyboard focus.',
  },
  {
    trigger: 'toggle',
    inline: true,
    image: false,
    note: 'Clicks while it plays are ignored.',
  },
  {
    trigger: 'manual',
    inline: true,
    image: false,
    note: 'Call beginElement() on the play or reverse timer.',
  },
];

/** "Trigger: click. Works when the SVG is inline; as an <img> it shows its first state." */
export function svgTriggerSummary(animation: Animation): string {
  const support = SVG_TRIGGER_SUPPORT.find((s) => s.trigger === animation.trigger.type)!;
  const where = support.image
    ? 'works inline and as an <img>'
    : 'works when the SVG is inline in a page; as an <img> it shows its first state';
  return `Trigger: ${animation.trigger.type}, ${where}.`;
}

// --- The timeline ---------------------------------------------------------------------

/** One movement of the whole icon from one state to the next, like the runtime's legs. */
interface Leg {
  start: number;
  from: StateValues;
  to: StateValues;
  duration: number;
  delays: Record<string, number>;
  total: number;
  motion: ExportMotion;
  mode: Mode;
}

/** Longest reduced-motion fade per leg, in ms (the runtime's FADE_MAX). */
const FADE_MAX = 200;

/** Legs for every step in one direction, starting at `start` (runtime: buildLeg). */
function passLegs(a: Animation, dir: 1 | -1, mode: Mode, start: number): Leg[] {
  const steps = a.sequence.steps;
  const byId = new Map(a.states.map((s) => [s.id, s.elements]));
  const order = steps.map((_, i) => (dir === 1 ? i : steps.length - 1 - i));
  let time = start;
  return order.map((i) => {
    const step = steps[i]!;
    const motion = exportMotion(step.easing, typeof step.duration === 'number' ? step.duration : 0);
    let duration = motion.duration;
    const delays: Record<string, number> = {};
    if (mode === 'motion') {
      const base = a.elements.map(
        ({ id }, n) => (step.delays?.[id] ?? 0) + (step.stagger ?? 0) * n,
      );
      const max = Math.max(0, ...base);
      // Mirrored on the way back: the last element to leave is the first to return.
      a.elements.forEach(({ id }, n) => {
        delays[id] = dir === 1 ? base[n]! : max - base[n]!;
      });
    } else if (mode === 'fade') {
      duration = Math.min(duration, FADE_MAX);
    }
    const total = duration + Math.max(0, ...Object.values(delays));
    const leg: Leg = {
      start: time,
      from: byId.get(dir === 1 ? step.from : step.to)!,
      to: byId.get(dir === 1 ? step.to : step.from)!,
      duration,
      delays,
      total,
      motion,
      mode,
    };
    time += total;
    return leg;
  });
}

interface Pass {
  legs: Leg[];
  /** Milliseconds of one run (one cycle when it repeats). */
  duration: number;
  repeat: boolean;
}

const sum = (legs: Leg[]) => legs.reduce((n, leg) => n + leg.total, 0);

/** The forward pass. Repeats (loop, ping-pong) only with full motion, like the runtime. */
function playPass(a: Animation, mode: Mode): Pass {
  const repeatMode =
    a.sequence.repeat === 'once' && a.trigger.type === 'loop' ? 'loop' : a.sequence.repeat;
  const rest = Math.max(0, a.sequence.restBetweenLoops ?? 0);
  const forward = passLegs(a, 1, mode, 0);
  const length = sum(forward);
  if (mode !== 'motion' || repeatMode === 'once') {
    return { legs: forward, duration: length, repeat: false };
  }
  if (repeatMode === 'loop') {
    // Rests on the last state, then the next cycle starts on the first.
    const cycle = length + rest;
    return { legs: forward, duration: cycle, repeat: cycle > 0 };
  }
  const back = passLegs(a, -1, mode, length + rest);
  const cycle = length + rest + sum(back) + rest;
  return { legs: [...forward, ...back], duration: cycle, repeat: cycle > 0 };
}

function reversePass(a: Animation, mode: Mode): Pass {
  const legs = passLegs(a, -1, mode, 0);
  return { legs, duration: sum(legs), repeat: false };
}

// --- Keyframes ------------------------------------------------------------------------

/** A keyframe: the element's values at `t`, reached from the previous one along `spline`. */
interface Key {
  t: number;
  es: ElementState;
  /** Reduced-motion fade multiplier for opacity. */
  fade: number;
  /** Forces visibility at a jump where a draw shrinks to nothing (or grows from it). */
  visible?: boolean;
  /** Curve into this key; null is a straight line (or a hold). */
  spline: Spline | null;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function mixState(a: ElementState, b: ElementState, t: number): ElementState {
  return {
    segments: a.segments.map((s, i) => {
      const o = b.segments[i] as Record<string, number | string>;
      const out: Record<string, number | string> = { ...s };
      for (const k in out) if (k !== 'cmd') out[k] = mix(out[k] as number, o[k] as number, t);
      return out as unknown as ElementState['segments'][number];
    }),
    transform: {
      translateX: mix(a.transform.translateX, b.transform.translateX, t),
      translateY: mix(a.transform.translateY, b.transform.translateY, t),
      rotate: mix(a.transform.rotate, b.transform.rotate, t),
      scale: mix(a.transform.scale, b.transform.scale, t),
      originX: mix(a.transform.originX, b.transform.originX, t),
      originY: mix(a.transform.originY, b.transform.originY, t),
    },
    opacity: mix(a.opacity, b.opacity, t),
    draw: { start: mix(a.draw.start, b.draw.start, t), end: mix(a.draw.end, b.draw.end, t) },
  };
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Whether the runtime paints the element (a fully undrawn path is hidden). */
function isVisible(es: ElementState): boolean {
  const start = clamp01(es.draw.start);
  const end = clamp01(es.draw.end);
  return !((start > 0 || end < 1) && end - start <= 0.0005);
}

/** How far a step moves anything, in viewBox units, to choose how finely to sample it. */
function reach(leg: Leg, radius: number): number {
  let far = 0;
  for (const id in leg.from) {
    const a = leg.from[id]!;
    const b = leg.to[id]!;
    a.segments.forEach((s, i) => {
      const o = b.segments[i] as Record<string, number | string>;
      for (const k in s) {
        if (k !== 'cmd') {
          far = Math.max(
            far,
            Math.abs((s as unknown as Record<string, number>)[k]! - (o[k] as number)),
          );
        }
      }
    });
    const ta = a.transform;
    const tb = b.transform;
    far = Math.max(
      far,
      Math.abs(ta.translateX - tb.translateX),
      Math.abs(ta.translateY - tb.translateY),
      (Math.abs(ta.rotate - tb.rotate) * Math.PI * radius) / 180,
      Math.abs(ta.scale - tb.scale) * radius,
      Math.abs(a.opacity - b.opacity) * radius,
      Math.abs(a.draw.start - b.draw.start) * radius * 2,
      Math.abs(a.draw.end - b.draw.end) * radius * 2,
    );
  }
  return far;
}

/** Largest error allowed when sampling, in viewBox units (0.05 px at 24 px). */
const SAMPLE_ERROR = 0.05;

/** Keyframes of one element over a pass. */
function elementKeys(id: string, pass: Pass, radius: number): Key[] {
  const first = pass.legs[0]!.from[id]!;
  const keys: Key[] = [{ t: 0, es: first, fade: 1, spline: null }];
  const add = (t: number, es: ElementState, extra: Partial<Key> = {}) =>
    keys.push({ t, es, fade: 1, spline: null, ...extra });

  for (const leg of pass.legs) {
    const from = leg.from[id]!;
    const to = leg.to[id]!;
    const s = leg.start;
    if (leg.mode === 'instant' || leg.duration <= 0) {
      // Every element jumps at the start of the leg (the runtime ignores delays here).
      add(s, from);
      add(s, to);
    } else if (leg.mode === 'fade') {
      const half = s + leg.duration / 2;
      add(s, from);
      add(half, from, { fade: 0 });
      add(half, to, { fade: 0 });
      add(s + leg.duration, to);
    } else {
      const begin = s + (leg.delays[id] ?? 0);
      add(begin, from);
      const { motion } = leg;
      const flips = isVisible(from) !== isVisible(to);
      if (motion.spline && !flips) {
        add(begin + leg.duration, to, { spline: motion.spline });
      } else {
        const far = reach(leg, radius);
        const tolerance = Math.min(0.005, far > 0 ? SAMPLE_ERROR / far : 0.005);
        let prevU = 0;
        let prev = from;
        for (const u of sampleCurve(motion.ease, tolerance)) {
          const es = mixState(from, to, motion.ease(u));
          if (isVisible(es) !== isVisible(prev)) {
            // The draw crosses zero between samples: find where, and jump there.
            let lo = prevU;
            let hi = u;
            for (let i = 0; i < 30; i++) {
              const m = (lo + hi) / 2;
              if (isVisible(mixState(from, to, motion.ease(m))) === isVisible(prev)) lo = m;
              else hi = m;
            }
            const at = mixState(from, to, motion.ease(hi));
            add(begin + hi * leg.duration, at, { visible: isVisible(prev) });
            add(begin + hi * leg.duration, at, { visible: !isVisible(prev) });
          }
          add(begin + u * leg.duration, es);
          prevU = u;
          prev = es;
        }
      }
    }
    add(s + leg.total, to);
  }
  // Loops hold the last state through the rest.
  const last = keys[keys.length - 1]!;
  if (last.t < pass.duration) add(pass.duration, last.es);
  return keys;
}

// --- Attributes -----------------------------------------------------------------------

/** One animated attribute, read from each keyframe. */
interface Channel {
  name: string;
  /** animateTransform type, or undefined for <animate>. */
  transform?: 'translate' | 'rotate' | 'scale';
  read: (key: Key) => string;
}

const f = (n: number) => formatNumber(n);

function renderedOpacity(key: Key): number {
  const visible = key.visible ?? isVisible(key.es);
  return clamp01(key.es.opacity) * key.fade * (visible ? 1 : 0);
}

const D: Channel = { name: 'd', read: (k) => segmentsToD(k.es.segments) };
const OPACITY: Channel = { name: 'opacity', read: (k) => f(renderedOpacity(k)) };
const DASHARRAY: Channel = {
  name: 'stroke-dasharray',
  read: (k) => `${f(Math.max(clamp01(k.es.draw.end) - clamp01(k.es.draw.start), 0))} 2`,
};
const DASHOFFSET: Channel = {
  name: 'stroke-dashoffset',
  read: (k) => f(-clamp01(k.es.draw.start)),
};

/**
 * The runtime's transform, translate(t) translate(o) rotate(r) scale(s) translate(-o),
 * written as parts SMIL can animate: translate(t) rotate(r o) translate(o·(1−s)) scale(s).
 */
const TRANSFORM_PARTS: Record<'translate' | 'rotate' | 'pivot' | 'scale', Channel> = {
  translate: {
    name: 'transform',
    transform: 'translate',
    read: (k) => `${f(k.es.transform.translateX)} ${f(k.es.transform.translateY)}`,
  },
  rotate: {
    name: 'transform',
    transform: 'rotate',
    read: (k) => {
      const t = k.es.transform;
      return `${f(t.rotate)} ${f(t.originX)} ${f(t.originY)}`;
    },
  },
  pivot: {
    name: 'transform',
    transform: 'translate',
    read: (k) => {
      const t = k.es.transform;
      return `${f(t.originX * (1 - t.scale))} ${f(t.originY * (1 - t.scale))}`;
    },
  },
  scale: { name: 'transform', transform: 'scale', read: (k) => f(k.es.transform.scale) },
};

/** Keyframes of one channel with repeated holds removed. */
function channelKeys(
  keys: Key[],
  channel: Channel,
): { t: number; v: string; spline: Spline | null }[] {
  const all = keys.map((k) => ({ t: k.t, v: channel.read(k), spline: k.spline }));
  const out: typeof all = [];
  for (let i = 0; i < all.length; i++) {
    const k = all[i]!;
    const prev = out[out.length - 1];
    const next = all[i + 1];
    // Same time, same value: nothing happens here.
    if (prev && prev.t === k.t && prev.v === k.v) continue;
    // Inside a hold: the value stays the same on both sides.
    if (prev && next && prev.v === k.v && next.v === k.v) continue;
    out.push(k);
  }
  return out;
}

interface Track {
  channel: Channel;
  keys: { t: number; v: string; spline: Spline | null }[];
  additive: boolean;
}

/** Tracks of one element in one pass, in the order they compose. */
function elementTracks(
  keys: Key[],
  partial: boolean,
  transformParts: (keyof typeof TRANSFORM_PARTS)[],
): Track[] {
  const tracks: Track[] = [];
  const varies = (c: Channel) => new Set(keys.map((k) => c.read(k))).size > 1;
  for (const c of [D, OPACITY, ...(partial ? [DASHARRAY, DASHOFFSET] : [])]) {
    if (varies(c)) tracks.push({ channel: c, keys: channelKeys(keys, c), additive: false });
  }
  transformParts.forEach((part, i) => {
    const c = TRANSFORM_PARTS[part];
    tracks.push({ channel: c, keys: channelKeys(keys, c), additive: i > 0 });
  });
  return tracks;
}

/** Which transform parts an element needs, over all its keyframes (empty if it never moves). */
function transformPartsFor(allKeys: Key[]): (keyof typeof TRANSFORM_PARTS)[] {
  const parts = Object.keys(TRANSFORM_PARTS) as (keyof typeof TRANSFORM_PARTS)[];
  const anyVaries = parts.some((p) => new Set(allKeys.map(TRANSFORM_PARTS[p].read)).size > 1);
  if (!anyVaries) return [];
  return parts.filter((p) => {
    const t = (k: Key) => k.es.transform;
    if (p === 'translate')
      return allKeys.some((k) => t(k).translateX !== 0 || t(k).translateY !== 0);
    if (p === 'rotate') return allKeys.some((k) => t(k).rotate !== 0);
    return allKeys.some((k) => t(k).scale !== 1);
  });
}

// --- Markup ---------------------------------------------------------------------------

const WIDTH = 100;

function animateMarkup(
  track: Track,
  timing: { begin: string; duration: number; repeat: boolean },
  indent: string,
): string[] {
  const { channel, keys } = track;
  const tag = channel.transform ? 'animateTransform' : 'animate';
  const attrs: [string, string][] = [['attributeName', channel.name]];
  if (channel.transform) attrs.push(['type', channel.transform]);
  if (track.additive) attrs.push(['additive', 'sum']);
  attrs.push(['begin', timing.begin], ['dur', `${f(Math.max(timing.duration, 1))}ms`]);
  if (timing.repeat) attrs.push(['repeatCount', 'indefinite']);
  attrs.push(['fill', 'freeze']);

  const lines = [`${indent}<${tag}`];
  for (const [k, v] of attrs) lines.push(`${indent}  ${k}="${v}"`);
  if (keys.length === 1) {
    // A part of the transform that doesn't change in this element: a constant.
    lines.push(`${indent}  values="${keys[0]!.v}"`);
  } else {
    const duration = Math.max(timing.duration, 1);
    const times = keys.map((k) => formatNumber(Math.min(1, k.t / duration), 4));
    times[0] = '0';
    times[times.length - 1] = '1';
    const curves = keys.slice(1).map((k) => (k.spline ?? [0, 0, 1, 1]).map((n) => f(n)).join(' '));
    const curved = keys.some((k) => k.spline && k.spline.join() !== '0,0,1,1');
    const list = (name: string, items: string[]) => {
      const one = `${indent}  ${name}="${items.join('; ')}"`;
      if (one.length <= WIDTH) return [one];
      return [
        `${indent}  ${name}="`,
        ...items.map((item, i) => `${indent}    ${item}${i < items.length - 1 ? ';' : ''}`),
        `${indent}  "`,
      ];
    };
    if (curved) lines.push(`${indent}  calcMode="spline"`);
    lines.push(...list('keyTimes', times));
    if (curved) lines.push(...list('keySplines', curves));
    lines.push(
      ...list(
        'values',
        keys.map((k) => k.v),
      ),
    );
  }
  lines.push(`${indent}/>`);
  return lines;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface SvgExportOptions {
  /** width and height, in pixels. Default 24. Omit-able in CSS: the viewBox scales. */
  size?: number;
}

interface Timer {
  play: string;
  reverse: string | null;
}

/** One group of paths: the motion one, the reduced-motion one, or a still one. */
function groupMarkup(
  a: Animation,
  className: string,
  passes: { play: Pass; reverse: Pass | null } | null,
  timer: Timer,
): string[] {
  const radius = Math.max(a.viewBox[2], a.viewBox[3]) / 2;
  const stateA = a.states[0]!.elements;
  const lines = [`  <g class="${className}">`];
  for (const el of a.elements) {
    lines.push(...pathMarkup(a, el, stateA[el.id]!, passes, timer, radius));
  }
  lines.push('  </g>');
  return lines;
}

function pathMarkup(
  a: Animation,
  el: PreparedElement,
  stateA: ElementState,
  passes: { play: Pass; reverse: Pass | null } | null,
  timer: Timer,
  radius: number,
): string[] {
  const label = commentText(el.name ? `${el.id} (${el.name})` : el.id);
  const attrs = pathAttributes(el, stateA);
  const head = [`    <!-- ${label} -->`, '    <path'];
  if (!passes) {
    return [...head, ...attrs.map(([k, v]) => `      ${k}="${escapeXml(v)}"`), '    />'];
  }
  const play = elementKeys(el.id, passes.play, radius);
  const reverse = passes.reverse ? elementKeys(el.id, passes.reverse, radius) : [];
  const all = [...play, ...reverse];
  const partial = all.some((k) => clamp01(k.es.draw.start) > 0 || clamp01(k.es.draw.end) < 1);
  // pathLength makes dash lengths fractions of the path; it only matters when drawing.
  if (partial && !attrs.some(([k]) => k === 'pathLength')) attrs.push(['pathLength', '1']);
  const parts = transformPartsFor(all);
  const tracks = (keys: Key[]) => (keys.length ? elementTracks(keys, partial, parts) : []);
  const playTracks = tracks(play);
  const reverseTracks = tracks(reverse);

  const lines = [...head, ...attrs.map(([k, v]) => `      ${k}="${escapeXml(v)}"`)];
  if (!playTracks.length && !reverseTracks.length) return [...lines, '    />'];
  lines.push('    >');
  const timingOf = (pass: Pass, id: string) => ({
    begin: `${id}.begin`,
    duration: pass.duration,
    repeat: pass.repeat,
  });
  for (const t of playTracks)
    lines.push(...animateMarkup(t, timingOf(passes.play, timer.play), '      '));
  if (reverseTracks.length && passes.reverse && timer.reverse) {
    lines.push('      <!-- Back to the first state. -->');
    for (const t of reverseTracks) {
      lines.push(...animateMarkup(t, timingOf(passes.reverse, timer.reverse), '      '));
    }
  }
  lines.push('    </path>');
  return lines;
}

/** Whether any value changes along the sequence. */
function hasMotion(a: Animation): boolean {
  if (!a.sequence.steps.length) return false;
  const first = JSON.stringify(a.states[0]!.elements);
  const path = [a.sequence.steps[0]!.from, ...a.sequence.steps.map((s) => s.to)];
  return path.some((id) => JSON.stringify(a.states.find((s) => s.id === id)!.elements) !== first);
}

const TRIGGER_TEXT: Record<TriggerType, string> = {
  loop: 'It loops from the moment the file loads.',
  appear: 'It plays once when the file loads.',
  click:
    'It plays on click when the SVG is inline in a page. As an <img> it shows its first state.',
  hover:
    'It plays on hover and back when the pointer leaves, when the SVG is inline in a page. ' +
    'As an <img> it shows its first state.',
  toggle:
    'Each click moves it to its other state, when the SVG is inline in a page. ' +
    'As an <img> it shows its first state.',
  manual:
    'It plays when your code calls beginElement() on the play or reverse timer at the end ' +
    'of the file. As an <img> it shows its first state.',
};

/**
 * A standalone SVG that plays with SMIL, no JavaScript. Works inline and as <img src>
 * (loop and appear); hover, click, toggle and manual need it inline.
 */
export function exportSvg(
  animation: Animation,
  tokens: MotionTokens,
  options: SvgExportOptions = {},
): ExportFile {
  const a = resolveTokens(animation, tokens);
  const base = exportFileBase(animation);
  const prefix = /^[a-z]/.test(base) ? base : `icon-${base}`;
  // Ids are camelCase: in begin="id.event" Chrome reads the first "-" as a time offset,
  // so "copy-check-play.begin" would never fire.
  const ids = dataVariableName(animation).replace(/Animation$/, '');
  const name = commentText(animation.name) || 'Icon';
  const size = options.size ?? 24;
  const trigger = a.trigger.type;
  const viewBox = a.viewBox.map((n) => f(n)).join(' ');
  const moving = hasMotion(a);
  const rm = a.reducedMotion.mode;
  const backwards = trigger === 'hover' || trigger === 'toggle' || trigger === 'manual';

  const header = [
    `  <!--`,
    `    ${name}, an animated icon made with IconTween (https://icontween.com).`,
    `    SVG with SMIL animation: no JavaScript needed.`,
  ];
  if (moving) {
    header.push(`    ${TRIGGER_TEXT[trigger]}`, `    ${reducedMotionSummary(animation)}`);
  } else {
    header.push('    It has no motion yet, so this is a still icon.');
  }
  header.push('  -->');

  const lines = [
    `<svg`,
    `  xmlns="http://www.w3.org/2000/svg"`,
    `  viewBox="${viewBox}"`,
    `  width="${size}"`,
    `  height="${size}"`,
    `>`,
    ...header,
  ];

  if (!moving) {
    lines.push(
      ...groupMarkup(a, `${prefix}-still`, null, { play: '', reverse: null }),
      '</svg>',
      '',
    );
    return { fileName: `${base}.svg`, type: 'image/svg+xml', text: lines.join('\n') };
  }

  const timer: Timer = {
    play: `${ids}Play`,
    reverse: backwards ? `${ids}Reverse` : null,
  };
  const motionPasses = {
    play: playPass(a, 'motion'),
    reverse: backwards ? reversePass(a, 'motion') : null,
  };
  const reducedMode: Mode = rm === 'fade' ? 'fade' : 'instant';
  const reducedPasses =
    rm === 'none'
      ? null
      : { play: playPass(a, reducedMode), reverse: backwards ? reversePass(a, reducedMode) : null };
  const motionClass = `${prefix}-motion`;
  const reducedClass = rm === 'none' ? `${prefix}-still` : `${prefix}-reduced`;

  lines.push(
    '  <style>',
    `    /* Reduced motion: when the OS asks for less motion, the second group shows instead. */`,
    `    .${reducedClass} {`,
    '      display: none;',
    '    }',
    '    @media (prefers-reduced-motion: reduce) {',
    `      .${motionClass} {`,
    '        display: none;',
    '      }',
    `      .${reducedClass} {`,
    '        display: inline;',
    '      }',
    '    }',
    '  </style>',
    '',
    ...groupMarkup(a, motionClass, motionPasses, timer),
    '',
    rm === 'none'
      ? '  <!-- With reduced motion: the first state, still. -->'
      : rm === 'fade'
        ? '  <!-- With reduced motion: short fades between the states, played once. -->'
        : '  <!-- With reduced motion: jumps to each state without moving, played once. -->',
    ...groupMarkup(a, reducedClass, reducedPasses, timer),
    '',
  );

  // Hit areas: the whole icon counts, not only its strokes.
  const [x, y, w, h] = a.viewBox.map((n) => f(n));
  const hit = (id: string, extra = '') =>
    `  <rect id="${id}" x="${x}" y="${y}" width="${w}" height="${h}" fill="none" pointer-events="all" cursor="pointer"${extra}`;
  const playPassInfo = motionPasses.play;
  let playBegin = '0s';
  let reverseBegin = '';
  let restart = 'whenNotActive';
  if (trigger === 'click') {
    lines.push('  <!-- Where a click counts: the whole icon, not only its strokes. -->');
    lines.push(`${hit(`${ids}Hit`)} />`);
    playBegin = `${ids}Hit.click`;
  } else if (trigger === 'hover') {
    lines.push('  <!-- Where hover counts: the whole icon, not only its strokes. -->');
    lines.push(`${hit(`${ids}Hit`)} />`);
    playBegin = `${ids}Hit.mouseover`;
    reverseBegin = `${ids}Hit.mouseout`;
    restart = 'always';
  } else if (trigger === 'toggle') {
    // Two hit areas take turns: one plays forwards, the other back. They swap when a run
    // ends (or starts, for a sequence that repeats and never ends).
    const swap = playPassInfo.repeat ? `${timer.play}.begin` : `${timer.play}.end`;
    lines.push(
      '  <!-- Where a click counts: one area plays forwards, the other back. They take turns. -->',
      `${hit(`${ids}HitPlay`)}>`,
      `    <set attributeName="display" to="none" begin="${swap}" fill="freeze" />`,
      `    <set attributeName="display" to="inline" begin="${timer.reverse}.end" fill="freeze" />`,
      '  </rect>',
      `${hit(`${ids}HitReverse`, ' display="none"')}>`,
      `    <set attributeName="display" to="inline" begin="${swap}" fill="freeze" />`,
      `    <set attributeName="display" to="none" begin="${timer.reverse}.end" fill="freeze" />`,
      '  </rect>',
    );
    playBegin = `${ids}HitPlay.click`;
    reverseBegin = `${ids}HitReverse.click`;
  } else if (trigger === 'manual') {
    playBegin = 'indefinite';
    reverseBegin = 'indefinite';
    restart = 'always';
  }

  const timerLines = (id: string, begin: string, pass: Pass) => [
    '    <animate',
    `      id="${id}"`,
    '      attributeName="x"',
    '      values="0; 0"',
    `      begin="${begin}"`,
    `      dur="${f(Math.max(pass.duration, 1))}ms"`,
    ...(pass.repeat ? ['      repeatCount="indefinite"'] : []),
    `      restart="${restart}"`,
    '      fill="freeze"',
    '    />',
  ];
  lines.push(
    '',
    trigger === 'manual'
      ? `  <!-- Timers: every animation above starts with one of these. From code:\n       svg.getElementById('${timer.play}').beginElement() plays it, '${timer.reverse}' plays it back. -->`
      : '  <!-- Timers: every animation above starts with one of these. -->',
    '  <rect width="0" height="0" fill="none">',
    ...timerLines(timer.play, playBegin, playPassInfo),
    ...(timer.reverse && motionPasses.reverse
      ? timerLines(timer.reverse, reverseBegin, motionPasses.reverse)
      : []),
    '  </rect>',
    '</svg>',
    '',
  );

  return { fileName: `${base}.svg`, type: 'image/svg+xml', text: lines.join('\n') };
}

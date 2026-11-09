/**
 * The player: plays an Animation's sequence on an <svg>, forwards and backwards,
 * interruptible at any moment. See docs/decisions/005-runtime-v0.md.
 */
import type { Animation, TriggerType } from '@icontween/core';
import { clamp01, resolveMotion, type EasingFunction } from './easing';
import {
  assertSameStructure,
  cloneValues,
  mixElementStateInto,
  type StateValues,
} from './interpolate';
import { bindPaths, renderPath } from './render';
import { DEFAULT_TOKENS, resolveDuration, type MotionTokens } from './tokens';

export type ReducedMotionPreference = 'auto' | 'reduce' | 'no-preference';

/** Time source. Injectable so tests (and the editor's scrubber, later) control time. */
export interface Clock {
  now(): number;
  frame(callback: () => void): number;
  cancel(id: number): void;
}

export interface PlayerOptions {
  /** Motion tokens used to resolve `{ token }` durations and easings. */
  tokens?: MotionTokens;
  /** Overrides the animation's trigger. 'none' binds no events (the caller drives playback). */
  trigger?: TriggerType | 'none';
  /** Element that listens for trigger events, e.g. the button around the icon. Default: svg. */
  listenOn?: Element;
  /** 'auto' follows the OS setting (prefers-reduced-motion). The editor can force either. */
  reducedMotion?: ReducedMotionPreference;
  clock?: Clock;
  /** Called when playback comes to rest on a state. */
  onFinish?: (stateId: string) => void;
}

export interface Player {
  /**
   * Runs the sequence forwards from the current values. At the end, starts over. Repeats
   * (loop, ping-pong) until reverse() or stop(), except with reduced motion.
   */
  play(): void;
  /** Runs the sequence backwards to its first state from the current values. */
  reverse(): void;
  /** Reverses while playing or at rest past the start; plays otherwise. */
  toggle(): void;
  /** Freezes at the current values. */
  stop(): void;
  /** Jumps to a state without animating. */
  setState(stateId: string): void;
  setReducedMotion(preference: ReducedMotionPreference): void;
  readonly playing: boolean;
  /** Live current values. Read only. */
  readonly values: StateValues;
  /** Removes event listeners and stops. Leaves the svg as it is. */
  destroy(): void;
}

type Direction = 1 | -1;
type LegMode = 'motion' | 'instant' | 'fade';

/** One movement from the current values to one state. */
interface Leg {
  target: StateValues;
  /** Step index in the sequence. */
  step: number;
  /** Scaled milliseconds (scaled down when the leg resumes part-way). */
  duration: number;
  delays: Record<string, number>;
  total: number;
  ease: EasingFunction;
  mode: LegMode;
}

interface Run {
  legs: Leg[];
  index: number;
  dir: Direction;
  /** Starts another cycle at the end (loop, ping-pong). */
  repeat: boolean;
  /** Loop only: values to jump to when the rest between cycles ends. */
  jump: StateValues | null;
  /** Start time of the current leg. */
  start: number;
  /** Values when the current leg began. */
  from: StateValues;
}

/** Longest reduced-motion fade per leg, in ms. */
const FADE_MAX = 200;

const defaultClock: Clock = {
  now: () => performance.now(),
  frame: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export function createPlayer(
  svg: SVGSVGElement,
  animation: Animation,
  options: PlayerOptions = {},
): Player {
  const tokens = options.tokens ?? DEFAULT_TOKENS;
  const clock = options.clock ?? defaultClock;
  const { elements, states, sequence } = animation;
  const steps = sequence.steps;
  // The loop trigger implies repetition, even if the sequence says 'once'.
  const repeatMode =
    sequence.repeat === 'once' && animation.trigger.type === 'loop' ? 'loop' : sequence.repeat;
  const rest = Math.max(0, sequence.restBetweenLoops ?? 0);

  const stateA = states[0];
  if (!stateA) throw new Error('IconTween: animation has no states');
  const byId = new Map(states.map((s) => [s.id, s]));
  for (const state of states) {
    for (const { id } of elements) {
      const es = state.elements[id];
      const a = stateA.elements[id];
      if (!es || !a) throw new Error(`IconTween: state ${state.id} is missing element ${id}`);
      assertSameStructure(a.segments, es.segments, `state ${state.id}, element ${id}`);
    }
  }
  const valuesOf = (stateId: string): StateValues => {
    const state = byId.get(stateId);
    if (!state) throw new Error(`IconTween: unknown state "${stateId}"`);
    return state.elements;
  };

  /** State ids along the sequence: [steps[0].from, steps[0].to, steps[1].to, …]. */
  const path = steps.length ? [steps[0]!.from, ...steps.map((s) => s.to)] : [stateA.id];
  const paths = bindPaths(svg, animation.viewBox, elements);
  const current = cloneValues(stateA.elements);
  /** Where we are along the sequence, in steps (0..steps.length). Fractional when stopped mid-step. */
  let position = Math.max(0, path.indexOf(stateA.id));
  let run: Run | null = null;
  let frameId: number | null = null;
  let fade = 1;
  let reducedPreference = options.reducedMotion ?? 'auto';

  const render = () => {
    elements.forEach(({ id }, i) => renderPath(paths[i]!, current[id]!, fade));
  };

  /** Sets the current values to a state's, in place (a blend at t = 0 is a plain copy). */
  const copyInto = (values: StateValues) => {
    for (const { id } of elements) {
      mixElementStateInto(current[id]!, values[id]!, values[id]!, 0);
    }
  };

  const reduced = () =>
    reducedPreference === 'reduce' ||
    (reducedPreference === 'auto' &&
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** Position right now, including progress through a running leg. */
  const positionNow = () => {
    if (!run) return position;
    const elapsed = clock.now() - run.start;
    // Resting at the end of a loop, before jumping back to the start.
    if (run.jump && elapsed < 0) return steps.length;
    const leg = run.legs[run.index]!;
    const p = leg.total > 0 ? clamp01(elapsed / leg.total) : 1;
    return run.dir === 1 ? leg.step + p : leg.step + 1 - p;
  };

  const buildLeg = (step: number, dir: Direction, scale: number, mode: LegMode): Leg => {
    const t = steps[step]!;
    const motion = resolveMotion(t.easing, resolveDuration(t.duration, tokens), tokens);
    // A spring settles in its own time however far it has to go, so a resumed spring leg
    // keeps its full length instead of being squeezed.
    let duration = motion.duration * (motion.spring && mode === 'motion' ? 1 : scale);
    const delays: Record<string, number> = {};
    if (mode === 'motion') {
      const base = elements.map(({ id }, i) => (t.delays?.[id] ?? 0) + (t.stagger ?? 0) * i);
      const max = Math.max(0, ...base);
      // Mirrored on the way back: the last element to leave is the first to return.
      elements.forEach(({ id }, i) => {
        delays[id] = (dir === 1 ? base[i]! : max - base[i]!) * scale;
      });
    } else if (mode === 'fade') {
      duration = Math.min(duration, FADE_MAX);
    }
    const maxDelay = Math.max(0, ...Object.values(delays));
    return {
      target: valuesOf(dir === 1 ? t.to : t.from),
      step,
      duration,
      delays,
      total: duration + maxDelay,
      ease: mode === 'motion' ? motion.ease : () => 1,
      mode,
    };
  };

  const schedule = () => {
    if (frameId === null && run) {
      frameId = clock.frame(() => {
        frameId = null;
        tick();
      });
    }
  };

  /** All steps of the sequence as legs, in one direction. */
  const cycle = (dir: Direction): Leg[] =>
    steps.map((_, i) => buildLeg(dir === 1 ? i : steps.length - 1 - i, dir, 1, 'motion'));

  /**
   * At the end of a repeating run: sets up the next cycle after the rest. Returns false
   * when there is nothing to repeat (a cycle of zero length would spin forever).
   */
  const repeatRun = (r: Run): boolean => {
    if (reduced()) return false; // The OS setting changed while looping.
    const dir: Direction = repeatMode === 'ping-pong' ? (-r.dir as Direction) : 1;
    const legs = cycle(dir);
    const length = rest + legs.reduce((sum, leg) => sum + leg.total, 0);
    if (length <= 0) return false;
    r.legs = legs;
    r.index = 0;
    r.dir = dir;
    r.jump = repeatMode === 'loop' ? valuesOf(path[0]!) : null;
    r.start += rest;
    // Far behind (a hidden tab, a long pause): skip the missed cycles instead of replaying.
    const now = clock.now();
    if (now - r.start > length) r.start = now;
    r.from = cloneValues(current);
    return true;
  };

  const tick = () => {
    while (run) {
      const elapsed = clock.now() - run.start;
      if (elapsed < 0) {
        // Resting between cycles: hold the end of the last one.
        render();
        schedule();
        return;
      }
      if (run.jump) {
        copyInto(run.jump);
        run.jump = null;
        run.from = cloneValues(current);
        position = 0;
      }
      const leg = run.legs[run.index]!;
      if (elapsed >= leg.total) {
        // Leg done: land exactly on its state and carry the leftover time into the next.
        copyInto(leg.target);
        fade = 1;
        position = run.dir === 1 ? leg.step + 1 : leg.step;
        run.start += leg.total;
        run.index++;
        if (run.index < run.legs.length) {
          run.from = cloneValues(current);
          continue;
        }
        if (run.repeat && repeatRun(run)) continue;
        run = null;
        render();
        options.onFinish?.(path[position] ?? stateA.id);
        return;
      }
      for (const { id } of elements) {
        const local =
          leg.duration > 0 ? clamp01((elapsed - (leg.delays[id] ?? 0)) / leg.duration) : 1;
        const from = run.from[id]!;
        const to = leg.target[id]!;
        if (leg.mode === 'fade') {
          mixElementStateInto(current[id]!, from, to, local < 0.5 ? 0 : 1);
          fade = Math.abs(1 - 2 * local);
        } else {
          mixElementStateInto(current[id]!, from, to, leg.ease(local));
        }
      }
      render();
      schedule();
      return;
    }
  };

  const go = (dir: Direction) => {
    if (!steps.length) return;
    const isReduced = reduced();
    const rm = animation.reducedMotion.mode;
    if (isReduced && rm === 'none') return;
    // Repetition only goes forwards, and never with reduced motion (no endless motion).
    const repeat = dir === 1 && repeatMode !== 'once' && !isReduced;
    // Already heading there; keep the curve going.
    if (run && run.dir === dir && run.repeat === repeat) return;

    let x = positionNow();
    if (dir === 1 && x >= steps.length) {
      // At the end: start over from the first state.
      copyInto(valuesOf(path[0]!));
      x = 0;
    }
    const mode: LegMode = !isReduced ? 'motion' : rm === 'fade' ? 'fade' : 'instant';
    const i = Math.floor(x);
    const f = x - i;
    const legs: Leg[] = [];
    if (dir === 1) {
      // A part-done step resumes with the share of time it has left.
      if (f > 0) legs.push(buildLeg(i, 1, 1 - f, mode));
      for (let s = f > 0 ? i + 1 : i; s < steps.length; s++) legs.push(buildLeg(s, 1, 1, mode));
    } else {
      if (f > 0) legs.push(buildLeg(i, -1, f, mode));
      for (let s = i - 1; s >= 0; s--) legs.push(buildLeg(s, -1, 1, mode));
    }
    position = x;
    fade = 1;
    run = legs.length
      ? { legs, index: 0, dir, repeat, jump: null, start: clock.now(), from: cloneValues(current) }
      : null;
    tick();
  };

  const stop = () => {
    position = positionNow();
    run = null;
    fade = 1;
    if (frameId !== null) clock.cancel(frameId);
    frameId = null;
    render();
  };

  const player: Player = {
    play: () => go(1),
    reverse: () => go(-1),
    toggle: () => go(run ? (-run.dir as Direction) : positionNow() > 0 ? -1 : 1),
    stop,
    setState(stateId) {
      const values = valuesOf(stateId);
      stop();
      copyInto(values);
      position = Math.max(0, path.indexOf(stateId));
      render();
    },
    setReducedMotion(preference) {
      reducedPreference = preference;
    },
    get playing() {
      return run !== null;
    },
    get values() {
      return current;
    },
    destroy() {
      stop();
      unbind();
    },
  };

  const unbind = bindTrigger(
    options.listenOn ?? svg,
    options.trigger ?? animation.trigger.type,
    player,
  );
  render();
  return player;
}

/** Wires a trigger's DOM events to the player. Returns a function that removes them. */
function bindTrigger(target: Element, trigger: TriggerType | 'none', player: Player): () => void {
  const listeners: [string, () => void][] = [];
  if (trigger === 'hover') {
    // Hover and keyboard focus both count, so the moment isn't mouse-only.
    let hovered = false;
    let focused = false;
    const update = (h: boolean, f: boolean) => {
      const was = hovered || focused;
      hovered = h;
      focused = f;
      const is = hovered || focused;
      if (is !== was) {
        if (is) player.play();
        else player.reverse();
      }
    };
    listeners.push(
      ['pointerenter', () => update(true, focused)],
      ['pointerleave', () => update(false, focused)],
      ['focusin', () => update(hovered, true)],
      ['focusout', () => update(hovered, false)],
    );
  } else if (trigger === 'click') {
    listeners.push(['click', () => player.play()]);
  } else if (trigger === 'toggle') {
    listeners.push(['click', () => player.toggle()]);
  } else if (trigger === 'loop' || trigger === 'appear') {
    return watchVisibility(target, trigger, player);
  }
  // 'manual' and 'none' bind nothing.
  for (const [type, fn] of listeners) target.addEventListener(type, fn);
  return () => {
    for (const [type, fn] of listeners) target.removeEventListener(type, fn);
  };
}

/** Share of the target that must be on screen to count as visible. */
const VISIBLE = 0.5;

/**
 * appear: plays once, the first time the target is on screen.
 * loop: plays while the target is on screen and pauses when it isn't, so off-screen icons
 * cost nothing. Without IntersectionObserver both simply start at once.
 */
function watchVisibility(target: Element, trigger: 'loop' | 'appear', player: Player) {
  if (typeof IntersectionObserver !== 'function') {
    player.play();
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries[entries.length - 1]?.isIntersecting ?? false;
      if (visible) player.play();
      else if (trigger === 'loop') player.stop();
      if (visible && trigger === 'appear') observer.disconnect();
    },
    { threshold: VISIBLE },
  );
  observer.observe(target);
  return () => observer.disconnect();
}

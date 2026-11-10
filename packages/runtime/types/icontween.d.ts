/**
 * Types for icontween.js, the IconTween runtime (MIT License · https://icontween.vedjuk.com).
 *
 * Shipped next to exported React components so TypeScript apps can import the runtime.
 * Kept in step with the runtime's source by a type test (packages/runtime/test/public-types.ts).
 */

export declare const RUNTIME_VERSION: string;

// --- Animation data -------------------------------------------------------------------

/** Path segment: absolute coordinates in the viewBox, only M/L/C/Z. */
export type Segment =
  | { cmd: 'M'; x: number; y: number }
  | { cmd: 'L'; x: number; y: number }
  | { cmd: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { cmd: 'Z' };

export interface ElementStyle {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'butt' | 'round' | 'square';
  strokeLinejoin: 'miter' | 'round' | 'bevel';
  fill: string;
}

export interface PreparedElement {
  id: string;
  name?: string;
  style: ElementStyle;
}

/** One element's values in one state. Every state has the same segment structure. */
export interface ElementState {
  segments: Segment[];
  transform: {
    translateX: number;
    translateY: number;
    /** Degrees. */
    rotate: number;
    scale: number;
    /** Pivot for rotate and scale, in viewBox coordinates. */
    originX: number;
    originY: number;
  };
  /** 0..1 */
  opacity: number;
  /** Fraction of the path drawn, 0..1. */
  draw: { start: number; end: number };
}

export interface State {
  id: string;
  label?: string;
  elements: Record<string, ElementState>;
}

export type Easing =
  | { type: 'token'; name: string }
  | { type: 'cubic-bezier'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'spring'; stiffness: number; damping: number; mass: number };

export interface Transition {
  from: string;
  to: string;
  /** Milliseconds, or a duration token. Springs settle in their own time. */
  duration: number | { token: string };
  easing: Easing;
  /** Millisecond offset per element id. */
  delays?: Record<string, number>;
  /** Milliseconds between elements, in element order. */
  stagger?: number;
}

export type TriggerType = 'hover' | 'click' | 'toggle' | 'loop' | 'appear' | 'manual';

export interface Animation {
  id: string;
  name: string;
  purpose: 'feedback' | 'state-change' | 'attention' | 'discoverability' | 'delight';
  viewBox: [minX: number, minY: number, width: number, height: number];
  elements: PreparedElement[];
  /** states[0] is state A, the resting state. */
  states: State[];
  sequence: {
    steps: Transition[];
    repeat: 'once' | 'loop' | 'ping-pong';
    /** Millisecond pause between loops. */
    restBetweenLoops?: number;
  };
  trigger: { type: TriggerType };
  /** What happens when the OS asks for reduced motion. 'none' stays on state A. */
  reducedMotion: { mode: 'instant' | 'fade' | 'none' };
}

/** Named durations and easings that `{ token }` values refer to. */
export interface MotionTokens {
  durations: Record<string, number>;
  easings: Record<string, Easing>;
}

export declare const DEFAULT_TOKENS: MotionTokens;

// --- Playing --------------------------------------------------------------------------

export type ReducedMotionPreference = 'auto' | 'reduce' | 'no-preference';

/** Time source. Injectable for tests. */
export interface Clock {
  now(): number;
  frame(callback: () => void): number;
  cancel(id: number): void;
}

export interface PlayerOptions {
  /** Motion tokens used to resolve `{ token }` durations and easings. */
  tokens?: MotionTokens;
  /** Overrides the animation's trigger. 'none' binds no events (you drive playback). */
  trigger?: TriggerType | 'none';
  /** Element that listens for trigger events, e.g. the button around the icon. Default: svg. */
  listenOn?: Element;
  /** 'auto' (default) follows the OS setting, prefers-reduced-motion. */
  reducedMotion?: ReducedMotionPreference;
  clock?: Clock;
  /** Called when playback comes to rest on a state. */
  onFinish?: (stateId: string) => void;
}

export interface Player {
  /** Runs the sequence forwards from wherever the icon is. At the end, starts over. */
  play(): void;
  /** Runs the sequence backwards to its first state. */
  reverse(): void;
  /** Reverses while playing or when past the start; plays otherwise. */
  toggle(): void;
  /** Freezes at the current values. */
  stop(): void;
  /** Jumps to a state without animating. */
  setState(stateId: string): void;
  setReducedMotion(preference: ReducedMotionPreference): void;
  readonly playing: boolean;
  /** Live current values, by element id. Read only. */
  readonly values: Record<string, ElementState>;
  /** Removes event listeners and stops. Leaves the svg as it is. */
  destroy(): void;
}

/**
 * Plays an animation on an inline <svg>. Paths are found by
 * `data-icontween-element="<element id>"`; missing ones are created.
 */
export declare function createPlayer(
  svg: SVGSVGElement,
  animation: Animation,
  options?: PlayerOptions,
): Player;

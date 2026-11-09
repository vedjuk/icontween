/**
 * IconTween data model.
 *
 * Every feature (editor, preview, export, share links) reads and writes these types.
 * Changing the saved shape means bumping SCHEMA_VERSION and adding a migration.
 */

/** Versioned so saved projects and share links can be migrated later. */
export const SCHEMA_VERSION = 1;

export const PURPOSES = [
  'feedback',
  'state-change',
  'attention',
  'discoverability',
  'delight',
] as const;
export type Purpose = (typeof PURPOSES)[number];

export const TRIGGER_TYPES = ['hover', 'click', 'toggle', 'loop', 'appear', 'manual'] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** Canonical path segment: absolute coordinates, only M/L/C/Z. */
export type Segment =
  | { cmd: 'M'; x: number; y: number }
  | { cmd: 'L'; x: number; y: number }
  | { cmd: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { cmd: 'Z' };

export type SegmentCommand = Segment['cmd'];

/** Static presentation, shared across states in v1. */
export interface ElementStyle {
  /** Usually 'currentColor'. */
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'butt' | 'round' | 'square';
  strokeLinejoin: 'miter' | 'round' | 'bevel';
  /** Usually 'none' for stroke icons. */
  fill: string;
}

export interface PreparedElement {
  /** Stable id, e.g. 'el-1'. */
  id: string;
  /** Optional human label, e.g. 'clapper'. */
  name?: string;
  style: ElementStyle;
}

export interface ElementTransform {
  translateX: number;
  translateY: number;
  /** Degrees. */
  rotate: number;
  /** Uniform in v1. */
  scale: number;
  /** Pivot, in viewBox coordinates. */
  originX: number;
  originY: number;
}

/** Animatable values for one element in one state. Segment structure must match state A exactly. */
export interface ElementState {
  segments: Segment[];
  transform: ElementTransform;
  /** 0..1 */
  opacity: number;
  /** 0..1 fraction of the path drawn (pathLength). */
  draw: { start: number; end: number };
}

export interface State {
  /** 'A', 'B', 'C'… */
  id: string;
  /** e.g. 'Checked' */
  label?: string;
  /** Keyed by element id. */
  elements: Record<string, ElementState>;
}

export type Easing =
  | { type: 'token'; name: string }
  | { type: 'cubic-bezier'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'spring'; stiffness: number; damping: number; mass: number };

export interface Transition {
  /** State id. */
  from: string;
  /** State id. */
  to: string;
  /** Milliseconds, or a duration token. Ignored for springs, which settle on their own. */
  duration: number | { token: string };
  easing: Easing;
  /** Millisecond offset per element id. */
  delays?: Record<string, number>;
  /** Milliseconds between elements, applied in element order. */
  stagger?: number;
}

export interface Sequence {
  /** e.g. A→B, B→A */
  steps: Transition[];
  repeat: 'once' | 'loop' | 'ping-pong';
  /** Millisecond pause between loops. */
  restBetweenLoops?: number;
}

export interface Trigger {
  /**
   * toggle: two stable states, each activation moves to the other.
   * hover: forward sequence on enter, reverse (or a defined return) on leave.
   */
  type: TriggerType;
}

export const REDUCED_MOTION_MODES = ['instant', 'fade', 'none'] as const;

export interface ReducedMotion {
  /** 'none' = stay on state A. */
  mode: (typeof REDUCED_MOTION_MODES)[number];
}

export type ViewBox = [minX: number, minY: number, width: number, height: number];

export interface Animation {
  id: string;
  /** e.g. 'Copy → Check' */
  name: string;
  purpose: Purpose;
  /** Usually [0, 0, 24, 24]. */
  viewBox: ViewBox;
  elements: PreparedElement[];
  /** states[0] is always A. */
  states: State[];
  sequence: Sequence;
  trigger: Trigger;
  reducedMotion: ReducedMotion;
}

export interface LibraryIcon {
  id: string;
  fileName: string;
  /** Raw source SVG, as imported. Never modified. */
  svg: string;
}

export interface Project {
  schemaVersion: number;
  name: string;
  motionTokens: {
    /** e.g. { fast: 150, base: 250, slow: 400 } */
    durations: Record<string, number>;
    /** e.g. { standard: …, snappy: …, 'spring-gentle': … } */
    easings: Record<string, Easing>;
  };
  library: LibraryIcon[];
  animations: Animation[];
}

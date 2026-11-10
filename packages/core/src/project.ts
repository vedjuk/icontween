/**
 * Project files (`.icontween.json`) and anything else read back from storage.
 *
 * Saved data is untrusted: it may come from another person, an older version of the app,
 * or a hand edit. Reading rebuilds every object from the fields the schema knows (unknown
 * fields are dropped), checks types, rejects style values that could load something remote,
 * and then runs `validateAnimation()` on every animation, so nothing reaches the editor or
 * the runtime that an edit couldn't have produced.
 */
import { DANGEROUS_VALUE } from './prepare';
import {
  PURPOSES,
  REDUCED_MOTION_MODES,
  SCHEMA_VERSION,
  TRIGGER_TYPES,
  type Animation,
  type Easing,
  type ElementState,
  type ElementStyle,
  type LibraryIcon,
  type PreparedElement,
  type Project,
  type Segment,
  type Sequence,
  type State,
  type Transition,
} from './schema';
import type { MotionTokens } from './tokens';
import { validateAnimation } from './validate';

export const PROJECT_FILE_EXTENSION = '.icontween.json';

export type ReadResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Formatted JSON (rule 7: exports are readable), with a trailing newline. */
export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

/** Reads a project file's text. Errors are written for the person who picked the file. */
export function parseProject(text: string): ReadResult<Project> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON, so it can't be an IconTween project." };
  }
  return readProject(raw);
}

/** Reads a project already parsed from JSON (a file, or IndexedDB). */
export function readProject(raw: unknown): ReadResult<Project> {
  if (!isRecord(raw) || !('schemaVersion' in raw) || !('animations' in raw)) {
    return { ok: false, error: "This file isn't an IconTween project." };
  }
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: "This file isn't an IconTween project (no valid schemaVersion)." };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This project was saved by a newer version of IconTween (schema ${version}). Reload the app to get the latest version.`,
    };
  }

  try {
    const migrated = migrate(raw, version);
    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      name: str(migrated.name, 'name'),
      motionTokens: readTokens(migrated.motionTokens, 'motionTokens'),
      library: arr(migrated.library, 'library').map((icon, i) =>
        readLibraryIcon(icon, `library[${i}]`),
      ),
      animations: arr(migrated.animations, 'animations').map((a, i) =>
        readAnimationOrThrow(a, `animations[${i}]`),
      ),
    };
    rejectDuplicates(
      project.library.map((i) => i.id),
      'library',
      'icons',
    );
    rejectDuplicates(
      project.animations.map((a) => a.id),
      'animations',
      'animations',
    );
    return { ok: true, value: project };
  } catch (e) {
    return damaged(e, 'project');
  }
}

/** Reads one animation (the animation JSON export). */
export function readAnimation(raw: unknown): ReadResult<Animation> {
  try {
    return { ok: true, value: readAnimationOrThrow(raw, 'animation') };
  } catch (e) {
    return damaged(e, 'animation');
  }
}

/**
 * What a share link carries: one animation, the values of the motion tokens it uses (so it
 * plays as it did for the person who shared it), and the source icon when it isn't one of
 * the app's built-in starters.
 */
export interface SharedAnimation {
  schemaVersion: number;
  animation: Animation;
  tokens: MotionTokens;
  icon?: { fileName: string; svg: string };
}

/** Reads a share link's decoded JSON, with the same checks as a project file. */
export function readSharedAnimation(raw: unknown): ReadResult<SharedAnimation> {
  if (!isRecord(raw) || !('schemaVersion' in raw) || !('animation' in raw)) {
    return { ok: false, error: "This link doesn't hold an IconTween animation." };
  }
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: "This link doesn't hold an IconTween animation." };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This link was made by a newer version of IconTween (schema ${version}). Reload the app to get the latest version.`,
    };
  }
  try {
    // Migrations work on projects, so the animation goes through one.
    const migrated = migrate({ schemaVersion: version, animations: [raw.animation] }, version);
    const animation = readAnimationOrThrow(arr(migrated.animations, 'animation')[0], 'animation');
    const shared: SharedAnimation = {
      schemaVersion: SCHEMA_VERSION,
      animation,
      tokens: readTokens(raw.tokens, 'tokens'),
    };
    if (raw.icon !== undefined) {
      const icon = obj(raw.icon, 'icon');
      shared.icon = {
        fileName: str(icon.fileName, 'icon.fileName'),
        svg: str(icon.svg, 'icon.svg'),
      };
    }
    return { ok: true, value: shared };
  } catch (e) {
    return damaged(e, 'link');
  }
}

/**
 * Upgrades older saved data to the current schema, one version at a time. Version 1 is
 * the only one so far; add a step here whenever SCHEMA_VERSION is bumped.
 */
function migrate(raw: Record<string, unknown>, version: number): Record<string, unknown> {
  const steps: Record<number, (p: Record<string, unknown>) => Record<string, unknown>> = {};
  let project = raw;
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const step = steps[v] ?? fail('schemaVersion', `no migration from schema ${v}`);
    project = step(project);
  }
  return project;
}

// --- Readers. Each takes the raw value and its path (for the error), and throws ReadError.

class ReadError extends Error {
  override name = 'ReadError';
  constructor(
    readonly path: string,
    readonly detail: string,
  ) {
    super(`${path}: ${detail}`);
  }
}

const fail = (path: string, message: string): never => {
  throw new ReadError(path, message);
};

/** Turns a ReadError into a result that says what was being read; rethrows anything else. */
function damaged(e: unknown, what: string): { ok: false; error: string } {
  if (e instanceof ReadError) {
    return { ok: false, error: `The ${what} is damaged at ${e.path}: ${e.detail}.` };
  }
  throw e;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function obj(v: unknown, path: string): Record<string, unknown> {
  return isRecord(v) ? v : fail(path, 'expected an object');
}

function arr(v: unknown, path: string): unknown[] {
  return Array.isArray(v) ? v : fail(path, 'expected a list');
}

function str(v: unknown, path: string): string {
  return typeof v === 'string' ? v : fail(path, 'expected text');
}

function optStr(v: unknown, path: string): string | undefined {
  return v === undefined ? undefined : str(v, path);
}

/** Finite-ness and ranges are left to validateAnimation, which reports them in detail. */
function num(v: unknown, path: string): number {
  return typeof v === 'number' ? v : fail(path, 'expected a number');
}

function oneOf<T extends string>(v: unknown, options: readonly T[], path: string): T {
  return options.includes(v as T) ? (v as T) : fail(path, `unknown value ${JSON.stringify(v)}`);
}

/** Ids end up in attributes, URLs and exported code, so they stay plain. */
const ID = /^[A-Za-z0-9_-]{1,100}$/;

function id(v: unknown, path: string): string {
  const s = str(v, path);
  return ID.test(s) ? s : fail(path, 'ids may only use letters, digits, - and _');
}

/** Paint is set as an attribute by the runtime; it may not reach the network (rule 6). */
function paint(v: unknown, path: string): string {
  const s = str(v, path);
  return DANGEROUS_VALUE.test(s) || s.length > 100 ? fail(path, 'unsupported colour') : s;
}

function record<T>(v: unknown, path: string, read: (v: unknown, path: string) => T) {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(obj(v, path))) {
    out[id(key, `${path} key`)] = read(value, `${path}.${key}`);
  }
  return out;
}

function rejectDuplicates(ids: string[], path: string, what: string) {
  const seen = new Set<string>();
  for (const i of ids) {
    if (seen.has(i)) fail(path, `two ${what} share the id "${i}"`);
    seen.add(i);
  }
}

function readLibraryIcon(v: unknown, path: string): LibraryIcon {
  const o = obj(v, path);
  // The SVG stays raw (rule 3); it is sanitized every time it is shown or prepared.
  return {
    id: id(o.id, `${path}.id`),
    fileName: str(o.fileName, `${path}.fileName`),
    svg: str(o.svg, `${path}.svg`),
  };
}

function readTokens(v: unknown, path: string): MotionTokens {
  const o = obj(v, path);
  return {
    durations: record(o.durations, `${path}.durations`, num),
    easings: record(o.easings, `${path}.easings`, readEasing),
  };
}

function readEasing(v: unknown, path: string): Easing {
  const o = obj(v, path);
  const type = oneOf(o.type, ['token', 'cubic-bezier', 'spring'] as const, `${path}.type`);
  const n = (key: string) => num(o[key], `${path}.${key}`);
  switch (type) {
    case 'token':
      return { type, name: str(o.name, `${path}.name`) };
    case 'cubic-bezier':
      return { type, x1: n('x1'), y1: n('y1'), x2: n('x2'), y2: n('y2') };
    case 'spring':
      return { type, stiffness: n('stiffness'), damping: n('damping'), mass: n('mass') };
  }
}

function readAnimationOrThrow(v: unknown, path: string): Animation {
  const o = obj(v, path);
  const viewBox = arr(o.viewBox, `${path}.viewBox`).map((n, i) => num(n, `${path}.viewBox[${i}]`));
  if (viewBox.length !== 4) fail(`${path}.viewBox`, 'expected four numbers');

  const animation: Animation = {
    id: id(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    purpose: oneOf(o.purpose, PURPOSES, `${path}.purpose`),
    viewBox: viewBox as Animation['viewBox'],
    elements: arr(o.elements, `${path}.elements`).map((e, i) =>
      readElement(e, `${path}.elements[${i}]`),
    ),
    states: arr(o.states, `${path}.states`).map((s, i) => readState(s, `${path}.states[${i}]`)),
    sequence: readSequence(o.sequence, `${path}.sequence`),
    trigger: {
      type: oneOf(obj(o.trigger, `${path}.trigger`).type, TRIGGER_TYPES, `${path}.trigger.type`),
    },
    reducedMotion: {
      mode: oneOf(
        obj(o.reducedMotion, `${path}.reducedMotion`).mode,
        REDUCED_MOTION_MODES,
        `${path}.reducedMotion.mode`,
      ),
    },
  };

  const result = validateAnimation(animation);
  if (!result.ok) {
    const first = result.issues[0]!;
    fail(`${path}.${first.path}`, first.message[0]!.toLowerCase() + first.message.slice(1));
  }
  return animation;
}

function readElement(v: unknown, path: string): PreparedElement {
  const o = obj(v, path);
  const s = obj(o.style, `${path}.style`);
  const style: ElementStyle = {
    stroke: paint(s.stroke, `${path}.style.stroke`),
    strokeWidth: num(s.strokeWidth, `${path}.style.strokeWidth`),
    strokeLinecap: oneOf(
      s.strokeLinecap,
      ['butt', 'round', 'square'] as const,
      `${path}.style.strokeLinecap`,
    ),
    strokeLinejoin: oneOf(
      s.strokeLinejoin,
      ['miter', 'round', 'bevel'] as const,
      `${path}.style.strokeLinejoin`,
    ),
    fill: paint(s.fill, `${path}.style.fill`),
  };
  const name = optStr(o.name, `${path}.name`);
  return { id: id(o.id, `${path}.id`), ...(name !== undefined && { name }), style };
}

function readState(v: unknown, path: string): State {
  const o = obj(v, path);
  const label = optStr(o.label, `${path}.label`);
  return {
    id: id(o.id, `${path}.id`),
    ...(label !== undefined && { label }),
    elements: record(o.elements, `${path}.elements`, readElementState),
  };
}

function readElementState(v: unknown, path: string): ElementState {
  const o = obj(v, path);
  const t = obj(o.transform, `${path}.transform`);
  const d = obj(o.draw, `${path}.draw`);
  const n = (from: Record<string, unknown>, key: string, p: string) =>
    num(from[key], `${p}.${key}`);
  return {
    segments: arr(o.segments, `${path}.segments`).map((s, i) =>
      readSegment(s, `${path}.segments[${i}]`),
    ),
    transform: {
      translateX: n(t, 'translateX', `${path}.transform`),
      translateY: n(t, 'translateY', `${path}.transform`),
      rotate: n(t, 'rotate', `${path}.transform`),
      scale: n(t, 'scale', `${path}.transform`),
      originX: n(t, 'originX', `${path}.transform`),
      originY: n(t, 'originY', `${path}.transform`),
    },
    opacity: num(o.opacity, `${path}.opacity`),
    draw: { start: n(d, 'start', `${path}.draw`), end: n(d, 'end', `${path}.draw`) },
  };
}

function readSegment(v: unknown, path: string): Segment {
  const o = obj(v, path);
  const cmd = oneOf(o.cmd, ['M', 'L', 'C', 'Z'] as const, `${path}.cmd`);
  const n = (key: string) => num(o[key], `${path}.${key}`);
  switch (cmd) {
    case 'M':
    case 'L':
      return { cmd, x: n('x'), y: n('y') };
    case 'C':
      return { cmd, x1: n('x1'), y1: n('y1'), x2: n('x2'), y2: n('y2'), x: n('x'), y: n('y') };
    case 'Z':
      return { cmd };
  }
}

function readSequence(v: unknown, path: string): Sequence {
  const o = obj(v, path);
  const sequence: Sequence = {
    steps: arr(o.steps, `${path}.steps`).map((s, i) => readTransition(s, `${path}.steps[${i}]`)),
    repeat: oneOf(o.repeat, ['once', 'loop', 'ping-pong'] as const, `${path}.repeat`),
  };
  if (o.restBetweenLoops !== undefined) {
    sequence.restBetweenLoops = num(o.restBetweenLoops, `${path}.restBetweenLoops`);
  }
  return sequence;
}

function readTransition(v: unknown, path: string): Transition {
  const o = obj(v, path);
  const duration =
    typeof o.duration === 'number'
      ? o.duration
      : { token: str(obj(o.duration, `${path}.duration`).token, `${path}.duration.token`) };
  const transition: Transition = {
    from: id(o.from, `${path}.from`),
    to: id(o.to, `${path}.to`),
    duration,
    easing: readEasing(o.easing, `${path}.easing`),
  };
  if (o.delays !== undefined) transition.delays = record(o.delays, `${path}.delays`, num);
  if (o.stagger !== undefined) transition.stagger = num(o.stagger, `${path}.stagger`);
  return transition;
}

/**
 * Motion tokens: named durations and easings shared by every animation in a project
 * (brief §6). The set of names is fixed; their values are tuned. The default values live
 * in the runtime (`DEFAULT_TOKENS`), which resolves tokens when it plays.
 */
import type { Easing, Project } from './schema';

export type MotionTokens = Project['motionTokens'];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** Sets a duration token, in whole milliseconds from 0 to 5000. */
export function setDurationToken(tokens: MotionTokens, name: string, ms: number): MotionTokens {
  if (!(name in tokens.durations)) throw new Error(`Unknown duration token "${name}"`);
  if (!Number.isFinite(ms)) return tokens;
  return {
    ...tokens,
    durations: { ...tokens.durations, [name]: Math.round(clamp(ms, 0, 5000)) },
  };
}

/**
 * Sets an easing token to a curve or spring of the same kind (a curve stays a curve).
 * Curve x values are kept in 0..1 (so time runs forwards), y values in -1..2; spring
 * values stay positive and within ranges that settle in the runtime's 5 s cap.
 */
export function setEasingToken(tokens: MotionTokens, name: string, easing: Easing): MotionTokens {
  const current = tokens.easings[name];
  if (!current) throw new Error(`Unknown easing token "${name}"`);
  if (easing.type !== current.type || easing.type === 'token') {
    throw new Error(`Easing token "${name}" must stay a ${current.type}`);
  }
  const values = Object.values(easing).filter((v) => typeof v === 'number');
  if (!values.every(Number.isFinite)) return tokens;
  const next: Easing =
    easing.type === 'cubic-bezier'
      ? {
          type: 'cubic-bezier',
          x1: round(clamp(easing.x1, 0, 1), 3),
          y1: round(clamp(easing.y1, -1, 2), 3),
          x2: round(clamp(easing.x2, 0, 1), 3),
          y2: round(clamp(easing.y2, -1, 2), 3),
        }
      : {
          type: 'spring',
          stiffness: round(clamp(easing.stiffness, 1, 2000), 1),
          damping: round(clamp(easing.damping, 1, 200), 1),
          mass: round(clamp(easing.mass, 0.1, 20), 2),
        };
  return { ...tokens, easings: { ...tokens.easings, [name]: next } };
}

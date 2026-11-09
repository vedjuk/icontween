/**
 * IconTween runtime: plays an Animation on an <svg> element.
 *
 * Dependency-free and meant to stay a few KB gzipped (`pnpm --filter @icontween/runtime size`).
 * The editor preview uses this same code, so preview and export behave identically.
 */
export const RUNTIME_VERSION = '0.1.0';

export {
  createPlayer,
  type Clock,
  type Player,
  type PlayerOptions,
  type ReducedMotionPreference,
} from './player';
export {
  cubicBezier,
  linear,
  resolveEasing,
  resolveMotion,
  spring,
  type EasingFunction,
  type Motion,
  type SpringCurve,
} from './easing';
export {
  cloneElementState,
  cloneValues,
  mixElementState,
  mixValues,
  type StateValues,
} from './interpolate';
export { ELEMENT_ATTRIBUTE, toD, toTransform } from './render';
export { DEFAULT_TOKENS, resolveDuration, type MotionTokens } from './tokens';

import type { Easing, Project } from '@icontween/core';

export type MotionTokens = Project['motionTokens'];

/**
 * Default motion tokens. Initial values, to be tuned by hand (brief §17).
 * A project's own tokens replace these per player.
 */
export const DEFAULT_TOKENS: MotionTokens = {
  durations: { fast: 150, base: 250, slow: 400 },
  easings: {
    /** Quick start, long gentle settle. The everyday curve. */
    standard: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
    /** Sharper start, for small immediate feedback. */
    snappy: { type: 'cubic-bezier', x1: 0.3, y1: 0, x2: 0, y2: 1 },
    /** Settles without overshoot (damping ratio ≈ 1), about 0.6 s. */
    'spring-gentle': { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
    /** Quick, with a small overshoot. */
    'spring-snappy': { type: 'spring', stiffness: 400, damping: 28, mass: 1 },
    /** Visible bounce, for delight. Use sparingly. */
    'spring-bouncy': { type: 'spring', stiffness: 300, damping: 14, mass: 1 },
  } satisfies Record<string, Easing>,
};

/** Milliseconds for a transition duration, resolving tokens (unknown → `base`). */
export function resolveDuration(
  duration: number | { token: string },
  tokens: MotionTokens,
): number {
  if (typeof duration === 'number') return duration;
  return tokens.durations[duration.token] ?? tokens.durations.base ?? 250;
}

/**
 * Defaults per purpose (brief §9). Picking a purpose sets these; anything the designer
 * changes afterwards is an override, shown as such. Initial values, to tune by hand.
 * See docs/decisions/010-purpose-tokens-reduced-motion.md.
 */
import type { Easing, Purpose, ReducedMotion, Transition, TriggerType } from './schema';
import type { PatternId } from './sequence';

export interface PurposeDefaults {
  /** Short name, e.g. 'State change'. */
  name: string;
  /** What the motion is for, in a sentence. */
  hint: string;
  trigger: TriggerType;
  /** A duration token. */
  duration: { token: string };
  easing: Easing;
  pattern: PatternId;
  reducedMotion: ReducedMotion['mode'];
}

const token = (name: string): Easing => ({ type: 'token', name });

export const PURPOSE_DEFAULTS: Record<Purpose, PurposeDefaults> = {
  feedback: {
    name: 'Feedback',
    hint: 'Confirms that an action worked, like copied or sent.',
    trigger: 'click',
    duration: { token: 'base' },
    easing: token('snappy'),
    pattern: 'return',
    reducedMotion: 'instant',
  },
  'state-change': {
    name: 'State change',
    hint: 'Shows a switch between two stable states, like play and pause.',
    trigger: 'toggle',
    duration: { token: 'base' },
    easing: token('standard'),
    pattern: 'hold',
    reducedMotion: 'instant',
  },
  attention: {
    name: 'Attention',
    hint: 'Asks for a look once, like a new notification. Use rarely.',
    trigger: 'appear',
    duration: { token: 'slow' },
    easing: token('spring-gentle'),
    pattern: 'return-twice',
    reducedMotion: 'none',
  },
  discoverability: {
    name: 'Discoverability',
    hint: 'Hints at what a control does when the pointer or focus reaches it.',
    trigger: 'hover',
    duration: { token: 'fast' },
    easing: token('standard'),
    pattern: 'hold',
    reducedMotion: 'none',
  },
  delight: {
    name: 'Delight',
    hint: 'A small reward for an action, like a like. Use sparingly.',
    trigger: 'click',
    duration: { token: 'base' },
    easing: token('spring-bouncy'),
    pattern: 'return',
    reducedMotion: 'fade',
  },
};

/** A new step's transition with the purpose's default timing. */
export function purposeTransition(purpose: Purpose, from: string, to: string): Transition {
  const d = PURPOSE_DEFAULTS[purpose];
  return { from, to, duration: { ...d.duration }, easing: { ...d.easing } };
}

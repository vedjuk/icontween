/**
 * The words the editor uses for easings, triggers, reduced motion and patterns. The
 * inspector and the phone viewer share them, so both describe an animation the same way.
 */
import {
  patternTemplates,
  type Easing,
  type ReducedMotion,
  type TriggerType,
} from '@icontween/core';

export const EASINGS: { id: string; label: string; easing: Easing }[] = [
  { id: 'standard', label: 'Standard', easing: { type: 'token', name: 'standard' } },
  { id: 'snappy', label: 'Snappy', easing: { type: 'token', name: 'snappy' } },
  {
    id: 'ease-in-out',
    label: 'Ease in-out',
    easing: { type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  },
  { id: 'linear', label: 'Linear', easing: { type: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 } },
  {
    id: 'spring-gentle',
    label: 'Spring · gentle',
    easing: { type: 'token', name: 'spring-gentle' },
  },
  {
    id: 'spring-snappy',
    label: 'Spring · snappy',
    easing: { type: 'token', name: 'spring-snappy' },
  },
  {
    id: 'spring-bouncy',
    label: 'Spring · bouncy',
    easing: { type: 'token', name: 'spring-bouncy' },
  },
];

export const TRIGGERS: { id: TriggerType; label: string }[] = [
  { id: 'hover', label: 'Hover' },
  { id: 'click', label: 'Click' },
  { id: 'toggle', label: 'Toggle' },
  { id: 'loop', label: 'Loop (while visible)' },
  { id: 'appear', label: 'Appear (once, on screen)' },
];

export const REDUCED_MOTION_LABELS: Record<ReducedMotion['mode'], string> = {
  instant: 'Jump to each state',
  fade: 'Short fade',
  none: 'No motion (stays on A)',
};

export const PATTERN_NAMES = Object.fromEntries(
  patternTemplates(['A', 'B', 'C']).map((t) => [t.id, t.name]),
);

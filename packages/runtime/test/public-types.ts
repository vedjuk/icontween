/**
 * Type test (run by `pnpm typecheck`): the hand-written types shipped with exports
 * (types/icontween.d.ts) must match the runtime's real API and core's data model, both ways.
 */
import type * as Core from '@icontween/core';
import type * as Public from '../types/icontween';
import type * as Runtime from '../src';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const check = <T extends true>() => undefined as unknown as T;

export const types = [
  check<Same<Public.Animation, Core.Animation>>(),
  check<Same<Public.Segment, Core.Segment>>(),
  check<Same<Public.ElementState, Core.ElementState>>(),
  check<Same<Public.Easing, Core.Easing>>(),
  check<Same<Public.TriggerType, Core.TriggerType>>(),
  check<Same<Public.MotionTokens, Core.MotionTokens>>(),
  check<Same<Public.PlayerOptions, Runtime.PlayerOptions>>(),
  check<Same<Public.Player, Runtime.Player>>(),
  check<Same<Public.Clock, Runtime.Clock>>(),
  check<Same<Public.ReducedMotionPreference, Runtime.ReducedMotionPreference>>(),
  check<Same<typeof Public.createPlayer, typeof Runtime.createPlayer>>(),
];
